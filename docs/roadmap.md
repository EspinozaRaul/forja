# Forja — Roadmap y estado

> Last updated: 2026-10-03
> Status: `origin/main` is at `af8c436`; the 2026-09-20 session's fourteen units, the six-unit technical batch and the second eight-unit technical batch are all in `main`, and the database-integrity work is published as **PR #1** and not yet merged, with a decision list still open

This file is the handoff for the next session. It says what is done, what is pending, and what is
worth checking. The standard for building screens lives in `docs/ui-standard.md`; `AGENTS.md`
points there.

---

## 0. This session (2026-09-20) — read this first

Fourteen units were merged into `main` this session, each one gated by `npx tsc --noEmit` and
`npx jest`. The suite went from **17 suites / 138 tests** on `616a25a` to **25 / 220** here, and the
working tree is clean.

**Delivery status, updated 2026-09-21.** All of it is now pushed. `main` went `616a25a..79df39e`
(this session's fourteen units plus the handoff), then `79df39e..30a7e89`, which lands
`fix/technical-defects-batch` as **six units**: `deleteSession` atomicity, the routine
materialisation fan-out, the EN→ES seed, the web hook account guard, the sign-out error shape, and
the three bottom sheets. `origin/main` is at `30a7e89`.

**Delivery status, updated 2026-09-24.** `main` then went `30a7e89..893eda8` (merge commit dated
2026-09-21 22:47), which lands
`fix/technical-defects-batch-2` as **eight units**: the living documents corrected against a
committed measurement script, the superset delete made atomic, the custom-rest dialog unclipped,
the typography and the last counted nouns, the fourteen header-hidden screens given a real
container, the dead `session.exerciseCount` deleted, the Jest allow-list pruned, and the three ASCII
arrows turned into Ionicons. `origin/main` reached `893eda8` there, the tree was clean, and the gate on
it is `npx tsc --noEmit` exit 0 with `npx jest` **36 suites / 347 tests** (from 29 / 271). That batch's
branch was deleted.

**Delivery status, updated 2026-09-27.** The docs refresh that follows `893eda8` is `af8c436`, and that is
where `origin/main` is now. The database-integrity work — N1's inert cascades and N2's five non-atomic
transactions, plus the harness-fidelity follow-up and a version-gated startup cleanup — is published as
**PR #1** (`fix/db-integrity-foreign-keys`) and is **not merged**; merging it is the user's
decision. Its own gate is `npx tsc --noEmit` exit 0 with `npx jest` **39 suites / 374 tests**.

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

1. **Push.** Done: `main` was pushed through `30a7e89` — `616a25a..79df39e`, then
   `79df39e..30a7e89` (see the delivery status above). No longer outstanding.
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
   What remains is a genuinely signed-out user needing a network to get back in. **It now has a real
   case, measured on 2026-09-22 — see "The T7 case" below.**
5. **Deleting the branches.** Done, and needs nothing: `origin` carries exactly two branches now — `main`
   and `fix/db-integrity-foreign-keys`, the latter being PR #1. Verified with `git ls-remote --heads origin`.
6. **Obs-06, the app-wide large-text strategy.** The largest remaining piece. Of its two recorded
   instances, **B3 is closed** — the custom-rest dialog was unclipped in `a64bca9`. It already
   carried `maxHeight`; what it actually needed was a scrollable body, its `width: 280` literal
   replaced by `100%` / `MODAL.MAX_WIDTH`, and an `onRequestClose`. **B2 remains**: the bottom sheets
   (`app/(tabs)/routines.tsx`, `app/routine/folder/[id].tsx`) have no backdrop press, no
   `onRequestClose` and no bottom safe-area inset.

#### Decided — no user input needed

7. **The candidate button conversions.** An audit of three dense files found that only **10 of 33**
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

### The T7 case: your brother's phone (2026-09-22)

T7 stopped being hypothetical. Your brother cannot sign in, and the diagnosis is **his phone's
network — not the app, and not the backend**.

The evidence, in order:

- The screenshot from his phone reads `fetch failed: java.net.ConnectException: Failed to connect to
  tvhirldahraymahvthfq.supabase.co/172.64.149.246:443`. That is a **TCP connect failure**, so the
  request never left the device — which is why "the emails were never registered": the signup never
  reached the server. No confirmation-email flow and no `auth.users` trigger is involved.
- `dig +short tvhirldahraymahvthfq.supabase.co` → `172.64.149.246`, `104.18.38.10` (Cloudflare) —
  the same IP his phone reports, and it resolves from the Mac.
- `curl https://tvhirldahraymahvthfq.supabase.co/auth/v1/health` → **HTTP 401**
  `{"message":"No API key found in request"}`. That is the Supabase gateway answering normally: the
  project is alive, not paused, not deleted.
- `scripts/supabase-schema.sql` declares **no `CREATE TRIGGER` on `auth.users`** and no
  `handle_new_user`, so signup does not depend on a trigger that could fail.

Ordered hypotheses, all on his side: an **IPv6-only mobile network with NAT64** (the error shows an
IPv4 and the TCP dies — it fits exactly), a **VPN / Private DNS / ad-blocker** intercepting
`*.supabase.co` (ad-blockers block "cloud" domains heuristically), or a **carrier block** of those
Cloudflare IPs.

**What he needs to do — one check, then act.** Open
`https://tvhirldahraymahvthfq.supabase.co/auth/v1/health` in his phone's browser. If it loads, his
network is fine and the problem is the app on that device; if it does not load, it is his network.
Then: switch Wi-Fi ↔ mobile data, and turn off VPN / Private DNS / blockers.

**Do not clear the app's data and do not reinstall.** His history lives only on that phone; there is
no Supabase data migration. A new APK would not have fixed this either.

One upside: it confirms T3 earned its cost. The raw text he saw — a Java `ConnectException` with a
bare IP — is literally the string that motivated T3, and `main` already classifies it.

### The process note: strict TDD was declared, not run

`.pi/project.json` declares `gentlePi.strictTDD: true`, and **no unit in this session was run under
strict TDD.** Three separate writers reported it as "not activated", because it was never forwarded.
The declaration and the practice disagreed for the whole session. Next session should decide whether
to honour the declaration or change it — but say it plainly: this session ran without strict TDD.

**Decided 2026-09-21: honour it.** Strict TDD — mode, source and the exact runner — was forwarded on
every delegation in the two technical batches that followed, and each unit that could not have a
meaningful pre-implementation test declares that exception by name. The declaration and the practice
now agree.

### The measurement scripts are committed now

**Resolved.** The counts quoted in `odd/tasks/ui-action-standard.md`, in `docs/ui-standard.md` and in
this section are now produced by `scripts/ui-metrics.js` (Node stdlib only, no dependencies), and
`__tests__/lib/metrics.test.ts` parses the machine-readable `ui-metrics` block out of
`docs/ui-standard.md` and **fails if any quoted number drifts from the measurement**. Re-derive them
with `node scripts/ui-metrics.js`. Three invariants are asserted next to the counts:
`buttonVariants === buttonCallsites`, `glyphActions` and `glyphAsciiCandidates` both `0`, and
`unlabelledInteractive === 0`.

Be precise about what this repaired: it covers the UI counts that were moved into the script. The
one-off audit scripts of 2026-09-20 are still lost, and any count in this document that did **not**
move into `scripts/ui-metrics.js` remains unverifiable. Do not read this as a general amnesty.

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

### Resolved — the release keystore, verified against the artifacts (2026-09-22)

**The identity is intact, and it has been a single one from the first APK to the last release.**
Verified by measurement, not by reading this file:

- `npx eas-cli@latest credentials` → Android → `production`: the **Default** keystore (`Z9ixc4KUGH`)
  exists, is a JKS, is EAS-managed, with
  `SHA256 = 38:E2:3A:A3:19:12:45:77:35:A0:CC:32:24:91:90:01:CD:54:6D:87:01:B5:B5:85:62:8A:45:43:E0:A5:50:98`.
- `apksigner verify --print-certs` over **all 24 local APKs** (3/8 → 13/9): every single one reports
  `38e23aa3…`. Not one carries a different key.
- `gh release list` plus the GitHub API: each published asset matches its root file's `sha256`
  exactly (v1.0.7 `3116c29aa556fada…`, v1.0.6 `28748fda228083bd…`, v1.0.4 `81a43ec725b64d5c…`), so
  they are bit-for-bit the files that were measured.

**A second, orphan keystore exists.** `Configuration: Build Credentials tlXYEF09-q`, SHA256
`CD:9B:C2:5F:DC:4C:0F:4C:35:01:06:4F:CE:E4:E4:63:95:5B:9B:26:DC:02:F4:16:77:55:58:15:55:76:F9:5C`,
updated around 14/9. It signed **no** local APK and **no** published release — most likely generated
by mistake with "Generate new keystore". **Decision: touch nothing.** The `(Default)` marker means
`production` still resolves to the right one, and deleting credentials is destructive with no rush.

**Two traps worth keeping from this verification.** The command this section used to give was wrong:
`npx eas` fails with `npm error could not determine executable to run`, because an unrelated npm
package named `eas` (0.1.0) shadows it and ships no binary — the CLI is
**`npx eas-cli@latest credentials`**. And the APKs are signed v2/v3 only, so
`keytool -printcert -jarfile` sees nothing; use `apksigner`.

**Before the first Play submission:** confirm which configuration the profile resolves, and only
then decide about the orphan.

Still true and unrelated to the keystore: `npx expo prebuild` **clears** `android/` and `ios/` (it
prints "Clearing android, ios"); it does not sync. Both are gitignored, so there is no repo diff, but
anything hand-edited inside them is gone.

### Resolved — v1.0.7 (the R8 pre-release) breaks on the device (2026-09-29)

**The device test that item 1 of "Pending — your hands" asked for came back negative: v1.0.7
installs and then shows the database-failure screen, so the app never reaches a screen.** The build
under test is the published one, identified against this file's own recorded hash instead of by
filename:

- `build-1789353271236.apk` →
  `sha256 = 3116c29aa556fada55adb9391db0e49808c1881929c31e053f8be9858e6b96e2`, the v1.0.7 asset hash
  recorded in the keystore section above. `aapt2` reports `versionCode 5`, `versionName 1.0.7`,
  82.4 MiB — the 82.5 MB of the release table.
- The JS is **not** the variable: `assets/index.android.bundle` is byte-identical in v1.0.6
  (`build-1789352343523.apk`) and v1.0.7 —
  `sha256 = 23898b93f64fd3e50ab0d7f63fb2455da204bff7c0c5a3ae9e36688e2d670d01` in both. Between those two
  commits only `app.json` changed: `fa73a99` added `enableMinifyInReleaseBuilds` +
  `enableShrinkResourcesInReleaseBuilds`.
- So the regression sits in the R8-minified native layer. **The exact break is still unproven**:
  neither the device's `logcat` nor the R8 `mapping.txt` exists (section 4 already records that the
  mapping dies with EAS's temp directory), and no emulator is installed locally to reproduce it.

**Response, following the pre-recorded decision in item 1: the R8 commit is reverted.** `app.json`
drops both flags and `expo.version` goes 1.0.7 → 1.0.8. `android/gradle.properties` was flipped to
`false` by hand as well, because a stale generated copy would otherwise keep R8 on for a local
`./gradlew assembleRelease`.

**Still unverified:** whether v1.0.8 starts on the phone. If it does, R8 is confirmed and the flags
stay off until someone adds keep rules and re-verifies on a device. If it does not, the fault is the
database the phone already has rather than the build, and the next step is `logcat` on the device.

**Found while diagnosing it, and closed with it:** that failure screen styled itself with
`className`, which is inert in this app — no `babel.config.js` and no `metro.config.js`, so NativeWind
never reaches the bundle (`react-native-css-interop` appears 0 times in the exported bundle against
3534 `node_modules` paths). The message rendered at the top-left, on the Android window background,
under the status bar. The screen is now `<Screen>` + `<EmptyState>` over the token layer, the failure
is logged in every build instead of only under `__DEV__` (with a test whose negative control fails
when the guard comes back), and `docs/ui-standard.md` §4 names the trap. **Still open:** the other 25
`className` props in 8 files are dead and remain backlog.

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
| Security (Supabase) | Plan SQL aligned with the app (3 tables and several columns were missing), RLS on all 10 tables with **37** policies, RPC `REVOKE`d from PUBLIC, and the schema and the RPC wrapped in a transaction — the seed script is not, it is 1330 lines of autocommitted `INSERT`s | **Not executed anywhere** — it has only been parse-checked. Run it in the Supabase SQL editor |
| Data bugs | Notes editing no longer rewrites `completedAt`; the session screen's hook order is unconditional; `useAuth` unblocks on a rejected session; `mostFrequentExercise` counts completed sessions only | `queries-live-fixes.test.ts`, `useAuth.test.ts`, both with negative controls |
| Hygiene | `.bak` (1211 lines), 29 unused imports, 23 dead constants/tokens, 99 dead i18n keys removed; the parity guard now catches more (525 → 562 keys) | Commit `f31106e`, and the missing `session.exerciseCount` it found |
| Visible quality | `QueryState` for loading/failure/empty with retry on 17 screens; contrast brought to AA with role tokens (`text.onAccent`, `errorStrong`); 124 unlabelled interactive elements → 0, plus every TextInput | `QueryState.test.tsx`, `interactive-elements.test.ts`, measured contrast pairs |
| Animations | 1324 exercise GIFs converted to MP4 (122.8 MB → 10.7 MB), bundled so they work offline, no longer dependent on a third-party GitHub repo | `scripts/convert-exercise-gifs.sh`, the guard test, and the APK contents |
| Release | `preview` now increments the version code (root cause of 21 APKs all reporting `versionCode=2`); x86/x86_64 native libs dropped; R8 enabled in v1.0.7 and **reverted in v1.0.8** after it broke at runtime on the device; releases published | `aapt2`/`apksigner` on the artifact: 145 MB → 93.5 MB → 82.5 MB, certificate unchanged; the v1.0.7 break: a byte-identical JS bundle against v1.0.6, and the device screen |

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

1. ~~**Test v1.0.8 on the phone**~~ — **done, and it failed twice before it worked.** v1.0.7 was
tested on 2026-09-29 and failed; the R8 revert alone did not fix it either, because the build that
reached the phone (`code 12`) still showed the database-failure screen. The real cause was a
**second, independent defect**: `initializeDatabase` ran `CREATE_TABLES_SQL` before
`runSchemaMigrations`, and the DDL's nine `CREATE UNIQUE INDEX ... (uuid)` statements ran before the
ALTER that adds `uuid` — on any database created before the identity layer that is
`no such column: uuid`, and the app never starts. **v1.0.8 (code 13) opened on the phone, the old
database migrated, and the data was there.** Sequence, hashes and releases: "Resolved — v1.0.7 (the
R8 pre-release) breaks on the device", `v1.0.8` → `v1.0.8-db-startup`; then `v1.0.8-modal` and
`v1.0.8-modal-scroll` for the start-session dialog.
**The scroll question closed on 2026-10-03, by measurement instead of argument.** Wireless
debugging (`adb pair`, then mDNS — no cable needed) put this phone on the machine, and the dialog
was driven from here: `adb shell input swipe` inside the scrollable node moved the list, in **both
code 15 and code 16**. So the fix works and code 15 did fix it; the build described as broken was
**code 14**, which is what `adb shell dumpsys package` showed (`versionCode=15`,
`lastUpdateTime=2026-10-01 12:49:14`). **v1.0.9 (code 16)** carries the same fix plus the version
footer in Settings, and is published. Method, obstacles and the one hypothesis left open:
`odd/tasks/app-observability.md`.
2. **Supabase: the tables are up, but the server is NOT ready to sync.** Measured from this machine
   on 2026-09-29 with the anon key (read-only, RLS-respecting): 3 categories, **1324** shared
   exercises, `sessions` and `progress_photos` return 0 rows for anon (RLS denying by default), and
   `delete_user_account` refuses an anonymous caller with `P0001`. So the three scripts *were* run —
   the old claim that nothing had ever been executed was wrong. **What is missing is the identity
   layer**: the deployed tables have no `uuid`, no `updated_at` and no `deleted_at` (Postgres 42703
   on every one of them), so an upsert-by-uuid, a newest-wins conflict and a delete that does not
   resurrect have nothing to stand on. That migration is the first work unit of the sync; it needs
   the SQL editor (no service key or `psql` on this machine), and it touches nine tables plus the
   nine unique indexes. Detail in `odd/tasks/supabase-sync.md`.
3. **The two-account test** for the isolation work: sign in as A, log something, sign out, sign in as
   B, confirm B sees nothing of A's. It needs a second email account.
4. **The unmerged branches.** `fix/release-v1.0.8` (the R8 revert, the legacy-database fix) and
   `fix/modal-scroll-and-actions` (the dialog's scroll, its actions, and the version footer) are
   pushed, tagged and released from, and `main` is still at `9cdc7bc`. Merging them is the owner's
   call.

---

## 4. Pending — technical, the agent can do it

Ordered by what I would do first.

1. **Observability: there is none.** No Sentry, no Crashlytics, and the local build's `mapping.txt`
   is deleted with EAS's temp directory. A crash on someone else's phone leaves no trace, and R8
   obfuscation makes any stack they could send unreadable. This is the biggest operational hole left.
2. **`deleteSession`'s transaction is fixed; N2, its five siblings, are not.** `deleteSession` is now
   atomic (`392e7d3`), and the original framing here was wrong: its three deletes run children-first,
   so nothing is orphaned. The residue of a mid-sequence failure is a **half-deleted session** — a
   surviving `sessions` row whose children are already gone, which `getActiveSession` still returns.
   The same sync-driver defect is live in the five other `db.transaction` sites, **re-measured on
   2026-09-24: `lib/db/queries.ts:388`, `:646`, `:820`, `:997`, `:1186`.** This list used to read
   `:760`, `:937`, `:1126` — those were stale. The earlier count of five was right and the places were
   wrong: `:752` and `:777` are already synchronous, and `:937` is a leaf-set read region with no
   transaction. Their `async` callbacks hit the trap `deleteSession` avoids — the driver commits at
   the first `await`, so later statements run in autocommit. `deleteSession`'s own callback is
   synchronous on purpose (`:518`). Tracked as N2 in `odd/tasks/db-integrity-foreign-keys.md`, and **fixed
   on `fix/db-integrity-foreign-keys`** (PR #1): `grep -c "async (tx)" lib/db/queries.ts` is now 0.
3. **Sequential writes in a loop**: `app/routine/[id].tsx:220-230` awaited `createSet` per set, so
   materialising a routine was O(exercises × sets) round trips. It now fans them out through one
   `Promise.all` (`7338fcd`), matching the session and home paths. That is **fan-out, not batching**:
   the round-trip count is unchanged and only the serialised latency is gone. A real batch insert is
   still unstarted.
4. **The two EN→ES exercise-name maps** (`lib/db/exercise-names-es.ts` and
   `lib/i18n/exercise-translations.ts`) can disagree, so the same exercise can be named differently
   depending on where it is read.
5. **The data migration to Supabase** — the schema and RLS plan exist, and an exercise-only importer
exists in two forms: `scripts/import-exercises.sql` and `scripts/import-to-supabase.ts`, the latter **not
runnable as committed** (it needs `tsx`, which is not a dependency, and it reads a hardcoded `/tmp`
dataset path). What does not exist is **any path for the user's own rows** — and no data-layer code at all:
the only non-auth Supabase call in runtime code is `supabase.rpc('delete_user_account')`
(`lib/hooks/useAuth.ts:140`). So this is a **new feature, not a switch**, and the step that gates it is the
cross-system identity layer (`uuid`, `updated_at`, `deleted_at`), which this list does not name.
6. **`progress_photos.uri` is a local file URI**, so remote sync needs a Storage bucket and object
   policies before that screen can work across devices.
7. **Ecosystem drift**: `expo-doctor` reports 20 patch-level updates behind;
   `react-native-reanimated@^4.5.1` and `react-native-worklets@^0.10.2` are floating ranges whose
   pairing breaks on a plain `npm install` (reanimated 4.6 wants worklets 0.12), and `.npmrc`'s
   `legacy-peer-deps=true` hides exactly that class of break.
8. **The two `.web.ts` mocks** (`useProgress.web.ts`, `useProgressionBubble.web.ts`) have no account
   guard or key, unlike their native counterparts.
9. **Cosmetic leftovers — three of the four closed, and the fourth reframed.** Closed in
   `fix/technical-defects-batch-2`: the `fontWeight`-without-`fontFamily` sites, including the
   family/weight mismatch the note had missed (`e27ef95`); the `!exercise` branch of `exercise-detail`
   and the other thirteen header-hidden screens (`d1d5de2`); and the hand-concatenated
   "sets"/"reps" in `session/history/[id].tsx` (`e27ef95`). **What remains is not a defect**: the
   a11y guard test does not cover `TextInput`, but all 31 `<TextInput>` sites already carry an
   `accessibilityLabel`, so such a guard has zero offenders and no test can fail against this tree.
   It is coverage, not repair — and it hides two real design holes that need their own unit:
   `components/ui/Input.tsx:30-31` sets `accessibilityLabel={label}` where `label` is optional and
   `{...props}` spreads **after** it, so a caller can silence the label while the guard stays green;
   and the guard's accepted list must be per-element-kind, because `accessible={false}` is not a
   valid exemption on a text input. (The `accessibilityHint` / `role="header"` item is closed as a
   decision — see §5.6.)
10. **N1 — `PRAGMA foreign_keys` is never enabled, so every `ON DELETE CASCADE` is inert.** No file
    in the repository turns the pragma on. `deleteSessionExercise` (`lib/db/queries.ts:734`) deletes
    only the `session_exercises` row and relies on the declared cascade for its `sets`, so it leaves
    genuinely orphaned `sets` rows — a live data-integrity bug. It is not a one-liner: enabling the
    pragma on a database that already contains orphans can make later operations fail, so the
    existing rows need an audit or a cleanup first. Listed last only to keep the §4.2 / §4.3
    references in the earlier batch documents valid; by severity it belongs near the top.

    **Its scope is wider than this entry, re-measured on 2026-09-24.** Three cascade dependencies are
    inert, not one: `deleteRoutine` also orphans `routine_exercises` and leaves `sessions.routine_id`
    dangling, and `deleteFolder` leaves `routines.folder_id` pointing at a deleted folder — which its
    own comment says the FK handles. The knock-on effect: **`deleteExercise` is poisoned by those
    ghosts**, because it counts references without joining against a live parent, so it refuses to
    delete an exercise cited only by routines that no longer exist. And **three confirmation strings
    are false** today, not one: the exercise and superset deletes promise *"Se eliminan sus series"*,
    and the folder delete promises the routines are merely unlinked. Full map, the two premises
    verified before coding, and the unit split: `odd/tasks/db-integrity-foreign-keys.md`. **Fixed on
    `fix/db-integrity-foreign-keys`** (PR #1): the pragma is enabled at module scope, the four orphan kinds
    are cleaned once per database, and the three confirmation strings this entry lists now tell the truth.

---

## 5. Worth checking (my own list, not from the audit)

1. **The empty card on the Progreso tab — now mapped, still waiting on one observation.** The map
   proved the two candidate cards *cannot* render an empty interior: the calendar grid always renders
   42 cells with day numbers (`lib/progress/calendar.ts:1-18`) and its month label and count always
   resolve (`app/(tabs)/progress.tsx:316`), and the selected-day card has a hard-coded title
   (`:326-328`). Leading hypothesis, and it is a shared-primitive problem:
   `components/ui/EmptyState.tsx:31` and `components/ui/LoadingSpinner.tsx:9` are both `flex: 1`
   **and** `backgroundColor: colors.bg.primary` — one shade below `bg.card` — so inside a
   content-sized card (`:379-387`) a `flex: 1` child collapses to zero height and paints a
   screen-coloured slab inside a card. `QueryState` picks that branch exactly when the month has no
   sessions.

   **The discriminator: is there a "Sesiones del mes" line above the empty box, inside the same
   border?** If yes, it is the collapsed empty state; if no, it is a fourth container and the
   screenshot predates `30a7e89`. Take it on a **clean cold start** — this repository already learned
   that Fast Refresh after a structural JSX change fakes layout measurements. If confirmed, the fix
   is a **presentation rule** — how `QueryState` should look *inside* a container, which
   `docs/ui-standard.md` §7 does not say yet — and it touches primitives shared by 17 screens, so it
   needs its own unit and its own decision.
2. **`session.exerciseCount` — closed: deleted in `fe2fd84`.** It was an orphan with two live
   namesakes (`session.new.exerciseCount` and `progress.exerciseCount` are both used), and deleting
   the wrong one would have been easy, so the deletion was deliberate: three audit records already
   said so (`docs/audits/03-dead-code.md` F2 and cleanup step 6, and `docs/audits/00-consolidated.md`
   row 18). The honest counterpoint is recorded with it: wiring it was *smaller* than this list
   implied — `app/(tabs)/index.tsx` already had per-session counts from `lib/progress/queries.ts`,
   and only the history index would have needed a new grouped count, with
   `getRoutineSessionCounts` as precedent. It was deleted deliberately, not for cost. The deletion
   also had to fix `components/RoutineCard.tsx:20`, which hand-rolled English pluralisation and was
   the only live exercise count in the app.
3. **Whether the app still needs a web target.** `useProgress.web.ts` and
   `useProgressionBubble.web.ts`, plus `react-dom` and `react-native-web`, suggest it was once
   intended; nothing else does.
4. **The `ios/` project is stale** (its Pods are from a different week than `package.json`) and
   `packages/precompile` does not exist, which forces several pods to compile from source. Neither
   blocks anything today, but a fresh iOS build will need the same `rm -rf Pods Podfile.lock` dance
   that the Android side did not.
5. **`jest.config.js`'s `transformIgnorePatterns` — closed: pruned in `f4fe925`.** It named
   `@sentry/react-native` and `native-base`, neither installed while the rest of the list is live.
   Removal was safe for the reason recorded here: the pattern is a transpilation allow-list, so an
   entry naming an absent package is inert. The warning that used to sit in this item still stands and
   is unrelated — do not budget work against the `expo-updates` comparison, because `expo-updates`
   appears nowhere in the tree (`package.json`, `package-lock.json`, `app.json`, `node_modules`), knip
   is not a dependency of this repository, and the comparison had no artifact behind it.
6. **`accessibilityHint` and `role="header"` — closed as a decision, not done.** The item has no
   origin in this repository: nothing under `docs/audits/` mentions it (the one a11y line there
   praises the existing guard), and its only reference was a single roadmap line with no provenance,
   no per-site list and no reason. What it asked for already exists. `accessibilityHint` is applied
   selectively at **35 sites** backed by **29** catalogue keys — on inputs, toggles and
   expand/collapse controls — and deliberately omitted where the label plus role already states the
   outcome; that is the policy, and it is implemented. `role="header"` has **zero** occurrences and
   no candidate list, so adding one would be a new convention with no rule to violate. Do not
   re-open this item without a named site that fails.

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
