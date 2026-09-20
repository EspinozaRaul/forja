# Dead Code & Dependencies Audit — Phase 3 of 4

**Date:** 2026-05 (session audit)
**Scope:** Git-tracked bloat, unused npm dependencies (verified per import), dead source files, unused assets, config/tooling hygiene, code-level dead code.
**Method:** Read-only exploration agent (tracked-file claims derived from the git index; independently verified by the orchestrator with `git ls-files`/`du`). No files were modified.
**Cross-references:** `01-security.md` (Phase 1), `02-architecture.md` (Phase 2, H1/I1/L3).
**Severity:** hygiene findings use INFO unless they actively harm (tracked bloat, inert styling layer).

## Executive summary

The `build-*.apk` files are **NOT tracked by git** — 24 files totaling 3.0 GB live only on local disk (verified: `git ls-files | grep '\.apk'` → 0). The real **tracked** weight is exercise media: ~125 MB of GIFs (`assets/exercises/gifs/`), plus a 17 MB dead dataset duplicate (`assets/exercises/data/exercises.json`). Dependency hygiene is poor: **6+ declared runtime deps have zero source imports** (`react-native-chart-kit`, `react-native-svg`, `react-native-draggable-flatlist`, `expo-auth-session`, `expo-crypto`, `expo-background-fetch`; `react-native-web`/`react-dom` unused for a phone-only app). Dead source clusters exist (`sample-exercises`, `load-exercises`/`import-exercises`, `exercise-localization`, `ProgressionBubble`+`progression-mapping`, `progress/compare.ts`), and the NativeWind setup is **half-wired**: `className` is used in ~8 files but no `metro.config.js`/`babel.config.js` exists anywhere (verified), so the Tailwind layer is likely inert decoration next to inline `style`.

## (A) Git-tracked bloat

| # | Finding | Evidence | Why it matters | Action |
|---|---|---|---|---|
| A1 | `build-*.apk` NOT tracked | `git ls-files | grep '\.apk'` → 0; 24 files / 3.0 GB on disk; `.gitignore` covers `*.apk` and `build-*/` | Clones stay clean; bloat is local-disk only. | Keep `.gitignore` rules; optionally delete locally to reclaim 3 GB. |
| A2 | `releases/`, `dist/`, `ios/`, `android/` not tracked | git index grep → 0 matches; all ignored | No build output leaks into history. | None. |
| A3 | **Tracked media is the true repo weight** | `assets/exercises/gifs/` = **125 MB** (verified), `videos/` = 13 MB, `images/` = 11 MB | The GIFs are the largest tracked set; they are source material for the offline mp4s, not referenced by code (code builds remote GitHub URLs instead). | Judgment call (roadmap §2.1): move gifs out of the repo → clone drops ~125 MB. |
| A4 | `assets/exercises/images/*.jpg` (~1,000+) | `require()`d by `lib/assets/exercise-images.ts`, used by `ExercisePicker.tsx:13`, `app/exercise/[id].tsx:19` | Live code — NOT bloat. | Keep. |
| A5 | **Three dataset JSON copies; one is 17 MB and dead** | `lib/db/exercises-data.json` (1.5 MB, live, `lib/db/index.ts:5`) · `assets/exercises/data.json` (guard test) · `assets/exercises/data/exercises.json` (**17 MB**, only required by dead `lib/utils/load-exercises.ts:9`) | 17 MB of tracked dead weight + drift risk. | Delete `assets/exercises/data/exercises.json` after deleting the dead files that import it. |

## (B) Unused dependencies (verified per import)

✅ used · ❌ zero imports · ⚠️ config-only/indirect.

| Dependency | Verdict | Evidence | Recommendation |
|---|---|---|---|
| `expo-background-fetch` | ❌ | Only `package.json`; no `defineTask`/`registerTaskAsync` anywhere (Phase 2 I1) | `npm uninstall`. Low risk. |
| `expo-task-manager` | ⚠️ config-only | No imports; `app.json:38` plugin entry | Remove ONLY together with the `app.json` plugin. |
| `react-native-chart-kit` | ❌ | Zero imports; replaced by custom `components/SimpleLineChart.tsx` (git log confirms) | `npm uninstall`. Low risk. |
| `react-native-svg` | ❌ direct | Only chart-kit's peer + stale in `jest.config.js:5` | Remove AFTER chart-kit; prune jest config. |
| `react-native-draggable-flatlist` | ❌ | Zero imports | `npm uninstall`. Low risk. |
| `expo-auth-session` | ❌ | `useAuth.ts` uses `supabase.auth.signInWithOAuth` + `expo-web-browser`, not auth-session | `npm uninstall`. Low–medium (Google sign-in deferred; re-add deliberately if revisited). |
| `expo-crypto` | ❌ direct | No usage; transitive of auth-session | Remove after auth-session. Re-add when the migration checklist item #1 (client UUIDs) starts. |
| `react-native-web` + `react-dom` | ❌ | No imports; phone-only | Remove only if the web target is dropped (decision pending). |
| `expo-status-bar` / `expo-system-ui` / `expo-splash-screen` | ⚠️ config-only | `app.json` plugins | Keep (or remove dep+plugin together). |
| `nativewind` / `tailwindcss` | ⚠️ **half-wired** | `className=` in ~8 files (`app/session/new.tsx:97-113`, `app/exercise/create.tsx:71-95`, `app/_layout.tsx:120-122,153`, `components/ui/*`), `global.css` imported, but **no `metro.config.js`/`babel.config.js` exists** (verified) | Investigate on device. NativeWind v4 requires `withNativeWind(...)` in metro config; without it the `className` props are likely inert. Risk medium. |
| `drizzle-kit` (dev) | ⚠️ dormant | No npm script invokes it; migrations dead (Phase 2 H1) | Tie to the H1 decision: archive with `lib/db/migrations/` or keep when rebuilding the chain. |
| All others checked | ✅ | `expo-haptics`, `@expo/vector-icons`, `react-native-url-polyfill`, i18n stack, AsyncStorage, expo-notifications, expo-secure-store, expo-localization, expo-image/video/file-system/image-picker/font/web-browser, `@testing-library/react-native`, jest stack | Keep. |

## (C) Dead source files

| # | File(s) | Evidence | Recommendation |
|---|---|---|---|
| C1 | `lib/db/sample-exercises.ts` | Zero importers | Delete. |
| C2 | `lib/utils/load-exercises.ts` | Zero importers | Delete. |
| C3 | `lib/db/import-exercises.ts` | Only imported by dead C2 | Delete after C2. |
| C4 | `lib/utils/exercise-localization.ts` | Zero call sites (all localization goes through `exercise-names.ts`) | Delete. |
| C5 | `components/ProgressionBubble.tsx` | Zero importers (roadmap §2.3 seed decision) | Delete or keep as feature seed. |
| C6 | `lib/utils/progression-mapping.ts` (+ its test) | Only imported by dead C5 | Delete with C5. |
| C7 | `lib/progress/compare.ts` | `compareSessions` zero call sites (UI uses `routine-compare.ts`) | Delete + drop barrel export in `lib/progress/index.ts`. |
| C8 | `.web.ts` variants (4 files) | Never resolved on native; phone-only | Keep iff web is a live goal; else delete. |
| C9 | `lib/db/seed-exercises.ts` | Only imported by `index.web.ts:226` | Keep/drop with C8. |
| C10 | `lib/db/migrations/*` | Dead (Phase 2 H1); journal only tracks 0000/0001/0002_faithful | Archive to `lib/db/migrations_legacy/` (H1 decision pending). |
| C11 | `scripts/import-*.ts`, `scripts/*-supabase*` | Standalone, no app import | **KEEP** — Supabase migration plan. |

**Correction to roadmap §2.3:** `lib/hooks/useProgressionBubble.ts` is ALIVE (`app/progress/exercise-detail/[id].tsx:8,209`). Only the component and the `.web.ts` twin are dead.

**Dead exports inside live files:**
- `SessionCard.exerciseCount` prop — never passed by any caller; unreachable branch + orphan i18n key `session.exerciseCount` (en/es).
- `ExercisePicker.multiSelect` (`@deprecated`) — no caller passes it.

## (D) Unused assets

| # | Finding | Action |
|---|---|---|
| D1 | Fonts/icons all referenced (`useFonts`, `app.json`) | Keep. |
| D2 | `assets/exercises/gifs/` — 125 MB, no code references (code builds remote URLs; gifs are source material for mp4 conversion) | Keep-with-reason today; move out per roadmap §2.1 (biggest tracked weight). |
| D3 | `assets/exercises/data/exercises.json` — 17 MB, only required by dead C2 | Delete after C2/C3. |
| D4 | `assets/exercises/data.json` — used by guard test | Keep. |
| D5 | `assets/exercises/images/` — used by live code | Keep — NOT dead. |

## (E) Config / tooling

| # | Finding | Recommendation |
|---|---|---|
| E1 | `jest.config.js` has no `collectCoverageFrom` — coverage can't surface untested/dead modules | Add `collectCoverageFrom: ['app/**/*.{ts,tsx}','lib/**/*.{ts,tsx}','components/**/*.{ts,tsx}','!**/*.web.*']`. |
| E2 | `transformIgnorePatterns` references uninstalled packages (`@sentry/react-native`, `native-base`) | Prune. |
| E3 | `tsconfig.json` strict but no unused-symbol checks | Add `noUnusedLocals`/`noUnusedParameters` (incrementally). |
| E4 | `drizzle.config.ts` points at a non-tracked DB path | Tie to H1 decision. |
| E5 | npm scripts all valid; `web` script exists for a phone-only app | Keep until web-target decision. |
| E6 | No `metro.config.js`/`babel.config.js` (verified) | Either wire NativeWind or strip `className` + nativewind/tailwindcss. |

## (F) Code-level dead code

- **F1.** NativeWind `className` duplicated as decoration next to inline `style` in ~8 files — likely inert (see B/E6).
- **F2.** `SessionCard` unreachable `exerciseCount` branch + orphan i18n key.
- **F3.** `ExercisePicker` deprecated `multiSelect` shim.
- **F4.** Duplicated data-access layers (Phase 2 L3): `useProgress.ts`/`progress/queries.ts` duplicate aggregate SQL that exists in `queries.ts`; two EN→ES name maps (`lib/db/exercise-names-es.ts` vs `lib/i18n/exercise-translations.ts`).
- **F5.** Stale remote GIF URL fallback (`gif_url` → raw.githubusercontent) — renders only online; consider dropping in favor of the bundled mp4 map.
- **F6.** No large commented-out blocks (verified by pattern grep). Clean.

## Prioritized cleanup action list

**Safe now (low risk, high signal):**
1. `npm uninstall expo-background-fetch react-native-chart-kit react-native-draggable-flatlist expo-auth-session expo-crypto react-native-svg` (svg after chart-kit) + prune `jest.config.js`.
2. Delete `lib/db/sample-exercises.ts`.
3. Delete `lib/utils/load-exercises.ts` + `lib/db/import-exercises.ts` + then the 17 MB `assets/exercises/data/exercises.json`.
4. Delete `lib/utils/exercise-localization.ts`.
5. Delete `lib/progress/compare.ts` (+ barrel export), `components/ProgressionBubble.tsx` + `lib/utils/progression-mapping.ts` + its test.
6. Remove `SessionCard.exerciseCount` (+ orphan i18n key), `ExercisePicker.multiSelect`.
7. Add `collectCoverageFrom` (jest) and `noUnusedLocals`/`noUnusedParameters` (tsconfig).

**Judgment calls (decide first):**
8. NativeWind: wire `metro.config.js` with `withNativeWind` OR strip className/nativewind/tailwindcss. Verify on device.
9. Move `assets/exercises/gifs/` (125 MB) out of the repo (roadmap §2.1).
10. Phase-2 H1: archive `lib/db/migrations/` + `drizzle-kit` + `drizzle.config.ts`, or rebuild the chain. Not both half-alive.
11. Web target: if dropped, delete 4 `.web.ts` files, `seed-exercises.ts`, `react-native-web`, `react-dom`, `web` script.
12. Consolidate the duplicated data-access layers (F4/Phase-2 L3).

## Looks dead but KEEP

- `scripts/supabase-schema.sql`, `scripts/create-delete-account-rpc.sql`, `scripts/import-exercises.sql`, `scripts/import-exercises.ts`, `scripts/import-to-supabase.ts` — the Supabase migration plan.
- `lib/db/migrations/*` — until the explicit H1 decision.
- `.web.ts` variants + `react-native-web`/`react-dom` — pending the web-target decision (roadmap §5.3).
- `expo-status-bar`/`expo-task-manager`/`expo-system-ui`/`expo-splash-screen` — `app.json` plugin entries; removing dep without plugin breaks prebuild.
- `lib/db/exercise-names-es.ts` — USED (`ExercisePicker.tsx:14`, `exercise-names.ts:1`).
- `lib/hooks/useProgressionBubble.ts` — USED by the live exercise-detail screen (roadmap §2.3 is out of date).
- `assets/exercises/gifs/` — intentional source material for offline mp4s (until moved out).
- `test-renderer` — legitimate peer of `@testing-library/react-native` v14.

## Could not be verified statically

1. Runtime NativeWind behavior on device (whether `className` styles apply at all).
2. Exhaustive i18n key-vs-usage diff (one orphan confirmed: `session.exerciseCount`).
3. Whether `drizzle-kit generate` would actually collide (Phase 2 static claim).
4. Test coverage percentages (no `collectCoverageFrom` configured).

## Severity tally

Actively harmful: A3 (125 MB tracked gifs), A5 (17 MB dead dataset), F1/B (inert styling layer).
Hygiene: 6 unused runtime deps, 7 dead source files, 2 dead exports, 2 stale jest patterns.
Clean: no commented-out code blocks, fonts/icons fully referenced, npm scripts valid.
