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

**New, reported 2026-10-03, not investigated.** The owner: "el teclado está tapando otra vez las últimas
series cuando usas el teclado, cuando son los últimos ejercicios al final de la pantalla el teclado tapa
el ejercicio".

`app.json` sets `softwareKeyboardLayoutMode: "resize"`, so the window shrinks and whatever must follow it
is the scroll — the same shape of problem as the start-session dialog, and it should be measured the same
way: positions from `uiautomator` (or `screencap` on the session screen, where the timer keeps the tree
from ever going idle) rather than a look at a screenshot.

---

## The gate

`npx tsc --noEmit` clean and `npx jest` green, per the repo's standing rule. Every behaviour change lands
with a test that fails without it, and the parent observes the negative control.
