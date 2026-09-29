/**
 * The legibility floor, as a contract.
 *
 * Every ratio below is computed from the live values in `lib/theme/tokens.ts`
 * (WCAG relative luminance, then `(L1 + 0.05) / (L2 + 0.05)`) — no ratio is
 * hardcoded, so changing a token re-measures the pair instead of reassuring us.
 * The floors come from the house standard (`docs/ui-standard.md` §4) and Apple's
 * Human Interface Guidelines: `typography.md › Ensuring legibility` (the 11 pt
 * minimum for information-carrying text) and `accessibility.md › Vision`
 * (text needs 4.5:1, or 3:1 when it is large — ≥18 pt, or ≥14 pt bold).
 *
 * This is a characterization test: it fails on the values that shipped before
 * the legibility slice, and pins them so they cannot regress silently.
 */
import { colors, fontSizes } from '../../../lib/theme/tokens';

/** WCAG floor for text under 18 pt (or under 14 pt bold). */
const SMALL_TEXT_FLOOR = 4.5;

/** HIG minimum for information-carrying text. */
const MIN_FONT_SIZE = 11;

/** `#rgb` / `#rrggbb` → `[r, g, b]` in 0-255. Pure tokens, never alpha colours. */
function channels(hex: string): [number, number, number] {
  const body = hex.replace('#', '');
  if (!/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(body)) {
    throw new Error(`not a hex colour token: ${hex}`);
  }
  const full = body.length === 3 ? body.replace(/./g, (c) => c + c) : body;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** WCAG relative luminance. */
function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((value) => {
    const s = value / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrast ratio between two hex tokens, lighter over darker. */
function contrast(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('contrast helper', () => {
  it('measures the extremes correctly', () => {
    expect(contrast('#FFFFFF', '#000000')).toBeCloseTo(21, 1);
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(contrast(colors.text.primary, colors.text.primary)).toBeCloseTo(1, 5);
  });
});

describe('small information-carrying text clears 4.5:1', () => {
  const pairs: Array<[string, string, string]> = [
    ['tag.text on tag.muscle', colors.tag.text, colors.tag.muscle],
    ['tag.equipmentText on tag.equipment', colors.tag.equipmentText, colors.tag.equipment],
    ['text.muted on bg.primary', colors.text.muted, colors.bg.primary],
    ['text.muted on bg.card', colors.text.muted, colors.bg.card],
    ['text.muted on bg.elevated', colors.text.muted, colors.bg.elevated],
    ['text.link on bg.primary', colors.text.link, colors.bg.primary],
    ['text.link on bg.elevated', colors.text.link, colors.bg.elevated],
    ['text.onAccent on accent.primary', colors.text.onAccent, colors.accent.primary],
    ['success on bg.card', colors.success, colors.bg.card],
  ];

  it.each(pairs)('%s', (_label, foreground, background) => {
    const ratio = contrast(foreground, background);
    expect({
      pair: _label,
      ratio: Number(ratio.toFixed(2)),
      clearsFloor: ratio >= SMALL_TEXT_FLOOR,
    }).toEqual({
      pair: _label,
      ratio: Number(ratio.toFixed(2)),
      clearsFloor: true,
    });
  });
});

describe('no typography token sits below the 11 pt HIG minimum', () => {
  const sizes = Object.entries(fontSizes);

  it.each(sizes)('fontSizes.%s', (_token, size) => {
    expect(size).toBeGreaterThanOrEqual(MIN_FONT_SIZE);
  });
});
