# Security Audit — Phase 1 of 4

**Date:** 2026-05 (session audit)
**Scope:** Read-only security audit of auth flow, Supabase RLS schema/RPC, secrets handling, local DB user isolation, sensitive data at rest, network, deep linking.
**Method:** Automated read-only exploration agent over the full working tree. No files were modified.
**Severity scale:** CRITICAL / HIGH / MEDIUM / LOW / INFO.

## Executive summary

The app is in unusually good shape for a hobby-grown project: client-side user isolation is implemented consistently and battle-tested, the Supabase RLS script is thorough and correct, and no service-role key or hardcoded secret exists in the repo. The real risks are not authorization bugs but **data-at-rest exposure** (unencrypted SQLite and progress photos), **session-token storage degradation on web/Expo Go**, and a **web-platform isolation gap** where per-user query keys and the mock DB do not enforce account boundaries. No CRITICAL or HIGH code-level vulnerability was found; the highest-impact items are MEDIUM.

## Findings

### MEDIUM

#### M-1. Progress photos and workout data stored unencrypted on device
- **Evidence:** `lib/db/index.ts:12` (`openDatabaseSync('fitness-tracker.db')`), `lib/hooks/useProgressPhotos.ts` (photo `uri` persisted), `lib/db/queries.ts:1838` (`deleteUserLocalData`), `lib/db/schema.ts` (`bodyMeasurements`, `progressPhotos`).
- **Why:** Body measurements and progress photos are stored in plain SQLite and plain files with no encryption at rest. On a rooted/jailbroken device, a device backup, or an ADB/IDE extract of app data, this PII is readable.
- **Fix:** Enable SQLCipher via `expo-sqlite` options or encrypt sensitive columns; store photos in an app-owned directory with OS file-protection and document the at-rest data class.

#### M-2. Supabase session tokens fall back to unencrypted AsyncStorage (web and Expo Go)
- **Evidence:** `lib/supabase.ts:23-34` (SecureStore `require` in `try/catch`, else AsyncStorage), `lib/supabase.ts:36-43` (`persistSession: true`).
- **Why:** On web, SecureStore is unavailable, so Supabase refresh/access tokens land in AsyncStorage → `localStorage`, readable by any XSS. The `try/catch` also degrades *silently* if the native module failed to link.
- **Fix:** On web use a cookie-based/in-memory session or explicitly refuse persistence; log a warning (not just fallback) when SecureStore is unavailable.

#### M-3. Web platform has no verified account isolation (query keys + mock DB)
- **Evidence:** `lib/hooks/useProgress.web.ts:11,27,41` and `lib/hooks/useProgressionBubble.web.ts:11` build query keys **without `userId`**, unlike native `lib/hooks/useProgress.ts:16-202`. `lib/db/index.web.ts:8-16` keeps module-level in-memory tables never cleared on sign-out.
- **Why:** If the web build is ever shipped, account switch / re-render can reuse another account's cached results; the in-memory store is shared across the session. Native is fine; web parity is missing.
- **Fix:** Add `userId` to every `.web.ts` query key and clear/reset the web store on sign-out; or drop the web target.

#### M-4. Progress-photo files reference the image-picker cache, not an app-owned path
- **Evidence:** `lib/hooks/useProgressPhotos.ts` (`launchImageLibraryAsync` / `launchCameraAsync`, URI stored verbatim), `lib/db/queries.ts` (`createProgressPhoto`), `app/progress/measurements.tsx:125-131,392+`.
- **Why:** expo-image-picker returns a URI in the app cache/temp dir. The OS may evict it, leaving DB rows pointing at missing files; `deleteUserLocalData` then reports URIs it cannot delete.
- **Fix:** Copy each picked image into `Paths.document` (app-owned) before persisting and delete from there.

### LOW

#### L-1. Password minimum length is only 6 characters
- **Evidence:** `lib/constants/config.ts:56-58` (`MIN_PASSWORD_LENGTH: 6`), enforced at `app/auth/signup.tsx:41`.
- **Fix:** Raise to 8–12 and align the Supabase Auth password policy in the dashboard.

#### L-2. Raw Supabase auth errors surfaced verbatim (email enumeration)
- **Evidence:** `app/auth/login.tsx:37` (`showAlert(t('common.error'), error.message)`), `app/auth/signup.tsx:52`.
- **Why:** Messages like "Email not confirmed" / "User already registered" reveal whether an address has an account.
- **Fix:** Map auth errors to generic user-facing copy; log details only in `__DEV__`.

#### L-3. React Query cache cleared only on sign-out, not on any user-id change
- **Evidence:** `lib/hooks/useAuth.ts:60-71` clears `queryClient` only when `userId` is null; `applySession` sets a non-null id without clearing.
- **Fix:** In `applySession`, clear the cache whenever `userId` differs from the previous value.

#### L-4. `updateExercise` allows mutating shared library rows
- **Evidence:** `lib/db/queries.ts:195-204` uses `visibleToCurrentUser(exercises.userId)` (shared OR own) for UPDATE.
- **Why:** An account can change the `unit` of a globally shared seeded exercise, affecting other accounts' display.
- **Fix:** Copy-on-write into a custom exercise, or a per-user override table for mutable fields.

#### L-5. `deleteExercise` reference check is not user-scoped
- **Evidence:** `lib/db/queries.ts:206-228` counts `routineExercises` / `sessionExercises` refs globally before deleting, though the delete itself is scoped (`ownedByCurrentUser` at :226).
- **Why:** A user can be blocked from deleting their own exercise because another account references it; the error string leaks global counts.
- **Fix:** Scope the reference counts to the current user's routines/sessions.

#### L-6. `delete_user_account()` RPC: harden `search_path`
- **Evidence:** `scripts/create-delete-account-rpc.sql` (`SECURITY DEFINER`, `SET search_path = public`, unqualified table names).
- **Why:** Classic hijack pattern for SECURITY DEFINER functions (exploitability low here, but it is the recommended hardening).
- **Fix:** `SET search_path = ''` and fully qualify `public.sets`, `public.sessions`, etc.

### INFO

#### I-1. Duplicate sign-in path in the login screen
- `app/auth/login.tsx:35` calls `supabase.auth.signInWithPassword` directly instead of `useAuth().signIn` (`lib/hooks/useAuth.ts:99`). Route the screen through the hook.

#### I-2. Password reset redirect points at an unhandled route
- `app/auth/login.tsx:82-91` (`redirectTo: 'forja://reset-password'`); no `reset-password` route under `app/`. Add the screen and verify the Supabase redirect allowlist.

#### I-3. `backfilledUserId` module flag not reset on sign-out
- `lib/hooks/useAuth.ts:24`, `:45-58`. Harmless today (backfill is idempotent) but latent state coupling. Reset in the signed-out branch.

#### I-4. `expo-image-picker` has no explicit permission-string config
- `app.json:30-65` plugin list omits it. Add the config plugin with explicit `photosPermission` / `cameraPermission` strings and call `requestMediaLibraryPermissionsAsync`.

## What is done WELL (keep doing this)

- **No secrets in the repo.** Only the publishable anon key is used (`lib/supabase.ts:5-6,36`); no `service_role`, no hardcoded JWTs/API keys. `.env` is gitignored; the one script that reads it exits if missing.
- **RLS plan is correct and complete.** All 10 tables have `ENABLE ROW LEVEL SECURITY` (`scripts/supabase-schema.sql:302…561`); per-operation policies with `WITH CHECK`, child tables inherit ownership through `EXISTS` joins, `exercises` correctly split shared-OR-own, no `TO anon` policy (default deny), indexes on RLS columns included.
- **`delete_user_account()` RPC is well-designed** beyond the `search_path` nit: `REVOKE ALL FROM PUBLIC` + grant to authenticated, uid derived from `auth.uid()`, dependency-ordered deletes, refuses to run unauthenticated.
- **Local DB isolation is consistent and tested with real SQL.** Reads scoped via `ownedByCurrentUser`/`visibleToCurrentUser`; every child-table write asserts parent ownership (`lib/db/queries.ts:33-66`). Covered by `__tests__/lib/db/user-scope.test.ts` and `cross-account-writes.test.ts` running the shipped SQL against `node:sqlite`.
- **Fail-closed auth gating.** Root layout gates all routes (`app/_layout.tsx:28-40`); splash held until session resolves; `getSession()` rejection still unblocks and clears scope (pinned by `useAuth.test.ts`).
- **Per-account query keys on native** plus `queryClient.clear()` on sign-out.
- **No third-party data sharing.** No analytics/crash SDKs; only outbound URL is public exercise GIFs from GitHub raw. No `http://` anywhere.
- **SecureStore wired for native tokens** (dependency + plugin).
- **In-app account deletion cleans local data correctly**, including photo files and shared-library preservation.

## Could NOT verify from the repo (check manually)

1. **Live Supabase project state.** `scripts/supabase-schema.sql` is labeled "PLAN, not yet the live source of truth"; the app is auth-only today. Confirm whether schema/RLS/RPC were applied:
   - `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public';`
   - `SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname='public';`
2. **Supabase Auth settings** (dashboard): email confirmation, password policy, rate limits/lockout, JWT expiry, allowed redirect URLs for `forja://reset-password` and the OAuth callback.
3. **`.env` contents / git history for secrets** — verify no service-role value was ever committed (`git log -p -- .env`) and that EAS secrets are set for production.
4. **SecureStore actually loads in release builds** (the silent `try/catch` fallback makes this unobservable from code) — test on a real production build, not Expo Go.
5. **Runtime behavior of the web mock DB** (`lib/db/index.web.ts`) — whether its `where(eq(...))` shim filters correctly and whether state persists across sign-out.
6. **Native file protection / backup settings** (iOS `NSFileProtection`, Android `allowBackup`) — not configured in `app.json`; check the generated native projects.
7. **Git history beyond current HEAD** for leaked secrets.

## Severity tally

CRITICAL: 0 · HIGH: 0 · MEDIUM: 4 · LOW: 6 · INFO: 4

## Recommended fix order

1. M-2 + M-3 (web token storage & web isolation) — before any web shipping or cloud sync enablement.
2. M-4 (photos into app-owned storage) — functional correctness + privacy.
3. M-1 (encryption at rest) — decide scope; may be accepted as a documented trade-off for a v1.
4. L-6 (RPC search_path hardening) — one-line change, apply before running the RPC live.
5. L-1/L-2 (password policy, generic error copy) — quick wins.
6. Remaining LOW/INFO items opportunistically.
