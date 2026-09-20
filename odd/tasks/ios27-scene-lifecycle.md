# Feature: iOS 27 scene lifecycle adoption

**Workflow**: ODD (Organic Driven Development)
**Scope**: Native build configuration and dependencies (`app.json`, `package.json`, regenerated `ios/`)
**Branch**: `fix/ios27-scene-lifecycle`, branched from `main` @ `616a25a`
**Status**: in progress — step 1 of 4 (versions, `app.json`, iOS prebuild); rebuild pending the user's checkpoint

---

## Goal

Make the app launch on iOS 27. Today it does not: the build traps at startup because the
generated iOS project never adopted the UIKit scene-based life cycle, which Apple requires
for apps built with the iOS 27 SDK.

This is a launch blocker, not a layout defect. Every other open item in the project is
moot on an iOS 27 device until it is fixed, and Apple requires the latest SDK to publish.

## Evidence

### The crash, with an A/B across runtimes

The same `Forja.app` bundle, installed and launched on two simulators:

| runtime | device | result |
| --- | --- | --- |
| iOS 26.5 | iPhone 17 Pro | launches and runs |
| iOS 27.0 | iPhone 18 Pro | **crashes at launch** |

Crash report `~/Library/Logs/DiagnosticReports/Forja-2026-09-20-170605.ips`:

```text
exception:   EXC_BREAKPOINT (SIGTRAP)
termination: Trace/BPT trap: 5
faulting frame:
  UIKitCore  ___UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption_block_invoke
```

### The generated project is the standard pre-scene template

`ios/Forja/Info.plist` has no `UIApplicationSceneManifest` — only `UILaunchStoryboardName`
and `UIRequiresFullScreen`. `ios/Forja/AppDelegate.swift` still owns the window:

```swift
window = UIWindow(frame: UIScreen.main.bounds)
factory.startReactNative(withModuleName: "main", in: window, launchOptions: launchOptions)
```

That is exactly the arrangement Apple's TN3187 says must be replaced, and there is no
`SceneDelegate` in the project.

### It is a documented Apple requirement, not a simulator quirk

Apple, *Transitioning to the UIKit scene-based life cycle*: beginning in iOS 27 and the
other 27 platforms, apps built with the latest SDK **must** adopt the scene-based life
cycle **or they fail to launch**.

### It is a known, still-open Expo gap

`expo/expo#46664` — `[iOS][Xcode 27] Fails on launch because UIScene lifecycle is required` —
state OPEN, labels include `Issue accepted` and `Upstream: React Native`. A reporter confirms
it still reproduces on SDK 57.0.22 with a blank TypeScript template.

### The supported fix, from Expo

A maintainer's comment on that issue (2026-09-15) documents the supported path for SDK 57:
update to Expo `57.0.23` or later, install `expo-build-properties` `57.0.20` or later, and set
`ios.enableSceneSupport: true` in the plugin config. It is opt-in deliberately, because
adopting the scene lifecycle changes how the native app starts.

Confirmed against the published package rather than only the comment —
`expo-build-properties@57.0.20/build/pluginConfig.d.ts`:

```ts
/**
 * Adopt the UIKit scene lifecycle in an Expo SDK 57 iOS project, as required by the iOS 27 SDK (Xcode 27).
 * When `true`, the AppDelegate exposes its `ExpoReactNativeFactory`, React Native startup moves to Expo's
 * scene delegate, and the scene manifest is added to **Info.plist**. When `false`, these changes are reverted.
 *
 * Only the standard SDK 57 Swift AppDelegate template is supported. Requires Expo SDK 57.0.23 or newer.
 *
 * Expo SDK 58 and newer include scene lifecycle support, so this property is no longer required and can be removed.
 */
enableSceneSupport?: boolean;
```

The one precondition — the standard SDK 57 Swift AppDelegate template — holds: the project's
`AppDelegate.swift` is `class AppDelegate: ExpoAppDelegate` with `reactNativeFactory`. The
option does not exist in the installed `expo-build-properties@57.0.17`, which is why the bump
is required and not optional.

*Note: the SDK 57 `build-properties` documentation page, as fetched twice, exposes only the
Android options and does not show this property. The authoritative source used here is the
package's own type declaration, not the docs page.*

## Approach

1. `expo` 57.0.20 → ≥ 57.0.23; `expo-build-properties` 57.0.17 → ≥ 57.0.20.
2. Add `"ios": { "enableSceneSupport": true }` to the `expo-build-properties` entry that
   already exists in `app.json`, alongside its `android` block.
3. `npx expo prebuild --platform ios` — iOS only, so `android/` is untouched.
4. Rebuild, install and launch on the iPhone 18 Pro (iOS 27), then run the regression checks.

## Risks

- **`expo prebuild` clears `ios/`.** Both native directories are gitignored, so nothing
  tracked is lost, but anything hand-edited inside them is gone. Running with
  `--platform ios` leaves `android/` — and its `debug.keystore` — alone. The release
  keystore lives on EAS (`eas.json` declares no `credentialsSource: local`), so it is not
  affected either way.
- **Adopting the scene lifecycle changes native startup.** That is precisely why Expo made it
  opt-in. The known surface is **deep links**: with a scene delegate, links stop arriving
  through the AppDelegate. This repository depends on them — `forja://reset-password` backs
  SEC-13 (password reset), and `forja://routine/1` was used to navigate during verification.
  It must be tested, not assumed.
- **`expo-notifications` and `expo-task-manager`** are the plausible candidates for a prebuild
  failure: the maintainer's note says a config plugin that modifies `AppDelegate` can break
  the option. If prebuild fails, the error is the evidence.
- **Bumping `expo` 57.0.20 → 57.0.24** pulls in other patch releases. `tsc` and `jest` are the
  cheap check for type or behaviour drift.
- **A native change cannot be verified by `jest` or `tsc`.** The gate is a run on two runtimes.

## Verification

1. Launches on **iOS 27** (iPhone 18 Pro) — the thing that is broken today.
2. Still launches on **iOS 26.5** (iPhone 17 Pro) — do not break the runtime that works.
3. **Deep links** still resolve: a route link (`forja://routine/<id>`) navigates, and the
   password-reset link still reaches `app/reset-password.tsx`.
4. Login works and a session can be run end to end.
5. `npx tsc --noEmit` clean; `npx jest` green.

## Gate

`npx tsc --noEmit` clean and `npx jest` green, plus the five checks above. A check that was
not observed is reported as unverified, not as passing.

## Revert

The change is `app.json` plus dependency versions. Reverting means restoring both and
regenerating the native project; `ios/` is disposable by construction.

## Open questions

1. Is the user's own phone on iOS 27? If not, this does not break today's usage — but any
   build produced with Xcode 27 dies at launch, which blocks publishing.
2. Does `expo prebuild` succeed with the current plugin set? Answer comes from running it.
