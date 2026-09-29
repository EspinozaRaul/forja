import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/**
 * Pins `docs/ui-standard.md` §9's size rule for the arrangement that has already
 * clipped on device: a heading `Text` and a **full-size** `Button` sharing a
 * `justifyContent: 'space-between'` row.
 *
 * Why this arrangement and not the Button itself: `components/ui/Button.tsx`
 * gives its label `flexShrink: 0`, so a full-size button keeps its intrinsic
 * width and cannot yield to the heading beside it. At the OS accessibility sizes
 * the row then either overruns its card — the measured Obs-06 clip — or squeezes
 * the heading toward nothing. A `compact` button is smaller in both axes
 * (`fontSizes.sm`, `spacing.sm`), so both can share the row. The Slice 1 fix in
 * `app/routine/[id].tsx` is the reference; that row may also wrap (`flexWrap`),
 * which is the layout half of the fix. This guard pins only the size half.
 *
 * What a scan can prove, and what it cannot:
 *   - It proves the *arrangement*: every `space-between` row that contains a
 *     `<Button>` passes `compact` to it. That is a source-level decision.
 *   - It does NOT prove the rendering. It cannot see the resolved tree, so it
 *     cannot say the row no longer wraps, how tall the button is, or whether the
 *     heading stays on one line. Those are device measurements (Obs-06), not
 *     something a static scan can assert.
 *
 * How the scan works. Each file is parsed with the TypeScript parser and the JSX
 * tree is walked, rather than the line-window heuristic this class invites. A
 * "row" is a JSX element whose inline `style` carries
 * `justifyContent: 'space-between'` — in an object literal or a `style={[…]}`)
 * array; any `<Button>` at or below that element without `compact` is the defect.
 * A line window has no principled width: its answer is proximity, so a long
 * comment, a wrapper, or a row that ends just before an unrelated Button shifts
 * it. (On today's tree a 3-to-10-line window also happens to return only the
 * real rows; that coincidence is not a reason to ship the weaker rule.)
 *
 * Known limits, stated so a green run is not overread:
 *   - Only *inline* style values are seen. A `space-between` that lives in a
 *     `StyleSheet.create` entry or a `const style = {…}` referenced by name is
 *     invisible here. That is a false negative, not a false pass: all 34
 *     `space-between` occurrences in `app/` and `components/` are inline today,
 *     but a new one written as a named style would slip through.
 *   - A `<Button>` nested anywhere inside the row counts as being in the row. A
 *     full-size button mounted inside the row but not beside the heading would be
 *     flagged; that is intentional, and `EXEMPT` is where such a case gets named.
 *   - The parser never evaluates code: `compact={someFlag}` reads as compact even
 *     if the flag is false at runtime.
 *
 * The file-walk and `file:line` reporting follow
 * `__tests__/components/typography-tokens.test.ts`; the fixture cases below prove
 * the scanner matches, so the green tree is not the artifact of a walker that
 * never fires.
 */

const ROOT = path.join(__dirname, '..', '..');
const SCAN_ROOTS = ['app', 'components'];

/**
 * Rows that legitimately need a full-size Button, keyed by the Button's
 * `file:line`. Empty on purpose: all three `space-between` rows that carry a
 * Button today sit beside a heading, which §9 puts in `compact` territory. An
 * entry is a design decision a reviewer can see and argue with — never a silent
 * pass.
 */
const EXEMPT: ReadonlyArray<{ site: string; reason: string }> = [
  // { site: 'app/example.tsx:42', reason: 'a bottom action bar that shares a space-between row' },
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

type JsxOpen = ts.JsxOpeningElement | ts.JsxSelfClosingElement;

/** True when the opening tag's inline `style` carries `justifyContent: 'space-between'`. */
function isSpaceBetweenRow(open: JsxOpen, sf: ts.SourceFile): boolean {
  const style = open.attributes.properties.find(
    (attr): attr is ts.JsxAttribute => ts.isJsxAttribute(attr) && attr.name.getText(sf) === 'style',
  );
  if (!style || !style.initializer || !ts.isJsxExpression(style.initializer) || !style.initializer.expression) {
    return false;
  }
  let found = false;
  const visit = (node: ts.Node): void => {
    if (
      ts.isPropertyAssignment(node) &&
      node.name.getText(sf) === 'justifyContent' &&
      ts.isStringLiteral(node.initializer) &&
      node.initializer.text === 'space-between'
    ) {
      found = true;
    }
    ts.forEachChild(node, visit);
  };
  visit(style.initializer.expression);
  return found;
}

/** True when a `<Button>` opening tag carries the `compact` prop (bare or valued). */
function hasCompact(open: JsxOpen, sf: ts.SourceFile): boolean {
  return open.attributes.properties.some(
    (attr) => ts.isJsxAttribute(attr) && attr.name.getText(sf) === 'compact',
  );
}

function openingTagOf(node: ts.JsxElement | ts.JsxSelfClosingElement): JsxOpen {
  return ts.isJsxElement(node) ? node.openingElement : node;
}

function lineOf(node: ts.Node, sf: ts.SourceFile): number {
  return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
}

/**
 * Every `<Button>` that shares a `justifyContent: 'space-between'` row, as
 * `{ site, compact }`, where `site` is `file:line` of the Button.
 */
function spaceBetweenRowButtons(
  src: string,
  file: string,
  kind: ts.ScriptKind,
): { site: string; compact: boolean }[] {
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, kind);
  const rows: { site: string; compact: boolean }[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isJsxElement(node) && isSpaceBetweenRow(node.openingElement, sf)) {
      const walk = (child: ts.Node): void => {
        if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child)) {
          const open = openingTagOf(child);
          if (open.tagName.getText(sf) === 'Button') {
            rows.push({ site: `${file}:${lineOf(open, sf)}`, compact: hasCompact(open, sf) });
          }
        }
        ts.forEachChild(child, walk);
      };
      ts.forEachChild(node, walk);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return rows;
}

/** A full-size Button in a `space-between` row, as `file:line`; the defect class. */
function fullSizeButtonsInSpaceBetweenRows(
  src: string,
  file: string,
  kind: ts.ScriptKind,
): string[] {
  return spaceBetweenRowButtons(src, file, kind)
    .filter((row) => !row.compact)
    .map((row) => row.site);
}

/** The same scan over the whole tree, minus the named exemptions. */
function scanTree(): string[] {
  const exemptSites = new Set(EXEMPT.map((entry) => entry.site));
  const offenders: string[] = [];
  for (const dir of SCAN_ROOTS) {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs)) continue;
    for (const file of collectSource(abs)) {
      const rel = path.relative(ROOT, file);
      const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
      for (const site of fullSizeButtonsInSpaceBetweenRows(fs.readFileSync(file, 'utf8'), rel, kind)) {
        if (!exemptSites.has(site)) offenders.push(site);
      }
    }
  }
  return offenders;
}

describe('section-heading rows', () => {
  it('gives every Button inside a `space-between` row the compact size', () => {
    expect(scanTree()).toEqual([]);
  });

  it('reaches real files through the walk (relative, scannable paths)', () => {
    // Guards the walk, not the rule: the offenders must be reported as
    // repository-relative paths under the scanned roots, exactly like the
    // typography guard. Empty today, so also assert the reference row is read.
    expect(scanTree().every((site) => site.startsWith('app/') || site.startsWith('components/'))).toBe(true);
    const reference = fs.readFileSync(path.join(ROOT, 'app', 'routine', '[id].tsx'), 'utf8');
    expect(spaceBetweenRowButtons(reference, 'app/routine/[id].tsx', ts.ScriptKind.TSX)).toContainEqual({
      site: 'app/routine/[id].tsx:364',
      compact: true,
    });
  });

  // Triangulation: the scanner must flag a real offender and must tolerate the
  // legitimate shapes, so a green tree cannot be a walker that never fires.
  describe('scanner', () => {
    it('flags a full-size Button that shares a space-between row with a heading', () => {
      const fixture = [
        '<View style={{ flexDirection: "row", justifyContent: "space-between" }}>',
        '  <Text>Ejercicios</Text>',
        '  <Button title="add" variant="secondary" onPress={go} />',
        '</View>',
      ].join('\n');
      expect(fullSizeButtonsInSpaceBetweenRows(fixture, 'fixture.tsx', ts.ScriptKind.TSX)).toEqual([
        'fixture.tsx:3',
      ]);
    });

    it('accepts the same row once the Button is compact', () => {
      const fixture = [
        '<View style={{ justifyContent: "space-between" }}>',
        '  <Text>Ejercicios</Text>',
        '  <Button title="add" variant="secondary" compact onPress={go} />',
        '</View>',
      ].join('\n');
      expect(fullSizeButtonsInSpaceBetweenRows(fixture, 'fixture.tsx', ts.ScriptKind.TSX)).toEqual([]);
    });

    it('ignores a full-size Button that is not in a space-between row', () => {
      const fixture = [
        '<View style={{ flexDirection: "row", gap: 8 }}>',
        '  <Button title="start" variant="primary" onPress={go} />',
        '</View>',
      ].join('\n');
      expect(fullSizeButtonsInSpaceBetweenRows(fixture, 'fixture.tsx', ts.ScriptKind.TSX)).toEqual([]);
    });

    it('reads the style through a `style={[…]}` array (the ScreenHeader shape)', () => {
      const fixture = [
        '<View style={[{ justifyContent: "space-between" }, extra]}>',
        '  <Button title="x" onPress={go} />',
        '</View>',
      ].join('\n');
      expect(fullSizeButtonsInSpaceBetweenRows(fixture, 'fixture.tsx', ts.ScriptKind.TSX)).toEqual([
        'fixture.tsx:2',
      ]);
    });

    it('flags a Button nested inside a wrapper within the row', () => {
      const fixture = [
        '<View style={{ justifyContent: "space-between" }}>',
        '  <Text>h</Text>',
        '  <View>',
        '    <Button title="x" onPress={go} />',
        '  </View>',
        '</View>',
      ].join('\n');
      expect(fullSizeButtonsInSpaceBetweenRows(fixture, 'fixture.tsx', ts.ScriptKind.TSX)).toEqual([
        'fixture.tsx:4',
      ]);
    });

    it('flags a multi-line Button opening tag at its own line', () => {
      const fixture = [
        '<View style={{ justifyContent: "space-between" }}>',
        '  <Text>h</Text>',
        '  <Button',
        '    title="x"',
        '    onPress={go}',
        '  />',
        '</View>',
      ].join('\n');
      expect(fullSizeButtonsInSpaceBetweenRows(fixture, 'fixture.tsx', ts.ScriptKind.TSX)).toEqual([
        'fixture.tsx:3',
      ]);
    });

    it('ignores a space-between row that holds no Button', () => {
      const fixture = [
        '<View style={{ justifyContent: "space-between" }}>',
        '  <Text>a</Text>',
        '  <Text>b</Text>',
        '</View>',
      ].join('\n');
      expect(fullSizeButtonsInSpaceBetweenRows(fixture, 'fixture.tsx', ts.ScriptKind.TSX)).toEqual([]);
    });
  });
});
