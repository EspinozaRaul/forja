/* eslint-disable @typescript-eslint/no-explicit-any */
import { CREATE_TABLES_SQL } from '../../../lib/db/ddl';
import { setCurrentUserId } from '../../../lib/db/user-scope';

// Units U3 and U4: every `db.transaction` callback touched by the N2 fix must be
// atomic on the driver that actually ships.
//
// They used to pass an `async` callback to `db.transaction`. On
// `drizzle-orm/expo-sqlite` the session runs `begin`, calls the callback, then
// `commit` WITHOUT awaiting it (see `transaction()` in
// `drizzle-orm/expo-sqlite/session.js`). An `async` callback runs synchronously up
// to its first `await` — and the builder's `.then()` executes that first statement
// synchronously — then returns a pending promise, so `commit` fires with only the
// first statement inside the transaction. Every later statement runs in
// autocommit, and a mid-callback failure therefore rolls back nothing.
//
// The shape that works is a synchronous callback whose writes use `.run()` and
// whose reads use `.all()`/`.get()`, because the driver's session treats it as
// synchronous end to end. Exactly one assertion per function discriminates the two
// shapes: the rollback assertion. The success path produces the same SQL state
// under both shapes, so it only guards that the conversion preserved behaviour.
//
// Same harness as `delete-session-atomicity.test.ts`: `drizzle-orm/expo-sqlite`
// over a fake expo-sqlite client backed by `node:sqlite`. Only the native module
// boundary is fake, so the transaction semantics under test — including the
// commit-before-`await` trap — are the driver's real ones. It proves the SQL state
// after a failure, not on-device atomicity.
jest.mock('expo-sqlite', () => ({
  openDatabaseSync: () => ({ execSync: jest.fn() }),
}));

jest.mock('../../../lib/db/index', () => {
  const { DatabaseSync } = require('node:sqlite');
  const { drizzle } = require('drizzle-orm/expo-sqlite');

  const sqlite = new DatabaseSync(':memory:');
  const hooks: { onStatement: ((sql: string) => void) | null } = { onStatement: null };

  const isRowReturning = (sql: string) =>
    /^\s*(select|pragma|with)\b/i.test(sql) || /\breturning\b/i.test(sql);

  const client = {
    prepareSync(sql: string) {
      const statement = sqlite.prepare(sql);
      return {
        executeSync(params: unknown[] = []) {
          hooks.onStatement?.(sql);
          if (isRowReturning(sql)) {
            statement.setReturnArrays(true);
            const rows = statement.all(...params);
            return {
              changes: 0,
              lastInsertRowId: 0,
              getAllSync: () => rows,
              getFirstSync: () => rows[0],
            };
          }
          const info = statement.run(...params);
          return {
            changes: info.changes,
            lastInsertRowId: info.lastInsertRowId,
            getAllSync: () => [],
            getFirstSync: () => undefined,
          };
        },
        executeForRawResultSync(params: unknown[] = []) {
          hooks.onStatement?.(sql);
          statement.setReturnArrays(true);
          const rows = statement.all(...params);
          return { getAllSync: () => rows, getFirstSync: () => rows[0] };
        },
      };
    },
  };

  return {
    __esModule: true,
    db: drizzle(client as any),
    __sqlite: sqlite,
    __hooks: hooks,
    initializeDatabase: jest.fn(),
  };
});

import * as queries from '../../../lib/db/queries';

const mockedIndex = require('../../../lib/db/index') as {
  db: any;
  __sqlite: any;
  __hooks: { onStatement: ((sql: string) => void) | null };
};

const OWNER = 'user-a';
const SESSION_ID = 1;

let sqlite: any;

/** Make the Nth `update <table>` statement throw, so an earlier write is at risk. */
function injectFailureOnUpdate(table: string, occurrence: number): void {
  injectFailureOn(table, 'update', occurrence);
}

/** Make the Nth `insert into <table>` statement throw, so an earlier write is at risk. */
function injectFailureOnInsert(table: string, occurrence: number): void {
  injectFailureOn(table, 'insert into', occurrence);
}

function injectFailureOn(table: string, verb: string, occurrence: number): void {
  let seen = 0;
  const pattern = new RegExp('^' + verb + '\\s+["`]?' + table + '["`]?', 'i');
  mockedIndex.__hooks.onStatement = (sql: string) => {
    if (!pattern.test(sql.trim())) return;
    seen += 1;
    if (seen === occurrence) {
      throw new Error(`injected ${table} ${verb.split(' ')[0]} failure #${occurrence}`);
    }
  };
}

function targetRow(id: number): { target_sets: number | null; target_reps: number | null } {
  return sqlite
    .prepare('SELECT target_sets, target_reps FROM routine_exercises WHERE id = ?')
    .get(id);
}

function pairIdOf(sessionExerciseId: number): number | null {
  const row = sqlite
    .prepare('SELECT superset_pair_id AS p FROM session_exercises WHERE id = ?')
    .get(sessionExerciseId);
  return row ? row.p : null;
}

function setCount(sessionExerciseId: number): number {
  return sqlite
    .prepare('SELECT COUNT(*) AS c FROM sets WHERE session_exercise_id = ?')
    .get(sessionExerciseId).c;
}

describe('sync transaction atomicity for the converted callbacks (expo-sqlite driver)', () => {
  beforeAll(() => {
    sqlite = mockedIndex.__sqlite;
    sqlite.exec(CREATE_TABLES_SQL);
  });

  beforeEach(() => {
    mockedIndex.__hooks.onStatement = null;
    sqlite.exec(
      'DELETE FROM sets; DELETE FROM session_exercises; DELETE FROM sessions;' +
        'DELETE FROM routine_exercises; DELETE FROM routines;' +
        'DELETE FROM exercises; DELETE FROM categories;'
    );
    sqlite.exec("INSERT INTO exercises (id, name, created_at) VALUES (1, 'Bench press', 0);");
    setCurrentUserId(OWNER);
  });

  afterEach(() => {
    mockedIndex.__hooks.onStatement = null;
  });

  describe('repairRoutineTargetDefaults', () => {
    beforeEach(() => {
      // The repair early-returns without an active account, so seed one exactly as
      // the auth effect does before it runs at startup.
      sqlite
        .prepare('INSERT INTO routines (id, user_id, name, created_at) VALUES (?, ?, ?, ?)')
        .run(1, OWNER, 'Routine A', 0);
      // Row 1 is the unambiguous upsync damage: target_sets = 1.
      sqlite
        .prepare(
          'INSERT INTO routine_exercises (id, routine_id, exercise_id, "order", target_sets, target_reps)' +
            ' VALUES (?, ?, ?, ?, ?, ?)'
        )
        .run(1, 1, 1, 0, 1, 5);
    });

    // DISCRIMINATING ASSERTION. Under the `async` callback the 2nd update throws
    // after the driver already committed the 1st, so target_sets is left at 3.
    // Only the synchronous callback keeps the 1st update inside the transaction
    // that the driver rolls back on the throw.
    it('rolls back the first target_sets repair when the second update throws', async () => {
      injectFailureOnUpdate('routine_exercises', 2);

      await expect(queries.repairRoutineTargetDefaults()).rejects.toThrow(
        'injected routine_exercises update failure #2'
      );

      const row = targetRow(1);
      expect(row.target_sets).toBe(1);
      expect(row.target_reps).toBe(5);
    });

    it('applies every repair on the success path', async () => {
      sqlite
        .prepare(
          'INSERT INTO routine_exercises (id, routine_id, exercise_id, "order", target_sets, target_reps)' +
            ' VALUES (?, ?, ?, ?, ?, ?)'
        )
        .run(2, 1, 1, 1, null, null);
      sqlite
        .prepare(
          'INSERT INTO routine_exercises (id, routine_id, exercise_id, "order", target_sets, target_reps)' +
            ' VALUES (?, ?, ?, ?, ?, ?)'
        )
        .run(3, 1, 1, 2, 2, 0);

      const result = await queries.repairRoutineTargetDefaults();

      expect(result).toBeUndefined();
      // target_sets = 1 → default; target_reps = 5 stays (not null, not <= 0).
      expect(targetRow(1)).toEqual({ target_sets: 3, target_reps: 5 });
      // null targets → both defaults.
      expect(targetRow(2)).toEqual({ target_sets: 3, target_reps: 10 });
      // target_sets = 2 is a deliberate value, target_reps = 0 is repaired.
      expect(targetRow(3)).toEqual({ target_sets: 2, target_reps: 10 });
    });
  });

  describe('createSuperSetPair', () => {
    beforeEach(() => {
      sqlite
        .prepare('INSERT INTO sessions (id, user_id, started_at) VALUES (?, ?, ?)')
        .run(SESSION_ID, OWNER, 0);
      sqlite
        .prepare(
          'INSERT INTO session_exercises (id, session_id, exercise_id, "order", superset_pair_id)' +
            ' VALUES (?, ?, ?, ?, ?)'
        )
        .run(1, SESSION_ID, 1, 0, null);
      sqlite
        .prepare(
          'INSERT INTO session_exercises (id, session_id, exercise_id, "order", superset_pair_id)' +
            ' VALUES (?, ?, ?, ?, ?)'
        )
        .run(2, SESSION_ID, 1, 1, null);
      // One side already has a set, so the balancing insert also runs.
      sqlite
        .prepare(
          'INSERT INTO sets (id, session_exercise_id, set_number, completed, created_at)' +
            ' VALUES (?, ?, ?, ?, ?)'
        )
        .run(1, 1, 1, 0, 0);
    });

    // DISCRIMINATING ASSERTION. Under the `async` callback the 2nd update throws
    // after COMMIT already made the 1st one permanent, so the first exercise keeps
    // a pair id whose partner was never written — the half-paired superset this
    // transaction exists to prevent.
    it('rolls back the first pair-id write when the second update throws', async () => {
      injectFailureOnUpdate('session_exercises', 2);

      await expect(queries.createSuperSetPair(1, 2)).rejects.toThrow(
        'injected session_exercises update failure #2'
      );

      expect(pairIdOf(1)).toBeNull();
      expect(pairIdOf(2)).toBeNull();
    });

    it('returns the pair id and writes it to both rows on the success path', async () => {
      const before = Date.now();
      const pairId = await queries.createSuperSetPair(1, 2);
      const after = Date.now();

      // Same formula as before the conversion: firstId * 1_000_000 + secondId * 1_000 + ms.
      expect(typeof pairId).toBe('number');
      const offset = pairId - (1 * 1000000 + 2 * 1000);
      expect(offset).toBeGreaterThanOrEqual(0);
      expect(offset).toBeLessThan(1000);
      expect(before % 1000).toBeLessThanOrEqual(after % 1000);

      expect(pairIdOf(1)).toBe(pairId);
      expect(pairIdOf(2)).toBe(pairId);
      // The balancing read stayed a read: side 2 got the matching empty set.
      expect(setCount(1)).toBe(1);
      expect(setCount(2)).toBe(1);
    });
  });

  describe('replaceDropSetGroup', () => {
    beforeEach(() => {
      sqlite
        .prepare('INSERT INTO sessions (id, user_id, started_at) VALUES (?, ?, ?)')
        .run(SESSION_ID, OWNER, 0);
      sqlite
        .prepare(
          'INSERT INTO session_exercises (id, session_id, exercise_id, "order", superset_pair_id)' +
            ' VALUES (?, ?, ?, ?, ?)'
        )
        .run(1, SESSION_ID, 1, 0, null);
      // The drop group the call replaces: two drops on set 1.
      sqlite
        .prepare(
          'INSERT INTO sets (id, session_exercise_id, set_number, reps, weight, completed, method, drop_order, is_drop_group, created_at)' +
            ' VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .run(1, 1, 1, 8, 40, 0, 'dropset', 1, 1, 0);
      sqlite
        .prepare(
          'INSERT INTO sets (id, session_exercise_id, set_number, reps, weight, completed, method, drop_order, is_drop_group, created_at)' +
            ' VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .run(2, 1, 1, 10, 30, 0, 'dropset', 2, 0, 0);
    });

    function dropGroupRows(): { id: number; reps: number | null; weight: number | null }[] {
      // The live rows of the group only: `replaceDropSetGroup` tombstones the old
      // drops, so an unfiltered read would also return the soft-deleted pair.
      return sqlite
        .prepare(
          'SELECT id, reps, weight FROM sets WHERE session_exercise_id = 1 AND set_number = 1' +
            ' AND deleted_at IS NULL ORDER BY drop_order'
        )
        .all();
    }

    // DISCRIMINATING ASSERTION. Under the `async` callback COMMIT already fired at
    // the delete's `await`, so by the time the insertion of the replacements throws
    // the original two drops are permanently gone and the group is left empty.
    // Only the synchronous callback keeps the delete inside the transaction that the
    // driver rolls back on the throw.
    it('rolls back the drop-group delete when the replacement insert throws', async () => {
      injectFailureOnInsert('sets', 1);

      await expect(
        queries.replaceDropSetGroup({
          sessionExerciseId: 1,
          setNumber: 1,
          drops: [{ reps: 9, weight: 45 }],
        })
      ).rejects.toThrow('injected sets insert failure #1');

      expect(dropGroupRows()).toEqual([
        { id: 1, reps: 8, weight: 40 },
        { id: 2, reps: 10, weight: 30 },
      ]);
    });

    it('returns the new rows and replaces the group on the success path', async () => {
      const returned = await queries.replaceDropSetGroup({
        sessionExerciseId: 1,
        setNumber: 1,
        drops: [
          { reps: 9, weight: 45, completed: true },
          { reps: 12, weight: 25 },
        ],
      });

      // Callers render these rows to avoid a gap: they must be the new ones, not
      // the deleted pair.
      expect(returned).toHaveLength(2);
      expect(returned.map((r) => r.id)).not.toContain(1);
      expect(returned.map((r) => r.id)).not.toContain(2);
      expect(returned[0]).toMatchObject({
        sessionExerciseId: 1,
        setNumber: 1,
        reps: 9,
        weight: 45,
        completed: true,
        isDropGroup: true,
        dropOrder: 1,
      });
      expect(returned[1]).toMatchObject({ reps: 12, weight: 25, isDropGroup: false, dropOrder: 2 });

      const rows = dropGroupRows();
      expect(rows.map((r) => r.id)).toEqual(returned.map((r) => r.id));
      expect(rows).toHaveLength(2);
    });
  });

  describe('duplicateSessionData', () => {
    beforeEach(() => {
      sqlite.exec("INSERT INTO exercises (id, name, created_at) VALUES (2, 'Squat', 0);");
      sqlite
        .prepare('INSERT INTO sessions (id, user_id, started_at) VALUES (?, ?, ?)')
        .run(1, OWNER, 0);
      sqlite
        .prepare('INSERT INTO sessions (id, user_id, started_at) VALUES (?, ?, ?)')
        .run(2, OWNER, 1);
      // Source: two exercises, two sets on the first and one on the second.
      sqlite
        .prepare(
          'INSERT INTO session_exercises (id, session_id, exercise_id, "order", superset_pair_id)' +
            ' VALUES (?, ?, ?, ?, ?)'
        )
        .run(1, 1, 1, 0, null);
      sqlite
        .prepare(
          'INSERT INTO session_exercises (id, session_id, exercise_id, "order", superset_pair_id)' +
            ' VALUES (?, ?, ?, ?, ?)'
        )
        .run(2, 1, 2, 1, null);
      for (const [id, sessionExerciseId, setNumber, reps, weight] of [
        [1, 1, 1, 8, 40],
        [2, 1, 2, 6, 45],
        [3, 2, 1, 10, 60],
      ] as const) {
        sqlite
          .prepare(
            'INSERT INTO sets (id, session_exercise_id, set_number, reps, weight, completed, created_at)' +
              ' VALUES (?, ?, ?, ?, ?, ?, ?)'
          )
          .run(id, sessionExerciseId, setNumber, reps, weight, 1, 0);
      }
    });

    function targetExerciseIds(): number[] {
      return sqlite
        .prepare('SELECT id FROM session_exercises WHERE session_id = 2 ORDER BY "order"')
        .all()
        .map((r: { id: number }) => r.id);
    }

    function targetSetRows(): { se: number; n: number; completed: number }[] {
      return sqlite
        .prepare(
          'SELECT s.session_exercise_id AS se, s.set_number AS n, s.completed AS completed' +
            ' FROM sets s JOIN session_exercises se ON se.id = s.session_exercise_id' +
            ' WHERE se.session_id = 2 ORDER BY se, n'
        )
        .all();
    }

    // DISCRIMINATING ASSERTION. Under the `async` callback COMMIT fired at the first
    // source read, so the copied `session_exercises` row of the first loop iteration
    // was already permanent when the copied-set insert threw: an exercise with no
    // sets survives. The synchronous callback rolls that insert back too.
    it('rolls back the copied exercises when a copied-set insert throws', async () => {
      injectFailureOnInsert('sets', 1);

      await expect(queries.duplicateSessionData(1, 2)).rejects.toThrow(
        'injected sets insert failure #1'
      );

      expect(targetExerciseIds()).toEqual([]);
      expect(targetSetRows()).toEqual([]);
    });

    it('copies every exercise and attaches each copied set to its copied exercise', async () => {
      const result = await queries.duplicateSessionData(1, 2);

      // The function returns nothing, before and after the conversion.
      expect(result).toBeUndefined();

      const targetIds = targetExerciseIds();
      expect(targetIds).toHaveLength(2);
      // The copies are new rows, never the source ids the loop read.
      expect(targetIds).not.toContain(1);
      expect(targetIds).not.toContain(2);

      const rows = targetSetRows();
      expect(rows).toHaveLength(3);
      // Each copied set hangs off the copied exercise of its source, grouped the
      // same way: two sets on the first copy, one on the second.
      expect(rows.filter((r) => r.se === targetIds[0]).map((r) => r.n)).toEqual([1, 2]);
      expect(rows.filter((r) => r.se === targetIds[1]).map((r) => r.n)).toEqual([1]);
      // A duplicated set starts unchecked, as before the conversion.
      expect(rows.every((r) => r.completed === 0)).toBe(true);

      // The source session is untouched.
      expect(
        sqlite.prepare('SELECT COUNT(*) AS c FROM session_exercises WHERE session_id = 1').get().c
      ).toBe(2);
      expect(
        sqlite
          .prepare(
            'SELECT COUNT(*) AS c FROM sets s JOIN session_exercises se ON se.id = s.session_exercise_id' +
              ' WHERE se.session_id = 1'
          )
          .get().c
      ).toBe(3);
    });
  });

  describe('replaceSessionExercise', () => {
    // The highest-risk site: three reads and four writes inside one callback, and the
    // data move reassigns EVERY set of the slot to the parked row. A half-applied run
    // does not merely lose a row, it rewrites visible session history.
    beforeEach(() => {
      sqlite.exec("INSERT INTO exercises (id, name, created_at) VALUES (2, 'Squat', 0);");
      sqlite
        .prepare('INSERT INTO sessions (id, user_id, started_at) VALUES (?, ?, ?)')
        .run(SESSION_ID, OWNER, 0);
      sqlite
        .prepare(
          'INSERT INTO session_exercises (id, session_id, exercise_id, "order", rest_time, notes, note_type, superset_pair_id)' +
            ' VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .run(1, SESSION_ID, 1, 0, 90, 'salida', 'rendimiento', 55);
      // Two sets with real data on the slot, so the callback takes the park-and-move
      // path instead of the in-place swap.
      sqlite
        .prepare(
          'INSERT INTO sets (id, session_exercise_id, set_number, reps, weight, completed, created_at)' +
            ' VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
        .run(1, 1, 1, 8, 40, 0, 0);
      sqlite
        .prepare(
          'INSERT INTO sets (id, session_exercise_id, set_number, reps, weight, completed, created_at)' +
            ' VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
        .run(2, 1, 2, 6, 45, 0, 0);
    });

    function slotRow(id: number): Record<string, unknown> {
      return sqlite
        .prepare(
          'SELECT session_id AS sessionId, exercise_id AS exerciseId, "order" AS ord,' +
            ' rest_time AS restTime, notes, note_type AS noteType, superset_pair_id AS pair' +
            ' FROM session_exercises WHERE id = ?'
        )
        .get(id);
    }

    function slotSets(sessionExerciseId: number): Record<string, unknown>[] {
      return sqlite
        .prepare(
          'SELECT id, set_number AS setNumber, reps, weight, completed FROM sets' +
            ' WHERE session_exercise_id = ? ORDER BY set_number'
        )
        .all(sessionExerciseId);
    }

    function exerciseCount(): number {
      return sqlite
        .prepare('SELECT COUNT(*) AS c FROM session_exercises WHERE session_id = ?')
        .get(SESSION_ID).c;
    }

    // DISCRIMINATING ASSERTION. The failure is injected on the LAST write of the
    // callback (the template rebuild), after the parked insert, the set reassignment
    // and the recycle have already run. Under the `async` callback COMMIT fired at the
    // first `await`, so those three writes were already permanent: the user's sets
    // would hang off a phantom parked row and the slot would already show the incoming
    // exercise. Only the synchronous callback keeps all four writes in the one
    // transaction the driver rolls back, leaving the record exactly as it was.
    it('rolls back the park, the set move and the recycle when the template rebuild throws', async () => {
      injectFailureOnInsert('sets', 1);

      await expect(queries.replaceSessionExercise(1, 2)).rejects.toThrow(
        'injected sets insert failure #1'
      );

      // Nothing parked: the session still holds exactly its one exercise slot.
      expect(exerciseCount()).toBe(1);
      // The slot is untouched: same exercise, order and superset pair, not recycled.
      expect(slotRow(1)).toEqual({
        sessionId: SESSION_ID,
        exerciseId: 1,
        ord: 0,
        restTime: 90,
        notes: 'salida',
        noteType: 'rendimiento',
        pair: 55,
      });
      // Every original set still points at the slot, unchanged and in order — the
      // reassignment to the parked row was rolled back too.
      expect(slotSets(1)).toEqual([
        { id: 1, setNumber: 1, reps: 8, weight: 40, completed: 0 },
        { id: 2, setNumber: 2, reps: 6, weight: 45, completed: 0 },
      ]);
    });

    it('parks every set, recycles the slot and rebuilds an empty template on the success path', async () => {
      const result = await queries.replaceSessionExercise(1, 2);

      // The recycled slot is returned with the same id and order and its pair intact.
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: 1, exerciseId: 2, order: 0, supersetPairId: 55 });

      // Exactly one parked row was added, above the session maximum, with the outgoing
      // exercise, the slot's rest/notes and no superset pair (the link follows the slot).
      expect(exerciseCount()).toBe(2);
      const parked = sqlite
        .prepare('SELECT id FROM session_exercises WHERE session_id = ? AND id <> 1')
        .get(SESSION_ID) as { id: number };
      expect(parked).toBeDefined();
      expect(slotRow(parked.id)).toEqual({
        sessionId: SESSION_ID,
        exerciseId: 1,
        ord: 1,
        restTime: 90,
        notes: 'salida',
        noteType: 'rendimiento',
        pair: null,
      });

      // Every original set moved to the parked row, unchanged.
      expect(slotSets(parked.id)).toEqual([
        { id: 1, setNumber: 1, reps: 8, weight: 40, completed: 0 },
        { id: 2, setNumber: 2, reps: 6, weight: 45, completed: 0 },
      ]);

      // The recycled slot carries a fresh, empty template of the same size.
      expect(slotSets(1)).toEqual([
        { id: expect.any(Number), setNumber: 1, reps: null, weight: null, completed: 0 },
        { id: expect.any(Number), setNumber: 2, reps: null, weight: null, completed: 0 },
      ]);
    });
  });
});
