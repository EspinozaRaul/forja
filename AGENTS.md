# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## BUILDS ARE LOCAL

Never submit a cloud build. Every APK is compiled on this machine:

```bash
npx eas-cli@latest build --local --profile preview --platform android
```

`--local` compiles in a temp directory and writes `build-<epoch>.apk` into the repo root. The
compile stays here on purpose: it is faster, and the whole toolchain under our control.
A plain `./gradlew assembleRelease` is **not** a substitute: the generated `android/` project signs
its release build with the debug keystore, so the APK cannot install over the published one — and
the only way around that is uninstalling the app, which deletes the local database.

The full ordered process, with the artifact checks to run before installing: `docs/release-runbook.md`.

Every build starts with `scripts/check-signing.sh`. It fails when the build would reach Expo's
servers for the keystore or the versionCode, when a secret has become committable, or when the
keystore is not the key that signed the published app. Before installing, `scripts/check-signing.sh
--apk <file>` verifies the APK itself.

## UI STANDARD

Before creating, restructuring or restyling any screen, read `docs/ui-standard.md`.

New screens are built with `components/ui/Screen.tsx` and `components/ui/ScreenHeader.tsx`,
which apply the device safe areas and the app's single header design. Safe-area spacing
comes from the device inset plus one small step — never from a fixed number.
