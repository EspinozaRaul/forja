import fs from 'node:fs';
import path from 'node:path';

/**
 * Guards the V4 "consistency, not behaviour" items against silent regression.
 *
 * Part A — the typography tokens. `lib/theme/tokens.ts` exposes `fonts` as
 * *pre-weighted* families (`Oswald_600SemiBold`, `SpaceGrotesk_400Regular` /
 * `_500Medium` / `_600SemiBold`), each loaded one by one in `app/_layout.tsx`.
 * A bare `fontWeight` therefore decorates nothing: the OS default face renders
 * instead of the intended family and the weight token is inert. The rule this
 * file pins: every object literal that sets `fontWeight` must also set a
 * `fontFamily`.
 *
 * Part B — the counted nouns. The scan asserts that the two hand-rolled English
 * strings on the session-history screen and on `RoutineCard` route their units
 * through the catalogue. The assertions are code-level (they name the static
 * `t('…')` keys and reject the exact removed fragments), so no translated
 * catalogue value can trip them; `__tests__/lib/i18n/catalog-parity.test.ts`
 * then resolves those keys in both catalogues.
 *
 * Both guards live in this file because the unit authorizes exactly one new
 * test path.
 */

const ROOT = path.join(__dirname, '..', '..');
const SCAN_ROOTS = ['app', 'components'];
const HISTORY_SCREEN = path.join(ROOT, 'app', 'session', 'history', '[id].tsx');
const ROUTINE_CARD = path.join(ROOT, 'components', 'RoutineCard.tsx');

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
 * The object literal that encloses `at`: walk back to the nearest unmatched
 * `{`, then forward to its matching `}`, so multi-line literals and nested
 * objects resolve to the innermost literal that owns the `fontWeight`.
 */
function enclosingLiteral(src: string, at: number): { start: number; end: number } | null {
  let depth = 0;
  let start = -1;
  for (let i = at; i >= 0; i--) {
    const ch = src[i];
    if (ch === '}') depth++;
    else if (ch === '{') {
      if (depth === 0) {
        start = i;
        break;
      }
      depth--;
    }
  }
  if (start === -1) return null;

  depth = 0;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return { start, end: i };
  }
  return null;
}

/**
 * Every `fontWeight:` whose own object literal has no `fontFamily:`, as
 * `file:line`. The literal — not the line — is the unit of the rule, because
 * the repository legitimately formats some style objects across several lines
 * (`components/SetLogger.tsx` keeps `fontFamily` on the line above the weight).
 */
function bareWeightSites(src: string, file: string): string[] {
  const offenders: string[] = [];
  for (const match of src.matchAll(/fontWeight\s*:/g)) {
    const at = match.index!;
    const literal = enclosingLiteral(src, at);
    const scope = literal ? src.slice(literal.start, literal.end + 1) : '';
    if (scope && /fontFamily\s*:/.test(scope)) continue;
    offenders.push(`${file}:${src.slice(0, at).split('\n').length}`);
  }
  return offenders;
}

describe('fontWeight tokens', () => {
  it('sits on a font family in every scanned style literal', () => {
    const offenders: string[] = [];
    for (const dir of SCAN_ROOTS) {
      const abs = path.join(ROOT, dir);
      if (!fs.existsSync(abs)) continue;
      for (const file of collectSource(abs)) {
        offenders.push(...bareWeightSites(fs.readFileSync(file, 'utf8'), path.relative(ROOT, file)));
      }
    }
    expect(offenders).toEqual([]);
  });

  // Triangulation: the scanner must catch a real offender and must tolerate
  // legitimate layouts, so a green tree cannot be an artifact of a scanner
  // that never reports anything.
  describe('scanner', () => {
    it('flags a bare fontWeight and names its line', () => {
      const src = [
        'const styles = {',
        '  title: {',
        '    fontSize: fontSizes.md,',
        '    fontWeight: fontWeights.bold,',
        '  },',
        '};',
      ].join('\n');
      expect(bareWeightSites(src, 'fixture.tsx')).toEqual(['fixture.tsx:4']);
    });

    it('accepts a fontFamily on the line above (SetLogger adjacency)', () => {
      const src = [
        'const styles = {',
        '  serieNumber: {',
        '    fontSize: fontSizes.sm, fontFamily: fonts.display,',
        '    fontWeight: fontWeights.semibold,',
        '    color: colors.text.secondary,',
        '  },',
        '};',
      ].join('\n');
      expect(bareWeightSites(src, 'fixture.tsx')).toEqual([]);
    });

    it('accepts a fontFamily after the weight in the same literal', () => {
      const src = "const s = { fontWeight: fontWeights.bold, fontFamily: fonts.body };";
      expect(bareWeightSites(src, 'fixture.tsx')).toEqual([]);
    });

    it('judges the nearest literal, not an ancestor that has a fontFamily', () => {
      const src = [
        'const styles = {',
        '  wrapper: { fontFamily: fonts.body,',
        '    inner: { fontWeight: fontWeights.bold },',
        '  },',
        '};',
      ].join('\n');
      expect(bareWeightSites(src, 'fixture.tsx')).toEqual(['fixture.tsx:3']);
    });

    it('reads a JSX style attribute literal', () => {
      const bare = '<Text style={{ fontSize: fontSizes.xl, fontWeight: fontWeights.bold }} />';
      const paired = '<Text style={{ fontSize: fontSizes.xl, fontFamily: fonts.display, fontWeight: fontWeights.bold }} />';
      expect(bareWeightSites(bare, 'fixture.tsx')).toEqual(['fixture.tsx:1']);
      expect(bareWeightSites(paired, 'fixture.tsx')).toEqual([]);
    });
  });
});

describe('counted nouns', () => {
  it('routes the history summary set/reps units through the catalogue', () => {
    const src = fs.readFileSync(HISTORY_SCREEN, 'utf8');
    expect(src).toContain("t('session.sets')");
    expect(src).toContain("t('session.reps')");
    // The exact removed fragments; no translated value can contain `}` or `$`.
    expect(src).not.toMatch(/completedSets\.length\}\s*sets\b/);
    expect(src).not.toMatch(/\}\s*reps\s*×/);
  });

  it('routes the routine card exercise count through singular/plural keys', () => {
    const src = fs.readFileSync(ROUTINE_CARD, 'utf8');
    expect(src).toContain("t('routine.exercise')");
    expect(src).toContain("t('routine.exercises')");
    expect(src).not.toMatch(/exercise\$\{[^}]*\?\s*'s'\s*:\s*''\}/);
  });
});
