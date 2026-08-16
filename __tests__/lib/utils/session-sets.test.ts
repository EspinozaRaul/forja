import { findPreviousSetWeight, shouldCelebrateNewRecord } from '../../../lib/utils/session-sets';
import type { Set } from '../../../lib/types';

function makeSet(partial: Partial<Set> & { id: number }): Set {
  return {
    sessionExerciseId: 1,
    setNumber: 1,
    reps: 10,
    weight: 100,
    completed: false,
    method: 'linear',
    dropOrder: 0, // schema default for plain linear sets (never null in the app)
    isDropGroup: false,
    rir: null,
    createdAt: new Date('2026-08-16T12:00:00Z'),
    ...partial,
  };
}

describe('findPreviousSetWeight', () => {
  it('returns null when there are no sets', () => {
    expect(findPreviousSetWeight([], 1)).toBeNull();
  });

  it('returns null when the only set is the one being updated', () => {
    const sets = [makeSet({ id: 1, setNumber: 1, weight: 60 })];
    expect(findPreviousSetWeight(sets, 1)).toBeNull();
  });

  it('returns the weight of the earlier set when a new heavier set follows it', () => {
    const sets = [
      makeSet({ id: 1, setNumber: 1, weight: 60 }),
      makeSet({ id: 2, setNumber: 2, weight: 62.5 }),
    ];
    expect(findPreviousSetWeight(sets, 2)).toBe(60);
  });

  it('skips an earlier set without a weight and uses the next earlier weighted set', () => {
    const sets = [
      makeSet({ id: 1, setNumber: 1, weight: null }),
      makeSet({ id: 2, setNumber: 2, weight: 55 }),
      makeSet({ id: 3, setNumber: 3, weight: 60 }),
    ];
    expect(findPreviousSetWeight(sets, 3)).toBe(55);
  });

  it('ignores drop children and uses the drop parent as the previous reference', () => {
    const sets = [
      makeSet({ id: 1, setNumber: 1, weight: 60, method: 'dropset', isDropGroup: true, dropOrder: 1 }),
      makeSet({ id: 2, setNumber: 1, weight: 40, method: 'dropset', isDropGroup: false, dropOrder: 2 }),
      makeSet({ id: 3, setNumber: 2, weight: 62.5 }),
    ];
    expect(findPreviousSetWeight(sets, 3)).toBe(60);
  });

  it('excludes the set being updated even when it has the highest setNumber', () => {
    const sets = [
      makeSet({ id: 1, setNumber: 1, weight: 60 }),
      makeSet({ id: 2, setNumber: 2, weight: 70 }),
    ];
    expect(findPreviousSetWeight(sets, 2)).toBe(60);
  });

  it('ignores an earlier set with a zero weight', () => {
    const sets = [
      makeSet({ id: 1, setNumber: 1, weight: 0 }),
      makeSet({ id: 2, setNumber: 2, weight: 62.5 }),
    ];
    expect(findPreviousSetWeight(sets, 2)).toBeNull();
  });

  it('returns null when no earlier weighted set exists (first set of the exercise)', () => {
    const sets = [makeSet({ id: 1, setNumber: 1, weight: 60 })];
    expect(findPreviousSetWeight(sets, 1)).toBeNull();
  });

  it('picks a deterministic winner when two parents share the same setNumber', () => {
    const sets = [
      makeSet({ id: 1, setNumber: 1, weight: 60 }),
      makeSet({ id: 2, setNumber: 1, weight: 62.5 }),
      makeSet({ id: 3, setNumber: 2, weight: 65 }),
    ];
    expect(findPreviousSetWeight(sets, 3)).toBe(60);
  });

  it('treats a plain linear set with dropOrder 0 as a valid previous reference', () => {
    // Regression: the app stores plain linear sets with dropOrder = 0 (schema
    // default), never null. The old filter (dropOrder == null) excluded them
    // all, so the new-record banner never appeared.
    const sets = [
      makeSet({ id: 1, setNumber: 1, weight: 60, dropOrder: 0, isDropGroup: false }),
      makeSet({ id: 2, setNumber: 2, weight: 62.5, dropOrder: 0, isDropGroup: false }),
    ];
    expect(findPreviousSetWeight(sets, 2)).toBe(60);
  });

  it('prefers the linear parent over a drop parent sharing the same setNumber', () => {
    const sets = [
      makeSet({ id: 1, setNumber: 1, weight: 40, method: 'dropset', isDropGroup: true, dropOrder: 1 }),
      makeSet({ id: 2, setNumber: 1, weight: 60, dropOrder: 0, isDropGroup: false }),
      makeSet({ id: 3, setNumber: 2, weight: 62.5 }),
    ];
    expect(findPreviousSetWeight(sets, 3)).toBe(60);
  });
});

describe('shouldCelebrateNewRecord', () => {
  it('celebrates beating the previous in-session set', () => {
    expect(shouldCelebrateNewRecord(62.5, 60, null, null)).toBe(true);
  });

  it('celebrates beating the visible placeholder mark even below the all-time max', () => {
    // Regression: the real DB shows placeholder 9 while the all-time max is 11.
    // Typing 10 beats what the user sees (placeholder) even though it is below
    // the historical max — it must still celebrate.
    expect(shouldCelebrateNewRecord(10, null, 9, 11)).toBe(true);
  });

  it('celebrates beating the all-time max', () => {
    expect(shouldCelebrateNewRecord(12, null, 9, 11)).toBe(true);
  });

  it('does not celebrate when the weight beats no mark', () => {
    expect(shouldCelebrateNewRecord(8, null, 9, 11)).toBe(false);
    expect(shouldCelebrateNewRecord(11, null, null, 11)).toBe(false);
  });

  it('does not celebrate for zero or negative weights', () => {
    expect(shouldCelebrateNewRecord(0, null, 9, 11)).toBe(false);
    expect(shouldCelebrateNewRecord(-5, null, 9, 11)).toBe(false);
  });
});