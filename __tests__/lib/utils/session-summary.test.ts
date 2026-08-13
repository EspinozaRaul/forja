import { summarizeSets } from '../../../lib/utils/session-summary';
import type { Set } from '../../../lib/types';

function makeSet(partial: Partial<Set> & { id: number; setNumber: number }): Set {
  return {
    sessionExerciseId: 1,
    reps: null,
    weight: null,
    completed: false,
    method: null,
    dropOrder: null,
    isDropGroup: null,
    rir: null,
    createdAt: new Date(),
    ...partial,
  } as Set;
}

describe('summarizeSets', () => {
  it('returns empty for no sets', () => {
    expect(summarizeSets([])).toEqual([]);
    expect(summarizeSets(undefined as any)).toEqual([]);
  });

  it('passes through linear sets in order', () => {
    const sets = [
      makeSet({ id: 1, setNumber: 1, reps: 10, weight: 50 }),
      makeSet({ id: 2, setNumber: 2, reps: 8, weight: 55 }),
      makeSet({ id: 3, setNumber: 3, reps: 6, weight: 60 }),
    ];
    expect(summarizeSets(sets)).toEqual([
      { type: 'set', label: null, count: null, setNumber: 1, reps: 10, weight: 50 },
      { type: 'set', label: null, count: null, setNumber: 2, reps: 8, weight: 55 },
      { type: 'set', label: null, count: null, setNumber: 3, reps: 6, weight: 60 },
    ]);
  });

  it('collapses a drop set group into one "Drop × N" line', () => {
    const sets = [
      // Drop group at setNumber 1: parent + 2 drops
      makeSet({ id: 1, setNumber: 1, method: 'dropset', dropOrder: 1, isDropGroup: true, reps: 10, weight: 50 }),
      makeSet({ id: 2, setNumber: 1, method: 'dropset', dropOrder: 2, isDropGroup: false, reps: 8, weight: 45 }),
      makeSet({ id: 3, setNumber: 1, method: 'dropset', dropOrder: 3, isDropGroup: false, reps: 6, weight: 40 }),
      // Linear set after
      makeSet({ id: 4, setNumber: 2, reps: 12, weight: 60 }),
    ];
    expect(summarizeSets(sets)).toEqual([
      { type: 'group', label: 'Drop', count: 3, setNumber: 1, reps: null, weight: null },
      { type: 'set', label: null, count: null, setNumber: 2, reps: 12, weight: 60 },
    ]);
  });

  it('keeps multiple drop groups as separate lines with original set numbers', () => {
    const sets = [
      makeSet({ id: 1, setNumber: 1, method: 'dropset', dropOrder: 1, isDropGroup: true }),
      makeSet({ id: 2, setNumber: 1, method: 'dropset', dropOrder: 2, isDropGroup: false }),
      makeSet({ id: 3, setNumber: 2, method: 'dropset', dropOrder: 1, isDropGroup: true }),
      makeSet({ id: 4, setNumber: 2, method: 'dropset', dropOrder: 2, isDropGroup: false }),
      makeSet({ id: 5, setNumber: 3, reps: 22, weight: 22 }),
    ];
    const lines = summarizeSets(sets);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatchObject({ type: 'group', label: 'Drop', count: 2, setNumber: 1 });
    expect(lines[1]).toMatchObject({ type: 'group', label: 'Drop', count: 2, setNumber: 2 });
    expect(lines[2]).toMatchObject({ type: 'set', setNumber: 3, reps: 22, weight: 22 });
  });

  it('labels rest_pause and cluster as Segmento', () => {
    const sets = [
      makeSet({ id: 1, setNumber: 1, method: 'rest_pause', dropOrder: 1, isDropGroup: true }),
      makeSet({ id: 2, setNumber: 1, method: 'rest_pause', dropOrder: 2, isDropGroup: false }),
      makeSet({ id: 3, setNumber: 2, method: 'cluster', dropOrder: 1, isDropGroup: true }),
      makeSet({ id: 4, setNumber: 2, method: 'cluster', dropOrder: 2, isDropGroup: false }),
    ];
    const lines = summarizeSets(sets);
    expect(lines[0]).toMatchObject({ type: 'group', label: 'Segmento', setNumber: 1 });
    expect(lines[1]).toMatchObject({ type: 'group', label: 'Segmento', setNumber: 2 });
  });
});
