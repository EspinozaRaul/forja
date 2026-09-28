/**
 * What this suite can and cannot prove.
 *
 * This harness mocks Drizzle (`lib/db/index` is replaced with jest.fn stubs and
 * `db.transaction` is wired to a fake `tx`), so these tests pin the SEQUENCE and
 * the ARGUMENTS of the calls `replaceSessionExercise` issues. They do NOT run any
 * SQL and cannot prove the resulting database state — no assertion below could
 * fail because of how SQLite stored a row. The predicate cases are genuine unit
 * tests because `setHasRealData` is pure.
 *
 * The one exception is the commit-boundary case at the end: the fake `transaction`
 * commits exactly where the driver does (right after the callback returns), so
 * `statementsAfterCommit` can tell a synchronous callback from an async one. That
 * assertion is about transaction membership, not stored rows, and the real data
 * outcome is measured against a real SQLite harness in
 * `sync-transaction-atomicity.test.ts`; do not read a green run here as evidence of
 * the data result.
 */

import { setHasRealData, replaceSessionExercise } from '../../../lib/db/queries';

// `uuid()` reaches expo-crypto through `lib/db/identity`; that native module is
// auto-mocked to return undefined under Jest, which would make the uuid assertions
// below vacuous. Back it with a deterministic unique generator, the same stub the
// sets-identity and identity-backfill suites use.
jest.mock('expo-crypto', () => {
  let counter = 0;
  return {
    randomUUID: () => {
      counter += 1;
      return `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
    },
  };
});

jest.mock('../../../lib/db/index', () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    transaction: jest.fn(),
  },
}));

import { db } from '../../../lib/db/index';
import { sessionExercises, sets } from '../../../lib/db/schema';

/* eslint-disable @typescript-eslint/no-explicit-any */

type AnyRecord = Record<string, unknown>;

/**
 * Thenable stand-in for a Drizzle query chain. Every chain method returns the
 * same object and awaiting it resolves the queued result — the same shape as the
 * `createMockQuery` helper in `queries.test.ts`, extended with the write methods.
 */
function createChain(result: unknown, onMethod?: (method: string, args: unknown[]) => void) {
  const chain: Record<string, unknown> = {};
  const methods = [
    'from',
    'where',
    'orderBy',
    'limit',
    'groupBy',
    'innerJoin',
    'leftJoin',
    'set',
    'values',
    'returning',
  ];
  for (const method of methods) {
    chain[method] = jest.fn((...args: unknown[]) => {
      onMethod?.(method, args);
      return chain;
    });
  }

  // The real builder carries both paths on the same object: it is thenable AND it
  // executes synchronously through `.all()` / `.get()` / `.run()`. The converted
  // callback uses the synchronous path only; `then` stays because a real builder has
  // it and a fake that drops it would not be modelling the driver.
  const asRows = () => (Array.isArray(result) ? result : [result]);
  chain.all = jest.fn(() => {
    onMethod?.('all', []);
    return asRows();
  });
  chain.get = jest.fn(() => {
    onMethod?.('get', []);
    return asRows()[0];
  });
  chain.run = jest.fn(() => {
    onMethod?.('run', []);
    return { changes: 1, lastInsertRowId: 1 };
  });
  chain.then = (resolve: (value: unknown) => unknown) => resolve(result);
  return chain;
}

interface StandInOptions {
  /** One entry per `tx.select()` call, in order. */
  selects: unknown[][];
  /** Result resolved by every `tx.insert(...)` chain (the parked row). */
  insertRows?: unknown[];
  /** Result resolved by every `tx.update(...)` chain (the recycled row). */
  updateRows?: unknown[];
}

/** A fake `tx` that records the `set()`/`values()` payloads it receives. */
function createStandIn(options: StandInOptions) {
  const insertValues: AnyRecord[] = [];
  const updateSets: AnyRecord[] = [];

  // Model the driver's COMMIT boundary exactly: `transaction()` in
  // `drizzle-orm/expo-sqlite/session.js` calls the callback and then `commit`
  // WITHOUT awaiting it. A synchronous callback has issued every statement by the
  // time it returns; an async one has not, and its remaining statements run after
  // that commit, in autocommit. This SQL-free harness cannot observe a rollback, so
  // recording what runs past the boundary is how it can still tell the two shapes
  // apart.
  let committed = false;
  const statementsAfterCommit: string[] = [];
  const record = (method: string) => {
    if (committed) statementsAfterCommit.push(method);
  };

  const select = jest.fn();
  for (const result of options.selects) {
    select.mockReturnValueOnce(createChain(result, record));
  }

  const insert = jest.fn(() =>
    createChain(options.insertRows ?? [], (method, args) => {
      if (method === 'values') insertValues.push(args[0] as AnyRecord);
      record(method);
    })
  );

  const update = jest.fn(() =>
    createChain(options.updateRows ?? [], (method, args) => {
      if (method === 'set') updateSets.push(args[0] as AnyRecord);
      record(method);
    })
  );

  return {
    tx: { select, insert, update } as any,
    insertValues,
    updateSets,
    /** Called by `wire` at the exact point the driver commits. */
    commit: () => {
      committed = true;
    },
    statementsAfterCommit,
  };
}

describe('setHasRealData', () => {
  // A session-start template set: only setNumber is populated, the rest are the
  // schema defaults.
  const templateSet = {
    completed: false,
    reps: null,
    weight: null,
    rir: null,
    partialReps: null,
    method: 'linear',
    isDropGroup: false,
  };

  it('returns false for a fresh template set', () => {
    expect(setHasRealData(templateSet)).toBe(false);
  });

  it('returns true for a completed set', () => {
    expect(setHasRealData({ ...templateSet, completed: true })).toBe(true);
  });

  it('returns true for a set with reps', () => {
    expect(setHasRealData({ ...templateSet, reps: 8 })).toBe(true);
  });

  it('returns true for a set with weight', () => {
    expect(setHasRealData({ ...templateSet, weight: 82.5 })).toBe(true);
  });

  it('returns true for rir 0 (a recorded value, not an empty slot)', () => {
    expect(setHasRealData({ ...templateSet, rir: 0 })).toBe(true);
  });

  it('returns true for partialReps', () => {
    expect(setHasRealData({ ...templateSet, partialReps: 3 })).toBe(true);
  });

  it('returns true for a non-linear method', () => {
    expect(setHasRealData({ ...templateSet, method: 'dropset' })).toBe(true);
  });

  it('returns true for a drop-group starter', () => {
    expect(setHasRealData({ ...templateSet, isDropGroup: true })).toBe(true);
  });

  it('accepts the SQLite 1/0 boolean shapes as well as true/false', () => {
    const asInts = (overrides: AnyRecord) =>
      ({ ...templateSet, ...overrides }) as unknown as Parameters<typeof setHasRealData>[0];
    expect(setHasRealData(asInts({ completed: 1 }))).toBe(true);
    expect(setHasRealData(asInts({ isDropGroup: 1 }))).toBe(true);
    expect(setHasRealData(asInts({ completed: 0, isDropGroup: 0 }))).toBe(false);
  });
});

describe('replaceSessionExercise', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  const targetRow = {
    id: 10,
    sessionId: 7,
    exerciseId: 1,
    order: 3,
    restTime: 90,
    notes: 'salida',
    noteType: 'rendimiento',
    supersetPairId: 55,
  };

  const recycledRow = { ...targetRow, exerciseId: 2 };
  const parkedRow = { ...targetRow, id: 99, order: 4, supersetPairId: null };

  function wire(standIn: ReturnType<typeof createStandIn>) {
    (db.transaction as jest.Mock).mockImplementationOnce((cb: (t: unknown) => unknown) => {
      // A real driver callback is synchronous: `transaction()` calls it, then
      // commits without awaiting whatever it returned.
      const result = cb(standIn.tx);
      standIn.commit();
      return result;
    });
  }

  it('does nothing when the row is not found (not owned)', async () => {
    const standIn = createStandIn({ selects: [[]] });
    const { tx, insertValues, updateSets } = standIn;
    wire(standIn);

    const result = await replaceSessionExercise(10, 2);

    expect(result).toEqual([]);
    expect(tx.insert).not.toHaveBeenCalled();
    expect(tx.update).not.toHaveBeenCalled();
    expect(insertValues).toHaveLength(0);
    expect(updateSets).toHaveLength(0);
  });

  it('with no real data only swaps the exercise id and inserts nothing', async () => {
    const emptyTemplate = [
      { setNumber: 1, completed: false, reps: null, weight: null, rir: null, partialReps: null, method: 'linear', isDropGroup: false },
      { setNumber: 2, completed: false, reps: null, weight: null, rir: null, partialReps: null, method: 'linear', isDropGroup: false },
    ];
    const standIn = createStandIn({
      selects: [[targetRow], emptyTemplate],
      updateRows: [recycledRow],
    });
    const { tx, insertValues, updateSets } = standIn;
    wire(standIn);

    const result = await replaceSessionExercise(10, 2);

    expect(result).toEqual([recycledRow]);
    expect(tx.insert).not.toHaveBeenCalled();
    expect(tx.update).toHaveBeenCalledTimes(1);
    expect(updateSets).toEqual([{ exerciseId: 2, updatedAt: expect.any(Date) }]);
    expect(insertValues).toHaveLength(0);
  });

  it('with real data parks the outgoing exercise, re-points its sets and rebuilds the slot', async () => {
    // Two sets with real data -> a two-set parked record and a two-set template.
    const loadedSets = [
      { setNumber: 1, completed: true, reps: 8, weight: 82.5, rir: null, partialReps: null, method: 'linear', isDropGroup: false },
      { setNumber: 2, completed: false, reps: 6, weight: 85, rir: 1, partialReps: null, method: 'linear', isDropGroup: false },
    ];
    const standIn = createStandIn({
      selects: [[targetRow], loadedSets, [{ value: 7 }]],
      insertRows: [parkedRow],
      updateRows: [recycledRow],
    });
    const { tx, insertValues, updateSets } = standIn;
    wire(standIn);

    const result = await replaceSessionExercise(10, 2);

    // Parked entry: the OUTGOING exercise, order above the session maximum, the
    // slot's rest/notes carried over, and no superset pair (the link follows the slot).
    expect(tx.insert).toHaveBeenNthCalledWith(1, sessionExercises);
    expect(insertValues[0]).toEqual({
      sessionId: 7,
      exerciseId: 1,
      order: 8,
      restTime: 90,
      notes: 'salida',
      noteType: 'rendimiento',
      supersetPairId: null,
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
      uuid: expect.any(String),
    });

    // Every set of the slot moves to the parked row.
    expect(updateSets[0]).toEqual({ sessionExerciseId: 99, updatedAt: expect.any(Date) });

    // Recycled slot: only exerciseId changes plus the updatedAt bump; id/order/
    // supersetPairId and the row's identity are untouched.
    expect(updateSets[1]).toEqual({ exerciseId: 2, updatedAt: expect.any(Date) });
    expect(tx.update).toHaveBeenCalledTimes(2);

    // Fresh empty template of the same size on the recycled slot.
    expect(tx.insert).toHaveBeenNthCalledWith(2, sets);
    expect(insertValues[1]).toEqual([
      { sessionExerciseId: 10, setNumber: 1, completed: false, createdAt: expect.any(Date), updatedAt: expect.any(Date), uuid: expect.any(String) },
      { sessionExerciseId: 10, setNumber: 2, completed: false, createdAt: expect.any(Date), updatedAt: expect.any(Date), uuid: expect.any(String) },
    ]);

    expect(result).toEqual([recycledRow]);
  });

  it('parks with order 1 when the session maximum is null (empty order set)', async () => {
    const loadedSets = [
      { setNumber: 1, completed: true, reps: 8, weight: 82.5, rir: null, partialReps: null, method: 'linear', isDropGroup: false },
    ];
    const standIn = createStandIn({
      selects: [[targetRow], loadedSets, [{ value: null }]],
      insertRows: [parkedRow],
      updateRows: [recycledRow],
    });
    const { insertValues } = standIn;
    wire(standIn);

    await replaceSessionExercise(10, 2);

    expect(insertValues[0]).toEqual(expect.objectContaining({ order: 1 }));
  });

  it('issues every statement before the driver commits (the callback is synchronous)', async () => {
    // Same real-data path as above: three reads, then the parked insert, the set
    // reassignment, the recycle and the template rebuild.
    const loadedSets = [
      { setNumber: 1, completed: true, reps: 8, weight: 82.5, rir: null, partialReps: null, method: 'linear', isDropGroup: false },
      { setNumber: 2, completed: false, reps: 6, weight: 85, rir: 1, partialReps: null, method: 'linear', isDropGroup: false },
    ];
    const standIn = createStandIn({
      selects: [[targetRow], loadedSets, [{ value: 7 }]],
      insertRows: [parkedRow],
      updateRows: [recycledRow],
    });
    wire(standIn);

    await replaceSessionExercise(10, 2);

    // THE DISCRIMINATING ASSERTION IN THIS FILE. The driver commits as soon as the
    // callback returns its value. Under the async callback everything after the first
    // `await` ran past that commit — the parked insert, the set reassignment, the
    // recycle and the template rebuild, each in autocommit where a later throw rolls
    // back nothing. The sequence assertions above cannot see that: they pass under
    // both shapes because the method calls still happen, only their transaction
    // membership differs. The behavioural rollback proof is the new case in
    // `sync-transaction-atomicity.test.ts`, which runs the real driver; this is the
    // SQL-free analogue, and it is the one assertion here that fails against the
    // async callback.
    expect(standIn.statementsAfterCommit).toEqual([]);
  });
});
