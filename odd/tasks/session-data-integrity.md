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

---

## Unit 2 — the "ANTERIOR" column across every exercise

**Not investigated yet.** What is known:

- The value comes from `app/session/[id].tsx:127`:
  `const prevSets = lastSession?.exercises?.find((se) => se.exerciseId === exerciseId)?.sets;`
  fed by `useLastSessionForRoutine` → `getLastSessionForRoutine`, which is **the last COMPLETED session
  of that routine** (ordered by `completedAt`, `isNull(deletedAt)`).
- So a session that was started and never completed cannot be the source — which means the number can
  legitimately be older than what the owner last did. That may be the whole explanation, or there may be
  a real staleness bug on top.
- `useLastSetsPerExercise` / `getLastSetsForExercise` (`lib/db/queries.ts:1620`) are a **second, global**
  source keyed by exercise across every routine. Two sources for the same number is a smell worth
  checking before touching anything.

**To do**: measure which source feeds which screen, then compare against what the owner sees on the
device. No code until the observation exists.

---

## Unit 3 — the swipe action does not close itself

**Known, UX.** The row's "Eliminar" is a swipe action that stays open until it is swiped back, and while
it is open it sits over the row and **hides the intensity control** — which is what made the owner think
the control was missing in the first place.

**Not a data defect.** The decision to make is behavioural: close the action when another row is
touched, close it after a moment, or close it when the set is completed. That is a product choice, not a
mechanical fix, so it needs the owner's call before code.

---

## The gate

`npx tsc --noEmit` clean and `npx jest` green, per the repo's standing rule. Every behaviour change lands
with a test that fails without it, and the parent observes the negative control.
