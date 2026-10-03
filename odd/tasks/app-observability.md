# app-observability

**Status**: **IN PROGRESS** — task 1 (the version footer) is **landed, released and verified on the
device**. The scroll defect this feature was opened around turned out to be **not a defect**: the
fix shipped in code 15 works, and the owner was running code 14. Detail in task 3. Sentry is still
**decided, not integrated** (deferred by the owner to the next build).

**Why this feature exists.** On 2026-10-01 the owner tested the app on his phone and reported that
the start-session dialog *still* does not scroll. The very first question that could not be answered
was **which build is on the phone**: four published releases all report `versionName 1.0.8` — codes
12, 13, 14 and 15 — and Android's app-info screen shows only `1.0.8`. Every diagnostic conversation
therefore starts with a guess, and a wrong guess wastes a whole round trip through GitHub, because
there is no other way to get an APK onto that device.

Two independent defects are behind this feature:

1. **The app cannot say what is running.** Nothing in the UI reports the version or the build number.
   — Task 1.
2. **A crash on someone else's phone leaves no trace.** There is no Sentry and no Crashlytics, and
   the local build's R8 `mapping.txt` is deleted with EAS's temp directory, so even a stack trace
   someone managed to send would be unreadable. This is the biggest operational hole the roadmap
   lists, and the R8 incident of 2026-09-13 is the proof that it costs real days. — Task 2.

---

## Decision recorded: Sentry, and only Sentry

The owner first said "Sentry and Crashlytics". They are **not complementary** — both capture crashes
and errors and both ship a dashboard, so running both doubles the SDK, the native configuration and
the privacy surface for one function nobody reads twice.

| | Sentry (`@sentry/react-native`) | Crashlytics (`@react-native-firebase/crashlytics`) |
| --- | --- | --- |
| Fit for this app | Purpose-built for apps; first-class Expo/EAS support | Standard **if the app already uses Firebase** |
| What it costs to start | one dependency and a DSN | a new Firebase project, `@react-native-firebase/app`, `google-services.json`, a config plugin and a native rebuild |
| Source maps / R8 | **Uploads them automatically**, so an obfuscated stack reads normally | Works, but the mapping upload is a separate step to wire |
| JS **and** native errors | Yes, plus breadcrumbs (the actions before the crash) | Yes, via the native crash reporter |
| Free tier | ~5k errors/month | Generous (Spark plan) |

**The deciding argument is the R8 wound.** Every build since 2026-09-13 shipped with R8 on, and when
the app broke at runtime the diagnostic value of the stack was **zero** — no `mapping.txt`, no
`logcat`, no emulator, so the exact break was never proven. Sentry's automatic source-map upload is
the only one of the two that closes that specific hole out of the box, and this app has no Firebase
anywhere, so Crashlytics would mean adding Google as a new infrastructure dependency for a feature it
does not do better here.

**Recorded, not built:** analytics and product telemetry are a different problem. Sentry is not that,
and nothing here should be stretched to make it do that.

---

## Tasks

### 1. The version footer in Settings

- **What**: a discreet line at the bottom of `app/settings.tsx` naming the app, the `versionName` and
  the `versionCode` of the **installed package**.
- **Why**: it is the only way the owner can answer "which build is this?" without reading a release
  page. It ends the ambiguity that opened this feature.
- **Source of truth**: `expo-application` (`nativeApplicationVersion`, `nativeBuildVersion`), which
  reads the `PackageInfo` of the installed APK. Deliberately **not** `expo-constants`, which resolves
  from the bundle's embedded manifest and can disagree with the binary in a dev build — the whole
  point is the number of the thing on the phone. `expo-constants` is currently in `package.json` with
  zero imports; that is a separate cleanup question, not this task.
- **Design**: no button, no card, no section header — one centred line in `text.muted`, which is the
  dimmest token that still clears 4.5:1. It is information, not decoration, so it must stay readable.
- **Acceptance**: a test pins that the screen reads the version from the installed package rather than
  from a literal, and that the string exists in both catalogues.
- **Evidence (working tree, not committed)**: `expo-application@57.0.3` added; the footer in
  `app/settings.tsx`; `settings.buildVersion` in both catalogues. Gate: `npx tsc --noEmit` exit 0 and
  `npx jest` **71 suites / 599 tests** green. Negative control observed: replacing the two module
  reads with the literals `'1.0.8'` / `'15'` fails the guard, restoring them passes.
- **Found by the guard, and fixed**: adding one key to each catalogue moved `catalogueKeys*` from 682
  to 683, and `__tests__/lib/metrics.test.ts` failed because `docs/ui-standard.md` still quoted 682.
  The document now carries the measured value. That is the guard working as designed.
- **Released**: `a85ee64` (the footer), `edb3371` (`1.0.9`), `ec83221` (the versionCode bump the build
  made). Artifact `build-1790873788953.apk`, 93 MB, verified by `scripts/check-signing.sh --apk`:
  `versionCode 16`, `versionName 1.0.9`, the published key `38E23AA3…`, R8 off (69 class-name hits),
  and a bundle hash that differs from code 15 — so the new JS is inside. Published as the
  **`v1.0.9`** pre-release, asset `forja-v1.0.9-code16.apk`,
  `sha256 b3542aeec75a59f4781352f84184f463a4e1b57d1297cb87ea82f31f07680571`.

### 2. Sentry integration

- **What**: `@sentry/react-native`, initialised once, with the EAS/local build wired to upload source
  maps so R8-obfuscated stacks are readable.
- **Decisions still to make before writing**: the DSN (a Sentry project has to exist), what is
  sampled (errors only, or traces too), and whether PII is scrubbed on the way out. No user email,
  no exercise content, no weights.
- **Acceptance**: a deliberate test crash appears in the dashboard with a readable symbolicated stack,
  from a device build — not from a dev server.

### 3. Device verification — DONE, 2026-10-03, and it closed the scroll question

**How the device got connected, since there is no USB cable.** Wireless debugging. `adb pair
192.168.0.188:35203 <code>` then mDNS brought the transport up on its own; no `adb connect` was
needed. Phone: POCO X7 Pro (`rodin`), Android 16, 1220x2712.

**Two obstacles worth recording, because both will recur:**

- **MIUI/HyperOS refuses `adb shell input tap`** with `SecurityException: Injecting input events
  requires the caller to have the INJECT_EVENTS permission`, on top of the ordinary "USB debugging"
  switch. The separate **"Depuración USB (ajustes de seguridad)"** toggle under Developer options
  ("Permitir la concesión de permisos y la simulación de entrada a través de la depuración USB") is
  what enables it. Without that toggle `input` is dead; `uiautomator dump` and `screencap` work
  regardless, so the screen can still be read.
- **`am start -a android.intent.action.VIEW -d "forja://routines"` navigates the app without a tap.**
  `forja://routine/2` answered "Rutina no encontrada" — the local routine ids are not `1..3` in list
  order, so a deep link is not a substitute for reading the real id.

**The scroll works, and it was measured, not judged.** Same modal and same list, with
`adb shell input swipe 609 1650 609 1000 400` applied inside the scrollable node
(`bounds [201,989][1018,1720]` — 731 px ≈ 244 dp on this density):

| Build | Before the gesture | After the gesture |
| --- | --- | --- |
| code 15 (`1.0.8`) | Elevación lateral · Peso muerto rumano · Remo en Barra T | Aperturas pecho · Remo sentado · Extensión de pierna |
| code 16 (`1.0.9`) | Elevación lateral · Peso muerto rumano · Remo en Barra T | Aperturas pecho · Remo sentado · Extensión de pierna |

**So `829040e` is correct and code 15 did fix the scroll.** `adb shell dumpsys package` reported
`versionCode=15` with `lastUpdateTime=2026-10-01 12:49:14`, so the build the owner described as
broken was **code 14** (or an earlier one) — the build that shipped the defect. The one hypothesis
this leaves untested is the `Pressable`-around-`ScrollView` pattern in the other six sites: it did
**not** break this modal, and there is no evidence it breaks anything else.

**The footer works.** After `adb install -r build-1790873788953.apk` (data intact, `versionCode`
16 reported by the package manager), Settings renders `Versión 1.0.9 (compilación 16)`.

---

## The gate

`npx tsc --noEmit` clean and `npx jest` green, per the repo's standing rule. A behaviour change lands
with a test that fails without it.

## Out of scope, recorded

- The scroll defect on the start-session dialog is **not** part of this feature. It is its own
  investigation (`odd/tasks/modal-scroll-device.md`) and it is the reason this one exists.
