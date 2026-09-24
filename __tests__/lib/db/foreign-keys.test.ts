/* eslint-disable @typescript-eslint/no-explicit-any */
import { CREATE_TABLES_SQL } from '../../../lib/db/ddl';

// U2: `lib/db/index` must issue `PRAGMA foreign_keys = ON` on the app's own
// connection, at module scope, so the declared `ON DELETE CASCADE` / `SET NULL`
// actions stop being inert on the driver that ships.
//
// PRODUCTION FIDELITY: expo-sqlite 57.0.2 does not enable foreign keys on either
// platform, while `node:sqlite` (the test harness) defaults them ON. The fake
// client below therefore starts with the pragma OFF, mirroring the device. That
// is what makes assertion 1 discriminating: the only thing that can turn the
// connection ON is the statement `lib/db/index` ships at import time, not the
// native default.
//
// Both assertions are required and they cover different axes:
//   1. Boundary — the real `lib/db/index` module (the pattern is in
//      `exercise-metadata-repair.test.ts`) issues the pragma and its connection
//      ends up enforcing it. Only this proves *our* code enables it.
//   2. Behaviour — a real exported query from `lib/db/queries.ts` whose outcome
//      depends on the `sets.session_exercise_id → session_exercises.id` CASCADE
//      differs between OFF and ON. The OFF arm is what makes the test able to
//      fail: asserting only "children are gone" would pass on node:sqlite's
//      default even if the app enabled nothing.
jest.mock('expo-sqlite', () => {
  const { DatabaseSync } = require('node:sqlite');
  const sqlite = new DatabaseSync(':memory:');
  const execSyncCalls: string[] = [];

  // Start OFF, exactly as the shipping driver does on both platforms.
  sqlite.exec('PRAGMA foreign_keys = OFF');

  const isRowReturning = (sql: string) =>
    /^\s*(select|pragma|with)\b/i.test(sql) || /\breturning\b/i.test(sql);

  const client = {
    execSync: (sql: string) => {
      execSyncCalls.push(sql);
      sqlite.exec(sql);
    },
    prepareSync(sql: string) {
      const statement = sqlite.prepare(sql);
      return {
        executeSync(params: unknown[] = []) {
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
          statement.setReturnArrays(true);
          const rows = statement.all(...params);
          return { getAllSync: () => rows, getFirstSync: () => rows[0] };
        },
      };
    },
  };

  return {
    __esModule: true,
    openDatabaseSync: () => client,
    __sqlite: sqlite,
    __execSyncCalls: execSyncCalls,
  };
});

import * as queries from '../../../lib/db/queries';
import { setCurrentUserId } from '../../../lib/db/user-scope';

const sqlite: any = require('expo-sqlite').__sqlite;
const execSyncCalls: string[] = require('expo-sqlite').__execSyncCalls;

const OWNER = 'user-a';

function foreignKeysEnabled(): number {
  return sqlite.prepare('PRAGMA foreign_keys').get().foreign_keys;
}

function countSetsOf(sessionExerciseId: number): number {
  return sqlite
    .prepare('SELECT COUNT(*) AS c FROM sets WHERE session_exercise_id = ?')
    .get(sessionExerciseId).c;
}

function sessionExerciseExists(id: number): boolean {
  return (
    sqlite.prepare('SELECT COUNT(*) AS c FROM session_exercises WHERE id = ?').get(id).c > 0
  );
}

describe('PRAGMA foreign_keys = ON on the app connection (U2)', () => {
  beforeAll(() => {
    sqlite.exec(CREATE_TABLES_SQL);
  });

  beforeEach(() => {
    sqlite.exec(
      'DELETE FROM sets; DELETE FROM session_exercises; DELETE FROM sessions;' +
        'DELETE FROM exercises; DELETE FROM categories;'
    );
    sqlite.exec(
      "INSERT INTO categories (id, name, color, icon, created_at) VALUES (1, 'Strength', '#fff', 'x', 0);"
    );
    sqlite.exec("INSERT INTO exercises (id, name, created_at) VALUES (1, 'Bench press', 0);");
    sqlite
      .prepare('INSERT INTO sessions (id, user_id, started_at) VALUES (?, ?, ?)')
      .run(1, OWNER, 0);
    sqlite
      .prepare(
        'INSERT INTO session_exercises (id, session_id, exercise_id, "order") VALUES (?, ?, ?, ?)'
      )
      .run(1, 1, 1, 0);
    sqlite
      .prepare(
        'INSERT INTO session_exercises (id, session_id, exercise_id, "order") VALUES (?, ?, ?, ?)'
      )
      .run(2, 1, 1, 1);
    sqlite.exec(
      'INSERT INTO sets (id, session_exercise_id, set_number, reps, weight, completed, created_at)' +
        ' VALUES (1, 1, 1, 8, 100, 0, 0), (2, 2, 1, 8, 100, 0, 0);'
    );
    setCurrentUserId(OWNER);
  });

  // Runs first on purpose: it reads the connection state the module import left
  // behind, before the behaviour test mutates the pragma for its OFF arm.
  it('the app itself issues the pragma at module scope, and its connection enforces it', () => {
    // Boundary: the real `lib/db/index` module was imported (through
    // `lib/db/queries`) and its own `execSync` call recorded the pragma.
    expect(execSyncCalls).toContain('PRAGMA foreign_keys = ON');

    // Consequence: the connection that started OFF (as expo-sqlite leaves it)
    // is now enforcing. Nothing else in this test file ran before the import.
    expect(foreignKeysEnabled()).toBe(1);
  });

  it('the sets → session_exercises CASCADE removes child rows only with the pragma ON', async () => {
    // OFF: the shipped defect reproduced. The parent row is really deleted, but
    // the declared CASCADE is inert and its sets survive as orphans.
    sqlite.exec('PRAGMA foreign_keys = OFF');
    await queries.deleteSessionExercise(1);
    expect(sessionExerciseExists(1)).toBe(false); // the delete ran
    expect(countSetsOf(1)).toBe(1); // ...and the cascade did not fire

    // ON: the same query, against the same data shape, now removes the
    // children through the declaration itself.
    sqlite.exec('PRAGMA foreign_keys = ON');
    await queries.deleteSessionExercise(2);
    expect(sessionExerciseExists(2)).toBe(false);
    expect(countSetsOf(2)).toBe(0);
  });
});
