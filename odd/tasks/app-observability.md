# app-observability

**Status**: **IN PROGRESS** — task 1 (the version footer) is **written and gated**, uncommitted on
`fix/modal-scroll-and-actions` pending the owner's call. Sentry is **decided, not yet integrated**.

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

### 2. Sentry integration

- **What**: `@sentry/react-native`, initialised once, with the EAS/local build wired to upload source
  maps so R8-obfuscated stacks are readable.
- **Decisions still to make before writing**: the DSN (a Sentry project has to exist), what is
  sampled (errors only, or traces too), and whether PII is scrubbed on the way out. No user email,
  no exercise content, no weights.
- **Acceptance**: a deliberate test crash appears in the dashboard with a readable symbolicated stack,
  from a device build — not from a dev server.

### 3. Device verification

- **What**: the footer and a crash, observed on the real phone.
- **Why**: every previous "it works" in this project that was reasoned from the style tree instead of
  observed shipped something broken. The version footer exists to make this cheap.

---

## The gate

`npx tsc --noEmit` clean and `npx jest` green, per the repo's standing rule. A behaviour change lands
with a test that fails without it.

## Out of scope, recorded

- The scroll defect on the start-session dialog is **not** part of this feature. It is its own
  investigation (`odd/tasks/modal-scroll-device.md`) and it is the reason this one exists.
