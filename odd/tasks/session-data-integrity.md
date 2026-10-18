# session-data-integrity

**Status**: **IN PROGRESS** — unit 1 is being written. Units 2 and 3 are pending.

**Opened by the owner on 2026-10-03**, testing on his phone, right after v1.0.11:

> "cuando elimino esa serie y termino la sesión no se hace el cambio para la siguiente sesión"
> "quiero verificar que de verdad la actualización de datos de pesos y series que se marcan en
> 'anterior' de todos los ejercicios en general"
> "por orden pero tratemos todas"

Three units, in the order the owner asked for them. Each one lands on its own with its own gate.

---

## Unit 1 — a deleted set comes back in the next session

**Root cause found, 2026-10-03.** `lib/db/queries.ts:1464` `duplicateSessionData` — the function behind
"Continuar última" — reads its two sources **without the tombstone guard**:

```js
const sourceExercises = tx
  .select().from(sessionExercises)
  .where(eq(sessionExercises.sessionId, sourceSessionId))   // no isNull(deletedAt)
  .all();

const sourceSets = tx
  .select().from(sets)
  .where(eq(sets.sessionExerciseId, se.id))                 // no isNull(deletedAt)
  .all();
```

Every other read of those two tables in the file carries `isNull(...deletedAt)` — this is the pair that
was missed when the identity layer landed. `deleteSet` writes a tombstone correctly, and
`getLastSessionForRoutine` filters them correctly, so the *display* of the previous session is right and
only the **copy** resurrects the row. That is exactly the reported symptom: delete a set, finish the
session, and "Continuar última" brings it back.

**Fix**: guard both reads. The comments say why, because the next reader will wonder whether a
tombstoned slot should keep its position — it should not: a removed slot is removed.

**Acceptance**: a test that deletes a set, duplicates the session, and asserts the copy has no row for
it. Negative control: removing the guard fails it.

**LANDED** — `e165a05`. `__tests__/lib/db/duplicate-session-tombstones.test.ts` drives the real shipping
driver (`drizzle-orm/expo-sqlite` over `node:sqlite`) through three cases. Negative control observed:
removing both guards fails exactly the two deletion cases and nothing else. Gate: `tsc` clean, **73
suites / 608 tests**.

---

## Unit 2 — the "ANTERIOR" column across every exercise

**Investigated 2026-10-03. No defect found yet — this unit needs an observation before it needs code.**

`getPreviousForExercise` (`app/session/[id].tsx:100`) resolves the number in **three cascading
sources**, which is itself the thing worth questioning:

1. **Primary**: `lastSetsGlobal[exerciseId]` ← `useLastSetsPerExercise` → `getLastSetsPerExercise`
   (`lib/db/queries.ts:1398`). It is **global across ALL routines**: the most recent *completed*
   sessionExercise holding that exercise, ordered by `desc(sessions.completedAt)`.
2. **Fallback**: `lastSession` ← `getLastSessionForRoutine` — the last completed session of **that
   routine**.
3. **Per-field**: `lastWeights` / `lastReps` / `lastRirByExercise` per field independently.

**Both queries are clean.** `getLastSetsPerExercise` filters `isNotNull(sessions.completedAt)` and both
tombstones, and the batching is correct — it deliberately has **no** `limit(1)`; it dedupes to the first
row per exercise in JS. `getLastRirByRoutineExerciseIds` carries the same guards. So this is not the
same class of bug as unit 1.

**What is legitimately confusing, and may be the whole report:** because the primary source is global,
an exercise trained in two routines (the owner's FB-B and FB-C share "Elevación lateral sentado") shows
the number from **whichever routine was most recent**, not from the one being performed. That is
deliberate per the comment, but it reads as "the ANTERIOR is wrong" when you are looking at the other
routine's number.

**Second candidate**: the display filters `s.method !== 'partial'`, so a session whose last sets were
partial falls back to something older for the placeholder.

**Third, cosmetic but visible in the owner's own screenshot**: two formatters disagree —
`SetLogger.tsx:41` renders `12.5 KG` and `previousText()` at `:89` renders `12.5KG`.

**To do**: the owner has to name one exercise and say what he expected versus what he saw. Then
reproduce it against the device with `adb`, the way the scroll and the lockout were settled. No code
before that observation exists.

---

## Unit 3 — the swipe action does not close itself

**Known, UX.** The row's "Eliminar" is a swipe action that stays open until it is swiped back, and while
it is open it sits over the row and **hides the intensity control** — which is what made the owner think
the control was missing in the first place.

**Not a data defect.** The decision was behavioural and the owner chose **(a): closing one row's action
closes the others.**

**LANDED** — `69e3061`. `SessionExerciseItem` owns `openSwipeSetId`; each row receives `isSwipeOpen`
and closes itself when it flips to false, plus `onSwipeableOpen` / `onSwipeableClose` to report back.

Rejected deliberately: **(b)** a timeout, which is timing magic that can fire while you are reading the
row; **(c)** closing on complete, which does not cover the case that produced the report — reaching for
the intensity control on a row you have not completed yet.

**This was the cause of the intensity report.** The owner had not lost the control; the delete button
was sitting on top of it. Worth remembering as a class: ask *what is covering what* before hunting for a
logic bug.

---

## Unit 4 — the keyboard covers the last exercises

**New, reported 2026-10-03. REPRODUCED, attempted, REVERTED — still open.**

**The bug, measured on the device.** With the keyboard open the scroll reached its end and the focused
input sat **half-covered**: only its top edge and the caret stayed above the keyboard
(`/tmp/x1.png`). The action bar ("Cancelar / Finalizar sesión") did not stay visible either.

**What is NOT the cause.** The wiring is correct: the list is already a `KeyboardAwareScrollView` and
`KeyboardProvider` wraps the app at `app/_layout.tsx:187`. There was no missing provider and no missing
gesture handler — that is why this survived so long looking like a keyboard-configuration problem.

**What the cause is.** There is no room left *inside* the content: the scroll cannot lift the last row
because the content ends right after it.

**The attempt, and why it was reverted.** `d0347ff` derived the content's bottom padding from
`useKeyboardState((state) => state.height)`. The owner installed it and reported on the spot: the content
now **keeps scrolling into empty space past the last exercise**. The derived value stays large, so the
list grew a block of nothing. Reverted in `23ad5ec`.

**Kept from the attempt**: `actionBarHeight`, measured through `onLayout` and added to `bottomOffset`.
It is inert on its own and it is the part that is actually right.

**Where to go next.** The room has to be added inside the content, but **not** as an absolute height
derived from the keyboard state. Candidates to measure against the device: clamping the value, reading
`state.height` without the `isVisible` flag, `contentContainerStyle` instead of the inner `View`, or
letting the `KeyboardAwareScrollView` own the inset. Whatever is tried, **measure with `screencap` (the
session screen never goes idle for `uiautomator`) and check both ends: the focused row stays visible AND
there is no dead space when the keyboard is closed.** The first attempt fixed one end and broke the
other.

---

## Unit 4 — MEASURED ON THE DEVICE, 2026-10-18, on code 20

Measured with `scripts/device` after pausing the session timer, which is what makes `uiautomator`
dump this screen at all. Every number below is from a live dump, not from an image.

**The concept that was missing.** `react-native-keyboard-controller@1.21.9` — the
`KeyboardAwareScrollView` this screen already uses — **grows the content's bottom by the keyboard
height on its own.** `KeyboardAwareScrollView/index.tsx:579-582` derives
`padding = enabled ? currentKeyboardFrameHeight.value : 0`, the default `mode` is `"insets"`, and
`ScrollViewWithBottomPadding/index.tsx:126-131` passes it to Android as the native
`contentInsetBottom`. So the room inside the content was never missing: `d0347ff` added a **second**
inset of the same size, and that is the whole explanation of the "endless scroll" the owner hit on
v1.0.12.

**The keyboard does not resize the window.** With the keyboard open the scrolling container reports
`bounds=[0,511][1220,2556]`, i.e. the app still thinks it owns the full height; the keyboard at
`1730..2712` merely overlays it. With the keyboard closed the same container is `[0,511][1220,2324]`
— shorter, because the action bar shows its two buttons again. The library's own arithmetic lands the
visible region at `511..1574`, which is exactly the action-bar top, so its inset is correct as it
stands.

**The action bar is not a bug.** `app/session/[id].tsx:790` renders the two buttons under
`{!isKeyboardVisible && (...)}`, so *by design* they disappear while the keyboard is up and the bar
collapses to its rest-timer area. The earlier note that "the action bar did not stay visible either"
was reading intended behaviour as a defect.

**The original symptom does not reproduce in code 20.** Focusing the weight input of the **last**
exercise (`Sentadilla Pendular`) moved focus from `text="10" bounds=[680,511][916,570]` to
`text="80" bounds=[439,1376][675,1502]`. The action bar starts at `1574`, so the focused input ends
**72 px clear of it** and the screenshot shows the whole card, caret included. The retained
`actionBarHeight` in `bottomOffset` — the half of `d0347ff` that was kept — is what does the work.

**Still true, and it is the honest caveat:** with the keyboard open the scroll can still travel past
the last exercise into an empty viewport. That space is the library's inset, not the app's padding, so
it is present in code 20 exactly as it was before `d0347ff`. It is the price of the focused input being
liftable; the app no longer doubles it.

**The next measurement, if it is ever needed again:** the swipe helpers are unreliable on this screen —
a swipe that starts on a `TextInput` or on a row's `Swipeable` never reaches the `ScrollView`, and a
slow drag sometimes does not scroll at all. Only gestures that start inside the container move it, so
verify each gesture changed the screen (hash the screenshot, timer region excluded) before trusting it.


---

## The gate

`npx tsc --noEmit` clean and `npx jest` green, per the repo's standing rule. Every behaviour change lands
with a test that fails without it, and the parent observes the negative control.
