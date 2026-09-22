import fs from 'node:fs';
import path from 'node:path';

/**
 * Guards the two V2 wiring contracts of `app/session/[id].tsx` structurally. The
 * grouping decision itself is exercised behaviourally in
 * `__tests__/lib/utils/superset-grouping.test.ts`; this file only pins that the
 * screen is wired to it and to the atomic delete. The screen is inline JSX, so the
 * contract is asserted against the source — the same approach as
 * `__tests__/components/routine-start-modal.test.ts`.
 */

const ROOT = path.join(__dirname, '..', '..');
const SCREEN = path.join(ROOT, 'app', 'session', '[id].tsx');
const HELPER = path.join(ROOT, 'lib', 'utils', 'superset-grouping.ts');

describe('super set delete path', () => {
  const src = fs.readFileSync(SCREEN, 'utf8');

  it('renders through the extracted grouping helper', () => {
    expect(src).toMatch(/from '\.\.\/\.\.\/lib\/utils\/superset-grouping'/);
    expect(src).toContain('planSupersetRows(');
  });

  it('has no silent `members.length === 2` fallthrough', () => {
    expect(src).not.toMatch(/members\s*\.\s*length\s*===?\s*2/);
    expect(src).toContain("row.kind === 'pair'");
  });

  it('dissolves a pair group whose member count cannot render', () => {
    // The ≠2 case is no longer a comment: the plan names it and the screen acts on it.
    expect(src).toContain('unrenderablePairIds');
    expect(src).toMatch(/unlinkSuperSet\s*\.\s*mutateAsync/);
  });

  it('deletes the pair through one atomic DB function', () => {
    const start = src.indexOf('const handleDeleteSuperSet');
    expect(start).toBeGreaterThan(-1);
    const end = src.indexOf('\n  return (', start);
    expect(end).toBeGreaterThan(start);
    const block = src.slice(start, end);
    expect(block).toContain('deleteSuperSetMembers(');
    expect(block).not.toContain('deleteSessionExercise');
    expect(block).not.toContain('unlinkSuperSet');
  });
});

describe('superset grouping helper module', () => {
  it('stays pure: no React and no database imports', () => {
    const helper = fs.readFileSync(HELPER, 'utf8');
    expect(helper).not.toMatch(/from ['"][^'"]*react/i);
    expect(helper).not.toMatch(/from ['"][^'"]*db\//);
  });
});
