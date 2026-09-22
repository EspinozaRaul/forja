import fs from 'node:fs';
import path from 'node:path';

/**
 * Guards the planned-set materialisation in `handleStartSession` of
 * `app/routine/[id].tsx` against the serialized-insert defect: the handler
 * awaited one `createSet.mutateAsync` per set, so a routine with N planned sets
 * paid N serialized round-trips before the session screen could open.
 *
 * The fix is fan-out, not batching: the same single-row inserts are collected
 * into `setPromises` and awaited through one `Promise.all`, which removes the
 * serialized latency without changing the round-trip count. The pattern is the
 * one already landed in `app/(tabs)/index.tsx` and `app/session/new.tsx`.
 *
 * `handleStartSession` is an inline handler in the screen, not an extractable
 * component, so the contract is asserted structurally against the source — the
 * same approach as `__tests__/components/routine-start-modal.test.ts`. What
 * this pins: the concurrency shape of the loop. What it cannot prove: real
 * runtime concurrency; no static test observes `Promise.all` at runtime.
 *
 * The serial *outer* loop is intended, not a defect: each
 * `addExerciseToSession` insert returns the id its sets need, so it must stay
 * awaited. That negative half is asserted too, so the test cannot pass by
 * fanning out the outer loop as well.
 */

const ROOT = path.join(__dirname, '..', '..');
const SCREEN = path.join(ROOT, 'app', 'routine', '[id].tsx');

/** Returns the balanced `{ … }` body starting at the first `{` at or after `from`. */
function braceBody(src: string, from: number): string {
  const open = src.indexOf('{', from);
  if (open === -1) return '';
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  return '';
}

/** Returns the body of `handleStartSession`, or '' when not found. */
function startSessionHandlerBlock(src: string): string {
  const marker = src.indexOf('const handleStartSession = async');
  if (marker === -1) return '';
  const arrow = src.indexOf('=>', marker);
  if (arrow === -1) return '';
  return braceBody(src, arrow);
}

/** Returns the body of the per-set `for (let i = 1; i <= plannedSets; i++)` loop. */
function plannedSetsLoopBlock(handler: string): string {
  const marker = handler.indexOf('for (let i = 1; i <= plannedSets; i++)');
  if (marker === -1) return '';
  return braceBody(handler, marker);
}

describe('routine materialisation fan-out', () => {
  const src = fs.readFileSync(SCREEN, 'utf8');
  const handler = startSessionHandlerBlock(src);
  const loop = plannedSetsLoopBlock(handler);

  it('locates the handleStartSession handler and its per-set loop', () => {
    // Every other assertion here is a `not.toMatch` or a presence check over an
    // extracted slice. If extraction silently returned '', the negative
    // assertions would pass vacuously, so the extraction itself is pinned.
    expect(handler).not.toBe('');
    expect(handler).toContain('createSet.mutateAsync');
    expect(handler).toContain('addExerciseToSession.mutateAsync');
    expect(loop).not.toBe('');
    expect(loop).toContain('createSet.mutateAsync');
  });

  it('does not await createSet.mutateAsync inside the per-set loop', () => {
    // The defect: one awaited insert per set. Fan-out replaces the `await` with
    // a collected promise, so the loop body must not await the mutation.
    expect(loop).not.toMatch(/await\s+createSet\.mutateAsync/);
  });

  it('collects the set promises and awaits them through one Promise.all', () => {
    expect(handler).toMatch(/const\s+setPromises\s*=\s*\[\s*\]/);
    expect(handler).toMatch(/setPromises\.push\(\s*createSet\.mutateAsync/);
    expect(handler).toMatch(/await\s+Promise\.all\(\s*setPromises\s*\)/);
  });

  it('keeps the outer addExerciseToSession insert awaited and serial', () => {
    // The outer per-exercise loop must stay serial: each insert returns the id
    // its sets need, so fanning it out would race the set creation.
    expect(handler).toMatch(/await\s+addExerciseToSession\.mutateAsync\(/);
  });

  it('fans out only the per-set loop, never the outer exercise loop', () => {
    // TRIANGULATE: exactly one `Promise.all` in the handler. If the outer loop
    // were also converted to fan-out, a second one would appear and the set
    // creation would race its `addExerciseToSession` id.
    const allCalls = handler.match(/Promise\.all/g) ?? [];
    expect(allCalls).toHaveLength(1);
    expect(handler).toMatch(/for\s*\(\s*const\s+re\s+of\s+routineExercisesWithDetails\s*\)/);
  });

  it('leaves the continue-from-last branch untouched', () => {
    // TRIANGULATE: the fan-out change is scoped to the fresh-start branch. The
    // duplicate path is not part of this unit and must not be altered or lost.
    expect(handler).toMatch(/if\s*\(\s*continueFromLast\s*&&\s*lastSession\s*\)/);
    expect(handler).toMatch(/await\s+duplicateSessionData\.mutateAsync\(/);
  });
});
