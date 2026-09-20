# Feature: UX corrections batch

**Workflow**: ODD (Organic Driven Development)
**Scope**: Forja application code (`app/`, `components/`, `lib/`, `docs/`)
**Status**: in progress — T1 closed (`195a611c` + `baea66b`, verified on the iOS simulator); T2 unblocked and authorized; T3 authorized; T5/T6/T7 blocked on decisions

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
| 05 | Login surfaces a raw SDK network error and the app becomes unusable without a network: the auth gate depends on connectivity while all user data is local | critical | cause verified; layer (a) authorized |
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

**18 `<Modal>` usages across 11 files. One file has the guard.**

| File | Modals | has `maxHeight` |
| --- | --- | --- |
| `app/routine/[id].tsx` | 1 | **yes** — T1 |
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

## Order

T1 → T2 → T3 → T4 → T5 → T6 → T7.

## Gate

`npx tsc --noEmit` clean and `npx jest` green before any task is called done. Every fix that
changes behavior ships with a test that fails without it — a test that cannot fail proves nothing.

## Revert

One work-unit commit per task on the feature branch; each task reverts independently — a task
with more than one commit (T1 has two, `195a611c` and `baea66b`) reverts with `git revert` over
its whole commit set, newest first, so the branch states stay consistent.
