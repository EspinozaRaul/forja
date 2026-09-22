import fs from 'node:fs';
import path from 'node:path';
import { computeMetrics, MACHINE_BLOCK_KEYS } from '../../scripts/ui-metrics.js';

/**
 * Guards `docs/ui-standard.md`'s current-state numbers against drift.
 *
 * The section used to say `<Button>` was called 28 times with 14 variants and
 * that 14 text glyphs were still actions. None of those was true, and nothing
 * failed when they stopped being true. The document now carries a fenced
 * `ui-metrics` block:
 *
 *   <!-- ui-metrics:begin -->
 *   key = value
 *   ...
 *   <!-- ui-metrics:end -->
 *
 * These tests re-run `scripts/ui-metrics.js` against the tree and assert the
 * block quotes those measurements exactly. The numbers are reported output;
 * the assertions are the part that means something.
 */

const DOC = path.join(__dirname, '..', '..', 'docs', 'ui-standard.md');
const BLOCK = /<!--\s*ui-metrics:begin\s*-->([\s\S]*?)<!--\s*ui-metrics:end\s*-->/;

type ParsedBlock = { present: boolean; values: Map<string, number> };

function parseBlock(source: string): ParsedBlock {
  const match = source.match(BLOCK);
  if (!match) return { present: false, values: new Map() };

  const values = new Map<string, number>();
  for (const rawLine of match[1].split('\n')) {
    const line = rawLine.trim();
    if (line === '') continue;
    const kv = line.match(/^([A-Za-z][A-Za-z0-9_]*)\s*=\s*(\d+)$/);
    if (!kv) throw new Error(`Malformed ui-metrics line: "${line}"`);
    values.set(kv[1], Number(kv[2]));
  }
  return { present: true, values };
}

const source = fs.readFileSync(DOC, 'utf8');
const block = parseBlock(source);
const { metrics } = computeMetrics();

const keys = Object.keys(metrics) as (keyof typeof metrics)[];

describe('ui-standard.md current-state metrics', () => {
  it('carries a machine-readable ui-metrics block', () => {
    expect(block.present).toBe(true);
  });

  it('declares exactly the metrics the script emits', () => {
    expect([...block.values.keys()].sort()).toEqual([...MACHINE_BLOCK_KEYS].sort());
  });

  it('quotes every measured count exactly', () => {
    const drift = keys
      .filter((key) => block.values.get(key) !== metrics[key])
      .map((key) => `${key}: doc says ${block.values.get(key)}, measured ${metrics[key]}`);
    expect(drift).toEqual([]);
  });
});

describe('ui-standard.md current-state invariants', () => {
  it('every <Button> call site chooses a variant explicitly', () => {
    expect(metrics.buttonVariants).toBe(metrics.buttonCallsites);
  });

  it('no named text glyph survives as an action', () => {
    // The ASCII arrow candidates are reported separately on purpose: the named
    // sweep is clean, and pretending they are the same number hides the trap
    // that produced this guard.
    expect(metrics.glyphActions).toBe(0);
  });

  it('no interactive element is unlabelled', () => {
    expect(metrics.unlabelledInteractive).toBe(0);
  });

  it('both catalogues carry the same number of keys', () => {
    expect(metrics.catalogueKeysEs).toBe(metrics.catalogueKeysEn);
  });
});

describe('ui-metrics block parser', () => {
  it('ignores surrounding prose and blank lines', () => {
    const sample = [
      'prose before',
      '<!-- ui-metrics:begin -->',
      '',
      'modals = 17',
      '  buttonVariants = 27  ',
      '<!-- ui-metrics:end -->',
      'prose after',
    ].join('\n');
    expect([...parseBlock(sample).values.entries()]).toEqual([
      ['modals', 17],
      ['buttonVariants', 27],
    ]);
  });

  it('reports a missing block instead of throwing', () => {
    expect(parseBlock('no markers here').present).toBe(false);
  });

  it('rejects a malformed line rather than silently skipping it', () => {
    const sample = '<!-- ui-metrics:begin -->\nmodals: 17\n<!-- ui-metrics:end -->';
    expect(() => parseBlock(sample)).toThrow(/Malformed ui-metrics line/);
  });
});
