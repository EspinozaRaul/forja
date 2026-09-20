# Feature: security hardening batch (audit closeout)

**Workflow**: ODD (Organic Driven Development)
**Scope**: Forja application code (`app/`, `components/`, `app.json`)
**Status**: complete — 4/4 tasks; one external check left to the user

---

## Goal

Close the last four findings that are verifiably open, so the security audit reaches zero and
effort returns to product work.

## Already closed — do NOT redo

Verified in the current code on 2026-09-17, after the audit was written:

- **SEC-01 per-user isolation** — `lib/db/user-scope.ts` provides the scoping helpers
  (`ownedByCurrentUser`, `visibleToCurrentUser`, `sessionOwnedByCurrentUser`,
  `routineOwnedByCurrentUser`), `lib/db/queries.ts` has 70 `userId` uses, and it is wired into
  `lib/progress/queries.ts`, `lib/hooks/useAuth.ts`, `useCurrentUser.ts`, `useProgress.ts`.
- **SEC-02 wipe on account deletion** — `deleteAccount` reads the active user id *before* signing
  out, calls `deleteUserLocalData(userId)` (per-user rows, scoped by `userId`), and deletes the
  progress-photo files from disk.
- **SEC-03 sign-out** — resolved **by design**, not by wiping: local rows are partitioned per user,
  so offline data survives a sign-out and the next account on the device sees nothing. The code
  documents this intentionally ("Signing out must not delete rows, but deleting the account must").
- **H-04 tracked `.bak` file** — `git ls-files | grep '\.bak$'` returns nothing.

`docs/audits/` is therefore **stale** on these four points. Do not act on it without re-verifying.

## Tasks

| # | Task | Severity | Status |
| --- | --- | --- | --- |
| 1 | SEC-13 — password reset cannot complete: no route exists for `forja://reset-password` | user-visible product bug | **done** — `0707898` |
| 2 | SEC-15 — `ErrorBoundary` renders the raw stack on screen in release | low — info disclosure | **done** — `5c4e088` |
| 3 | SEC-06 — `android:allowBackup="true"` exposes the unencrypted local DB to adb backup / Google Auto Backup | medium — privacy | **done** — `b82b0b1` |
| 4 | SEC-10 — `RECORD_AUDIO`, `SYSTEM_ALERT_WINDOW` and storage permissions in the shipping manifest, for an app that records no audio | low — store/privacy | **done** — `b82b0b1` |

## Evidence

### Task 1 — SEC-13 (`0707898`)

Independently verified by a second agent against the artifact, not against the writer's report:
`npx tsc --noEmit` exit 0; focused jest for `reset-link` + `catalog-parity` + `a11y` → 3 suites / 16
tests; `git status` matched the declared surfaces exactly; `useLinkingURL` confirmed to exist as a
real export (`node_modules/expo-linking/build/Linking.d.ts:81` → `string | null`) and the module
confirmed to carry zero React Native / expo / supabase imports.

That verification found two branches of the documented rule that no test covered. Both are now
covered (the fragment carrying neither token still falls back to the query, and a malformed
percent escape is kept raw instead of throwing). A third finding — that the 2 `as any` casts on
`tintColor` could be removed — was **attempted and reverted**: `tintColor` is not in the type
`TextInput`'s `style` accepts, which is precisely why they are there. Moving to `selectionColor`
would work but changes a visible colour, so it is out of scope for a functional fix.

### Task 2 — SEC-15 (`5c4e088`)

Four tests in `__tests__/components/ErrorBoundary.test.tsx` flip `__DEV__` (a runtime global under
jest-expo, not inlined at transform time) so the release branch is asserted rather than assumed:
the generic message renders, no internal marker and no `file:line` path appears, and the children do
not come back after a crash.

### Tasks 3 and 4 — SEC-06 + SEC-10 (`b82b0b1`)

Both were `app.json` findings, as the Gate predicted. Verified in the regenerated
`android/app/src/main/AndroidManifest.xml`:

| entry | before | after |
| --- | --- | --- |
| `RECORD_AUDIO` | present | `tools:node="remove"` |
| `SYSTEM_ALERT_WINDOW` | present | `tools:node="remove"` |
| application `allowBackup` | `"true"` | `"false"` (+ the `fullBackupContent` / `dataExtractionRules` rules expo-secure-store adds) |

`ios/Forja/Info.plist` no longer carries `NSMicrophoneUsageDescription`.

Two things worth recording:

1. **The audit was wrong about the storage permissions.** `READ_EXTERNAL_STORAGE` and
   `WRITE_EXTERNAL_STORAGE` come from `expo-image-picker`'s own manifest, capped at
   `maxSdkVersion="32"`, and the picker needs them to read the camera roll on Android <= 12.
   `CAMERA` is needed too: `lib/hooks/useProgressPhotos.ts` calls both `launchImageLibraryAsync`
   and `launchCameraAsync`. Blocking any of the three would have broken photo capture, so they stay.
   `RECORD_AUDIO` was the real, verifiable excess: the plugin injects it for video capture and the
   app only takes stills.
2. **`RECORD_AUDIO` did not come from any library manifest.**
   `grep -rl RECORD_AUDIO node_modules --include=AndroidManifest.xml` returns nothing; it appears in
   `node_modules/expo-image-picker/plugin/src/withImagePicker.ts:66`. That is why the fix is the
   plugin's own `microphonePermission: false` option rather than a raw block: the plugin then skips
   the injection, blocks the permission and clears the iOS string together.

### Prebuild side effect — the native directories were CLEARED

`npx expo prebuild --no-install` reported "Clearing android, ios" and recreated both from
`app.json`. Both are gitignored (`.gitignore:/android`, `/ios`), so this produced no repository
diff, but anything hand-edited inside them is gone. The user was told prebuild would regenerate the
native projects and authorized it; the **clearing** behaviour was not stated, and that is the
disclosure gap in this batch.

Whether signing material was lost: **very likely not, but not provable from here.**

- The newest APK's signer digest is
  `38e23aa31912457735a0cc3224919001cd546d8701b5b585628a4543e0a55098`, which is NOT the debug
  keystore the template regenerates
  (`FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C`).
  So a separate release key existed at some point.
- No `.jks` or `.keystore` exists anywhere on disk besides the regenerated debug one, and there is no
  `credentials.json` in the project.
- But `eas.json` declares no `credentialsSource: local`, `~/Library/Caches/eas-cli` exists, and the
  root APK filenames (`build-<epoch-ms>.apk`) are EAS local-build output. This project builds through
  EAS with remote credentials, and EAS regenerates the native project on every build — the same
  thing a clean prebuild does.

**Action left to the user:** run `npx eas credentials` and confirm the Android keystore is still
listed for this project. If it is, nothing was lost.

### Suite counts on this branch

`npx jest` → **19 suites / 152 tests**, all passing. This differs from the 20/157 seen while the
timer/db work was uncommitted because that work lives on its own branch
(`fix/timer-restore-and-exercise-repair`): the two timer/db test files are not in this tree. The
discovered set here is exactly the 18 tracked test files plus the new `ErrorBoundary` one.

### Not verifiable from the repository

- **The Supabase redirect allowlist must cover `forja://reset-password`.** The route now exists and
  the gate lets it through, but whether the email link actually redirects there depends on the
  dashboard entry, which no repo file can prove. If the allowlist holds a bare `forja://`, the flow
  still breaks and nothing here would show it.
- **Runtime delivery on device.** The `forja://` custom scheme does not work in Expo Go, so neither
  cold-start nor already-running deep-link delivery was exercised. What was verified statically is
  that expo-linking returns the raw URL including the fragment on both paths.
- **`segments[0] === 'reset-password'` under expo-router for a cold-start deep link.** No test covers
  `app/_layout.tsx`.

## Gate

SEC-06 and SEC-10 had to be fixed in **`app.json`**, never in
`android/app/src/main/AndroidManifest.xml`: `android/` is generated and gitignored, so a manifest
edit vanishes on the next prebuild. Applying an `app.json` change requires a prebuild, which
regenerates `android/` — so those two tasks ended with a prebuild step, not with a source edit alone.

Satisfied: both were changed in `app.json`, and the result was verified in the regenerated native
files rather than assumed from the config.

## Open question on SEC-13

The route is verified missing. The recovery **flow** was not executed end-to-end, so it is not yet
verified whether the link dead-ends or silently falls through to the app root. Resolve this before
choosing the implementation shape.

## Revert

Per-task commits on the feature branch; each task reverts independently with `git revert <sha>`.
