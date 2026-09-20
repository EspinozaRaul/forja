# Feature: UX corrections batch

**Workflow**: ODD (Organic Driven Development)
**Scope**: Forja application code (`app/`, `components/`, `lib/`, `docs/`)
**Status**: in progress — T1 implemented, verified and committed; T2 and T3 authorized; T5/T6/T7 blocked on decisions

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
| 04 | Start-session modal with a long list traps the user; the start button is unreachable **and there is no way to close it** | critical | cause verified; start here |
| 05 | Login surfaces a raw SDK network error and the app becomes unusable without a network: the auth gate depends on connectivity while all user data is local | critical | cause verified; layer (a) authorized |
| 03 | Replacing an exercise mid-session keeps the previous exercise's numbers | high | behavior decided; superset case open |
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

1. Add `MAX_HEIGHT` to the `MODAL` constant in `lib/constants/layout.ts`. It currently exports
   only `WIDTH`, `MAX_WIDTH`, `HANDLE_HEIGHT`, `HANDLE_WIDTH`; the missing bound is the root of
   this whole class of defect.
2. In `app/routine/[id].tsx`, bound the card with that constant, put **only the scrollable list**
   inside a `ScrollView` that can shrink (`flexShrink: 1`), and keep the action row **outside** the
   scroll region so it is always visible and always reachable.
3. Keep the backdrop-close escape reachable: the bounded card leaves tappable overlay, and the
   modal keeps `onRequestClose` for the Android back button.
4. Add the rule to `docs/ui-standard.md`, which today says nothing about modals beyond "clears its
   own bottom inset": a modal's card is height-bounded, its variable-length content scrolls, and
   its actions are pinned outside the scroll region.

### Gate

The reported case is reproduced with a session long enough to overflow, and the start button is
reachable with the actions visible. `npx tsc --noEmit` clean and `npx jest` green.

**The runtime half of this gate is NOT satisfied.** No device or simulator run has been done, so
"a long session overflows and the start button stays reachable" is asserted structurally, not
observed. That check belongs to the user on a real phone.

### Evidence

Implemented on `fix/ux-corrections` (branched from `main` @ `616a25a2`) and committed as `195a611c`:

| File | Change |
| --- | --- |
| `lib/constants/layout.ts` | `MODAL.MAX_HEIGHT: '70%'` and `MODAL.MAX_BODY_HEIGHT: 360`, each with the reasoning as a comment |
| `app/routine/[id].tsx` | card bound by `MAX_HEIGHT`; the previous-session list moved into a `ScrollView` carrying `flexShrink: 1` and `MAX_BODY_HEIGHT`; title, message and the action row outside the scroll region |
| `docs/ui-standard.md` | new §8 plus a checklist item, written as a target rather than as shipped state; header metadata bumped |
| `__tests__/components/routine-start-modal.test.ts` | new source-scanning guard, 8 tests |

Gate on this branch: `npx tsc --noEmit` exit 0; `npx jest` → **18 suites / 146 tests**, from a
baseline of 17 / 138. The delta is the single new suite; no tracked test file was modified.

### What the guard does and does not prove

Each containment property has its own assertion, and each was proven to fail when that property
alone is removed: the card bound, the body bound, `flexShrink: 1`, and the ordering of the actions
after the scroll region.

Known gaps, accepted rather than hidden:

- **Dismissal is unguarded**: deleting `onRequestClose`, the backdrop `onPress`, or the card's
  `stopPropagation` leaves all 8 tests green, even though §8 requires the escape hatch.
- **Constant values are unguarded**: the assertions check the shape of the values, not that they are
  safe. `MAX_HEIGHT: '100%'` would pass while removing the tappable backdrop strip.
- **Runtime containment is unprovable statically.** The arithmetic is real: fixed chrome ≈ 197pt
  plus a 360pt body needs ≈ 796pt of viewport for the card's 70% bound to contain it without any
  shrink, so on a 667pt phone the deficit is ≈ 90pt and on a 568pt device ≈ 160pt. Below that,
  the actions stay on screen **only if Yoga applies `flexShrink: 1`** to the scroll node inside a
  content-driven, `maxHeight`-clamped card. The body cap is a secondary limit, not a proof. Only a
  device run with a long session settles it.

### Correction history

Three independent verification rounds ran against this task, not one. They refuted, in order: a
guard test that could not fail on the very property the fix depends on; a doc that contradicted
its own reference and claimed a universal standard while one of eleven files was fixed; and a
hard cap that was described as removing the shrink dependency while the arithmetic shows it does
not. Each correction was itself re-verified. The prose now states what is true, including what
remains unproven.

## T2 — Modal sweep (Obs-04)

**Severity**: critical. **Authorized to start.**

The user explicitly asked for every occurrence of this situation to be fixed, not just the one
that bit them.

**18 `<Modal>` usages across 11 files. One file has the guard.**

| File | Modals | has `maxHeight` |
| --- | --- | --- |
| `app/routine/[id].tsx` | 1 | no — T1 |
| `app/session/[id].tsx` | 3 | no |
| `components/ExercisePicker.tsx` | 3 | no |
| `app/(tabs)/routines.tsx` | 2 | no |
| `app/exercise/[id].tsx` | 2 | no |
| `app/(tabs)/index.tsx` | 1 | no |
| `app/routine/folder/[id].tsx` | 1 | no |
| `components/ui/ConfirmDialog.tsx` | 1 | no (and no `ScrollView`) |
| `components/IntensityMethodPicker.tsx` | 1 | no (and no `ScrollView`) |
| `components/session/SessionExerciseItem.tsx` | 1 | no (and no `ScrollView`) |
| `components/progress/RoutinePickerModal.tsx` | 1 | **yes** — the reference |

Each file is judged on its own content, not blanket-patched: a short static confirm dialog does
not need a scroll region, but it still needs a height bound so a long translated message (or a
large font-size accessibility setting) cannot push its buttons off-screen. `ConfirmDialog` is the
shared component behind many destructive confirmations and carries the same defect.

### Gate

Every modal file is either bounded or has a written reason it cannot overflow. `npx tsc --noEmit`
clean and `npx jest` green.

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
  cache and drops the user at the login screen.

### Approach

Distinguish "there is no connection" from "these credentials are wrong", translate both, and stop
rendering SDK internals. This continues the SEC-15 decision (release must not surface internals).
Offer a retry on the network branch.

### Gate

A forced network failure renders a translated, actionable message and no internal detail
(class name, hostname, IP). A wrong password still renders the credentials message. Tests use a
negative control: reintroduce the raw pass-through and watch the test fail.

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

## Order

T1 → T2 → T3 → T4 → T5 → T6 → T7.

## Gate

`npx tsc --noEmit` clean and `npx jest` green before any task is called done. Every fix that
changes behavior ships with a test that fails without it — a test that cannot fail proves nothing.

## Revert

One work-unit commit per task on the feature branch; each task reverts independently with
`git revert <sha>`.
