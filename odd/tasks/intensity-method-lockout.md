# intensity-method-lockout

**Status**: **IN PROGRESS** — the three code changes are being written. Nothing committed yet.

**Opened by the owner on 2026-10-03**, testing v1.0.10 (code 17) on his phone, with the app open on an
active session:

> "esa serie ya no tiene opción para modificar su método de intensidad"
> "no aparece" (after un-swiping the row, so it was not the delete button covering it)
> "hay que agregar eso de volver a lineal sin duda"

## The defect, traced

`components/SetLogger.tsx:37` decides whether the intensity control exists:

```js
const isLinear = set.method === 'linear' || set.method === null || set.method === 'partial';
```

```jsx
{isLinear && onOpenIntensityPicker && (  // line 163
  <TouchableOpacity onPress={onOpenIntensityPicker} ...>
    <Ionicons name="flash" ... />
  </TouchableOpacity>
)}
```

**`'superset'`, `'pyramid_up'` and `'pyramid_down'` are not in that list**, and all three are reachable
values of `SetMethod` (`lib/types/index.ts:78`). A set holding one of them lands in the `SetLogger`
branch, `isLinear` is false, **the control disappears, and nothing brings it back.**

The trap closes because of the order of operations in `handleSelectIntensityMethod`
(`components/session/SessionExerciseItem.tsx:174`):

```js
updateSet.mutateAsync({ id, data: { method, isDropGroup: isDropMethod ? true : undefined } });  // ALWAYS
if (method === 'superset') { ... onPairSuperset?.(); return; }
```

**The method is persisted before the pairing flow starts.** Choosing "Super Set" and then cancelling the
pairing leaves the set marked `superset` forever — a door that closes one way.

And there is no way out of the picker either: `IntensityMethodPicker` offers `dropset`, `rest_pause`,
`cluster`, `superset`, `partial` — **none of them is "linear"**, and `handleSelectIntensityMethod` has no
branch that writes `method: 'linear'`.

So the two halves are: **a state the UI cannot leave**, and **no control that would let it**.

## What gets fixed

1. **The control is always there.** The intensity button is how you *choose* a method; it is not a
   reward for being on `linear`. Show it whenever a handler is available.
2. **"Lineal" is an option in the picker.** `IntensityMethod` gains `'linear'`, and the picker lists it
   first, because it is the default state and the way back.
3. **`handleSelectIntensityMethod` gets the `linear` branch**: write `method: 'linear'`,
   `isDropGroup: false`, clear `partialReps`, and open no editor.
4. The sets already trapped (`superset`, `pyramid_*`) become reachable again through 1 + 2.

## Acceptance

- A set in any method state shows the control.
- Choosing "Lineal" returns the set to a plain set — no badge, no drop group, no partial reps.
- A structural test pins "the control does not depend on the current method" and fails when the
  `isLinear` gate comes back. Negative control observed.

## Out of scope

`pyramid_up` / `pyramid_down` are in the type but no UI produces them, and the picker does not offer
them. They are fixed *only* in the sense that they no longer lock the control. Adding pyramid editing
is a different feature.

## Recorded, not scheduled (same report)

- **Deleting a set and finishing the session does not carry to the next one.** Needs its own
  investigation; the tombstones are in place and the reads are supposed to filter them.
- **The "ANTERIOR" column** for weights/reps across every exercise on the session screen. Its source is
  `app/session/[id].tsx:127` → `useLastSessionForRoutine` (the last *completed* session of that
  routine), so a session left incomplete can hold a stale number.
- **The swipe action does not close itself**, so the "Eliminar" button can sit over the row and hide the
  intensity control. UX, not data.
