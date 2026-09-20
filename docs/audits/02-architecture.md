# Architecture & Data-Flow Audit — Phase 2 of 4

**Fix status (2026-05):** C1 and C2 are FIXED and review-approved (see `fix log` below). Findings H1, H2, H3 and all MEDIUM/LOW remain open.
- C1 fixed in `lib/db/index.ts`: `repairExerciseMetadata()` now does in-place, id-preserving UPDATEs; `initializeDatabase()` no longer deletes exercises. Covered by `__tests__/lib/db/exercise-metadata-repair.test.ts`.
- C2 fixed in `components/Timer.tsx` + `lib/utils/timer-persistence.ts`: restore now absorbs accumulated elapsed via `computeRestoredElapsed()`. Covered by `__tests__/lib/utils/timer-restore-elapsed.test.ts`.

**Date:** 2026-05 (session audit)
**Scope:** Data flow (screens → hooks → React Query → SQLite), migration chain integrity, FK enforcement, active-session flow, background tasks, React Query hygiene, and migration readiness (local SQLite → Supabase plan).
**Method:** Read-only exploration agent over the full working tree. Phase 1 (security) findings are not repeated; see `01-security.md`.
**Severity scale:** CRITICAL / HIGH / MEDIUM / LOW / INFO.
**Project context:** Phone-only, offline-first today. Supabase used for AUTH ONLY; `scripts/supabase-schema.sql` is a plan, not applied. Full migration deferred until the local architecture is stabilized — so migration readiness is a first-class lens here.

## Executive summary

The local-first core is in better shape than the migration tooling around it: `lib/db/queries.ts` is a disciplined, ownership-guarded data layer, and every React Query key is per-user. But the **drizzle migration folder is disconnected from reality** — the app never runs drizzle migrations (it uses `lib/db/ddl.ts` + ~20 idempotent `ALTER`s), the journal tracks only `0002_faithful_roland_deschain`, `0002_add_exercise_unit` is orphaned, `0003/0004` are unjournaled, and `schema.ts` has columns no migration or snapshot records. Two live behaviours are dangerous on their own: `initializeDatabase()` can **delete every exercise row and re-seed with new ids** (breaking all routine/session references), and the session **Timer loses accumulated elapsed time after an app kill**, so workout durations are recorded wrong. For the future Supabase move, the blockers are structural: integer PKs on both sides (no offline-safe identity), zero soft-deletes/tombstones, zero `updated_at`, and orphaned child rows that FK-less SQLite tolerates today but Postgres will reject on upload.

## Data-flow map

```
app/(tabs)/index.tsx  ────────────────┐
app/(tabs)/routines.tsx               │
app/(tabs)/progress.tsx               │
app/session/[id].tsx  ── SetLogger ───┤   useQuery / useMutation (@tanstack/react-query)
app/session/new.tsx   ── DropSetLogger│   queryKey: ['<entity>', ...ids, userId]
app/session/history/* ─ PartialSet ───┤   onSuccess → queryClient.invalidateQueries(...)
components/session/SessionExerciseItem│
components/session/SupersetComponents │
app/settings.tsx                      │
                                      ▼
                        lib/hooks/*.ts   (cache keys + invalidation only)
                                      │
              ┌───────────────────────┼───────────────────────────┐
              ▼                       ▼                           ▼
   lib/db/queries.ts        lib/progress/queries.ts      lib/hooks/useProgress.ts
   (1 871 lines, all        (session/calendar aggregates) (imports db + schema directly)
    domain reads/writes)
              └───────────────┬───────────────────────────┘
                              ▼
          lib/db/user-scope.ts  (ownedByCurrentUser / visibleToCurrentUser /
                                 routineOwnedByCurrentUser / sessionOwnedByCurrentUser)
                              ▼
              drizzle-orm/expo-sqlite  →  SQLite file "fitness-tracker.db"
                              ▼
   lib/db/schema.ts (types) ── lib/db/ddl.ts (runtime DDL) ── lib/db/index.ts (ALTERs + seeding)
   lib/db/migrations/* (DORMANT — no migrate runner is ever invoked)

   Side channels (not in the React Query graph):
   lib/utils/settings.ts        → AsyncStorage 'app_settings'   (queryKey ['settings'], NOT per-user)
   lib/utils/timer-persistence  → AsyncStorage 'session_timer_state' / 'rest_timer_state'
   lib/hooks/useAuth.ts         → Supabase auth only; mirrors userId into user-scope
```

Table map (screen → primary tables): `sessions` + `session_exercises` + `sets` (session screens) · `routines` + `routine_exercises` + `routine_folders` (routines) · `exercises` + `categories` (library/progress) · `body_measurements` + `progress_photos` (progress).

## Findings

### CRITICAL

#### C1. `initializeDatabase()` can wipe every exercise and re-seed with new ids
- **Evidence:** `lib/db/index.ts:169-195` — when `exerciseCount > 0` and (`sampleBodyPart` empty OR `gifUrl` starts with `assets/exercises/gifs/`), the code runs `await db.delete(exercises)` (`index.ts:187`) with **no ownership filter**, then re-seeds.
- **Why:** (i) user-created custom exercises are deleted; (ii) re-seeded rows get **new** autoincrement ids, and `routine_exercises.exercise_id` / `session_exercises.exercise_id` still point at the deleted ids → every routine and every historical session loses its exercise. If FKs were enforced, the `RESTRICT` would instead make the delete throw and `DatabaseInitializer` (`app/_layout.tsx:120-140`) would show a permanent "database init failed" screen.
- **Fix:** never `DELETE FROM exercises` as a migration. Do a targeted `UPDATE exercises SET gif_url = ... WHERE gif_url LIKE 'assets/exercises/gifs/%'` (keyed on `original_id`), and scope any custom-row operation with `user_id IS NULL AND original_id IS NOT NULL`.

#### C2. Session duration is lost after an app kill while the timer runs
- **Evidence:** `components/Timer.tsx:95-120`. The restore path sets `pausedElapsedRef.current = saved.pausedElapsed` (line 100), then `startTimestampRef.current = now` (line 105), and only afterwards `setElapsed(calculateSessionElapsed(saved))` (line 116) for the first paint. `pausedElapsedRef` never absorbs the already-elapsed time, so the first interval tick calls `recalculateElapsed()` = `pausedElapsedRef (≈0) + (now − restoreTime)` and the display **drops to ~01s**. The persist effect on `[running]` then immediately saves `pausedElapsed: 0` (`Timer.tsx:150-158`), making the loss permanent. `elapsedSeconds` is what is written as `sessions.duration` (`app/session/[id].tsx:325-333`).
- **Fix:** in the `autoStart` branch compute the authoritative elapsed from `saved` first and assign it to `pausedElapsedRef.current` before resetting `startTimestampRef.current`.

### HIGH

#### H1. Drizzle migration chain is desynchronised (5 separate defects)
| Artifact | What is actually there |
|---|---|
| `meta/_journal.json` | 3 entries: `0000_charming_alex_wilder`, `0001_high_the_initiative`, `0002_faithful_roland_deschain` |
| `meta/` snapshots | only `0000`, `0001`, `0002` |
| `0002_add_exercise_unit.sql` | **orphaned** — no journal entry, no snapshot, duplicates `unit` which `0002_snapshot.json` already records |
| `0002_faithful_roland_deschain.sql` | adds `equipment/target_muscle/...` columns but **not** `unit`, `method`, `drop_order`, `is_drop_group`, `rir`, `note_type`, `superset_pair_id`, which its own snapshot claims |
| `0003_add_drop_sets.sql`, `0004_add_rir.sql` | hand-written, unjournaled, no snapshots; their columns are already in `0002_snapshot.json` |

Additionally `schema.ts` contains `user_id`, `exercises.name_es`, `exercises.description_es`, `session_exercises.note_type` — none of which appear in any snapshot or migration; they exist only because of the ad-hoc `ALTER`s at `lib/db/index.ts:71-166`.
- **Why:** the next `drizzle-kit generate` derives the next index from the journal (→ `0003_*`) and would collide with the hand-written `0003_add_drop_sets.sql` while emitting a snapshot that keeps drifting. There is no artifact that can rebuild the current DB.
- **Real chain today:** `CREATE_TABLES_SQL` (`lib/db/ddl.ts`) + the idempotent `ALTER` list in `lib/db/index.ts` + JSON seeding. `drizzle-kit` is effectively a code generator only.
- **Fix:** pick one. (a) declare the drizzle folder dead, archive it under `lib/db/migrations_legacy/`, and document `ddl.ts` as the source of truth; or (b) rebuild the chain: delete the orphan, run `drizzle-kit generate` once from current `schema.ts` to produce a single squashed `0000` baseline, and actually invoke the migrator. Do not leave both paths half-alive.

#### H2. Foreign keys are declared but never enforced; deletes leave orphans
- **Evidence:** no code anywhere enables FK enforcement (`grep "PRAGMA"` over `lib/**` → 0 hits). SQLite's default is `foreign_keys = OFF`, so the `ON DELETE CASCADE / SET NULL / RESTRICT` clauses in `lib/db/ddl.ts` are decorative at runtime. The code compensates in some places but not all:
  - `deleteSession` (`lib/db/queries.ts:497-513`) and `deleteUserLocalData` (`queries.ts:1817+`) delete children explicitly — correct.
  - `deleteSessionExercise` (`queries.ts:614`) deletes **only** the `session_exercises` row → its `sets` become orphans. Same for `handleDeleteSuperSet`.
  - `deleteRoutine` (`queries.ts:269`) deletes **only** the routine → `routine_exercises` rows are orphaned.
  - `deleteFolder` (`queries.ts:149`) relies on `ON DELETE SET NULL` → routines keep a dangling `folder_id`.
- **Why:** orphans are invisible locally (every read joins through the parent) but they are **real rows that will be uploaded**. In Postgres the FKs *are* enforced, so `sets.session_exercise_id → session_exercises` will raise an FK violation and abort the import.
- **Fix:** enable FKs at open time (`PRAGMA foreign_keys = ON` in `lib/db/index.ts` before DDL) — then re-test flows that relied on "not enforced", **and** add the missing child deletes in `deleteSessionExercise`/`deleteRoutine`, because the pragma alone would make some current deletes throw.

#### H3. No offline-safe identity, no `updated_at`, no tombstones (migration blocker)
- **Evidence:** local PKs are `INTEGER PRIMARY KEY AUTOINCREMENT` (`ddl.ts`); the Supabase plan uses `SERIAL PRIMARY KEY` — integers, **not** UUIDs. Two devices offline both mint `routines.id = 5`; whichever syncs second overwrites or collides. No table has `updated_at`, so there is no last-write-wins clock and no incremental "changed since" query. All deletes are hard deletes, so a pull-based sync will resurrect deleted rows from the other device or from the server.
- **Fix (before writing any sync code):** add to every synced table a client-generated `uuid TEXT NOT NULL UNIQUE` (or `sync_id`) plus `updated_at INTEGER NOT NULL` and `deleted_at INTEGER` (tombstone). Keep the integer id purely local. Exercise references should also carry `original_id` so they survive an id remap.

### MEDIUM

#### M1. Optimistic cache writes target keys that no query reads (dead optimistic updates + cache pollution)
- `app/session/[id].tsx:241,247,261,266` write to `['sessions', sessionId, 'exercises']`, but the reader is `useSessionExercises` with `['sessions', sessionId, 'exercises', userId]` (`lib/hooks/useSessions.ts:64`). `setQueryData` requires an **exact** key match → the reorder/replace optimistic write and its rollback are no-ops.
- `components/session/SessionExerciseItem.tsx:272` uses `['sets', seId]` while the reader is `useSets` → `['sets', sessionExerciseId, userId]` (`lib/hooks/useSets.ts:21`). So `previousSets` is `undefined` and the rollback never fires.
- **Fix:** read `userId` from `useCurrentUserId()` and build the same key the hook uses (or export a key-builder from the hook module).

#### M2. Nothing prevents starting a second session while one is active
- **Evidence:** `app/(tabs)/index.tsx` renders `ActiveSessionBar` but the start handlers never check `useActiveSession()`. `getActiveSession` (`lib/db/queries.ts:437-446`) returns only the *latest* uncompleted session, so an earlier in-progress session becomes permanently invisible to the resume bar while still appearing in "Recent Sessions".
- **Fix:** block session creation (or offer "finish/discard the current one") when `activeSession != null`; exclude or label `completed_at IS NULL` rows in the home recent-sessions list.

#### M3. Per-keystroke mutations with no serialisation (last-write-wins by completion order)
- **Evidence:** `components/SetLogger.tsx:52-67` calls `onUpdate` on every `onChangeText`; `handleUpdateSet` (`SessionExerciseItem.tsx:141-175`) awaits `updateSet.mutateAsync` per keystroke. TanStack Query runs mutations in parallel by default, so typing "12" can land `reps = 12` then `reps = 1` depending on which SQLite statement completes last.
- **Fix:** debounce the write (300–500 ms) and/or pass `scope: { id: 'set-' + set.id }` to serialise mutations for the same row.

#### M4. Unsaved drop-set drafts are lost on kill / on End Session
- **Evidence:** drop drafts live in component state `dropSetDrafts` (`SessionExerciseItem.tsx:96`), persisted only by `handleSaveDropSet` (on `onCompleteAll` or set switch). Killing the app or tapping "End" with an open editor discards the drops. The parent set's `method`/`isDropGroup` were already written, leaving the row half-converted.
- **Fix:** persist drafts on change (or autosave on blur/background), and/or clear `method` when a draft edit is abandoned.

#### M5. Per-exercise `unit` edits on the shared library can never sync
- **Evidence:** `updateExercise` is scoped by `visibleToCurrentUser` (`lib/db/queries.ts:196-206`, includes seeded rows), and `handleUnitChange` writes `unit` on exactly those rows (`SessionExerciseItem.tsx:180-188`). The plan's RLS `exercises_update_own` (`USING user_id = auth.uid()`) matches zero shared rows → the local edit is silently unsyncable.
- **Fix:** store the per-user unit preference in a user-owned table (`exercise_preferences`), or make `exercises.unit` shared/immutable and move the override local-only with an explicit documented decision.

#### M6. Completing a session `push`es history, so Back re-enters the finished session
- **Evidence:** `app/session/[id].tsx:332` — `completeSessionAndNavigate` does `router.push(...)`. The session screen stays on the stack; pressing Back returns to it. Also inconsistent: hardware back is guarded with a three-option dialog (`app/session/[id].tsx:190-215`) but the on-screen "←" calls `router.back()` with no confirmation.
- **Fix:** `router.replace` for the history transition; reuse the confirm dialog for the header back button.

#### M7. Incomplete / asymmetric cache invalidation
- Set mutations (`lib/hooks/useSets.ts:43-46,64-67,87-90,109-112,131-134,152-155`) invalidate `['sets', seId]`, `['exercises','maxWeight']` and `['progress']`, but **not** `['exercises','lastWorkout'|'lastWeight'|'lastReps'|'lastRir']` nor `['sessions','lastForRoutine'|'lastSetsPerExercise'|'lastNotes']`. With tab screens kept mounted, the Home "last workout" preview can keep showing pre-session numbers.
- Home pull-to-refresh (`app/(tabs)/index.tsx:57-59`) invalidates only `sessions`, `routines`, `globalStats`.
- **Fix:** centralise an invalidation helper per domain (e.g. `invalidateSessionData(qc, sessionId)` that also hits `['exercises']` and `['sessions', …]`).

#### M8. QueryClient has no defaults; `retry: 3` on local SQLite
- **Evidence:** `app/_layout.tsx:18` — `new QueryClient()` with no `defaultOptions`: `staleTime: 0`, `retry: 3`. Every screen mount refetches everything; a deterministic SQLite error is retried three times before the error UI appears. `useActiveSession` additionally polls forever (`useSessions.ts:57`, `refetchInterval: 60000`).
- **Fix:** `defaultOptions.queries = { staleTime: 30_000, retry: (n, e) => isTransient(e) && n < 2 }`; review the 60 s poll.

#### M9. Unhandled promise rejections from `mutateAsync` without a catch
- **Evidence:** several call sites await `mutateAsync` without `try/catch`: `handleSetRestTime` (`SessionExerciseItem.tsx:167-170`), `handleUnitChange` (180-188), `updateNotes.mutateAsync` (~line 430), and `onUpdate` handlers passed to `PartialSetLogger`/`DropSetLogger`. The hooks have `onError: mutationErrorHandler(...)`, so the alert fires, but the rejection is still unhandled.
- **Fix:** standardise — either `void x.mutate(...)` (fire-and-forget) or wrap in `try/catch`.

### LOW

- **L1.** `app/session/new.tsx:31-37` returns before its hooks (the exact hazard `app/session/[id].tsx:277-297` documents and avoids). Move the guard below all hooks.
- **L2.** Password-reset deep link `forja://reset-password` has no route. (Dup of Phase-1 I-2.)
- **L3.** Two data-access layers: `lib/hooks/useProgress.ts` and `lib/progress/queries.ts` import `db`/`schema` directly, bypassing `lib/db/queries.ts`; `useProgress.ts` also duplicates aggregate SQL that exists in `queries.ts`.
- **L4.** Web mock DB diverges from native (4 hard-coded categories, `nextId = 100`). Harmless while phone-only.
- **L5.** `order` is 0-based in `app/(tabs)/index.tsx:96-101` but 1-based everywhere else; `applyRoutineUpsync` (`app/session/[id].tsx:449-465`) copies it straight into `routine_exercises.order`.

### INFO

- **I1.** `expo-background-fetch` and `expo-task-manager` are installed but unused (0 hits for `defineTask|registerTaskAsync|BackgroundFetch.|TaskManager.`). Only real background behaviour is `expo-notifications` in `RestTimer` plus `AppState` listeners.
- **I2.** Rest-timer notification ID is in-memory only (`RestTimer.tsx:88`); after an app restart a previously scheduled OS notification cannot be cancelled → ghost rest-timer alerts. Persist the notification id alongside the rest-timer state.
- **I3.** `Notifications.setNotificationHandler` is called at module import time (`RestTimer.tsx:17-24`), so the handler only exists if the session screen was loaded.

## Migration readiness (local SQLite → Supabase)

Reference: `lib/db/schema.ts` + `lib/db/ddl.ts` vs `scripts/supabase-schema.sql` (plan, not applied).

| # | Criterion | Status | Gap |
|---|---|---|---|
| a | Primary-key types | **NEEDS WORK** | Local `INTEGER AUTOINCREMENT` vs plan `SERIAL` — both integers, offline-created rows on two devices collide. `user_id` is `UUID` server / `TEXT` local — an unmentioned coercion. |
| b | `created_at` / `updated_at` | **NEEDS WORK** | `created_at` missing on `routine_exercises`, `session_exercises`; `updated_at` exists on **zero** tables. Server `TIMESTAMPTZ` vs local unix-seconds `INTEGER` — conversion needed everywhere. |
| c | Soft deletes / tombstones | **MISSING** | Every delete is a hard `db.delete(...)` → a naive sync resurrects deleted rows. |
| d | `user_id` coverage | **MOSTLY READY** | Present on all user-owned tables; inherited correctly on children (plan's RLS mirrors this). Caveat: `claimLegacyRows` can leave `user_id IS NULL` until first sign-in. |
| e | Shared / seeded data | **NEEDS WORK** | Plan seeds admin-side with `original_id UNIQUE`; local seeds at runtime from JSON with autoincrement ids. Parity "probably" holds today but is fragile: re-running the SQL import shifts every subsequent `SERIAL` id; nothing in the app enforces or checks parity. |
| f | Local-only state with no server home | **NEEDS DECISION** | `app_settings` (device-scoped), `session_timer_state`/`rest_timer_state` (keyed by local integer session id — an id remap binds stale state to a different row), `progress_photos.uri` (`file://` URI, no Storage bucket), `backfilledUserId`, NULL-`user_id` epochs. |

### Concrete pre-migration schema changes (do these BEFORE writing any sync code)

1. **Identity.** Add `uuid TEXT NOT NULL UNIQUE` (client-generated via `expo-crypto`) to `routines`, `routine_folders`, `sessions`, `session_exercises`, `sets`, `routine_exercises`, `body_measurements`, `progress_photos`, and user-created `exercises`. Keep integer ids local; use `uuid` (and `original_id` for seeded exercises) as the cross-system key.
2. **Versioning.** Add `updated_at INTEGER NOT NULL` to every synced table, set on every mutation (shared `now()` in `queries.ts`). Plan a seconds↔timestamptz conversion in the mapper.
3. **Tombstones.** Add `deleted_at INTEGER`; convert deletes to soft deletes (or a `sync_tombstones` table). Include a retention/purge policy.
4. **Deletions that stay hard.** Keep `deleteUserLocalData` hard, but write the tombstone for account deletion so the server honours it.
5. **Fix child integrity first.** Enable `PRAGMA foreign_keys = ON`, add the missing child deletes (`deleteSessionExercise`, `deleteRoutine`), and run a one-time orphan-reconciliation query before any upload — otherwise the Postgres import fails on FK violations.
6. **Exercise identity.** Freeze `exercises.original_id` as the migration key; add a startup assertion that every seeded row has `original_id NOT NULL` and that the local id ↔ `original_id` map matches the server.
7. **`exercises.user_id` semantics.** Document `NULL = shared/immutable`. Move the per-exercise `unit` override off the shared row (M5) or add a user-owned override table.
8. **`routine_exercises` / `session_exercises` `created_at`.** Add now so server rows get a real creation time instead of upload time.
9. **`progress_photos`.** Decide the Storage bucket + path convention (`{user_id}/{uuid}.jpg`); store both local URI and remote path.
10. **Settings / timer persistence.** Decide explicitly whether `app_settings` syncs; change persisted timer state to store the session `uuid`, not the local integer id string.
11. **Timestamp storage.** Standardise one integer convention and map in one place, or plan an explicit seconds→`TIMESTAMPTZ` conversion.
12. **`secondary_muscles`.** Stored as a JSON string locally; the SQL import uses `::jsonb` cast into `TEXT` (encoding mismatch with `JSON.stringify`); never read anywhere. Drop it from the sync or standardise.

## Things done well

- **Ownership enforced at the data layer, not the UI.** `lib/db/user-scope.ts` centralises scoping; write paths additionally assert parent ownership (`queries.ts:26-60`).
- **Every query key is per-user.** `useCurrentUserId` re-keys every cache on account change; `useAuth` clears the query client on sign-out.
- **Auth fails closed and unblocks.** `getSession()` rejection → `applySession(null)`; no infinite splash.
- **Documented non-obvious decisions** (non-unique index rationale, `coalesce` first-completion-date-wins, `updateSessionNotes` avoiding `completed_at`).
- **The Supabase plan mirrors the app's FK semantics with explanatory comments**, and its RLS is per-operation with `WITH CHECK`.
- **Rest timer design** (clean restart via `restartKey`, no notification-cancel race, channel before permission prompt, interval cleared on unmount).
- **`QueryState` unifies loading/error/empty** so a query failure can't read as "not found".
- **Tests cover the risky invariants** (user-scope, cross-account writes, routine-session counts, progression, live fixes).

## Could not be verified statically

1. Runtime value of `PRAGMA foreign_keys` (needs `SELECT * FROM pragma_foreign_keys;` on device).
2. Whether the local DB already contains orphans (e.g. `SELECT COUNT(*) FROM sets WHERE session_exercise_id NOT IN (SELECT id FROM session_exercises)`).
3. Whether local exercise ids actually equal the remote `SERIAL` ids (parity depends on an ordered, un-retried import).
4. JSON array order vs SQL insert order beyond the first rows (1.5 MB single-line file).
5. Real device behaviour on app kill (C2 is a code-path reading, verified by control flow).
6. Whether scheduled notifications survive an app restart in a cancellable way.
7. Background-fetch registration (zero code found; cannot rule out native-side registration, though none exists in the repo).
8. Whether the predicted `drizzle-kit generate` collision actually happens (depends on drizzle-kit 0.31.x naming).

## Severity tally

CRITICAL: 2 · HIGH: 3 · MEDIUM: 9 · LOW: 5 · INFO: 3

## Recommended fix order

1. **C1** (exercise wipe in `initializeDatabase`) — data-loss bug, highest priority.
2. **C2** (timer loss on app kill) — wrong `sessions.duration` data, permanent.
3. **H2** (enable FKs + add missing child deletes) — prerequisite for any upload.
4. **H1** (pick one migration story; archive or rebuild the drizzle folder) — removes the trap for future-you.
5. **M1/M3/M9** (query-key mismatch, keystroke mutation races, unhandled rejections) — same area, fix together in the session logging flow.
6. **H3 + migration checklist items 1-3** — only when starting the Supabase migration work proper; no need to rush now.
7. Remaining MEDIUM/LOW opportunistically.
