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
import fs from 'node:fs';
import path from 'node:path';
import { colors, fontSizes } from '../../../lib/theme/tokens';

/** Repo root, from `__tests__/lib/theme`. */
const ROOT = path.join(__dirname, '..', '..', '..');

/** The trees the static token scan walks, matching `typography-tokens.test.ts`. */
const SCAN_ROOTS = ['app', 'components'];

/**
 * Tokens that are surfaces, borders or fills and must never be given to a
 * `color:` property. A contrast assertion cannot catch this: `accent.secondary`
 * is too dark for text on *every* background (2.06-2.56:1), so the guard is that
 * no scanned style is even allowed to ask for it as a text colour.
 */
const NON_TEXT_TOKENS = ['accent.secondary', 'errorStrong'];

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

/** Every .ts/.tsx file under `dir`, excluding declaration files. */
function collectSource(dir: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') files.push(...collectSource(full));
    } else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      files.push(full);
    }
  }
  return files;
}

/**
 * Every `color: colors.<non-text token>` as `file:line`. Matches the *property*,
 * so `backgroundColor:` and `borderColor:` uses of the same token stay legal.
 */
function nonTextColorSites(src: string, file: string): string[] {
  const offenders: string[] = [];
  const pattern = new RegExp(`\\bcolor\\s*:\\s*colors\\.(${NON_TEXT_TOKENS.join('|')})\\b`, 'g');
  for (const match of src.matchAll(pattern)) {
    offenders.push(`${file}:${src.slice(0, match.index).split('\n').length}`);
  }
  return offenders;
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
    ['accent.light on bg.primary', colors.accent.light, colors.bg.primary],
    ['accent.light on bg.elevated', colors.accent.light, colors.bg.elevated],
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

describe('accent.secondary and errorStrong never carry text', () => {
  it('is never the `color:` of a scanned style', () => {
    const offenders: string[] = [];
    for (const dir of SCAN_ROOTS) {
      const abs = path.join(ROOT, dir);
      if (!fs.existsSync(abs)) continue;
      for (const file of collectSource(abs)) {
        offenders.push(...nonTextColorSites(fs.readFileSync(file, 'utf8'), path.relative(ROOT, file)));
      }
    }
    expect(offenders).toEqual([]);
  });

  // Triangulation: the scanner must catch a real text use and must tolerate the
  // same token as a surface, so a green tree cannot be a scanner that never fires.
  describe('scanner', () => {
    it('flags a `color:` on a non-text token and names its line', () => {
      const src = [
        'const styles = {',
        '  label: {',
        '    fontSize: fontSizes.sm,',
        '    color: colors.accent.secondary,',
        '  },',
        '};',
      ].join('\n');
      expect(nonTextColorSites(src, 'fixture.tsx')).toEqual(['fixture.tsx:4']);
    });

    it('flags errorStrong as text too', () => {
      const src = 'const s = { color: colors.errorStrong };';
      expect(nonTextColorSites(src, 'fixture.tsx')).toEqual(['fixture.tsx:1']);
    });

    it('keeps backgroundColor and borderColor legal', () => {
      const src = [
        'const styles = {',
        '  bar: { backgroundColor: colors.errorStrong },',
        '  edge: { borderColor: colors.accent.secondary },',
        '};',
      ].join('\n');
      expect(nonTextColorSites(src, 'fixture.tsx')).toEqual([]);
    });
  });
});
