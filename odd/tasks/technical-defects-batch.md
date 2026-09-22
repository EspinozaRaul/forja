# technical-defects-batch

**Status**: in progress — six units authorized on 2026-09-21. **U1 landed as `fix(db): make deleteSession atomic on the shipping sync driver` on `fix/technical-defects-batch`**; U2–U6 are still pending.

**Branch**: `fix/technical-defects-batch`, branched from `main` @ `79df39e` (which is pushed to `origin/main`).

**SHA policy**: U1 is tracked by its subject line, not its SHA, because this document ships inside the U1 commit — an amend of that commit would invalidate a SHA recorded here. U2–U6 commit first and update this document afterwards, so their SHAs can be recorded normally.

**TDD**: **strict, ON**. Source: `.pi/project.json` → `gentlePi.strictTDD: true`, plus the user's explicit choice on 2026-09-21 ("honrarlo de verdad"). Runner: `npx jest`; focused form `npx jest <path>`. RED before implementation, then GREEN, then TRIANGULATE, then REFACTOR. RED/GREEN evidence is required in every unit's return; a unit that cannot have a meaningful pre-implementation behavior test must report that as a narrow, named exception.

**Gate**: `npx tsc --noEmit` clean and `npx jest` green (baseline on `79df39e`: **25 suites / 220 tests**) before any unit is called done.

---

## Goal

Close the six small technical defects that `docs/roadmap.md` §4 had already diagnosed and that need no native rebuild and no product decision:

| Unit | Defect | Roadmap |
| --- | --- | --- |
| U1 | `deleteSession` writes without a transaction | §4.2 |
| U2 | Serialized `createSet` loop when materialising a routine | §4.3 |
| U3 | The two EN→ES exercise-name maps diverge | §4.4 |
| U4 | The `.web.ts` progress hooks have no account guard or key | §4.8 |
| U5 | `signOut` / `deleteAccount` return raw errors | §0.9 (B5) |
| U6 | The bottom sheets have no backdrop press, no `onRequestClose`, no bottom inset | §0.8 (B2) |

Chosen by the user on 2026-09-21 over the two alternatives (simulator verification of T4/T5, and the single native rebuild that would carry Sentry + the 17 patch updates). The reasoning is recorded in the session: this batch is cheap, needs no native rebuild, and closes debt that is already diagnosed and already located.

## The map, and why it changed the plan

Every unit below was mapped by a **read-only scout** on 2026-09-21 before any write. All line numbers are `grep`-sourced, not `read`-sourced (the scout reported that the `read` tool's `offset` re-anchored by up to ~9 lines on two files).

The map **corrected the roadmap on five of the six defects and found two defects the roadmap does not list**. The corrections are load-bearing: acting on the roadmap as written would have produced at least one change that looks correct, passes its tests, and is still wrong on the device (U1), and would have missed a live data-integrity bug (N1). Those are recorded in "Found by the map" below and in each unit's **Correction** line.

---

## U1 — `deleteSession` is not atomic

**Evidence**. `lib/db/queries.ts:499-516`: an ownership-scoped select of `sessionExercises.id` (506-508), then three independent autocommit statements — `db.delete(sets)` (510), `db.delete(sessionExercises)` (512), `return db.delete(sessions)` (513-515). Sole caller `lib/hooks/useSessions.ts:126-140` (`useDeleteSession`), and it ignores the return value.

**Correction (load-bearing)**. Two things in the roadmap are wrong:

1. The failure mode is **not** orphan rows. The deletes are children-first, so children cannot be orphaned by this function. The real residue is a **half-deleted session**: a surviving `sessions` row whose `session_exercises` and `sets` are already gone — an empty session that `getActiveSession` still returns.
2. **The obvious fix is a trap.** The repo's established shape, `await db.transaction(async (tx) => …)`, does **not** provide atomicity on this driver. `lib/db/index.ts:14` opens a **synchronous** database (`openDatabaseSync`), and `node_modules/drizzle-orm/expo-sqlite/session.cjs:53-64` never awaits the callback: it runs `begin`, calls `transaction(tx)`, and immediately runs `commit`. Since every builder's `execute` is `async`, the first `await` suspends and `COMMIT` fires while the callback is still in flight — every statement after the first `await` runs in autocommit. A naive wrap would look right, pass the Jest harness, and give no real atomicity on device.

**Fix shape (as landed in the U1 commit `fix(db): make deleteSession atomic on the shipping sync driver`)**. A **synchronous** callback using the builders' sync executor (`.run()`), which reaches `stmt.executeSync`:

```ts
export async function deleteSession(id: number) {
  const ownedSession = and(
    eq(sessionExercises.sessionId, id),
    sessionOwnedByCurrentUser(sessionExercises.sessionId)
  );
  return db.transaction((tx) => {
    tx.delete(sets)
      .where(
        inArray(
          sets.sessionExerciseId,
          tx.select({ id: sessionExercises.id }).from(sessionExercises).where(ownedSession)
        )
      )
      .run();
    tx.delete(sessionExercises).where(ownedSession).run();
    tx.delete(sessions)
      .where(and(eq(sessions.id, id), ownedByCurrentUser(sessions.userId)))
      .run();
  });
}
```

No `await` anywhere inside the callback. The child-id list is a correlated subquery in `IN (…)` instead of a `.all()` round-trip. `deleteSession(id)` keeps its signature; the only caller ignores the return value, so the blast radius is nil. `db.$client.withTransactionSync(...)` exists as an alternative but is not typed-exported through `lib/db/index.ts`.

**The `.all().map()` plan was refuted twice.** The shipped shape is not the one originally planned here:

1. **First refutation — the planned proxy test home.** On `drizzle-orm/sqlite-proxy`, `all()` is `async` (`sqlite-proxy/session.cjs:154`), so the synchronous callback's `.all().map(…)` throws `TypeError: … .map is not a function` (after the transaction's `begin`, before the child deletes run).
2. **Second refutation — the proxy test already exists.** After the new evidence moved to the expo-sqlite harness, the `.all().map()` shape still failed in the untouched `__tests__/lib/db/cross-account-writes.test.ts`: its `deleteSession cross-account` case calls `deleteSession` under the proxy harness, and it failed with the same `TypeError`. The subquery form runs under **both** drivers — synchronously on expo-sqlite, and as a resolved promise chain under proxy.

The earlier claim in this document that **no single callback shape satisfies both drivers** was wrong: the subquery shape does. Proxy still needs `await` for an *async* callback; it does not need it for a callback that performs no async builder call.

**Test home (strict TDD)** — **corrected on 2026-09-21, and the first attempt was refuted**. The original instruction was to extend `__tests__/lib/db/cross-account-writes.test.ts` (proxy harness, `describe` at 208-226). That is **impossible for the `.all().map()` shape**, and the writer proved it before writing anything: `sqlite-proxy`'s `all()` is `async` (`sqlite-proxy/session.cjs:154`), so the synchronous callback's `.all().map(…)` throws `TypeError: … .map is not a function` at `sqlite-proxy/session.cjs:75` (after the transaction's `begin`, before that child statement runs). Proxy also cannot roll back an un-awaited *async* callback, because its `run()` turns client errors into rejected promises. The later claim that **no single callback shape satisfies both drivers** was wrong — the subquery shape satisfies both (see Fix shape). The claim originally written here — that a green proxy test proves transactionality — was wrong for the `.all()` callback shape.

The correct home is a **new file**, `__tests__/lib/db/delete-session-atomicity.test.ts`, driving **`drizzle-orm/expo-sqlite`** (the real shipping session, the code that carries the defect) over a **fake expo-sqlite client backed by `node:sqlite`**, implementing `prepareSync` / `executeSync` / `executeForRawResultSync`. The writer already probed this harness read-only and observed it running the sync callback **and rolling back** correctly (after injecting a throw on the `session_exercises` delete: `sets` rows 1, `session_exercises` rows 1). This is strictly stronger evidence than the original plan: it exercises the real driver instead of a proxy that awaits properly. The mock is of expo-sqlite's *sync API*, not of drizzle's session.

RED, in that file (four tests as landed):

1. **Behavioral, failure-injection on `session_exercises`**: make that delete throw, then assert the `sets` rows are still present — the earlier child delete must roll back.
2. **Negative control (TRIANGULATE), required**: the same `session_exercises` failure run against an **async-callback replica** of the same three statements leaves the `sets` rows committed — proving both that the fix works and that the commit-before-`await` trap is real. Test-only; never exported production code.
3. **Behavioral, failure-injection on `sessions`** (added by the independent verification, finding 1): make the `sessions` delete throw, then assert **all three** counts are 1 — the fix restores both child tables. This is the residue that matters: the empty surviving session `getActiveSession` still returns.
4. **Negative control for case 3, required**: a test-only replica of the **pre-fix shape** (three sequential awaited autocommit statements, no transaction) run through the same `sessions` injection leaves the half-deleted state `sets` 0 / `session_exercises` 0 / `sessions` 1. This is how case 3's assertion is observed to be discriminating, without reverting the committed fix.

The originally prescribed **structural no-`await` test is dropped as redundant**: with the real driver under test, the trap is now observable *behaviorally* by case 2, which is the stronger guard against someone re-introducing the async shape.

**Still true, and it must be stated in the return**: even this harness mocks expo-sqlite's native layer, so it proves the driver's transaction semantics, **not** on-device atomicity. Do not claim on-device atomicity from a Jest result. `cross-account-writes.test.ts` stays untouched — it keeps its proxy harness, and diverging from `user-scope.test.ts` is avoided.

**Allowed edit surfaces**: `lib/db/queries.ts`, `__tests__/lib/db/delete-session-atomicity.test.ts`.

### Verification record (U1)

Independent read-only verification of the U1 commit `fix(db): make deleteSession atomic on the shipping sync driver` (2026-09-21) confirmed **8 of 9 claims**. The one refuted claim was the verifier's own suspicion that the proxy test was fragile: `sqlite-proxy`'s client is synchronous, so the delete ordering is guaranteed, not microtask luck. The async negative control was judged fair and non-vacuous. Three [Low] findings were raised, plus two commit-message inaccuracies.

| # | Finding | Severity | Resolution |
| --- | --- | --- | --- |
| 1 | The tested residue did not match the described residue: the test injected the failure on the `session_exercises` delete (`sets` 0 / `session_exercises` 1 / `sessions` 1), not on the `sessions` delete (both child tables already emptied, `sessions` row surviving — the empty session `getActiveSession` returns). | Low | Added the `sessions`-injection rollback case and its pre-fix-shape negative control to `__tests__/lib/db/delete-session-atomicity.test.ts`. |
| 2 | The feature document's U1 section was stale: it still showed the `.all().map()` shape with the `if (seIds.length > 0)` guard, said no unit had landed, and asserted that no single callback shape satisfies both drivers. | Low | Corrected in this section: status line, landed subquery shape, and the two refutations. |
| 3 | The claim that **no single callback shape satisfies both drivers** is disproved by the landed subquery shape, which runs on expo-sqlite and proxy alike. | Low | Recorded under Fix shape. |
| 4 | Commit-message conflation: it described the tested residue as if the injected `session_exercises` failure produced it, conflating the tested failure point with the residue the fix actually guards. | — | Corrected in the U1 commit's message. |
| 5 | Commit-message clause "before running any SQL" is inaccurate: the transaction's `begin` runs before the `.map` TypeError. | — | Corrected in the same U1 commit's message. |

The two commit-message inaccuracies (rows 4–5) are corrected **in the U1 commit's message**, which is where the corrected text lives; they are not fixed by rewriting history silently.

---

## U2 — Routine materialisation still awaits one `createSet` per set

**Evidence**. `app/routine/[id].tsx:213` `handleStartSession`; the serial branch is **224-240** (not 220-230 as the roadmap says): `224` `for (const re of routineExercisesWithDetails)`, `225` `await addExerciseToSession.mutateAsync`, `233` `for (let i = 1; i <= plannedSets; i++)`, **`234` `await createSet.mutateAsync({ sessionExerciseId, setNumber: i })`**. Hooks: `lib/hooks/useSets.ts:27-50` → `lib/db/queries.ts:826-845`.

**The landed pattern to copy**, verbatim and already identical in two places: `app/(tabs)/index.tsx:123-134` and `app/session/new.tsx:66-77` — build `setPromises`, push `createSet.mutateAsync(...)`, then `await Promise.all(setPromises)`.

**Correction**. The roadmap says "the N+1 fix landed for the session and home paths". What landed is **fan-out, not batching**: `Promise.all` of the same single-row inserts. The round-trip count is unchanged; only serialized latency was removed. Do not describe this unit as an N+1 fix.

**Fix shape**. Local: replace the inner loop with the established `setPromises` + `await Promise.all(setPromises)` shape. No signature change. The outer per-exercise `await addExerciseToSession` stays serial — each insert returns the id its sets need.

**Test home (strict TDD)**. No test renders `app/routine/[id].tsx`, and the established precedent for screen-internal handlers is **source-structural** (`__tests__/components/routine-start-modal.test.ts`: `fs.readFileSync` + regex over the modal block, 9 tests). New file `__tests__/components/routine-materialization.test.ts` asserting there is no awaited `createSet.mutateAsync` inside the per-set loop and that a `Promise.all` over the collected promises is awaited. **Report this as the narrow strict-TDD exception** — the change is about call concurrency inside a component handler with no render harness, and no cheap behavior-level test exists for it. If the writer finds one, better.

**Allowed edit surfaces**: `app/routine/[id].tsx`, `__tests__/components/routine-materialization.test.ts`.

---

## U3 — The two EN→ES exercise-name maps diverge (severity downgraded)

**Evidence**. Big map: `lib/db/exercise-names-es.ts:5` `EXERCISE_NAMES_ES`, entries 6-1217, **1211 entries**. Small map: `lib/i18n/exercise-translations.ts:7` `EXERCISE_NAME_TRANSLATIONS`, entries 9-162, **136 entries**; accessor `getExerciseNameEs` at 216-219 (normalises with `toLowerCase().trim()`). Of the **22 shared keys, 10 disagree**; 114 small-map keys have no counterpart.

**Call sites**. The big map has exactly one reader, `lib/utils/exercise-names.ts:12` (`EXERCISE_NAMES_ES[name] || name`), consumed by ~20 screens. The small map has exactly **one** reader: `lib/db/index.ts:305` `nameEs: getExerciseNameEs(ex.n)`, at seed time, writing `exercises.name_es` (`lib/db/schema.ts:16`, `lib/db/ddl.ts:21`).

**Correction (severity)**. The roadmap's "the same exercise can be named differently depending on where it is read" is **not reachable today**. `name_es` is read only by `lib/utils/exercise-localization.ts:13-14,30-31`, and **neither `useExerciseName` nor `getLocalizedName` has any consumer** (grep matched only the defining file). The whole `lib/i18n/exercise-translations.ts` module is reached solely through line 305. So this is **data-integrity / latent**, not user-visible. Say so in the commit; do not sell it as a user-facing fix.

**Fix shape**. Point the seed at the single source of truth: `lib/db/index.ts:305` reads `EXERCISE_NAMES_ES[ex.n.toLowerCase().trim()] ?? ex.n` (import from `./exercise-names-es`) instead of `getExerciseNameEs`. One line plus an import. Keep the normalisation — the big map's other reader looks up the raw `name`, so a casing mismatch silently returns English.

**Discriminating assertion for the RED**. Use a key where the two maps disagree, e.g. `dumbbell bench press` (big: "Press de banca con mancuerna"; small: "Press de banca con mancuernas"). Assert the seeded `name_es` equals the **big** map's value. Fails today, passes after.

**Test home (strict TDD)**. `__tests__/lib/db/exercise-metadata-repair.test.ts` already uses the real-SQLite harness and covers seed/repair of exercise metadata (`describe` at 45) — that is the natural home for "the seed writes `name_es` from `EXERCISE_NAMES_ES`".

**Not in scope (recorded, needs the user's call)**: the small map's `EXERCISE_NAME_TRANSLATIONS` + `getExerciseNameEs`, its three sibling translators (`getMuscleGroupEs`, `getCategoryEs`, `getEquipmentEs`), and `lib/utils/exercise-localization.ts` all become dead once the seed stops using them. Deleting dead code is a separate decision that overlaps roadmap §2.3 (the dead-code clusters that have tests covering them).

**Allowed edit surfaces**: `lib/db/index.ts`, `__tests__/lib/db/exercise-metadata-repair.test.ts`.

---

## U4 — The `.web.ts` progress hooks have no account guard or key

**Evidence**. `lib/hooks/useProgress.web.ts` (51 lines): `PROGRESS_KEY` 7; `useExerciseProgress` 9 with `queryKey` 11 and `enabled: !!exerciseId` 21; `useSessionCountByWeek` 25 with `queryKey` 27 and **no `enabled` at all**; `useTotalVolumeByWeek` 39, `queryKey` 41, `enabled: !!exerciseId` 50. `lib/hooks/useProgressionBubble.web.ts` (18 lines): `PROGRESSION_KEY` 7, `useExerciseProgressionData` 9, `queryKey` 11, `enabled: exerciseId != null` 15, `staleTime: 60_000` 16.

Natives (`lib/hooks/useProgress.ts`, `lib/hooks/useProgressionBubble.ts`): every hook calls `useCurrentUserId()`, appends `userId` as the last element of `queryKey`, and ANDs `!!userId` into `enabled`. `useProgressionBubble.ts` additionally has `refetchOnMount: true`, which the web variant drops.

Why the key shape is not cosmetic: `lib/hooks/useAuth.ts:61-64` wipes the cache on sign-out (`setCurrentUserId(null); queryClient.clear();`) **because** keys are account-scoped. Web keys would be shared across accounts by construction.

**Correction (count and framing)**. There are **four** `.web.*` files, not two: `lib/db/index.web.ts` (a whole in-memory fake database) and `components/ui/AnimatedListItem.web.tsx` are the others. And §5.3's suspicion that the web target may be dead is **not** established: `package.json:69` ships `"web": "expo start --web"`, `app.json:33-35` declares web config, and `react-dom` / `react-native-web` are real dependencies. Practical severity is nonetheless low, because on web the data layer is itself a mock (`lib/db/index.web.ts`).

**Fix shape**. Mechanical, local: import `useCurrentUserId` from `./useCurrentUser`, read `userId`, append it to `queryKey`, and AND `!!userId` into `enabled` — in four hooks. `useSessionCountByWeek` needs an `enabled` gate created (native has `enabled: !!userId`). No public signature changes.

**Test home (strict TDD)**. No test imports either `.web.ts` (Metro resolves them implicitly, so nothing imports the path). New file `__tests__/lib/hooks/useProgress.web.test.ts` asserting `queryKey` ends with `userId` and `enabled === false` when the user is null. **Caveat to resolve first**: under `jest-expo` Jest resolves `.ts` before `.web.ts` — check `jest.config.js` (`platform` / `haste.defaultPlatform`); if the web variant is not reachable by implicit resolution, the test must import the explicit `../../../lib/hooks/useProgress.web` path. If it cannot be reached at all, say so and report the exception rather than writing a test that silently exercises the native file.

**Allowed edit surfaces**: `lib/hooks/useProgress.web.ts`, `lib/hooks/useProgressionBubble.web.ts`, `__tests__/lib/hooks/useProgress.web.test.ts`.

---

## U5 — `signOut` / `deleteAccount` return raw errors

**Evidence**. `lib/hooks/useAuth.ts:131-134` (`signOut` returns the raw Supabase error object) and `:136-164` (`deleteAccount` returns the raw rpc error, 161-163). Sole consumer `app/settings.tsx:50`, `handleSignOut` 75-83, `handleDeleteAccount` 85-93 — both ignore the error's content and show their own copy (`settings.signOutFailed`, `settings.deleteAccountFailed`; both keys exist in `lib/i18n/es.json` at 829 and 821). So the roadmap's "nothing leaks today" is **verified true**.

**The established fixed pattern** (T3): `lib/auth/auth-error-message.ts` — `LocalizedAuthError` 39-45, `classifyAuthError` 97, `authErrorMessageKey(error, namespace)` 144-150, private tables `LOGIN_KEYS` 52 / `SIGNUP_KEYS` 65. Used at `app/auth/login.tsx:43,56,157` and `app/auth/signup.tsx:55`, in the shape `if (__DEV__) console.error(...); showAlert(t('common.error'), t(authErrorMessageKey(error, 'login')));`.

**Correction**. This is **not** a shape tidy-up. `authErrorMessageKey`'s `namespace` is typed `'login' | 'signup'` (144) and the two key tables' copy is login/signup-specific — `es.json:20` literally reads "Sin conexión. Para iniciar sesión necesitás conectarte a internet.", which is wrong for a sign-out failure. So the unit must widen the union, add a namespace table, and add keys to **both** catalogues. Also: a shared classifier **does** already exist — T3 did not do it inline, so do not write a new one. Do **not** reuse `lib/utils/mutation-error.ts`: it is not a classifier (it logs and shows a fixed string).

**Fix shape**. Widen the namespace union; add a `Record<AuthErrorCategory, string>` table beside the two existing ones; add the corresponding keys to `lib/i18n/es.json` and `lib/i18n/en.json`; route `app/settings.tsx:75-93` through `t(authErrorMessageKey(error, …))` with `__DEV__`-only `console.error`, mirroring `login.tsx:40-43`. Leave `useAuth.ts` returning the SDK error untouched — classification belongs at the display edge, consistent with the auth screens.

**Test home (strict TDD)**. `__tests__/lib/auth/auth-error-message.test.ts`: `describe('classifyAuthError')` 45, `describe('authErrorMessageKey')` 147, with negative controls at 235 ("never derives its output from the raw error message"), 248-262 (namespace leaks) and 204 ("resolves every mapped key in both catalogues"). The RED is a new-namespace test whose keys do not exist yet — the catalogue-resolution guard at 204 fails first. `__tests__/lib/i18n/catalog-parity.test.ts` will also fire on any key added to only one catalogue.

**Allowed edit surfaces**: `lib/auth/auth-error-message.ts`, `lib/i18n/es.json`, `lib/i18n/en.json`, `app/settings.tsx`, `__tests__/lib/auth/auth-error-message.test.ts`.

---

## U6 — The three bottom sheets

**Evidence**. Three sheet instances in two files, all with the same three gaps:

| sheet | `Modal` | backdrop | card | action row |
| --- | --- | --- | --- | --- |
| Create Folder | `app/(tabs)/routines.tsx:213` | 214 plain `View` | 215 | 264-281 |
| Move to Folder | `app/(tabs)/routines.tsx:285` | 286 plain `View` | 287 | 319-336 |
| Edit Folder | `app/routine/folder/[id].tsx:229` | 230 plain `View` | 231 | 280-295 |

No `onRequestClose` on any of the three (Android hardware back does nothing while the sheet is open); the backdrop is a `View`, not a `Pressable`; and the card's `padding: spacing.lg` is uniform, so the action row sits under the nav bar / home indicator. `app/(tabs)/routines.tsx` does not import `useSafeAreaInsets` at all.

**The fix template already exists**: `components/progress/RoutinePickerModal.tsx` — `onRequestClose` 63, backdrop `Pressable` with `onPress` + accessibility label/role 66-75, inner card `Pressable` with `onPress={(e) => e.stopPropagation()}` 77, `maxHeight: '70%'` 83, `paddingBottom: spacing.xl + insets.bottom` 86.

**Correction (scope)**. (a) There are **three** sheet instances, not the two files the roadmap names. (b) Containment is **already correct** in all three (card `MODAL.MAX_HEIGHT`, body `flexShrink: 1` + `MODAL.MAX_BODY_HEIGHT`, only the action row after `</ScrollView>`) — T1/T2 landed here, so this is a residual, not a containment re-do. (c) The missing-`onRequestClose` class extends to four more centred dialogs the roadmap does not name: `components/ui/ConfirmDialog.tsx:40`, `components/IntensityMethodPicker.tsx:32`, `components/session/SessionExerciseItem.tsx:524`, `app/session/[id].tsx:770`. Those are centred, so they have no inset issue; their `onRequestClose` gap is recorded, not fixed here. (d) The inset rule is **not** missing from the standard: `docs/ui-standard.md` §1 (line 40), §3 (51-62) and the checklist at 270-272 already require it, and §8 line 180 already says "Keep `onRequestClose` wired for the Android hardware back button". What §1 lacks is a checklist line for **backdrop-tap dismissal**.

**Fix shape**. Four edits per sheet: add `onRequestClose`; make the backdrop a `Pressable` with close `onPress` + accessibility label/role; make the card a `Pressable` with `onPress={(e) => e.stopPropagation()}` and `accessible={false}`; replace the card's uniform `padding` with `paddingHorizontal`/`paddingTop: spacing.lg` + `paddingBottom: spacing.xl + insets.bottom`, adding the `useSafeAreaInsets` import to `routines.tsx`. Use `MODAL.MAX_HEIGHT`, not the template's literal `'70%'` — `docs/ui-standard.md:182-187` says follow the principle, not the literals.

**Do not regress B1**: without `stopPropagation` on the card, the new backdrop tap would dismiss the sheet on any card tap. That contract is already guarded by `__tests__/components/session-modal-dismissal.test.ts`.

**Test home (strict TDD)**. No test covers these three sheets. New file `__tests__/components/bottom-sheet-containment.test.ts`, source-structural over the three blocks (precedent: `routine-start-modal.test.ts`), asserting `onRequestClose`, backdrop `Pressable` + `onPress`, `stopPropagation` on the card, and `insets.bottom`. Report the strict-TDD exception honestly: insets and hit-testing are not meaningfully observable through React Native Testing Library here.

**Allowed edit surfaces**: `app/(tabs)/routines.tsx`, `app/routine/folder/[id].tsx`, `__tests__/components/bottom-sheet-containment.test.ts`, and `docs/ui-standard.md` only if the §1 checklist line for backdrop-tap dismissal is added.

---

## Found by the map, NOT scheduled

These are new, unlisted, and **not** part of this batch. They are recorded because the map surfaced them and they are more consequential than some of the units above. Each needs its own decision.

### N1 — `PRAGMA foreign_keys` is never enabled, so every declared cascade is inert

`lib/db/ddl.ts:84` (`session_id … ON DELETE CASCADE`) and `:98` (`session_exercise_id … ON DELETE CASCADE`) declare cascades, but **no `PRAGMA foreign_keys` appears anywhere in the repository** (grep over `**/*.{ts,tsx,json,js}` → zero matches) and SQLite defaults it **off**. Consequence: `deleteSessionExercise` (`lib/db/queries.ts:718-724`) deletes only the `session_exercises` row and relies on cascade — so it **does** leave genuinely orphaned `sets` rows. This is a live data-integrity bug on a shipped path, and it is the real "orphan rows" the roadmap attributed to `deleteSession`.

It is **not** a one-line fix: enabling the pragma on an existing database that already contains orphaned rows can fail operations and changes behaviour app-wide. It needs a cleanup path and its own verification.

### N2 — The repo's transaction pattern does not provide atomicity on this driver

The five existing `await db.transaction(async (tx) => …)` sites — `lib/db/queries.ts:388, 630, 744, 921, 1110` — have the same defect U1 corrects: the sync expo-sqlite session never awaits the callback, so `COMMIT` fires at the first `await` and later statements run in autocommit. Pre-existing, and out of scope for U1. Fixing it means converting each callback to the synchronous `.run()`/`.all()` shape, one site at a time, each needing its own evidence.

### N3 — The docs are stale about the push

`docs/roadmap.md:16` and `odd/tasks/ux-corrections-batch.md:5,561` still say nothing was pushed and quote 24 / 46 commits ahead. `main` was pushed on 2026-09-21 (`616a25a..79df39e`) and is now 0/0 against `origin/main`. The roadmap also still carries the two claims this batch corrects (U1's failure mode, U2's line range and "N+1 fix landed"). Refresh both documents when this batch closes.

---

## Gate

- `npx tsc --noEmit` — clean.
- `npx jest` — green. Baseline on `79df39e`: 25 suites / 220 tests. Each unit's new tests raise that count; the return must state the observed numbers.
- Per unit: focused test observed failing first (RED), then passing (GREEN), with the exact commands reported.
- Nothing is pushed until the user says so; each unit is one work-unit commit on `fix/technical-defects-batch`.

## Revert

Each unit is a single commit on `fix/technical-defects-batch`, so `git revert <sha>` per unit is clean. U1 changes only `deleteSession`'s internals and its return shape (no caller reads it). U3 changes one line of the seed path. U4 touches only `.web.ts` variants. U5 widens a union and adds catalogue keys. U6 is confined to three JSX blocks.

## Process notes

- **The measurement scripts are still uncommitted** (roadmap §0). The counts in this document come from grep output observed on 2026-09-21, not from a committed script, so they cannot be re-derived from the repository. Same gap the roadmap flags.
- **The scout had no shell** (only `read`/`grep`/`find`/`codegraph`), so it could not run `git log -S`: commit references `a21a982` (T3) and the D2 batch fix are **unverified**. The D3 counts come from hand-enumerating the 136-entry map and grepping all 136 keys against the big map.
- Strict TDD was declared in `.pi/project.json` and never activated in the 2026-09-20 session. This batch resolves that: mode, source and runner are recorded at the top of this document and forwarded on every delegation.
