import { detectRoutineDiff, summarizeDiff } from '../../../lib/utils/routine-diff';
import type { DiffSetRow } from '../../../lib/utils/routine-diff';

function buildSets(
  rows: Array<{ setNumber: number; method?: string | null; isDropGroup?: boolean; dropOrder?: number }>
): DiffSetRow[] {
  return rows.map((r) => ({
    setNumber: r.setNumber,
    method: r.method ?? null,
    isDropGroup: r.isDropGroup ?? false,
    dropOrder: r.dropOrder ?? 0,
  }));
}

describe('detectRoutineDiff', () => {
  it('returns no changes when session matches the routine', () => {
    const diff = detectRoutineDiff({
      routineExercises: [
        { id: 1, exerciseId: 10, order: 1, targetSets: 3 },
        { id: 2, exerciseId: 20, order: 2, targetSets: 4 },
      ],
      sessionExercises: [
        { exerciseId: 10, order: 1 },
        { exerciseId: 20, order: 2 },
      ],
      setsByExercise: {
        10: buildSets([{ setNumber: 1 }, { setNumber: 2 }, { setNumber: 3 }]),
        20: buildSets([{ setNumber: 1 }, { setNumber: 2 }, { setNumber: 3 }, { setNumber: 4 }]),
      },
      exerciseNames: { 10: 'Press banca', 20: 'Remo' },
    });

    expect(diff.hasChanges).toBe(false);
    expect(diff.removed).toEqual([]);
    expect(diff.added).toEqual([]);
    expect(diff.volumeChanged).toEqual([]);
    expect(diff.reordered).toBe(false);
    expect(summarizeDiff(diff)).toEqual([]);
  });

  it('detects a removed exercise', () => {
    const diff = detectRoutineDiff({
      routineExercises: [
        { id: 1, exerciseId: 10, order: 1, targetSets: 3 },
        { id: 2, exerciseId: 20, order: 2, targetSets: 3 },
      ],
      sessionExercises: [{ exerciseId: 20, order: 2 }],
      setsByExercise: {
        20: buildSets([{ setNumber: 1 }, { setNumber: 2 }, { setNumber: 3 }]),
      },
      exerciseNames: { 10: 'Press banca', 20: 'Remo' },
    });

    expect(diff.hasChanges).toBe(true);
    expect(diff.removed).toEqual([{ exerciseId: 10, name: 'Press banca' }]);
    expect(summarizeDiff(diff)).toEqual(['Eliminado: Press banca']);
  });

  it('detects an added exercise', () => {
    const diff = detectRoutineDiff({
      routineExercises: [{ id: 1, exerciseId: 10, order: 1, targetSets: 3 }],
      sessionExercises: [
        { exerciseId: 10, order: 1 },
        { exerciseId: 30, order: 2 },
      ],
      setsByExercise: {
        10: buildSets([{ setNumber: 1 }, { setNumber: 2 }, { setNumber: 3 }]),
        30: buildSets([{ setNumber: 1 }, { setNumber: 2 }]),
      },
      exerciseNames: { 10: 'Press banca', 30: 'Peso muerto' },
    });

    expect(diff.hasChanges).toBe(true);
    expect(diff.added).toEqual([{ exerciseId: 30, name: 'Peso muerto' }]);
    expect(summarizeDiff(diff)).toEqual(['Agregado: Peso muerto']);
  });

  it('detects volume decrease 3 → 2', () => {
    const diff = detectRoutineDiff({
      routineExercises: [{ id: 1, exerciseId: 10, order: 1, targetSets: 3 }],
      sessionExercises: [{ exerciseId: 10, order: 1 }],
      setsByExercise: {
        10: buildSets([{ setNumber: 1 }, { setNumber: 2 }]),
      },
      exerciseNames: { 10: 'Sentadilla' },
    });

    expect(diff.volumeChanged).toEqual([
      { exerciseId: 10, name: 'Sentadilla', fromSets: 3, toSets: 2 },
    ]);
    expect(summarizeDiff(diff)).toEqual(['Volumen: 3→2 series en Sentadilla']);
  });

  it('detects volume increase 2 → 4', () => {
    const diff = detectRoutineDiff({
      routineExercises: [{ id: 1, exerciseId: 10, order: 1, targetSets: 2 }],
      sessionExercises: [{ exerciseId: 10, order: 1 }],
      setsByExercise: {
        10: buildSets([
          { setNumber: 1 },
          { setNumber: 2 },
          { setNumber: 3 },
          { setNumber: 4 },
        ]),
      },
      exerciseNames: { 10: 'Sentadilla' },
    });

    expect(diff.volumeChanged).toEqual([
      { exerciseId: 10, name: 'Sentadilla', fromSets: 2, toSets: 4 },
    ]);
  });

  it('counts a drop group as one set (drop children do not add volume)', () => {
    const diff = detectRoutineDiff({
      routineExercises: [{ id: 1, exerciseId: 10, order: 1, targetSets: 1 }],
      sessionExercises: [{ exerciseId: 10, order: 1 }],
      setsByExercise: {
        10: buildSets([
          // Drop group at setNumber 1: parent + 2 children → counts as 1 set
          { setNumber: 1, method: 'dropset', isDropGroup: true, dropOrder: 1 },
          { setNumber: 1, method: 'dropset', isDropGroup: false, dropOrder: 2 },
          { setNumber: 1, method: 'dropset', isDropGroup: false, dropOrder: 3 },
        ]),
      },
      exerciseNames: { 10: 'Sentadilla' },
    });

    expect(diff.hasChanges).toBe(false);
    expect(diff.volumeChanged).toEqual([]);
  });

  it('detects order change', () => {
    const diff = detectRoutineDiff({
      routineExercises: [
        { id: 1, exerciseId: 10, order: 1, targetSets: 3 },
        { id: 2, exerciseId: 20, order: 2, targetSets: 3 },
        { id: 3, exerciseId: 30, order: 3, targetSets: 3 },
      ],
      sessionExercises: [
        { exerciseId: 20, order: 1 },
        { exerciseId: 10, order: 2 },
        { exerciseId: 30, order: 3 },
      ],
      setsByExercise: {
        10: buildSets([{ setNumber: 1 }, { setNumber: 2 }, { setNumber: 3 }]),
        20: buildSets([{ setNumber: 1 }, { setNumber: 2 }, { setNumber: 3 }]),
        30: buildSets([{ setNumber: 1 }, { setNumber: 2 }, { setNumber: 3 }]),
      },
      exerciseNames: { 10: 'Press banca', 20: 'Remo', 30: 'Sentadilla' },
    });

    expect(diff.reordered).toBe(true);
    expect(diff.hasChanges).toBe(true);
    expect(diff.removed).toEqual([]);
    expect(diff.added).toEqual([]);
    expect(diff.volumeChanged).toEqual([]);
    expect(summarizeDiff(diff)).toEqual(['Orden de ejercicios cambiado']);
  });

  it('detects a full combination (removed + added + volume + reorder)', () => {
    const diff = detectRoutineDiff({
      routineExercises: [
        { id: 1, exerciseId: 10, order: 1, targetSets: 3 },
        { id: 2, exerciseId: 20, order: 2, targetSets: 2 },
        { id: 3, exerciseId: 30, order: 3, targetSets: 3 },
      ],
      sessionExercises: [
        { exerciseId: 40, order: 1 },
        { exerciseId: 20, order: 2 },
        { exerciseId: 10, order: 3 },
      ],
      setsByExercise: {
        10: buildSets([{ setNumber: 1 }, { setNumber: 2 }, { setNumber: 3 }]),
        20: buildSets([{ setNumber: 1 }, { setNumber: 2 }, { setNumber: 3 }, { setNumber: 4 }]),
        40: buildSets([{ setNumber: 1 }]),
      },
      exerciseNames: { 10: 'Press banca', 20: 'Remo', 30: 'Sentadilla', 40: 'Curl' },
    });

    expect(diff.hasChanges).toBe(true);
    // 30 was removed from the routine (absent in the session)
    expect(diff.removed).toEqual([{ exerciseId: 30, name: 'Sentadilla' }]);
    // 40 was added in the session (absent in the routine)
    expect(diff.added).toEqual([{ exerciseId: 40, name: 'Curl' }]);
    // 20 went from 2 target sets to 4 real sets
    expect(diff.volumeChanged).toEqual([
      { exerciseId: 20, name: 'Remo', fromSets: 2, toSets: 4 },
    ]);
    // Common exercises sequence changed: routine [10,20] vs session [20,10]
    expect(diff.reordered).toBe(true);

    expect(summarizeDiff(diff)).toEqual([
      'Eliminado: Sentadilla',
      'Agregado: Curl',
      'Volumen: 2→4 series en Remo',
      'Orden de ejercicios cambiado',
    ]);
  });
});