# Forja — Release runbook

> Last updated: 2026-09-29
> Status: v2 — the build is fully local: the compile, the keystore and the versionCode

From this repo to the phone, in order, with the check that proves each step. The rule that is not
negotiable is in `AGENTS.md`: the APK is compiled on this machine, never in the cloud.

## 0. Before the build

1. **Bump `expo.version` in `app.json`.** It is the `versionName` the device shows; two APKs sharing
   a name make a device test unreadable. (`android.versionCode` is bumped by the build itself — see
   step 5 — so commit that bump with the release.)
2. **Run the preflight**: `scripts/check-signing.sh`. It fails if the build would reach Expo's
   servers for the keystore or the versionCode, if a secret is committable, or if the keystore is not
   the key that signed the published app. All three are silent failures otherwise.
3. **Run the gate**: `npx tsc --noEmit`, then `npx jest`. Both green before anything is built.
4. **Commit.** EAS *does* include uncommitted changes — with `requireCommit` unset it clones with
   `--no-checkout` and then copies the working directory, verified on the v1.0.8 build whose record
   reports `appVersion 1.0.8` out of an uncommitted `app.json`. But an APK whose code exists in no
   commit cannot be rebuilt, bisected or reverted. Commit first.

## 1. Build

```bash
npx eas-cli@latest build --local --profile preview --platform android
```

It copies the working directory into a temp dir, runs `expo prebuild`, Metro (`EAGER_BUNDLE`, ~4900
modules) and `gradlew :app:assembleRelease`, then writes the APK into the repo root as
`build-<epoch>.apk`. Every APK already at the root has that name and came from this same path.

Never `./gradlew assembleRelease` on its own: the generated `android/` project's release block signs
with `signingConfig signingConfigs.debug`, and a debug-signed APK cannot install over the published
one. The only way around that is uninstalling, which deletes the local database.

## 2. Verify the artifact, before touching the phone

```bash
scripts/check-signing.sh --apk build-<epoch>.apk
```

What it checks, and the failure each check exists for:

| Check | Failure it catches |
| --- | --- |
| `versionCode` above the installed one | Android refuses an update whose versionCode does not increase |
| certificate is `38E23AA3…` | a different key cannot install over the app, and the workaround — uninstalling — deletes `fitness-tracker.db` |
| `expo/modules/sqlite/SQLiteModule` present in the dex | R8 obfuscated the class names the native bindings look up; v1.0.7 shipped with this defect and reported 0 hits |
| the bundled `assets/index.android.bundle` differs from the previous APK | a stale bundle looks exactly like a working build |
| (printed) `versionName`, bundle hash, dex size | the record that ties this file to this commit |

## 3. Install

```bash
adb install -r build-<epoch>.apk
```

`-r` replaces the app and keeps its data. **Never uninstall as part of a test**: it deletes
`fitness-tracker.db`, which is the only copy of the training data until the sync exists.

To run an A/B — does this build work where that one failed? — install an older APK without
uninstalling first:

```bash
adb install -r -d build-<older-epoch>.apk    # -d lets the versionCode go down
```

## 4. When something breaks

The release JS shows no error detail on screen. `console.error` is not stripped and does reach the
device log, so:

```bash
adb logcat | grep ReactNativeJS
```

## 5. Signing and versioning, local

Nothing in a build asks Expo for credentials or a version any more:

- `eas.json` → `cli.appVersionSource: "local"` plus `android.versionCode` in `app.json`. The build
  **bumps that number in `app.json`** and builds with it; commit the bump with the release. The
  remote counter is unused, so two APKs can no longer share a versionCode by accident.
- `eas.json` → `credentialsSource: "local"` on `preview` and `production`. The keystore comes from
  `credentials.json`, which points at `credentials/android/keystore.jks`.

### One-time setup (a new machine, or after losing the files)

```bash
npx eas-cli@latest credentials --platform android   # → "Update credentials.json"
chmod 600 credentials.json credentials/android/keystore.jks
scripts/check-signing.sh
```

That command writes the keystore and its three secrets (keystore password, key alias, key password)
out of EAS and into those two files, which are both **git-ignored** (`.gitignore` carries
`credentials.json` and `/credentials/`; the CLI itself warns when they are untracked, which means
ignored).

### The secrets, and what protects them

- **They never enter git.** The preflight fails if either file is tracked or unignored.
- **They are `600`.** The preflight fails on anything readable by other accounts on this machine.
- **The preflight never prints them.** It reads the password from the file, hands it to `keytool`
  through an environment variable (not through the command line, where `ps` would show it), and
  prints only the fingerprint.
- **The keystore is the app's identity.** Without it, no future APK can ever update the published
  app. There are now two copies: this one and the one EAS still holds. Keep both — do not remove the
  EAS copy while it is the backup, and put the local one in the password manager or an encrypted
  backup of your own.

### The two exceptions, stated rather than hidden

- The `development` profile still has no `credentialsSource`, so it resolves to EAS's managed
  credentials. It builds a dev client for Android **and iOS**, and iOS device credentials are Apple's,
  which cannot become local without an Apple-account setup of their own. Not used for releases.
- An iOS build through EAS would need `credentials/ios/` (a `.p12` and a `.mobileprovision`).
  Today iOS runs in the simulator through `expo run:ios`, which needs no signing at all.

## 6. Publishing

Tags, `gh release`, and the store submission are the owner's decisions, not this runbook's. What this
runbook guarantees is narrower: the artifact was built here, verified, and traceable to a commit.
