# Forja — Roadmap y estado

> Last updated: 2026-09-14
> Status: after the full audit session (facet 1–5) + the release work

This file is the handoff for the next session. It says what is done, what is pending, and what is
worth checking. The standard for building screens lives in `docs/ui-standard.md`; `AGENTS.md`
points there.

---

## 1. Done, with the evidence

| Area | What was done | How it is verified |
| --- | --- | --- |
| i18n | Catalogues reconciled (704 = 704 keys), Jest unblocked (AsyncStorage mock + pinned locale), parity test created and later widened to see `t('key', {...})` and template-literal bases | `__tests__/lib/i18n/catalog-parity.test.ts`, 7 tests |
| Layout standard | `components/ui/Screen.tsx` + `ScreenHeader.tsx`, `SafeAreaProvider` declared by the app, the 5 progress screens migrated, `docs/ui-standard.md` written | The simulator (before/after), `docs/ui-standard.md` |
| Security (local) | Every local datum scoped to the authenticated account; 8 tautological ownership filters found and fixed; legacy backfill; local wipe on account deletion; cache cleared on sign-out | `__tests__/lib/db/user-scope.test.ts` + `cross-account-writes.test.ts` (real SQLite), each validated by a negative control |
| Security (Supabase) | Plan SQL aligned with the app (3 tables and several columns were missing), RLS on all 10 tables with 38 policies, RPC `REVOKE`d from PUBLIC, both scripts wrapped in a transaction | **Not executed anywhere** — it has only been parse-checked. Run it in the Supabase SQL editor |
| Data bugs | Notes editing no longer rewrites `completedAt`; the session screen's hook order is unconditional; `useAuth` unblocks on a rejected session; `mostFrequentExercise` counts completed sessions only | `queries-live-fixes.test.ts`, `useAuth.test.ts`, both with negative controls |
| Hygiene | `.bak` (1211 lines), 29 unused imports, 23 dead constants/tokens, 99 dead i18n keys removed; the parity guard now catches more (525 → 562 keys) | Commit `f31106e`, and the missing `session.exerciseCount` it found |
| Visible quality | `QueryState` for loading/failure/empty with retry on 17 screens; contrast brought to AA with role tokens (`text.onAccent`, `errorStrong`); 124 unlabelled interactive elements → 0, plus every TextInput | `QueryState.test.tsx`, `interactive-elements.test.ts`, measured contrast pairs |
| Animations | 1324 exercise GIFs converted to MP4 (122.8 MB → 10.7 MB), bundled so they work offline, no longer dependent on a third-party GitHub repo | `scripts/convert-exercise-gifs.sh`, the guard test, and the APK contents |
| Release | `preview` now increments the version code (root cause of 21 APKs all reporting `versionCode=2`); x86/x86_64 native libs dropped; R8 enabled; releases published | `aapt2`/`apksigner` on the artifact: 145 MB → 93.5 MB → 82.5 MB, certificate unchanged |

Current state: **138 tests green**, `npx tsc --noEmit` clean, working tree clean, nothing unpushed.

---

## 2. Pending — your decision

1. **The 125 MB of exercise GIFs in the repo.** They are the source the MP4s were generated from.
   Keeping them means the repo is ~200 MB to clone; moving them to a separate release/bucket makes
   it ~75 MB. Keep or move?
2. **The 9 dependencies with zero imports.** Careful: `expo-status-bar` and `expo-task-manager` are
   referenced by `app.json`'s plugins, so removing those would break prebuild. The rest
   (`react-native-chart-kit`, `react-native-svg`, `react-native-draggable-flatlist`,
   `expo-auth-session`, `expo-background-fetch`, `expo-crypto`) can go, but they need a
   verification pass first.
3. **The dead-code clusters that have tests covering them** (`lib/progress/compare.ts`,
   `components/ProgressionBubble.tsx`, `lib/utils/progression-mapping.ts`,
   `lib/hooks/useProgressionBubble*.ts` and their 2 suites). They are orphans of a feature that was
   never wired up. Delete them or keep them as the start of that feature?
4. **Plural grammar.** The app has no i18next plurals, so counts read "Hace 1 días". Adopt proper
   plurals and fix them all, or leave it.
5. **`text.muted` (#899199) vs `text.secondary` (#9AA4AE)** now sit close together, so the three
   text levels look similar. Raising `secondary` to ~`#B3BBC3` restores the step.
6. **The two package identifiers**: Android `com.espinoza21.fitnesstracker`, iOS
   `com.espinozar.fitnesstracker`. Decide before any store submission.
7. **The orphan `v1.0.5` tag** (the release was deleted, the tag remains). Remove it or leave it.

---

## 3. Pending — your hands

1. **Test v1.0.7 on the phone** (the R8 pre-release). If it holds up, say so and it gets promoted to
   Latest; if something breaks, revert the R8 commit and rebuild. Checklist is in the release notes.
2. **Run the two SQL scripts in Supabase**, in the order in the file header, then the three control
   queries. Nothing has ever been executed, so the first run is the real verification.
3. **The two-account test** for the isolation work: sign in as A, log something, sign out, sign in as
   B, confirm B sees nothing of A's. It needs a second email account.

---

## 4. Pending — technical, the agent can do it

Ordered by what I would do first.

1. **Observability: there is none.** No Sentry, no Crashlytics, and the local build's `mapping.txt`
   is deleted with EAS's temp directory. A crash on someone else's phone leaves no trace, and R8
   obfuscation makes any stack they could send unreadable. This is the biggest operational hole left.
2. **`deleteSession` runs its three deletes without a transaction** (`lib/db/queries.ts`) — a failure
   between them leaves orphan rows.
3. **Sequential writes in a loop**: `app/routine/[id].tsx:220-230` awaits `createSet` per set, so
   materialising a routine is O(exercises × sets) round trips. The N+1 fix landed for the session and
   home paths but not this one.
4. **The two EN→ES exercise-name maps** (`lib/db/exercise-names-es.ts` and
   `lib/i18n/exercise-translations.ts`) can disagree, so the same exercise can be named differently
   depending on where it is read.
5. **The data migration to Supabase** — the schema and RLS plan exist; the plan for getting 1324
   exercises plus the user's own rows into Postgres does not.
6. **`progress_photos.uri` is a local file URI**, so remote sync needs a Storage bucket and object
   policies before that screen can work across devices.
7. **Ecosystem drift**: `expo-doctor` reports 20 patch-level updates behind;
   `react-native-reanimated@^4.5.1` and `react-native-worklets@^0.10.2` are floating ranges whose
   pairing breaks on a plain `npm install` (reanimated 4.6 wants worklets 0.12), and `.npmrc`'s
   `legacy-peer-deps=true` hides exactly that class of break.
8. **The two `.web.ts` mocks** (`useProgress.web.ts`, `useProgressionBubble.web.ts`) have no account
   guard or key, unlike their native counterparts.
9. **Cosmetic leftovers reported but not fixed**: 6 `fontWeight` without `fontFamily`; the
   `accessibilityHint` and `role="header"` suggestions (deliberately not blanket-added); the
   `!exercise` branch of `exercise-detail` not migrated to `<Screen>`; `session/history/[id].tsx`
   still builds "sets"/"reps" by concatenation; the a11y guard test does not cover `TextInput`.

---

## 5. Worth checking (my own list, not from the audit)

1. **The empty card on the Progreso tab.** It showed up in a simulator screenshot: a card between
   the title and "Sesiones del mes" with nothing in it. Never investigated.
2. **`session.exerciseCount`,** which I added to both catalogues: the key is real but the branch that
   renders it is unreachable today because no caller passes a count. Decide whether to wire it or
   delete the branch.
3. **Whether the app still needs a web target.** `useProgress.web.ts` and
   `useProgressionBubble.web.ts`, plus `react-dom` and `react-native-web`, suggest it was once
   intended; nothing else does.
4. **The `ios/` project is stale** (its Pods are from a different week than `package.json`) and
   `packages/precompile` does not exist, which forces several pods to compile from source. Neither
   blocks anything today, but a fresh iOS build will need the same `rm -rf Pods Podfile.lock` dance
   that the Android side did not.
5. **`jest.config.js`'s `transformIgnorePatterns` still lists `@sentry/react-native`**, a package that
   is not installed — the same "config references something that is not there" shape as the
   `expo-updates` hit knip reported.

---

## 6. How this repo works (for the next session)

- **Gate**: `npx tsc --noEmit` clean and `npx jest` green (138 tests) before anything is called done.
- **Tests that prove things**: every security fix in this session shipped with a negative control —
  reintroduce the bug, watch the test fail, restore it. A test that cannot fail proves nothing.
- **Verify before committing**, and never let a commit depend on a script that can abort before
  making its edits: `set -e` goes first.
- **Facts come from the artifact, not from the config**: the claim that the GIFs were inflating the
  APK was wrong, and one `unzip -l` would have shown it.
- The Engram memory holds the audit facets (`audit/*`), the security work (`security/*`), the layout
  standard (`standard/*`), the animation data (`product/exercise-animations-*`) and the release
  verifications (`release/*`).
