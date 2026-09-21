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

## Still open

**The 31 files that mount a bare `TouchableOpacity`.** This is the remaining piece, and it is not a
sweep: most of those pressables are legitimately *not* buttons — they are tappable rows, cards and
list items, which is exactly what a `TouchableOpacity` is for. Turning them all into `<Button>`
would be wrong, and it is why this needs an audit rather than a patch. The classification to
produce, per file:

- a pressable that **looks like a button** (its own `backgroundColor` + `borderRadius` + a text
  label, i.e. it reimplements `Button`) → replace with `<Button>` or a pill per §9;
- a pressable that is a **row or card** → leave it; it is not an action of that kind;
- a pressable that is an **icon-only action** → keep it, but its icon comes from Ionicons at §9's
  sizes, which the glyph sweep already enforced.

When that audit runs, keep it to reviewable batches by screen rather than one change touching 31
files, and re-measure the baseline at that moment instead of trusting the counts above — they were
taken on 2026-09-20 and the three preceding units have changed some of them.

**Also open, small**: `components/IntensityMethodPicker.tsx` still carries an `optionArrow` style
that nothing references since its glyph became an icon. Dead style, harmless, delete it in the next
unit that touches that file.
