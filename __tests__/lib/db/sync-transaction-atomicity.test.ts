/* eslint-disable @typescript-eslint/no-explicit-any */
import { CREATE_TABLES_SQL } from '../../../lib/db/ddl';
import { setCurrentUserId } from '../../../lib/db/user-scope';

// U3: `repairRoutineTargetDefaults` and `createSuperSetPair` must be atomic on the
// driver that actually ships.
//
// Both used to pass an `async` callback to `db.transaction`. On
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
  let seen = 0;
  const pattern = new RegExp('^update\\s+["`]?' + table + '["`]?', 'i');
  mockedIndex.__hooks.onStatement = (sql: string) => {
    if (!pattern.test(sql.trim())) return;
    seen += 1;
    if (seen === occurrence) {
      throw new Error(`injected ${table} update failure #${occurrence}`);
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

describe('sync transaction atomicity for U3 callbacks (expo-sqlite driver)', () => {
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
});
