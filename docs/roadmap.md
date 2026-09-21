# Forja — Roadmap y estado

> Last updated: 2026-09-20
> Status: 46 commits ahead of `origin/main`, nothing pushed; fourteen units merged end to end, with a decision list still open

This file is the handoff for the next session. It says what is done, what is pending, and what is
worth checking. The standard for building screens lives in `docs/ui-standard.md`; `AGENTS.md`
points there.

---

## 0. This session (2026-09-20) — read this first

Fourteen units were merged into `main` this session, each one gated by `npx tsc --noEmit` and
`npx jest`. The suite went from **17 suites / 138 tests** on `616a25a` to **25 / 220** here, and the
working tree is clean. Nothing was pushed: `main` is **46 commits ahead of `origin/main`**.

### Landed this session

- **The UX corrections batch, T1–T6.** Modal containment across all 17 modals, the login-error
  honesty fix, the replace-exercise data fix, and the routine-name fix. Detail lives in
  `odd/tasks/ux-corrections-batch.md`.
- **The iOS 27 launch blocker.** The app trapped at launch on iOS 27
  (`UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`). It now adopts the UIKit scene
  lifecycle through `expo-build-properties`' `ios.enableSceneSupport`, verified on iOS 27 and still
  working on iOS 26.5.
- **The branch integration.** The four branches carrying real unmerged work were merged as four
  separate merge commits, after verifying in a throwaway worktree that each one merges cleanly
  against `main` on its own and in sequence, that they do not overlap semantically, and that the
  combined tree passes the gate. `SEC-13`'s password-reset route is no longer stranded.
- **The UI action standard (§9), and its application.** Fourteen text-glyph actions became
  Ionicons; all 27 `<Button>` call sites now choose a variant explicitly; there is one destructive
  fill everywhere, at a measured 5.34:1; fourteen plain and sixteen conditional foregrounds moved
  off `colors.bg.primary` onto `text.onAccent`; and the reference that §9 itself cites carried a
  contrast defect, now fixed. Detail lives in `odd/tasks/ui-action-standard.md`.
- **The superset replace gap.** A paired exercise could not be replaced at all; it can now.

### Pending — what each item needs

#### Needs your decision or your eyes

1. **Push.** `main` is **46 commits ahead of `origin/main`** and nothing has been pushed. This is
   your decision and the single largest outstanding risk: all of this work exists only on this
   machine.
2. **T4's runtime verification.** The replace-exercise fix is merged and gated, but its *data*
   behaviour was never observed: the DB-layer tests mock Drizzle and cannot prove the row outcome. A
   fixture is prepared and waiting on the iPhone 17 Pro simulator — session `24`, where row `35`
   holds three completed sets with weights 35 / 40 / 45. It needs three taps (open the session → the
   `repeat` action on that exercise → pick another exercise), then a look at the rows.
3. **T5's visual.** The exercise-picker images. The data hypothesis is **refuted by measurement**:
   of 1324 exercises, **0 have `original_id` NULL** and **0 rows** of `routine_exercises` /
   `session_exercises` reference one, so the placeholder branch cannot be reached with this data. The
   defect is render-side, and it needs a visual reproduction in the picker.
4. **T7, the offline path.** A product decision. Its premise was corrected this session: a network
   failure does **not** drop the session (`@supabase/auth-js` excludes retryable fetch errors from
   session removal), and with a valid stored session the app does enter its logged-in state offline.
   What remains is a genuinely signed-out user needing a network to get back in.
5. **Deleting the branches.** Seventeen branches exist and every one is contained in `main`.
   Deleting them needs your OK; do not do it on your own.
6. **Obs-06, the app-wide large-text strategy.** The largest remaining piece. Its concrete
   instances, recorded as B2 and B3: the bottom sheets have no bottom inset, and the custom-rest
   dialog is bound-only, so the largest accessibility text sizes can still clip its buttons.

#### Decided — no user input needed

7. **The candidate button conversions.** An audit of three dense files found that only **10 of 29**
   pressables are actually buttons, and that **no conversion is a pure equivalence** — each one moves
   padding, radius, font size or fill. They are *per-site decisions*, not a sweep, with the
   near-equivalent sites named: `app/(tabs)/routines.tsx` 265 / 272 / 320 / 327,
   `app/session/[id].tsx` 743 / 750 / 800, `components/session/SessionExerciseItem.tsx` 556 / 563,
   and 385 as the highest-risk one, because it lives in a gesture slot. **This is not a defect
   list** — the whole point of the audit was that it is not.
8. **B2.** The bottom sheets (`app/(tabs)/routines.tsx`, `app/routine/folder/[id].tsx`) have no
   backdrop press, no `onRequestClose`, and no bottom safe-area inset.
9. **B5.** `signOut` and `deleteAccount` still return raw errors. Nothing leaks today because
   `app/settings.tsx` shows its own copy, but the shape is inconsistent with the auth screens.

### The process note: strict TDD was declared, not run

`.pi/project.json` declares `gentlePi.strictTDD: true`, and **no unit in this session was run under
strict TDD.** Three separate writers reported it as "not activated", because it was never forwarded.
The declaration and the practice disagreed for the whole session. Next session should decide whether
to honour the declaration or change it — but say it plainly: this session ran without strict TDD.

### The measurement scripts were never committed

The scripts that produced the counts quoted in `odd/tasks/ui-action-standard.md` and in this section
lived in a temporary directory and were **not committed**, so those numbers cannot currently be
re-derived from the repository. Either commit a script or stop quoting precise counts.

---

## 0b. Previous session (2026-09-17)

### The lesson: read this file before planning

The security audit in `docs/audits/` is dated 2026-09-13, and section 1 below already records the
per-user isolation as done. Planning from the audit alone made its critical findings look open when
they were not, and it nearly produced a needless design cycle. **Read `docs/roadmap.md` before
turning any audit into work.**

### Closed this session

| Finding | Fix | Commit |
| --- | --- | --- |
| SEC-13 — the password reset could not complete: no route existed for `forja://reset-password`, and the auth gate would have bounced an unauthenticated visitor to login anyway | new route, plus a pure fragment parser in `lib/auth/reset-link.ts` (the project uses Supabase's implicit flow, so the tokens arrive in the URL **fragment**, which expo-router drops), plus a gate exemption by segment | `0707898` |
| SEC-15 — the error boundary rendered the raw stack and the component stack in release | internals gated behind `__DEV__`; release shows one generic i18n string | `5c4e088` |
| SEC-06 — `allowBackup` (Expo's default is **true**) let adb backup / Google Auto Backup extract the unencrypted SQLite | `android.allowBackup: false` | `b82b0b1` |
| SEC-10 — `RECORD_AUDIO` in a shipping app that records no audio | `["expo-image-picker", { "microphonePermission": false }]` | `b82b0b1` |

Also in that batch: `SYSTEM_ALERT_WINDOW` blocked through `android.blockedPermissions`.
**Deliberately NOT blocked:** `CAMERA` and the API<=32 storage permissions — `useProgressPhotos`
calls both `launchCameraAsync` and `launchImageLibraryAsync`, so removing them would break photo
capture. The audit was wrong about those entries.

Useful detail for later: `RECORD_AUDIO` came from no library manifest at all — it is injected by
`expo-image-picker`'s config plugin, which is autolinked even when it is absent from `app.json`'s
`plugins` array. Adding it there is how you pass it options.

### The other branch

`fix/timer-restore-and-exercise-repair`, three commits, each with tests: elapsed time is no longer
dropped when a session is restored with `autoStart` (`7b4e905`); the startup exercise migration no
longer `DELETE`s and re-seeds, which was orphaning `routine_exercises` / `session_exercises` and
destroying user-created exercises (`8ab7ca7`); `.pi/` ignored (`6245cd4`).

### Unresolved — the release keystore

`npx expo prebuild` **clears** `android/` and `ios/` (it prints "Clearing android, ios"); it does not
sync. Both are gitignored, so there is no repo diff, but anything hand-edited inside them is gone.

The newest root APK is signed with certificate SHA-256 `38e23aa3…`, which is **not** the debug
keystore the template regenerates (`FA:C6:17:45…`), so a separate release key existed, and no
`.jks`/`.keystore` is on disk. It is most likely held by EAS: `eas.json` sets no
`credentialsSource: local`, `~/Library/Caches/eas-cli` exists, and the root APK names
(`build-<epoch-ms>.apk`) are EAS local-build output, which regenerates the native project every
build anyway.

**Do this before any release:** run `npx eas credentials` and confirm the Android keystore is still
listed. Losing it means no future update can be published under the same identity.

### Still unverified

1. **The Supabase redirect allowlist must cover `forja://reset-password`.** No repo file can prove
   it. If the dashboard entry is a bare `forja://`, the reset flow is still broken and nothing in
   this session would have revealed it.
2. **The reset link has never been exercised on a device.** The `forja://` scheme does not work in
   Expo Go; it needs a dev build. Cold-start deep-link delivery and `segments[0] === 'reset-password'`
   under expo-router are both untested.

### Housekeeping worth a minute

- **24 APKs, 3.0 GB, in the repo root.** Untracked (`.gitignore` has `*.apk` and `build-*/`), so no
  clone is affected — local disk only, but still 3 GB.
- `docs/audits/`, `odd/` and `.pi/gentle-ai/` are untracked, and nothing is staged by accident.

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

Current state (2026-09-17), per branch:

| Branch | Suite | Notes |
| --- | --- | --- |
| `main` @ `616a25a` | 17 suites / 138 tests | unchanged |
| `fix/timer-restore-and-exercise-repair` | 19 suites / 147 tests | 3 commits, unpushed |
| `fix/security-hardening-batch` | 19 suites / 152 tests | 3 commits, unpushed |

`npx tsc --noEmit` is clean on every branch. The working tree is **not** clean: `docs/audits/`,
`odd/` and `.pi/gentle-ai/` are untracked, and each branch carries its own untracked `odd/tasks/*.md`.
The two branches are split on purpose — together their diffs exceed the 400-line review threshold.

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

- **Gate**: `npx tsc --noEmit` clean and `npx jest` green (25 suites / 220 tests on `main` after this
  session's fourteen units, from 17 / 138 at `616a25a`) before anything is called done.
- **Tests that prove things**: every security fix in this session shipped with a negative control —
  reintroduce the bug, watch the test fail, restore it. A test that cannot fail proves nothing.
- **Verify before committing**, and never let a commit depend on a script that can abort before
  making its edits: `set -e` goes first.
- **Facts come from the artifact, not from the config**: the claim that the GIFs were inflating the
  APK was wrong, and one `unzip -l` would have shown it.
- The Engram memory holds the audit facets (`audit/*`), the security work (`security/*`), the layout
  standard (`standard/*`), the animation data (`product/exercise-animations-*`) and the release
  verifications (`release/*`).
