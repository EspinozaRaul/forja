# ui-aesthetic-pass

**Status**: **IN PROGRESS — Slice 1 LANDED on `feat/ui-legibility` (`ad2af48`).** Branched from `main`
(`6010c6d`). Gate: 66 suites / 566 tests.

**Why**: the user wants to improve the app's aesthetics. The review — done with the `apple-design` skill, its HIG
references and the app's own `docs/ui-standard.md` — says the aesthetics are **not** the problem: Forja has a real
thesis (cold steel monochrome, one ember reserved for achievement, Oswald for load numerals, squared radii). The
work is not a restyle; it is **legibility arithmetic and two salience inversions**, all measurable.

**The taste guard**: do not restyle to chase trends. No new palette, no new type pairing, no layout
re-imagination. The personality is the asset. Only the measured defects below.

---

## Verified findings (computed from `lib/theme/tokens.ts`, not estimated)

Contrast is WCAG relative luminance, `(L1+0.05)/(L2+0.05)`. Text under 18 pt needs **4.5:1**; 18 pt or bold
needs **3:1**; non-text needs **3:1**.

| Pair | Ratio | Verdict |
| --- | --- | --- |
| `tag.text #7A9AB5` on `tag.muscle #22344A` | **4.29** | fails 4.5 |
| `tag.equipmentText #6E9C8A` on `tag.equipment #1F332C` | **4.33** | fails 4.5 |
| `accent.primary #4A6FA5` on `bg.elevated #22272D` | **2.94** | fails even 3 |
| `accent.primary` on `bg.primary #101316` | **3.65** | only legal at ≥18 pt / bold |
| tab bar active `accent.primary` vs inactive `text.muted #899199` | **3.65 vs 5.83** | the selected tab is the *least* legible element |
| `text.muted` on the three backgrounds | 5.83 / 5.24 / 4.71 | passes — the token comment is true |
| `text.link #7A9AB5` on the three backgrounds | 6.32 / 5.68 / 5.10 | passes |
| `text.onAccent #FFFFFF` on `accent.primary` | 5.11 | passes |

Also verified: `fontSizes.xxs = 9` and `xs2 = 10` are below the HIG's **11 pt** floor and are used in **18
places**; the session-row chips carry `paddingVertical: spacing.xxs` (1 pt) at 10 pt text with **no `hitSlop`**
(`components/session/SessionExerciseItem.tsx:436,446`); the tab icons mix filled and outline
(`app/(tabs)/_layout.tsx:42,62,71`).

---

## Slice 1 — the legibility floor — LANDED (`ad2af48`)

Gate: `npx tsc --noEmit` exit 0 · `npx jest` **66 suites / 566 tests**. Parent negative control: reverting
`tag.equipmentText` fails its case; `tokens.ts` byte-identical after revert.

**One thing the implementation flagged for Slice 2**: `app/(tabs)/index.tsx:212`, the workout-count numeral
(24 pt, accent on `bg.elevated`), measures **2.94:1** — it misses even the 3:1 large-text allowance, by 0.06. It
was left as accent because the guard says display numerals stay accent; it belongs with the tab-bar tint (the same
2.94 pair) in Slice 2.

**Goal**: no information-carrying text below 4.5:1, and no token below the 11 pt minimum. Token-level, plus two
call sites.

**Changes**

- `lib/theme/tokens.ts`: `tag.text` `#7A9AB5` → **`#8FB3D4`** (5.77:1 on `tag.muscle`); `tag.equipmentText`
  `#6E9C8A` → **`#82A896`** (5.10:1 on `tag.equipment`). Same hue family, lighter. Update each token's comment
  with the measured ratio.
- `lib/theme/tokens.ts`: `fontSizes.xxs` 9 → **11**, `xs2` 10 → **11**. One token change fixes all 18 call sites.
- Small accent-as-text moves to the link role: `app/(tabs)/index.tsx` (the "most frequent exercise" label, 15 pt
  semibold on `bg.elevated`, 2.94:1) and `components/RestTimer.tsx:394` (the small REST label, 9 pt, 3.65:1)
  switch `colors.accent.primary` → `colors.text.link`. **Accent stays** on surfaces and on display numerals
  ≥24 pt: those are legal at 3:1 and are part of the thesis. Scan for any other small accent text and report it.

**Test — `__tests__/lib/theme/contrast-floor.test.ts` (new)**: the durable value is that the floor becomes a
contract. A WCAG `contrast(a, b)` helper over the token values, asserting the pairs above clear their floor (tag
pairs and the small-text pairs ≥ 4.5), and that **every `fontSizes` value is ≥ 11**. It is a
characterization/contract test: RED today (the two tag pairs and the sub-11 tokens fail), GREEN after the change.
Negative control: revert one token and watch the case fail.

**Allowed edit surfaces**: `lib/theme/tokens.ts`, `app/(tabs)/index.tsx`, `components/RestTimer.tsx`,
`__tests__/lib/theme/contrast-floor.test.ts`.

**Proves**: the app's own rule (§4 of `docs/ui-standard.md`) is enforced by test instead of by comment, and the
11 pt floor cannot regress silently.

---

## Slice 2 — targets and the tab bar (next, not in this slice)

- Tab bar: active tint `accent.primary` → a lighter steel that clears 5:1 (candidates: `#7A9AB5` 6.32,
  `#93B8D9` 8.96); the selected tab must not be the least legible element. Filled icons consistently
  (`app/(tabs)/_layout.tsx`).
- Session-row chips: height and/or `hitSlop` to reach the 28 pt minimum (44 preferred), with spacing
  (`components/session/SessionExerciseItem.tsx:436,446`).

---

## Recorded, deliberately not here

- **The large-text unit (Obs-06)** is already tracked in `odd/tasks/ux-corrections-batch.md` with its own
  decision. Not bundled: the repo already reverted one `maxFontSizeMultiplier` attempt, so it earns its own unit.
- **Taste items** — dark-only appearance, the ember budget, squaring everything — are the user's call and were
  judged to be working. Not touched.
- **Not verifiable from code**: animation feel, haptics, and real-device rendering (font hinting, P3, True Tone).
  Limits, not findings.
