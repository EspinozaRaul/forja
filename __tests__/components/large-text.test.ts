import fs from 'node:fs';
import path from 'node:path';

/**
 * Pins the large-text strategy as a rule, not as a rendering.
 *
 * The strategy (see `odd/tasks/large-text-strategy.md`): the app **scales with
 * the OS and never opts out**. No `allowFontScaling={false}`, no
 * `maxFontSizeMultiplier`. What has to change when the OS text size grows is
 * the *layout* that assumed text does not grow — not the text.
 *
 * The repo cannot render in jest, so the durable guard here is a **scan**, and
 * it must be honest about what a scan can prove:
 *
 *   - It proves the design decision: no file under `app/` or `components/`
 *     silences Dynamic Type.
 *   - It does **not** prove that nothing overflows at the largest size. It
 *     cannot see the rendered tree, so it cannot measure whether a row wraps or
 *     a title truncates. That is a device artifact, checked on device (Obs-06),
 *     not something a regex can assert. The scan pins the decision; the reflow
 *     is verified by hand.
 *
 * The scanner follows `__tests__/components/typography-tokens.test.ts`: same
 * file-walk, plus a fixture case so a green tree cannot be the artifact of a
 * regex that never matches anything.
 */

const ROOT = path.join(__dirname, '..', '..');
const SCAN_ROOTS = ['app', 'components'];

/** Both opt-outs, as written anywhere in a scanned source file. */
const FORBIDDEN_PATTERNS: RegExp[] = [
  // Any spacing/paren variant of the JSX opt-out, not only the canonical string.
  /allowFontScaling\s*=\s*\{\s*false\s*\}/g,
  // The prop itself is the opt-out at any value; the strategy has no use for it.
  /maxFontSizeMultiplier/g,
];

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
 * The 1-based lines of `src` that contain a forbidden opt-out, deduplicated and
 * ordered. Returns `[]` for a clean source.
 */
function optOutLines(src: string): number[] {
  const lines = new Set<number>();
  for (const pattern of FORBIDDEN_PATTERNS) {
    for (const match of src.matchAll(pattern)) {
      lines.add(src.slice(0, match.index!).split('\n').length);
    }
  }
  return [...lines].sort((a, b) => a - b);
}

/** Every opt-out under the scan roots, as `file:line`. */
function scanForOptOuts(): string[] {
  const offenders: string[] = [];
  for (const dir of SCAN_ROOTS) {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs)) continue;
    for (const file of collectSource(abs)) {
      const rel = path.relative(ROOT, file);
      for (const line of optOutLines(fs.readFileSync(file, 'utf8'))) {
        offenders.push(`${rel}:${line}`);
      }
    }
  }
  return offenders;
}

describe('large-text strategy', () => {
  it('never opts a source file out of OS text scaling', () => {
    expect(scanForOptOuts()).toEqual([]);
  });

  // Triangulation: the scanner must match a real offender, or the zero above
  // would be indistinguishable from a regex that never fires.
  describe('scanner', () => {
    it('flags both forbidden forms and names their lines', () => {
      const fixture = [
        '<Text allowFontScaling={false}>scaled out</Text>',
        '<Text maxFontSizeMultiplier={1.2}>capped</Text>',
      ].join('\n');
      expect(optOutLines(fixture)).toEqual([1, 2]);
    });

    it('tolerates spacing in the allowFontScaling opt-out', () => {
      expect(optOutLines('<Text allowFontScaling = { false } />')).toEqual([1]);
    });

    it('accepts text that scales with the OS', () => {
      const fixture = [
        '<Text allowFontScaling={true}>grows</Text>',
        '<Text>also grows</Text>',
      ].join('\n');
      expect(optOutLines(fixture)).toEqual([]);
    });

    it('scans the repository and returns file-relative offenders when planted', () => {
      // Guards the wrapper, not just the regex: the walk must reach real files
      // and report `app/…`/`components/…` paths. The planted string lives only in
      // this fixture; `scanForOptOuts` reads the working tree.
      const tree = scanForOptOuts();
      expect(tree.every((hit) => hit.startsWith('app/') || hit.startsWith('components/'))).toBe(true);
    });
  });
});
