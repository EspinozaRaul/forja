/* eslint-disable @typescript-eslint/no-explicit-any */
import { CREATE_TABLES_SQL } from '../../../lib/db/ddl';

// U2f: account deletion must be atomic on the driver that actually ships.
//
// `deleteUserLocalData` erases nine tables. It used to run nine sequential
// `await db.delete(...)` with no transaction, so a failure partway through left a
// half-erased account: the surviving rows belong to a `user_id` whose account no
// longer exists — invisible locally and invisible to RLS. Every other multi-write in
// `lib/db/queries.ts` already runs in one synchronous `db.transaction` callback.
//
// This file drives `drizzle-orm/expo-sqlite` — the session that ships — over a fake
// expo-sqlite client backed by `node:sqlite`, the same harness as
// `delete-session-atomicity.test.ts` and `sync-transaction-atomicity.test.ts`. Only the
// native module boundary is fake; the transaction semantics under test — including the
// commit-before-`await` trap — are the driver's real ones. It proves the SQL state after
// a failure, not on-device atomicity.
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
const OTHER = 'user-b';

const OWNER_PHOTO_URIS = ['file:///a-1.jpg', 'file:///a-2.jpg'];

let sqlite: any;

/**
 * Rows of `userId` in each of the nine tables `deleteUserLocalData` erases. Child
 * tables are counted through their owning parent, so a surviving row cannot hide
 * behind a deleted parent. Literal SQL only — no identifier is interpolated.
 */
const OWNED_ROW_COUNT_SQL: Array<{ table: string; sql: string }> = [
  {
    table: 'sets',
    sql:
      'SELECT COUNT(*) AS c FROM sets WHERE session_exercise_id IN (' +
      'SELECT id FROM session_exercises WHERE session_id IN (' +
      'SELECT id FROM sessions WHERE user_id = ?))',
  },
  {
    table: 'session_exercises',
    sql:
      'SELECT COUNT(*) AS c FROM session_exercises WHERE session_id IN (' +
      'SELECT id FROM sessions WHERE user_id = ?)',
  },
  { table: 'sessions', sql: 'SELECT COUNT(*) AS c FROM sessions WHERE user_id = ?' },
  {
    table: 'routine_exercises',
    sql:
      'SELECT COUNT(*) AS c FROM routine_exercises WHERE routine_id IN (' +
      'SELECT id FROM routines WHERE user_id = ?)',
  },
  { table: 'routines', sql: 'SELECT COUNT(*) AS c FROM routines WHERE user_id = ?' },
  { table: 'routine_folders', sql: 'SELECT COUNT(*) AS c FROM routine_folders WHERE user_id = ?' },
  { table: 'body_measurements', sql: 'SELECT COUNT(*) AS c FROM body_measurements WHERE user_id = ?' },
  { table: 'progress_photos', sql: 'SELECT COUNT(*) AS c FROM progress_photos WHERE user_id = ?' },
  { table: 'exercises', sql: 'SELECT COUNT(*) AS c FROM exercises WHERE user_id = ?' },
];

function ownedCounts(userId: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const { table, sql } of OWNED_ROW_COUNT_SQL) {
    counts[table] = sqlite.prepare(sql).get(userId).c;
  }
  return counts;
}

/** Every owned table A populates, so a successful delete has something to remove. */
const EXPECTED_OWNED_ROWS: Record<string, number> = {
  sets: 1,
  session_exercises: 1,
  sessions: 1,
  routine_exercises: 1,
  routines: 1,
  routine_folders: 1,
  body_measurements: 1,
  progress_photos: 2,
  exercises: 1,
};

/** Account B has the same shape except it owns a single progress photo. */
const OTHER_EXPECTED_OWNED_ROWS: Record<string, number> = {
  ...EXPECTED_OWNED_ROWS,
  progress_photos: 1,
};

/** Make the Nth `delete from <table>` statement throw. */
function injectFailureOnDelete(table: string, occurrence = 1): void {
  let seen = 0;
  const pattern = new RegExp('^\\s*delete\\s+from\\s+["`]?' + table + '["`]?\\b', 'i');
  mockedIndex.__hooks.onStatement = (sql: string) => {
    if (!pattern.test(sql.trim())) return;
    seen += 1;
    if (seen === occurrence) {
      throw new Error(`injected ${table} delete failure #${occurrence}`);
    }
  };
}

/** Parameterized single-statement insert — no identifier or value is interpolated. */
function insert(sql: string, params: unknown[]): void {
  sqlite.prepare(sql).run(...params);
}

/** One owned row per account for every table, plus a shared seed exercise. */
function seedTwoAccounts(): void {
  insert('INSERT INTO exercises (id, user_id, name, created_at) VALUES (?, ?, ?, ?)', [
    1,
    null,
    'Bench press',
    0,
  ]);
  insert('INSERT INTO exercises (id, user_id, name, created_at) VALUES (?, ?, ?, ?)', [
    2,
    OWNER,
    'A custom',
    0,
  ]);
  insert('INSERT INTO exercises (id, user_id, name, created_at) VALUES (?, ?, ?, ?)', [
    3,
    OTHER,
    'B custom',
    0,
  ]);

  insert('INSERT INTO routine_folders (id, user_id, name, created_at) VALUES (?, ?, ?, ?)', [
    1,
    OWNER,
    'A folder',
    0,
  ]);
  insert('INSERT INTO routine_folders (id, user_id, name, created_at) VALUES (?, ?, ?, ?)', [
    2,
    OTHER,
    'B folder',
    0,
  ]);

  insert('INSERT INTO routines (id, user_id, name, folder_id, created_at) VALUES (?, ?, ?, ?, ?)', [
    1,
    OWNER,
    'A routine',
    1,
    0,
  ]);
  insert('INSERT INTO routines (id, user_id, name, folder_id, created_at) VALUES (?, ?, ?, ?, ?)', [
    2,
    OTHER,
    'B routine',
    2,
    0,
  ]);

  insert(
    'INSERT INTO routine_exercises (id, routine_id, exercise_id, "order", created_at, uuid) VALUES (?, ?, ?, ?, ?, ?)',
    [1, 1, 2, 0, 0, 'a-re-1']
  );
  insert(
    'INSERT INTO routine_exercises (id, routine_id, exercise_id, "order", created_at, uuid) VALUES (?, ?, ?, ?, ?, ?)',
    [2, 2, 3, 0, 0, 'b-re-1']
  );

  insert('INSERT INTO sessions (id, user_id, routine_id, started_at, uuid) VALUES (?, ?, ?, ?, ?)', [
    1,
    OWNER,
    1,
    0,
    'a-s-1',
  ]);
  insert('INSERT INTO sessions (id, user_id, routine_id, started_at, uuid) VALUES (?, ?, ?, ?, ?)', [
    2,
    OTHER,
    2,
    0,
    'b-s-1',
  ]);

  insert(
    'INSERT INTO session_exercises (id, session_id, exercise_id, "order", created_at, uuid) VALUES (?, ?, ?, ?, ?, ?)',
    [1, 1, 2, 0, 0, 'a-se-1']
  );
  insert(
    'INSERT INTO session_exercises (id, session_id, exercise_id, "order", created_at, uuid) VALUES (?, ?, ?, ?, ?, ?)',
    [2, 2, 3, 0, 0, 'b-se-1']
  );

  insert(
    'INSERT INTO sets (id, session_exercise_id, set_number, reps, weight, completed, created_at, uuid) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [1, 1, 1, 10, 50, 1, 0, 'a-set-1']
  );
  insert(
    'INSERT INTO sets (id, session_exercise_id, set_number, reps, weight, completed, created_at, uuid) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [2, 2, 1, 10, 50, 1, 0, 'b-set-1']
  );

  insert(
    'INSERT INTO body_measurements (id, user_id, date, weight, created_at, uuid) VALUES (?, ?, ?, ?, ?, ?)',
    [1, OWNER, 0, 80, 0, 'a-bm-1']
  );
  insert(
    'INSERT INTO body_measurements (id, user_id, date, weight, created_at, uuid) VALUES (?, ?, ?, ?, ?, ?)',
    [2, OTHER, 0, 80, 0, 'b-bm-1']
  );

  insert(
    'INSERT INTO progress_photos (id, user_id, date, uri, created_at, uuid) VALUES (?, ?, ?, ?, ?, ?)',
    [1, OWNER, 0, OWNER_PHOTO_URIS[0], 0, 'a-ph-1']
  );
  insert(
    'INSERT INTO progress_photos (id, user_id, date, uri, created_at, uuid) VALUES (?, ?, ?, ?, ?, ?)',
    [2, OWNER, 0, OWNER_PHOTO_URIS[1], 0, 'a-ph-2']
  );
  insert(
    'INSERT INTO progress_photos (id, user_id, date, uri, created_at, uuid) VALUES (?, ?, ?, ?, ?, ?)',
    [3, OTHER, 0, 'file:///b-1.jpg', 0, 'b-ph-1']
  );
}

describe('deleteUserLocalData atomicity (expo-sqlite driver)', () => {
  beforeAll(() => {
    sqlite = mockedIndex.__sqlite;
    sqlite.exec(CREATE_TABLES_SQL);
  });

  beforeEach(() => {
    mockedIndex.__hooks.onStatement = null;
    sqlite.exec(
      'DELETE FROM sets; DELETE FROM session_exercises; DELETE FROM sessions;' +
        'DELETE FROM routine_exercises; DELETE FROM routines; DELETE FROM routine_folders;' +
        'DELETE FROM body_measurements; DELETE FROM progress_photos; DELETE FROM exercises;'
    );
    seedTwoAccounts();
  });

  afterEach(() => {
    mockedIndex.__hooks.onStatement = null;
  });

  it('erases every owned row of the account, keeps the shared library and other accounts, and returns the photo URIs', async () => {
    // Guard the fixture first, so a green happy path cannot come from an empty seed.
    expect(ownedCounts(OWNER)).toEqual(EXPECTED_OWNED_ROWS);

    const uris = await queries.deleteUserLocalData(OWNER);

    const after = ownedCounts(OWNER);
    for (const { table } of OWNED_ROW_COUNT_SQL) {
      expect({ table, count: after[table] }).toEqual({ table, count: 0 });
    }

    // The shared seed library (user_id IS NULL) survives.
    expect(sqlite.prepare('SELECT COUNT(*) AS c FROM exercises WHERE user_id IS NULL').get().c).toBe(1);

    // Account B is untouched on every table.
    const otherAfter = ownedCounts(OTHER);
    for (const { table } of OWNED_ROW_COUNT_SQL) {
      expect({ table, count: otherAfter[table] }).toEqual({
        table,
        count: OTHER_EXPECTED_OWNED_ROWS[table],
      });
    }

    expect([...uris].sort()).toEqual([...OWNER_PHOTO_URIS].sort());
  });

  it('returns the photo URIs even though their rows are gone', async () => {
    const uris = await queries.deleteUserLocalData(OWNER);

    expect(sqlite.prepare('SELECT COUNT(*) AS c FROM progress_photos WHERE user_id = ?').get(OWNER).c).toBe(0);
    expect([...uris].sort()).toEqual([...OWNER_PHOTO_URIS].sort());
  });

  // DISCRIMINATING ASSERTION. Without the transaction the first eight deletes commit
  // before the ninth throws, so A's sets/sessions/routines/measurements/photos are
  // already gone. Only one transaction keeps all nine inside the rolled-back unit.
  it('rolls back every delete when a late delete fails', async () => {
    const before = ownedCounts(OWNER);
    expect(before).toEqual(EXPECTED_OWNED_ROWS);

    // `exercises` is the last of the nine. It is the "late" failure the defect fears:
    // everything erased before it must be rolled back too.
    injectFailureOnDelete('exercises');

    await expect(queries.deleteUserLocalData(OWNER)).rejects.toThrow(
      'injected exercises delete failure #1'
    );

    const after = ownedCounts(OWNER);
    expect(after).toEqual(before);
  });
});
