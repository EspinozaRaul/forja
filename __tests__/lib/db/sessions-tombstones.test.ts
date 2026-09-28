/* eslint-disable @typescript-eslint/no-explicit-any */
import { CREATE_TABLES_SQL } from '../../../lib/db/ddl';

// U2d — `deleteSession` stops hard-deleting. It removes THREE layers in one
// transaction, and the FK cascades are inert (SQLite defaults `foreign_keys`
// OFF), so with the cascade unavailable it must tombstone EACH layer explicitly:
// `sets`, then `session_exercises`, then `sessions`, children before parent.
//
// THE TRAP THIS SUITE PINS: `sessionOwnedByCurrentUser` refuses a tombstoned
// session (`sessions.deleted_at IS NULL`). Tombstoning the session first would
// make the two child updates match nothing and leave orphaned live children, so
// the order children-before-parent is part of the contract, not an accident.
//
// PRODUCTION FIDELITY: only the native `expo-sqlite` boundary is faked over a
// real `node:sqlite` database, so the real `drizzle-orm/expo-sqlite` driver and
// the real `lib/db` layer run unmodified. The fake exposes the raw database as
// `__sqlite` so the assertions read the tombstone directly, not through the
// guard the soft delete is supposed to trip.
jest.mock('expo-crypto', () => {
  let counter = 0;
  return {
    randomUUID: () => {
      counter += 1;
      return `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
    },
  };
});

jest.mock('expo-sqlite', () => {
  const { DatabaseSync } = require('node:sqlite');
  const sqlite = new DatabaseSync(':memory:');
  const hooks: { onStatement: ((sql: string) => void) | null } = { onStatement: null };

  const isRowReturning = (sql: string) =>
    /^\s*(select|pragma|with)\b/i.test(sql) || /\breturning\b/i.test(sql);

  const client = {
    execSync: (sql: string) => {
      hooks.onStatement?.(sql);
      sqlite.exec(sql);
    },
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
    openDatabaseSync: () => client,
    __sqlite: sqlite,
    __hooks: hooks,
  };
});

import * as queries from '../../../lib/db/queries';
import { setCurrentUserId } from '../../../lib/db/user-scope';

const mockedSqlite = require('expo-sqlite') as {
  __sqlite: any;
  __hooks: { onStatement: ((sql: string) => void) | null };
};

const sqlite: any = mockedSqlite.__sqlite;

const OWNER = 'user-a';
const OTHER = 'user-b';
const EXERCISE_ID = 1;

/** The owner's session under test, and the two child layers it owns. */
const SESSION = 1;
const SESSION_EXERCISE = 11;
const SET = 101;
/** Another account's session, used only for the untouched probe. */
const OTHER_SESSION = 2;
const OTHER_SESSION_EXERCISE = 21;
const OTHER_SET = 201;

/** A stale timestamp so a real `now()` bump is unambiguous. */
const STALE = 1;

type Table = 'sets' | 'session_exercises' | 'sessions';

/** Allowlisted full statements per table, so no identifier is ever interpolated. */
const RAW_ROW_SQL: Record<Table, string> = {
  sets: 'SELECT deleted_at, updated_at FROM sets WHERE id = ?',
  session_exercises: 'SELECT deleted_at, updated_at FROM session_exercises WHERE id = ?',
  sessions: 'SELECT deleted_at, updated_at FROM sessions WHERE id = ?',
};

/** Raw row read, straight from SQLite — never through a guarded query. */
function rawRow(
  table: Table,
  id: number
): { deleted_at: number | null; updated_at: number | null } | undefined {
  return sqlite.prepare(RAW_ROW_SQL[table]).get(id) as
    | { deleted_at: number | null; updated_at: number | null }
    | undefined;
}

function seedFixture(): void {
  sqlite.exec(
    "INSERT INTO categories (id, name, color, icon, created_at) VALUES (1, 'Strength', '#fff', 'x', 0);"
  );
  sqlite.exec("INSERT INTO exercises (id, name, created_at) VALUES (1, 'Bench press', 0);");
  sqlite.exec(
    'INSERT INTO sessions (id, user_id, started_at, completed_at, updated_at, deleted_at) VALUES' +
      ` (${SESSION}, '${OWNER}', 3000, 4000, ${STALE}, NULL),` +
      ` (${OTHER_SESSION}, '${OTHER}', 3000, 4000, ${STALE}, NULL);`
  );
  sqlite.exec(
    'INSERT INTO session_exercises (id, session_id, exercise_id, "order", created_at, updated_at,' +
      ' deleted_at) VALUES' +
      ` (${SESSION_EXERCISE}, ${SESSION}, ${EXERCISE_ID}, 0, ${STALE}, ${STALE}, NULL),` +
      ` (${OTHER_SESSION_EXERCISE}, ${OTHER_SESSION}, ${EXERCISE_ID}, 0, ${STALE}, ${STALE}, NULL);`
  );
  sqlite.exec(
    'INSERT INTO sets (id, session_exercise_id, set_number, reps, weight, completed, created_at,' +
      ' updated_at, deleted_at) VALUES' +
      ` (${SET}, ${SESSION_EXERCISE}, 1, 8, 100, 0, ${STALE}, ${STALE}, NULL),` +
      ` (${OTHER_SET}, ${OTHER_SESSION_EXERCISE}, 1, 8, 100, 0, ${STALE}, ${STALE}, NULL);`
  );
}

/** Make the named UPDATE throw, so the earlier child tombstones are at risk. */
function injectFailureOnUpdate(table: Table): void {
  const pattern = new RegExp('^\\s*update\\s+["`]?' + table + '["`]?\\s+set\\b', 'i');
  mockedSqlite.__hooks.onStatement = (sql: string) => {
    if (pattern.test(sql.trim())) {
      throw new Error(`injected ${table} update failure`);
    }
  };
}

describe('deleteSession tombstones all three layers instead of hard-deleting (U2d)', () => {
  beforeAll(() => {
    sqlite.exec(CREATE_TABLES_SQL);
  });

  beforeEach(() => {
    mockedSqlite.__hooks.onStatement = null;
    sqlite.exec(
      'DELETE FROM sets; DELETE FROM session_exercises; DELETE FROM sessions;' +
        'DELETE FROM exercises; DELETE FROM categories;'
    );
    seedFixture();
    setCurrentUserId(OWNER);
  });

  afterEach(() => {
    mockedSqlite.__hooks.onStatement = null;
  });

  it('tombstones sets, session_exercises and sessions, keeping every raw row', async () => {
    // Precondition: all three layers start live.
    for (const [table, id] of [
      ['sets', SET],
      ['session_exercises', SESSION_EXERCISE],
      ['sessions', SESSION],
    ] as const) {
      expect(rawRow(table, id)?.deleted_at).toBeNull();
    }

    await queries.deleteSession(SESSION);

    // Every row still exists in its table, with a tombstone and a bumped
    // `updated_at`. These are the assertions that fail while the deletes are hard.
    for (const [table, id] of [
      ['sets', SET],
      ['session_exercises', SESSION_EXERCISE],
      ['sessions', SESSION],
    ] as const) {
      const row = rawRow(table, id);
      expect(row).toBeDefined();
      expect(row?.deleted_at).not.toBeNull();
      expect(row?.updated_at).not.toBe(STALE);
    }
  });

  it('hides the tombstoned session and its children from the guarded readers', async () => {
    await queries.deleteSession(SESSION);

    expect((await queries.getAllSessions()).map((s) => s.id)).not.toContain(SESSION);
    expect(await queries.getSessionExercises(SESSION)).toEqual([]);
    expect(await queries.getSetsForSessionExercise(SESSION_EXERCISE)).toEqual([]);
  });

  it('leaves another account’s session and its children untouched', async () => {
    await queries.deleteSession(SESSION);

    for (const [table, id] of [
      ['sets', OTHER_SET],
      ['session_exercises', OTHER_SESSION_EXERCISE],
      ['sessions', OTHER_SESSION],
    ] as const) {
      expect(rawRow(table, id)).toEqual({ deleted_at: null, updated_at: STALE });
    }
  });

  it('rolls back all three tombstones when the sessions update throws', async () => {
    injectFailureOnUpdate('sessions');

    await expect(queries.deleteSession(SESSION)).rejects.toThrow(
      'injected sessions update failure'
    );

    // The sets and session_exercises tombstones already ran; without a
    // transaction they would be permanent. Every layer must come back live.
    for (const [table, id] of [
      ['sets', SET],
      ['session_exercises', SESSION_EXERCISE],
      ['sessions', SESSION],
    ] as const) {
      expect(rawRow(table, id)).toEqual({ deleted_at: null, updated_at: STALE });
    }
  });
});
