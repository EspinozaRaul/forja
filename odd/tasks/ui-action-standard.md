# Feature: UI action standard

**Workflow**: ODD (Organic Driven Development)
**Scope**: The action/button language across `app/` and `components/`, plus `docs/ui-standard.md`
**Branch**: `main` (each unit was built on its own branch and merged; see the unit log below)
**Status**: in progress — the standard is written and two of three divergences are closed

---

## Goal

Make the app look uniform: the same role gets the same treatment everywhere, so no screen reads
as the odd one out. The trigger was a real complaint about the routine detail header — "cuadrar lo
de botones de editar y eliminar con la estética que se viene trabajando" — and the investigation
found the cause was not that screen. **There was no rule.**

## Why there was no rule

`docs/ui-standard.md` had §4 (colours by role) and a passing mention of `compact`, but nothing that
said which action gets which treatment. Everything following is measured, not estimated:

| divergence | baseline |
| --- | --- |
| `<Button>` call sites that never chose a variant (so `primary`, the loudest, by accident) | 12 of 27 |
| text glyph used as an action (`✕`, `↗`, `›`, `←`, `×`, `↻`) | 14 |
| files mounting a bare `<TouchableOpacity>` | 31 (131 tags) |
| files among those that paint their own `backgroundColor` | 28 |
| radii competing for the same rectangular job | `md` 83, `lg` 37, `full` 20 |

The cost was already visible in a shipped defect: the routine detail header was a row of two
**full-size** buttons, and they collapsed the routine's name to **zero width** — measured with a
seven-character name. The name was the reason the row existed and it was invisible.

## What §9 says

One button component (`components/ui/Button.tsx`); variant by role, tied to §4's role split
(`error` is the text/icon red, `errorStrong` the fill under a filled destructive action); size by
context (`compact` whenever the action shares a row with other content); header actions are pills
in `ScreenHeader`'s `right` slot; **never a text glyph as an action**; three radii and no fourth;
a text link is not a button.

§9 closes with the same honesty §8 uses: it is the target, not the current state, and it names the
divergences with their measured counts instead of pretending the app complies.

## Unit log

| unit | commit | what |
| --- | --- | --- |
| standard + first screens | `b534dba` | §9 written; the routine detail header migrated to `Screen`, `ScreenHeader` and pills; §4 violation in the reference §9 cites (see below) fixed |
| superset replace | `4a631d7` | a paired exercise can be replaced again (see "found on the way") |
| glyph sweep | `d2afdb0` | the 12 remaining glyph actions became Ionicons |
| button variants | `e9795f8` | all 27 call sites choose a variant; §9's clause sharpened to "at most one primary **visible at a time**" |

All four merged into `main` as `3ec964d`, `70cbb52` and `f1ebbe2`.

## Contradictions found on the way

1. **The reference §9 cites was failing §4.** `app/progress/measurements.tsx`'s header pill used
   `text.primary` on `accent.primary` — **4.34:1**, below the 4.5:1 §4 requires — and switched its
   fill to `colors.error` while the form was open, where `text.primary` measures **2.98:1**. Both
   verified independently with the WCAG formula against the real token values. The pill now uses
   `text.onAccent` (5.11:1 on accent, 5.34:1 on `errorStrong`) and `errorStrong` for the filled
   destructive state. `colors.error` was not touched: it is correct for text, borders and icons,
   which is exactly §4's point.
2. **Two primaries were visible at once on the routine screen while editing** — the inline form's
   Save and the persistent "Iniciar sesión" footer. Resolved by demoting the footer in that state
   rather than by weakening either action: `variant={isEditing ? 'secondary' : 'primary'}`.
3. **The category chip in `app/exercise/create.tsx`** shared `primary` with the form's submit, so
   two accent-filled buttons were visible together. The selected chip moved to `accent`, which
   still reads as selected next to a `secondary` chip and measures 14.5:1 for its label.

## Found on the way, and fixed

`SupersetBlock` received `onDeletePair` but **no `onReplace`**, and rendered the pair's header as a
single `Text` reading `"{nameA} ⟷ {nameB}"`. So with two exercises paired there was **no way to
replace either of them** — the capability existed only on the standalone item. Each member's name
now carries its own replace control, which is the only unambiguous placement: one icon for the pair
could not say which exercise it replaces.

## The pressable audit — and why there is no sweep to run

The last apparent divergence was "42 files mount a bare pressable and 69 of them look like a
button". That figure was **wrong in a way that matters**, and it was measured rather than argued:

- The heuristic (its own `backgroundColor` + `borderRadius` + a text label) **cannot tell a button
  from a tappable card**, because both match it.
- It **does not even reproduce its own per-file counts.** In the audited sample,
  `app/(tabs)/routines.tsx` matched 5 of 8 pressables under the stated rule rather than 7, and
  `app/session/[id].tsx` matched 3 of 11 rather than 7 — because in the cards the fill and the radius
  live on an **inner `View`**, not on the pressable.
- Classified by reading instead of by paint, **only 10 of the 29 pressables in the three sampled
  files are buttons**. The other 19 are chips, segmented preset selectors, a drag handle, an inline
  icon action, text links, navigation and selection cards, disclosure rows, and modal cards and
  backdrops.
- **No `is-a-button` site is a pixel-perfect match for `Button`.** Converting them would move padding,
  radius, font size (the session bottom bar's labels are 18pt against `Button`'s 15), fill and weight.
  Some of those deltas are the point: the session screen is a dense logging UI, not a column of app
  buttons.

**Verdict: the pressable count is not a defect list and must not be swept.** Rewriting those controls
as `<Button>` would make the app uniform and worse. §9 says a button is `Button`; it does not say
every pressable is a button, and `TouchableOpacity` is the right primitive for a row, a card and a
backdrop. A conversion is a per-site decision, taken only where `Button` reproduces the control
faithfully — and none of the sampled sites qualifies cleanly.

## Found by the audit, and fixed

The audit did surface one objective defect, and it was arithmetic rather than taste: **nine filled
destructive surfaces used `colors.error` as their fill, seven of them labelled with
`colors.text.primary` — 2.98:1 against §4's 4.5:1 minimum.** White on that fill is 3.51:1, also below.
All nine now use `errorStrong` with `text.onAccent` at **5.34:1** (`f90e636`): the session screen's
"Finalizar sesión", the active-session bar's "Descartar", the five swipe-to-delete reveals, and the
shared `ConfirmDialog` — whose fill and label had to move together, because its label passed on the
light red by luck at 5.31:1 and would have landed at 3.49:1 on `errorStrong`. The app now has one
destructive treatment instead of two. Checked after: **0 `backgroundColor: colors.error` remain**,
and the 22 remaining `colors.error` uses are text, borders and icons, which is the role §4 assigns it.

## Still open

**Small**: `components/IntensityMethodPicker.tsx` still carries an `optionArrow` style that nothing
references since its glyph became an icon. Dead style, harmless; delete it in the next unit that
touches that file.
