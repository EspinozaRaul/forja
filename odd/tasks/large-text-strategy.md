# large-text-strategy

**Status**: **IN PROGRESS — Slice 1 in flight.** This is **Obs-06** from `odd/tasks/ux-corrections-batch.md`
("the app has no large-text strategy; non-modal surfaces overflow at accessibility text sizes"), promoted to its own
unit because the repo already recorded that it "deserves its own decision" — and because a `maxFontSizeMultiplier`
cap was implemented and reverted once.

**Branch**: `feat/large-text` from `main` (`fb58347`'s merge base — confirm at start).

**The strategy, stated once**: the app **scales with the OS and never opts out**. No `allowFontScaling={false}`, no
`maxFontSizeMultiplier`. What has to change is the *layout* that assumes text does not grow.

---

## What is actually broken (audited, read-only)

The measured symptom (Obs-06, on a clean cold start at `accessibility-extra-extra-extra-large`, routine detail
screen): the "Agregar ejercicio" button clips at its card's edge, the routine description occupies most of the
viewport, the "Ejercicios" heading overruns.

**The decisive diagnosis** — it is not one broken node. It is that **the header, the section heading row and the
bottom action bar are all fixed-height chrome, and only the central `ScrollView` absorbs the growth**. Three
recurring patterns cause the visible failures:

1. **A row that does not wrap.** `app/routine/[id].tsx` puts `<Text>Ejercicios</Text>` and a full `Button` in a
   `justifyContent: 'space-between'` row with **no `flexWrap`**; and `components/ui/Button.tsx` sets the button's
   text to `flexShrink: 0`, so the button keeps its intrinsic width and the row overflows the card. This is the
   measured clip.
2. **Fixed-width text columns.** `components/session/SupersetComponents.tsx:69` (`width: 64` +
   `numberOfLines={1}`), the `SET_LOGGER.*` table widths, `measurements.tsx`'s label (`width: 70`),
   `statistics.tsx`'s group label (`width: 80`). At AAA the text is truncated to a few characters.
3. **An unbounded overlay.** `app/session/history/[id].tsx` re-creates the pre-T1 modal defect in a plain
   `position: 'absolute'` view with no `maxHeight` and no scroll, so its action row can leave the viewport.

**And one false start, refuted**: the `Button` cap. The revert was correct — the button already wraps; the row it
sits in is what does not.

---

## Slicing (ordered by damage, the measured screen first)

| # | Slice | Files | Size |
| --- | --- | --- | --- |
| **1** | The measured screen: the section row wraps, and the header actions collapse to icons at large text | `app/routine/[id].tsx` (+ the guard test) | small |
| 2 | The session screen and the set table's fixed widths | `app/session/[id].tsx`, `components/session/{SupersetComponents,SetLogger,SetLoggerHeader,PartialSetLogger,DropSetLogger}.tsx` | medium-large |
| 3 | The unbounded overlay becomes a real Modal (bounded card, scroll, actions outside) | `app/session/history/[id].tsx` | small |
| 4 | The auth screens stop centring a non-scrolling column | `app/auth/{login,signup}.tsx` | small |
| 5 | The folder header stops carrying a variable-length description | `app/routine/folder/[id].tsx` | small |
| 6 | Section-heading rows app-wide: the button yields to the heading | `components/ui/Button.tsx` call sites | medium |
| 7 | The remaining fixed-width columns | `app/progress/{statistics,measurements}.tsx`, `app/progress/exercise-detail/[id].tsx` | small-medium |

---

## Slice 1 — the measured screen (spec)

**Changes**

- `app/routine/[id].tsx`, the "Ejercicios" row: add `flexWrap: 'wrap'` (and a `rowGap`) so the `Button` drops to
  its own line when it no longer fits beside the heading. The heading keeps its size; nothing is truncated.
- `app/routine/[id].tsx`, the header actions (Edit / Delete pills): at large text they collapse to **icon-only**,
  keeping their `accessibilityLabel` — the HIG's own behaviour for toolbar items at accessibility sizes. Read
  `useWindowDimensions().fontScale` and render the label only below a threshold (1.3 is the usual start of the
  accessibility sizes); the icon is already there. This is what stops two labelled pills from squeezing the screen
  title to nothing — the title truncates by design (`ScreenHeader`), so the actions must yield, not the title.

**Test — `__tests__/components/large-text.test.ts` (new)**

The repo cannot render in jest, so the durable guard is a scan, and it must be honest about what a scan can prove:

- **The rule that can be asserted**: no file under `app/` or `components/` opts out of OS text scaling —
  `allowFontScaling={false}` and `maxFontSizeMultiplier` must appear **zero** times. This is the strategy, stated
  as a test. Follow `__tests__/components/typography-tokens.test.ts`'s file-walk and give it a fixture case that
  proves the scanner actually matches (so the zero is not a broken regex).
- **State the limit in the header comment**, the way `routine-start-modal.test.ts` does: a scan pins the *design
  decision*, never the rendering. It cannot prove that nothing overflows at the largest size.

**Allowed edit surfaces**: `app/routine/[id].tsx`, `__tests__/components/large-text.test.ts`.

**Proves**: the app does not silently opt out of Dynamic Type, and the measured screen's two clipping rows stop
clipping.

---

## Recorded, deliberately not here

- **The full per-screen reflow** (slices 2–7) is real work and will land one screen per commit.
- **What cannot be verified from code**: the exact overflow point, font metrics at `fontScale` on a specific OS
  version, and whether a given truncation is legible. The Obs-06 measurement itself is a pixel artifact from a cold
  start (Fast Refresh invalidates it, per T1's correction history). Limits, not findings.
