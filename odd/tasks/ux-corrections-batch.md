# Feature: UX corrections batch

**Workflow**: ODD (Organic Driven Development)
**Scope**: Forja application code (`app/`, `components/`, `lib/`, `docs/`)
**Status**: in progress — T1 closed (`195a611c` + `baea66b`, verified on the iOS simulator); T2 closed (`ad867b1`); T3 closed; T5/T6/T7 blocked on decisions. Separately, the iOS 27 launch blocker is closed on `fix/ios27-scene-lifecycle` (`25f0e11`).

---

## Goal

Fix the five defects the user found by using the app on a real device, in severity order, so
that the two that make the app unusable are closed first and the rest follow as separate,
reviewable work units.

Every observation below was raised by the user against the running app. Where a cause is
recorded as verified, it was read in the code or the artifact during this session, not inferred
from the report.

## Severity

| # | Observation | Severity | Status |
| --- | --- | --- | --- |
| 04 | Start-session modal with a long list traps the user; the start button is unreachable **and there is no way to close it** | critical | closed — T1 fixed in `195a611c` and `baea66b` |
| 05 | Login surfaces a raw SDK network error and the app becomes unusable without a network: the auth gate depends on connectivity while all user data is local | critical | **layer (a) closed by T3**; the layer (b) premise is corrected in T3 — a valid session already works offline, so what remains is a genuinely signed-out user needing network |
| 03 | Replacing an exercise mid-session keeps the previous exercise's numbers | high | behavior decided; superset case open |
| 06 | The app has no large-text strategy; non-modal surfaces overflow at accessibility text sizes | high | open — out of scope for this batch |
| 02 | Exercise picker is missing the example images on many rows | medium | needs one user datum |
| 01 | Routine header's Edit/Delete buttons are oversized and eat vertical space | low | needs one style decision |

---

## T1 — Modal containment (Obs-04)

**Severity**: critical. **Authorized to start.**

### Evidence

`app/routine/[id].tsx:422-465`. The dialog is:

```tsx
<Pressable style={{ flex: 1, overlay, justifyContent: 'center', alignItems: 'center', padding: lg }}>
  <Pressable style={{ backgroundColor: card, padding: lg, width: '100%', maxWidth: 400 }}>  {/* no maxHeight */}
    title + message
    <View> {lastSession.exercises?.map(...)} </View>   {/* grows with no bound */}
    <View row> [startFresh] [continueLast] </View>     {/* last child of a centred column */}
  </Pressable>
</Pressable>
```

Three facts, in order of damage:

1. The card has **no `maxHeight`** and the list has **no `ScrollView`**, so the content grows past
   the viewport.
2. The action row is the **last child of a centred column**, so when the content overflows, the
   two buttons are pushed off-screen and cannot be reached — there is nothing to scroll.
3. The only escape is tapping the backdrop (`onPress={() => setShowStartModal(false)}`), but the
   overgrown card covers almost the whole screen, so the tappable backdrop shrinks to nothing.
   **The user is trapped inside the modal and cannot start the session or close it.** The user
   lost that session because of this.

### The correct pattern already exists in this repository

`components/progress/RoutinePickerModal.tsx`: card `maxHeight: '70%'` (line 83) and an inner
`ScrollView` (line 161) with `maxHeight: 360`. This is the reference to standardize on. No new
pattern needs to be invented.

### Approach

1. Add `MAX_HEIGHT` to the `MODAL` constant in `lib/constants/layout.ts`. At the time it exported
   only `WIDTH`, `MAX_WIDTH`, `HANDLE_HEIGHT`, `HANDLE_WIDTH`; the missing bound is the root of
   this whole class of defect.
2. In `app/routine/[id].tsx`, bound the card with that constant, put the **variable-length body
   content** inside a `ScrollView` that can shrink (`flexShrink: 1`), and keep the action row
   **outside** the scroll region so it is always visible and always reachable. The first commit
   scoped the scroll region to the list only; the correction moved the title and the message in as
   well, because text grows with the OS accessibility size (see *Correction history*).
3. Keep the backdrop-close escape reachable: the bounded card leaves tappable overlay, and the
   modal keeps `onRequestClose` for the Android back button.
4. Add the rule to `docs/ui-standard.md`, which today says nothing about modals beyond "clears its
   own bottom inset": a modal's card is height-bounded, its variable-length content scrolls, and
   its actions are pinned outside the scroll region.

### Gate

The reported case is reproduced with a session long enough to overflow, and the start button is
reachable with the actions visible. `npx tsc --noEmit` clean and `npx jest` green.

**The runtime half is now satisfied** on a clean cold start on the iOS simulator; the measurements
are below.

### Runtime verification (Obs-04)

The check ran on the iOS simulator, device `Forja-SE3` (iPhone SE 3rd gen, 375x667pt), on a **clean
cold start**, against a seeded fixture: a routine of 15 exercises with a completed previous session
of 15 exercises x 3 sets, which overflows the viewport by a wide margin. The figures come from
screenshot pixel analysis, not from visual impression.

| measurement (667pt viewport) | default text size | `accessibility-extra-extra-extra-large` |
| --- | --- | --- |
| dialog card | 432.5pt tall, centred (y 117.0 -> 549.5pt) | 432.5pt, same |
| `MODAL.MAX_HEIGHT: '70%'` resolved | ~433pt = `(667 - 2 * 24) * 0.70`, i.e. against the parent's content box, not the viewport (70% of 667 would be 467pt) | same |
| body / scroll region | ~180pt available | ~180pt available |
| action row (primary button bbox) | 70.0pt (y 453.0 -> 523.0pt) | 185.0pt (y 338.0 -> 523.0pt) |
| geometry at the default text size | pixel-identical before and after the correction: 35,524 accent-coloured pixels, same y range | n/a |

**Corrected rule.** Only the action row sits outside the scroll region; the title, the message and
every other variable-length body content live inside it. The reason is arithmetic, not a rendering
detail: text grows with the OS accessibility size, so anything left outside the scroll region is
subtracted from the actions' budget. On this viewport the card's content box is ~383pt; at the
largest text size the action row alone is 185pt, leaving the body about 180pt.

Two honest gaps remain:

- **The `lastSession === null` path was not measured.** It is structurally changed: where the title
  and the message were previously direct children of the card, they now sit inside a `ScrollView`
  that carries a 16pt bottom margin, so that dialog may render about 16pt taller. Not a containment
  risk, but unverified.
- **The elevated "last session" box now scrolls with the content** instead of being the scroll frame
  itself, so its border scrolls away with it. An intentional consequence of the correction, not
  verified visually beyond the default-size render.

The check ran on a simulator, not on a physical phone; the user's own device remains untested.

### Evidence

Implemented on `fix/ux-corrections` (branched from `main` @ `616a25a2`) and committed in two work
units:

- `195a611c` — the containment fix: the card bounded by `MODAL.MAX_HEIGHT`, and the previous-session
  list moved into a `ScrollView` carrying `flexShrink: 1` and `MODAL.MAX_BODY_HEIGHT`.
- `baea66b` — the correction: the title and the message joined the scroll region, so only the action
  row stays outside it; the guard assertion was inverted and §8 of the UI standard was rewritten.

| File | Change |
| --- | --- |
| `lib/constants/layout.ts` | `MODAL.MAX_HEIGHT: '70%'` and `MODAL.MAX_BODY_HEIGHT: 360`, each with the reasoning as a comment |
| `app/routine/[id].tsx` | card bound by `MAX_HEIGHT`; the title, the message and the previous-session list inside one unconditional `ScrollView` carrying `flexShrink: 1` and `MAX_BODY_HEIGHT`; only the action row outside it |
| `docs/ui-standard.md` | §8 plus a checklist item, written as a target rather than as shipped state; header metadata bumped |
| `__tests__/components/routine-start-modal.test.ts` | source-scanning guard, 9 tests |

Gate on the second commit: `npx tsc --noEmit` exit 0; `npx jest` → **18 suites / 147 tests**, from a
baseline of 17 / 138. The delta is the single new suite.

### What the guard does and does not prove

Each containment property has its own assertion, and each was proven to fail when that property
alone is removed: the card bound, the body bound, `flexShrink: 1`, and the ordering of the actions
after the scroll region.

Known gaps, accepted rather than hidden:

- **Dismissal is unguarded**: deleting `onRequestClose`, the backdrop `onPress`, or the card's
  `stopPropagation` leaves all 9 tests green, even though §8 requires the escape hatch.
- **Constant values are unguarded**: the assertions check the shape of the values, not that they are
  safe. `MAX_HEIGHT: '100%'` would pass while removing the tappable backdrop strip.
- **Runtime containment is unprovable statically.** No static check can show that Yoga applies the
  `flexShrink: 1` at runtime; the body cap is a secondary limit, not a proof. The simulator run
  above now supplies that evidence on a 667pt viewport.

### Correction history

Three independent verification rounds ran against the first commit, `195a611c`. They refuted, in
order: a guard test that could not fail on the very property the fix depends on; a doc that
contradicted its own reference and claimed a universal standard while one of eleven files was
fixed; and a hard cap that was described as removing the shrink dependency while the arithmetic
shows it does not. Each correction was itself re-verified.

The simulator run then found what those rounds could not:

- The guard contained an assertion named `keeps the title and message outside the scroll region`.
  It froze the defective arrangement as a requirement, which is why the suite could not catch it.
  It is now inverted, and the scroll region gained an unconditional-render check so a guarded
  region cannot satisfy the indices silently.
- Section 8 of the UI standard stated the same inverted rule and carried a containment threshold
  (a viewport figure) that the arithmetic does not support. Both were corrected; the paragraph now
  states the rule as arithmetic.
- **Process lesson.** After a STRUCTURAL JSX change, Fast Refresh left a stale native layout in the
  simulator. That produced a fake measurement — an action row of 382.5pt with 222pt of empty space
  inside a card whose content box is ~383pt — and a fake diagnosis. A change was built on top of
  that artifact and then reverted. Simulator measurements of a layout change must be taken on a
  clean cold start, never on a Fast-Refreshed tree.

## T2 — Modal sweep (Obs-04)

**Severity**: critical. **Authorized to start.**

The user explicitly asked for every occurrence of this situation to be fixed, not just the one
that bit them.

**17 `<Modal>` usages across 11 files.** (This said 18 until the sweep counted them and reconciled
it against the source; the per-file counts were right and only the total was off by one.) T1 fixed
`app/routine/[id].tsx`, and `components/progress/RoutinePickerModal.tsx` was already the reference.

| File | Modals | Result |
| --- | --- | --- |
| `app/routine/[id].tsx` | 1 | bounded + scroll region — T1 |
| `components/progress/RoutinePickerModal.tsx` | 1 | already bounded — the reference |
| `app/session/[id].tsx` | 3 | all three bounded + scroll region: superset picker, routine diff, cancel/end confirm |
| `app/(tabs)/routines.tsx` | 2 | both bounded + scroll region: create-folder form, move-to-folder list |
| `app/(tabs)/index.tsx` | 1 | bounded + scroll region; the start action moved outside the scroll under the same loading condition |
| `app/routine/folder/[id].tsx` | 1 | bounded + scroll region: edit-folder form |
| `components/ui/ConfirmDialog.tsx` | 1 | bounded + scroll region around title/message; API, props, behaviour and dismissal unchanged |
| `components/IntensityMethodPicker.tsx` | 1 | bounded + scroll region around title/subtitle/options; cancel stays outside |
| `components/session/SessionExerciseItem.tsx` | 1 | bounded only — the custom-rest dialog is a short fixed body that cannot grow |
| `components/ExercisePicker.tsx` | 3 | **unchanged, with reason**: full-screen `presentationStyle="pageSheet"` modals already bounded by the screen, each with its own scroll region and fixed header/footer rows |
| `app/exercise/[id].tsx` | 2 | **unchanged, with reason**: fixed 300x300 media lightboxes — no card, no action row, no growing content |

Each file was judged on its own content rather than blanket-patched. Leaving a file unchanged is a
legitimate outcome only with a written reason, and both files above carry one.

### Findings the sweep surfaced, deliberately NOT fixed here (they are not containment)

1. `app/session/[id].tsx`: the routine-diff and cancel/end card `Pressable`s carry `accessible={false}`
   but no `stopPropagation`, unlike T1's routine modal. A tap on non-interactive card content bubbles to
   the backdrop `Pressable` and dismisses the dialog. Pre-existing, and changing it would alter dismissal
   semantics — its own decision.
2. The bottom sheets (`app/(tabs)/routines.tsx`, `app/routine/folder/[id].tsx`) have no backdrop press,
   no `onRequestClose` and no bottom safe-area inset padding, while §1 of the UI standard expects a bottom
   sheet to clear its own bottom inset, as `RoutinePickerModal` does. Pre-existing.
3. `components/session/SessionExerciseItem.tsx` is bound-only by design, so at the largest accessibility
   text sizes a bound-only card with no scroll region can still clip its buttons. That is a residual of the
   Obs-06 large-text gap, not of this sweep.

### Gate

Every modal file is either bounded or has a written reason it cannot overflow. The sweep applies
the corrected rule from T1: the card is bounded, **only the action row** sits outside the scroll
region, and the title, the message and all variable-length content scroll inside
`MODAL.MAX_BODY_HEIGHT` with `flexShrink: 1`. The sweep is unblocked now that T1 is closed.
`npx tsc --noEmit` clean and `npx jest` green.

## T3 — Login error honesty (Obs-05, layer a)

**Severity**: critical. **Authorized to start.**

### Evidence

The user's brother lost his session and could not sign back in with any account; the app showed:

```text
Error
fetch failed: java.net.ConnectException: Failed to connect to
tvhirldahraymahvthfq.supabase.co/172.64.149.246:443
```

Verified in this session:

- **The Supabase project is alive and reachable**: `/auth/v1/health` answers
  `{"message":"No API key found in request"}`, the base returns HTTP 404, and DNS resolves to
  `172.64.149.246` and `104.18.38.10`. The failure was the device's network, not the backend.
- `app/auth/login.tsx:39` → `showAlert(t('common.error'), error.message)` renders the raw SDK
  message. The same raw pass-through happens at `:155` (password reset); the Google branch at
  `:53-54` translates only `auth.*` keys.
- `lib/hooks/useAuth.ts:84` → `onAuthStateChange((_event, session) => applySession(session))`
  applies **every** event without distinguishing them, and `applySession(null)` clears the query
  cache and drops the user at the login screen. This was recorded as the likely lockout mechanism.
  **It is wrong, and correcting it matters.** `@supabase/auth-js`'s `_refreshAccessToken` catch
  block guards the only path that can remove a session with `if (!isAuthRetryableFetchError(error))`:
  a network failure produces exactly that error type, so it is excluded from session removal, and the
  code carries a comment explaining the proactive-vs-reactive distinction. A network blip never signs
  a user out, and with a valid stored session `getSession()` reads from SecureStore — so the app does
  reach its logged-in state offline. **The real sequence was: his session was genuinely gone, and then
  he could not sign back in because there was no network — while the app told him nothing about why.**
  That makes this task the whole fix for the reported case rather than the cheap half of it.

### Approach

Distinguish "there is no connection" from "these credentials are wrong", translate every case, and
stop rendering SDK internals. This continues the SEC-15 decision (release must not surface
internals). No retry button was added: the message tells the user to get online, and the sign-in
button is one tap away, so a second button would duplicate it.

### Outcome

`lib/auth/auth-error-message.ts` classifies an auth error into a category using only its structured
fields — `name`, `status`, `code` — and never `error.message`, because that text is
environment-specific (on Android a Java class name, an IP and the project hostname). It exposes
`classifyAuthError` and `authErrorMessageKey(error, namespace)`, and the app's own Google sentinels
travel through a `LocalizedAuthError` marker so they keep their key through a real field instead of a
message-string sniff. Both auth screens route every error path through it and log the raw error in
`__DEV__` only, matching `lib/utils/mutation-error.ts`. The previously dead
`auth.login.error.invalidCredentials` and `generic` keys are now used, and the password-reset success
message no longer reuses the "¿Olvidaste tu contraseña?" question.

`app/auth/signup.tsx` carried the same raw pass-through and was fixed in the same unit.
`app/settings.tsx` was already correct, so the defect was confined to the two auth screens.

### Gate

`npx tsc --noEmit` exit 0; `npx jest` 19 suites / 178 tests (baseline 18 / 147). The suite's negative
control reintroduces the raw pass-through and fails with the exact leak
(`Expected: "auth.login.error.network" / Received: "fetch failed: java.net.ConnectException: ..."`).
The i18n catalogues were checked for key parity: 659 keys in both, no orphans.

A real forced network failure was NOT observed at runtime. The classification is asserted against
fixtures carrying the real error shape, which is what the message-honesty claim needs; that the SDK
reports a given failure as `AuthRetryableFetchError` is the library's contract, not something this
suite measures.

### Findings recorded, not fixed here

1. `lib/hooks/useAuth.ts` exports `signIn` and `signUp`, and **no screen calls them** — the login and
   signup screens call `supabase.auth` directly. Dead code, and the reason the hook's error shape
   never mattered.
2. `signOut` and `deleteAccount` still return raw errors. `app/settings.tsx` shows its own catalogue
   string for each, so nothing leaks today; recorded rather than chased.

## T4 — Replace-exercise data reset (Obs-03)

**Severity**: high. **Behavior decided; superset case open.**

### Verified cause

- `lib/db/queries.ts:604-612`: `replaceSessionExercise(id, exerciseId)` performs **only**
  `UPDATE session_exercises SET exercise_id = ?`. It never touches the sets.
- `sets` rows hang off `sets.sessionExerciseId` (`lib/db/schema.ts:104`) and that row's `id` does
  not change, so **the sets survive carrying the previous exercise's weight and reps**.
- `components/session/SessionExerciseItem.tsx:122`:
  `finalWeight = updates.weight ?? set.weight ?? pendingWeightsRef.current.get(set.id) ?? null` —
  completing a set copies the placeholder into the row and persists it, so the guidance value
  stops being ephemeral.
- "Anterior" placeholders resolve by `sessionExercise.exerciseId` (`app/session/[id].tsx:90`,
  `getPreviousForExercise`), so after the swap the placeholder must be re-resolved.
- The set template is materialized empty at session start: `app/routine/[id].tsx:205-240`.

### Decided behavior (user, 2026-09-20)

1. The **new** exercise shows the prefill from **its own** last session; if it was never
   performed, it starts at zero. "No se inventa nada."
2. An outgoing exercise that **already has sets with real data** keeps them, attributed to it,
   and remains in the session as a **separate entry**.
3. An outgoing exercise with **nothing loaded** (template only) has its slot **recycled** and
   starts clean — no extra entry is added.
4. The replaced exercise's data is never modified or deleted.

### Open question before implementing

Superset pairs (`session_exercises.superset_pair_id`, `createSuperSetPair`, `unlinkSuperSet` in
`lib/hooks/useSessions.ts`): what happens to the link when one member of a pair is replaced is
**undefined**. Resolve before writing.

### Confirmed correct — do not touch

- Finishing the session without updating the routine leaves the previous exercise in the routine.
- History records the session with the changed exercise.

## T5 — Exercise picker images (Obs-02)

**Severity**: medium. **Blocked on one user datum.**

`components/ExercisePicker.tsx:351` → `item.originalId ? EXERCISE_IMAGES[item.originalId] : null`,
with the `t('exercisePicker.exercise')` placeholder at `:407-410`.

The repository side is verified healthy: `assets/exercises/{images,gifs,videos}` hold 1324 files
each, `lib/assets/exercise-images.ts` has 1324 zero-padded keys, `data.json` has 1324 exercises,
and **0 dataset ids are missing from the map**. The seed writes `originalId: ex.id`
(`lib/db/index.ts:247`). Therefore a placeholder can only appear when `originalId` is falsy on the
persisted row — that is device database state, not a repository defect.

Two branches meet here, and both cut the wrong way:

- `main` (`lib/db/index.ts:171-190`) runs `await db.delete(exercises)` plus a re-seed when
  `needsMigration` is true. That would repopulate every `original_id`, but it is exactly the
  destructive migration that orphaned `routine_exercises` / `session_exercises`.
- `fix/timer-restore-and-exercise-repair` (`8ab7ca7`) repairs in place but **only touches rows
  with `original_id IS NOT NULL`**, so it would not repair legacy seeded rows carrying a NULL.

**Needed**: whether one specific exercise is consistently missing its image (data) or the same row
alternates (render). A by-name repair has never existed in any branch and would be new work.

## T6 — Routine header buttons (Obs-01)

**Severity**: low. **Blocked on one style decision.**

`app/routine/[id].tsx:290-302`. Each button sits in a `<View style={{ flex: 1 }}>` inside a row
container with no `flex` and no width, which is a real layout smell. `components/ui/Button.tsx`
without `compact` applies `paddingHorizontal: spacing.lg` (24) and `paddingVertical: spacing.md`
(16) — about 53pt tall. `compact` already exists and nothing on this screen uses it. A discreet
precedent already ships in `app/routine/folder/[id].tsx:159-166` (small text links).

An empty band between the native header and the buttons suggests the routine name is not visible;
the mechanism is unproven and must be rendered before it is claimed.

Separate context, do not fold into this task: this screen is not migrated to `docs/ui-standard.md`
§1/§2 — it uses a raw `<ScrollView>` root with the native header (`app/_layout.tsx:86`).

## T7 — Offline path (Obs-05, layer b)

**Severity**: critical, but the largest scope. **Not started; needs a product decision.**

The auth gate depends on the network while 100% of the data is local, so losing the session makes
the app unusable. A user with no connectivity cannot reach their own records. This layer decides
whether a network failure may drop the session at all, and whether the app can be entered offline.
It is deliberately separated from T3, which is the cheap and verifiable half.

---

## Obs-06 — The app has no large-text strategy; non-modal surfaces overflow at accessibility text sizes

**Severity**: high. **Not started. Out of scope for this batch.**

Evidence: on a clean cold start at `accessibility-extra-extra-extra-large` on the same simulator,
the routine detail screen overflows with no modal involved: the "Agregar ejercicio" button is
clipped at its card's edge, the routine description occupies most of the viewport, and the
"Ejercicios" heading overruns. The modal was never special — the whole app assumes text does not
scale.

What was tried and rejected: capping the OS text-scale multiplier on the shared
`components/ui/Button.tsx` (`maxFontSizeMultiplier`) was implemented and then **reverted**. It was
justified by the artifact described in T1's correction history; once measured on a clean cold start
the action row was 185pt with and without the cap, so the cap solved nothing. Reverting it also
avoided an app-wide behavioural change (that component is imported by 9 files) inside a
modal-local task. A sane large-text strategy is its own work unit and deserves its own decision.

---

## Backlog — findings recorded, not yet scheduled

Surfaced while working T1–T3. None is a blocker; each carries its evidence so it is not lost or
rediscovered from scratch.

| # | Finding | Severity | Where |
| --- | --- | --- | --- |
| B1 | Two session modals lack `stopPropagation`: a tap on non-interactive card content bubbles to the backdrop and dismisses the dialog | low | `app/session/[id].tsx` (routine diff, cancel/end) |
| B2 | Bottom sheets have no backdrop press, no `onRequestClose` and no bottom safe-area inset, while §1 of the UI standard expects a sheet to clear its own bottom inset | medium | `app/(tabs)/routines.tsx`, `app/routine/folder/[id].tsx` |
| B3 | The custom-rest dialog is bound-only, so the largest accessibility text sizes can still clip its buttons — the residual of Obs-06 | low | `components/session/SessionExerciseItem.tsx` |
| B4 | `useAuth` exports `signIn` and `signUp` that no screen calls; the screens use `supabase.auth` directly — dead code, and the reason the hook's error shape never mattered | low | `lib/hooks/useAuth.ts` |
| B5 | `signOut` and `deleteAccount` return raw errors. Nothing leaks today because `app/settings.tsx` shows its own catalogue copy, but the shape is inconsistent with the auth screens | low | `lib/hooks/useAuth.ts` |
| B6 | The routine detail screen is not migrated to the UI standard: a raw `<ScrollView>` root under the native header | medium | `app/routine/[id].tsx` (context already noted in T6) |
| B7 | Four branches carry real unmerged work, and SEC-13 (the password-reset route) exists only on `fix/security-hardening-batch`. A cold-start `forja://reset-password` against a build of `main` lands on expo-router's unmatched-route screen — the reset is broken on `main` today | **high** | repo branches |

## Order

T1 → T2 → T3 → T4 → T5 → T6 → T7.

## Gate

`npx tsc --noEmit` clean and `npx jest` green before any task is called done. Every fix that
changes behavior ships with a test that fails without it — a test that cannot fail proves nothing.

## Revert

One work-unit commit per task on the feature branch; each task reverts independently — a task
with more than one commit (T1 has two, `195a611c` and `baea66b`) reverts with `git revert` over
its whole commit set, newest first, so the branch states stay consistent.
