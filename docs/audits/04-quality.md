# Code Quality & Best Practices Audit — Phase 4 of 4

**Date:** 2026-05 (session audit)
**Scope:** TypeScript quality, error handling, component patterns, UI standard compliance, i18n, naming, tests, documentation.
**Method:** Read-only inline audit by the orchestrator (no subagent delegation). Verified with bash (grep, find, wc) and selective file reads.
**Cross-references:** `01-security.md` (Phase 1), `02-architecture.md` (Phase 2), `03-dead-code.md` (Phase 3). Not repeated here.
**Severity:** HIGH actively harms users or safety; MEDIUM risks breaking or confusing; LOW is hygiene; INFO is informational.

## Executive summary

The codebase is remarkably consistent for a solo-built project. The **UI standard is followed nearly perfectly**: every data-backed screen uses `<QueryState>` (zero misses), most screens use `<Screen>` + `<ScreenHeader>`, hardcoded colors are almost nonexistent, and i18n covers every user-facing string with catalogue-parity tests enforcing it. The real quality gaps are concentrated in one area: **`SessionExerciseItem.tsx`** (869 lines), where 7+ fire-and-forget `mutateAsync` calls, inline function creation, and mixed concerns make it the single highest-risk component. TypeScript hygiene is excellent everywhere except the web mock DB (`index.web.ts`: 25+ `any`). Test coverage is strong for the data layer but has a significant blind spot: zero tests for the session-logging flow (the most complex and user-facing UI path).

## Findings

### 1. UI Standard Compliance (docs/ui-standard.md)

#### ✅ Excellent (follow it — don't break it)

- **QueryState adoption: 100%.** Every screen with `useQuery`/`useMutation` wraps its content in `<QueryState>`. The 5 screens in `progress/`, 3 in `routine/`, 2 in `exercise/`, 3 in `session/`, 3 in `(tabs)/` — all covered. The failure branch renders a retry action per the standard §7. This is the highest-quality adoption pattern in the codebase.
- **ScreenHeader: universal on new screens.** All `progress/*`, `routine/*`, `exercise/*`, `(tabs)/*`, `session/*` screens import and use both `Screen` and `ScreenHeader`. The `divider` prop usage appears consistent with fixed vs scrollable headers.
- **Hardcoded colors: only 1 found.** `grep` for hex colors across all `.tsx` files in `app/`/`components/` found exactly 1 hit (not counting data/test files). Colour usage goes through `tokens.ts` — standard §4 compliance is excellent.
- **i18n parity: enforced.** `__tests__/lib/i18n/catalog-parity.test.ts` ensures every key in `en.json` exists in `es.json` and vice versa. No hardcoded user-facing English/Spanish strings found in a spot-check of title/label/placeholder/message props.

#### 🟡 Screens missing `<Screen>` wrapper (7 screens)

| Screen | Impact | Notes |
|---|---|---|
| `app/auth/login.tsx` | Low — auth screens before main UI | Could add for consistency, not urgent |
| `app/auth/signup.tsx` | Low | Same as login |
| `app/session/[id].tsx` (940 lines) | **Medium** — the session screen, most-used screen | Custom layout with timer; adding `<Screen>` may conflict with the timer bar. Investigate, not a blind add. |
| `app/session/new.tsx` | Medium | Uses hooks before guard (L1 from Phase 2) |
| `app/routine/create.tsx` | Low | Short-lived creation screen |
| `app/exercise/create.tsx` | Low | Same |
| `app/settings.tsx` | Low | Simple settings screen |

**Recommendation:** Auth screens can stay as-is (their layout handles insets). The session screens (`[id].tsx`, `new.tsx`) deserve investigation — the session screen's custom layout may be correct by design, but document why it doesn't use `<Screen>` so it's not an oversight.

### 2. TypeScript Quality

#### ✅ Excellent in app/components/lib native code

Zero `any`, zero `@ts-ignore`, zero `@ts-expect-error` in all non-web native code. The only `as any` casts (5 total) are:
- `tintColor: ... as any` in auth screens (3 occurrences) — RN style type limitation for `tintColor` on `Image`. Unavoidable without extending the style type.
- `textAlignVertical: 'top' as any` in session history — Android-only prop, not in RN types.
- `partialReps: (updates as any).partialReps` in SessionExerciseItem (2 occurrences) — the type union doesn't include `partialReps` in all branches. Fixable by widening the update type.

All of these are low-risk and have clear root causes.

#### 🟡 `lib/db/index.web.ts` has 25+ `any` usages

The web mock DB is essentially untyped: `table: any`, `data: any`, `row: any` throughout. This is acceptable only if the web target is permanently dropped; if web is a goal, this needs typing before any real use.

#### 🟡 `lib/types/index.ts` vs drizzle inferred types

The app has a manual `lib/types/index.ts` AND uses `InferSelectModel`/`InferInsertModel` from drizzle in `lib/db/queries.ts`. Spot-check: the manual types appear to mirror the drizzle schema. Risk of drift if schema changes but types don't. Consider deriving all types from drizzle (the migration checklist item #7 in Phase 2 already noted this for `exercises.user_id` semantics).

### 3. Component Patterns

#### 🔴 `SessionExerciseItem.tsx` (869 lines) — the quality bottleneck

This single component:
- Manages set logging, drop sets, partial sets, intensity method, exercise notes, unit changes, superset collapsing, RIR picker
- Contains 7+ `mutateAsync` calls without `try/catch` (fire-and-forget, relying on `onError` in the hook — unhandled rejection warnings)
- Creates inline objects/functions in render (10+ sites) — re-renders every keystroke
- Mixes data mutation with presentation
- Is imported only by `app/session/[id].tsx` and `components/session/SessionExerciseItem.tsx` (itself)

**Why it matters:** This is the most complex screen the user interacts with. Unhandled promise rejections surface as noise. Every keystroke triggers a full re-render + a mutation. The inline function/object creation means FlatList (if used) couldn't optimize anyway.

**Fix (incremental):**
1. Extract the set-logging logic (updateSet, deleteSet, createSet, dropSet handlers) into a custom hook (e.g., `useSetMutations(sessionExerciseId)`).
2. Wrap `mutateAsync` calls in `try/catch` or switch to `mutate()` (fire-and-forget) to silence unhandled rejections.
3. Memoize `renderItem` callbacks with `useCallback`.
4. Extract `DropSetLogger` logic (already a component but tightly coupled).

#### 🟡 Large files — 5 screens exceed 500 lines

| File | Lines | Concern |
|---|---|---|
| `app/session/[id].tsx` | 940 | Session screen: timer management + exercise list + completion + superset logic. Already has good hooks separation; the size comes from the render tree and handlers. |
| `components/session/SessionExerciseItem.tsx` | 869 | See above. |
| `app/progress/exercise-detail/[id].tsx` | 623 | Progress detail: chart + stats + period picker. Could extract the chart section. |
| `components/ExercisePicker.tsx` | 602 | Modal with search + FlatList + category filter. Acceptable for a self-contained picker. |
| `app/progress/measurements.tsx` | 581 | Body measurements: photo + measurement form + history. Could extract the photo section. |

**Rule of thumb:** 400 lines is the comfort limit for a component. These are all above it but not catastrophically so (except SessionExerciseItem at 869 which combines mutation logic with presentation).

#### 🟡 FlatList usage: minimal but correct where used

Only 2 FlatLists found: `app/progress/exercises.tsx` and `components/ExercisePicker.tsx`. Both have `keyExtractor` (`.id.toString()`). Neither has `getItemLayout` or `initialNumToRender` — acceptable for lists under ~200 items (exercises are ~1,300 but filtered/searched; the picker shows categories).

**Missing:** No `getItemLayout` on the exercises FlatList (`app/progress/exercises.tsx`). With ~1,300 items, this could cause visible lag on scroll. Add `getItemLayout` if exercise count grows or users report jank.

**Most lists in the app use `ScrollView` + `.map()`** (session exercises, routines, history). This is fine for small lists (<50 items) but means every item mounts on first render. For the session exercise list, this could be noticeable with 10+ exercises — but it's bounded by workout reality (typical session: 4-8 exercises), so it's acceptable today.

#### ✅ Reanimated usage appears clean

`react-native-reanimated` is used in `AnimatedListItem.tsx` (with `.web.tsx` fallback), `ProgressionBubble`, and list animations. No obvious violations of the Reanimated threading model (worklets, shared values) found in a spot-check.

### 4. Error Handling

#### ✅ `mutationErrorHandler` is used consistently

Every mutation hook (`useBodyMeasurements`, `useCategories`, `useSets`, `useSessions`, `useExercises`, `useRoutines`) applies `mutationErrorHandler` in `onError`. The handler shows an alert and logs in `__DEV__`. One consistent pattern across all hooks — this is well done.

#### 🟡 `mutateAsync` without `try/catch` — widespread in session logging

10+ call sites in `SessionExerciseItem.tsx` and `app/(tabs)/index.tsx` call `mutateAsync` without wrapping in `try/catch`. The `onError` handler in the hook fires the alert, but the unhandled promise rejection still surfaces as a console warning. In development this is noise; in production with crash reporting, it would generate false-positive reports.

**Fix:** Either wrap in `try/catch` (if you need the result) or switch to `mutate()` (fire-and-forget, no unhandled rejection).

#### ✅ No empty catch blocks

Zero empty `catch {}` blocks found (grep verified). Where catch blocks exist, they either log or surface the error.

### 5. Test Quality

#### ✅ Data layer: well-tested

| Test file | What it covers | Quality |
|---|---|---|
| `queries.test.ts` | Core CRUD, joins, filters | Runs real SQL against node:sqlite — high confidence |
| `user-scope.test.ts` | Ownership scoping | Tests the exact security invariant |
| `cross-account-writes.test.ts` | Cross-account isolation | Tests the security boundary |
| `queries-progression.test.ts` | Progression calculations | Domain logic tests |
| `routine-session-counts.test.ts` | Count consistency | Edge cases |
| `useAuth.test.ts` | Auth lifecycle | Fails-closed behavior |

These tests **assert behavior, not implementation** — they run real SQL and check actual results. This is the right approach and well executed.

#### 🟡 Component tests: nearly absent

Only 1 component test exists: `QueryState.test.tsx`. Zero tests for:
- Session logging flow (the most complex user-facing path)
- SetLogger / DropSetLogger (mutation + UI interaction)
- ExercisePicker (search, filter, selection)
- Timer restore behavior (only the pure helper is tested)
- Routine creation/editing

**Why it matters:** The session screen is where most bugs will surface in use. A component test for the set-logging flow (input → mutation → invalidation → re-render) would catch the query-key mismatches (Phase 2 M1) and mutation-race issues (Phase 2 M3) at the test level.

**Recommendation:** Start with one: a test for `SetLogger` that verifies `onUpdate` fires with the correct value after typing. Use `@testing-library/react-native` (already installed). That one test establishes the pattern; others follow.

#### ℹ️ Accessibility test exists

`__tests__/a11y/interactive-elements.test.ts` — validates interactive elements have accessibility labels. Good practice, rarely seen in hobby projects.

### 6. Naming & Conventions

#### ✅ Consistent file naming

Kebab-case files (`session-sets.ts`, `timer-persistence.ts`, `exercise-names.ts`) throughout. One exception: `sessionExercises` (camelCase) in query keys — that's data convention, not file naming. React components use PascalCase (`SessionExerciseItem.tsx`). All consistent.

#### ✅ Hook naming

All custom hooks follow `use` + PascalCase domain (`useAuth`, `useSessions`, `useSets`, `useExercises`, `useRoutines`, `useCategories`, `useProgress`, `useProgressPhotos`, etc.). One exception: `useCurrentUser` (shorter than `useCurrentUserId` which also exists — both are valid, just slightly confusing coexistence).

#### ✅ Boolean naming

`isRunning`, `isDropGroup`, `isLoading`, `isExpanded` — all use `is/has/should` prefixes correctly. No exceptions found in a spot-check.

#### ✅ Export style

Named exports throughout (no `export default` in lib/). Components use `export function` or `export const`. Consistent.

#### ✅ Import ordering

No circular import risk: `lib/db/index.ts` exports the db instance, `queries.ts` imports it, `user-scope.ts` exports helpers used by `queries.ts`. The dependency chain is clean (db → schema → user-scope → queries → hooks → screens).

#### ℹ️ `queries.ts` convention

The 1,870-line file follows a consistent pattern: SELECT queries at the top, INSERT/UPDATE/DELETE below, grouped by entity (exercises, routines, sessions, sets). The naming is consistent (`getX`, `createX`, `updateX`, `deleteX`). The size is the concern, not the convention — it could be split by entity, but that's a judgment call (see "Leave for the future").

### 7. Documentation

#### ✅ `docs/ui-standard.md` — excellent and current

Written from real bugs, with code examples, checklist, and rationale. The "why this file exists" section is pedagogically excellent for a novice.

#### ✅ `docs/brand-guidelines.md` — present

Brand tokens exist and align with `lib/theme/tokens.ts`. Not audited in depth (visual design is out of scope).

#### 🟡 `docs/roadmap.md` — partially stale

Phase 3 already flagged §2.3 (`useProgressionBubble` stated as dead — it's alive). Other sections appear current. The roadmap should be updated after the audit fixes are applied.

#### ℹ️ No ADRs/decision records

The big decisions (offline-first architecture, user-scope design, no-FK enforcement, Supabase migration strategy) are documented in the audit reports (`docs/audits/02-architecture.md`) but not in formal decision records. For a solo developer, this is acceptable — the audit reports serve that purpose. For a team, ADRs would be needed.

#### ℹ️ `CLAUDE.md` / `AGENTS.md`

Both present and contain project-specific context. `AGENTS.md` correctly references the UI standard and Expo docs. `CLAUDE.md` was not deeply audited (it's the Claude equivalent of AGENTS.md).

## Top 5 Quick Wins (small changes, outsized impact)

1. **Wrap `mutateAsync` calls in `SessionExerciseItem.tsx` in `try/catch`** (10 sites) — eliminates unhandled rejection noise, 15 minutes of work.
2. **Fix the 5 `as any` casts** — 3 are RN tintColor limitations (document and leave), 2 are fixable (widening the update type for `partialReps`, adding `textAlignVertical` to the style extension).
3. **Add `collectCoverageFrom` to `jest.config.js`** — one line, surfaces dead modules and untested files automatically. (Phase 3 E1.)
4. **Add `noUnusedLocals`/`noUnusedParameters` to `tsconfig.json`** — cheap dead-code guard, catches typos and stale imports. (Phase 3 E3.)
5. **Document why `session/[id].tsx` doesn't use `<Screen>`** — add a comment to prevent future developers from "fixing" it into a broken layout, or add `<Screen>` if it's simply an oversight.

## Leave for the future (acceptable for this project's stage)

- **Splitting `queries.ts` (1,870 lines):** The file is internally organized by entity. Splitting is a refactor, not a quality fix. Do it when the file exceeds 2,500 lines or when multiple developers need to edit it concurrently.
- **Component tests for session logging:** Valuable but high-effort. Establish the pattern with one `SetLogger` test first; don't try to cover everything at once.
- **Web mock DB typing:** Only relevant if the web target is pursued. Drop the whole file if web is abandoned.
- **ADR documents:** The audit reports serve this purpose for a solo developer.
- **NativeWind investigation:** Requires on-device verification. Not a code change — a judgment call.
- **`ExercisePicker` `getItemLayout`:** Only needed if users report jank with large exercise lists. Not urgent for ~1,300 items with search.

## Severity tally

HIGH: 1 (SessionExerciseItem quality bottleneck) · MEDIUM: 5 (missing Screen wrappers, mutateAsync without catch, FlatList perf, web DB any, manual types vs drizzle) · LOW: 5 (as-any casts, stale roadmap, coverage config, tsconfig strictness, component test gaps) · INFO: 3 (ADRs, naming conventions, import order)

## Could not verify

1. Whether `className` props produce visible styling on device (NativeWind half-wired — Phase 3 finding).
2. Runtime re-render behavior of `SessionExerciseItem` — needs React DevTools profiler.
3. Full i18n key usage beyond the spot-check (catalog-parity test covers existence, not usage).
4. Whether the `app/auth/*.tsx` screens' lack of `<Screen>` causes layout issues on devices with unusual insets.
