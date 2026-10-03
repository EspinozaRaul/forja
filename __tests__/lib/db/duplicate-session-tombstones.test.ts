/* eslint-disable @typescript-eslint/no-explicit-any */
import { CREATE_TABLES_SQL } from '../../../lib/db/ddl';

// `duplicateSessionData` copies the previous session's slots and sets into a new one —
// that is what "Continuar última" does. It read both sources WITHOUT the tombstone
// guard while every other read of those tables in `lib/db/queries.ts` carries it, so a
// deleted set came back in the next session. Reported by the owner on 2026-10-03:
// "cuando elimino esa serie y termino la sesión no se hace el cambio para la siguiente".
//
// It is driven through `drizzle-orm/expo-sqlite` — the session that ships — over a fake
// expo-sqlite client backed by `node:sqlite`, the same harness as
// `delete-session-atomicity.test.ts`, because the function's callback must stay
// synchronous and drizzle's sqlite-proxy would make the reads async.
jest.mock('expo-sqlite', () => ({
  openDatabaseSync: () => ({ execSync: jest.fn() }),
}));

jest.mock('../../../lib/db/index', () => {
  const { DatabaseSync } = require('node:sqlite');
  const { drizzle } = require('drizzle-orm/expo-sqlite');

  const sqlite = new DatabaseSync(':memory:');

  const isRowReturning = (sql: string) =>
    /^\s*(select|pragma|with)\b/i.test(sql) || /\breturning\b/i.test(sql);

  const client = {
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
    db: drizzle(client as any),
    __sqlite: sqlite,
    initializeDatabase: jest.fn(),
  };
});

import * as queries from '../../../lib/db/queries';
import { setCurrentUserId } from '../../../lib/db/user-scope';

const SOURCE = 1;
const TARGET = 2;
const OWNER = 'user-a';

let sqlite: any;

/** Sets copied into the target session, read straight from SQLite. Keyed by exercise
 *  because set numbers restart per exercise — ordering by set_number alone interleaves
 *  the two slots and makes the assertion ambiguous. */
function copiedSets(): string[] {
  const rows = sqlite
    .prepare(
      'SELECT se.exercise_id AS exercise_id, s.set_number AS set_number' +
        ' FROM sets s JOIN session_exercises se ON se.id = s.session_exercise_id' +
        ' WHERE se.session_id = ? ORDER BY se.exercise_id, s.set_number'
    )
    .all(TARGET) as { exercise_id: number; set_number: number }[];
  return rows.map((r) => `${r.exercise_id}:${r.set_number}`);
}

function copiedSlots(): number {
  return sqlite
    .prepare('SELECT COUNT(*) AS c FROM session_exercises WHERE session_id = ?')
    .get(TARGET).c;
}

describe('duplicateSessionData does not resurrect tombstoned rows', () => {
  beforeAll(() => {
    sqlite = require('../../../lib/db/index').__sqlite;
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
    sqlite.exec("INSERT INTO exercises (id, name, created_at) VALUES (2, 'Row', 0);");

    const session = sqlite.prepare(
      'INSERT INTO sessions (id, user_id, started_at) VALUES (?, ?, ?)'
    );
    session.run(SOURCE, OWNER, 0);
    session.run(TARGET, OWNER, 0);

    sqlite.exec(
      'INSERT INTO session_exercises (id, session_id, exercise_id, "order") VALUES' +
        ' (1, 1, 1, 0), (2, 1, 2, 1);'
    );
    sqlite.exec(
      'INSERT INTO sets (id, session_exercise_id, set_number, reps, weight, completed, created_at)' +
        ' VALUES (1, 1, 1, 8, 100, 0, 0), (2, 1, 2, 8, 100, 0, 0),' +
        '        (3, 1, 3, 8, 100, 0, 0), (4, 2, 1, 10, 50, 0, 0);'
    );
    setCurrentUserId(OWNER);
  });

  it('copies every set when nothing was deleted', async () => {
    await queries.duplicateSessionData(SOURCE, TARGET);

    expect(copiedSets()).toEqual(['1:1', '1:2', '1:3', '2:1']);
    // A copy is a new row: nothing rediscovered may arrive already tombstoned.
    expect(
      sqlite.prepare('SELECT COUNT(*) AS c FROM sets WHERE deleted_at IS NOT NULL').get().c
    ).toBe(0);
  });

  it('does not copy a set the user deleted', async () => {
    // The tombstone `deleteSet` writes.
    sqlite.exec('UPDATE sets SET deleted_at = 123, updated_at = 123 WHERE id = 2');

    await queries.duplicateSessionData(SOURCE, TARGET);

    // Set 2 of the first exercise is gone; the rest survive.
    expect(copiedSets()).toEqual(['1:1', '1:3', '2:1']);
  });

  it('does not copy a slot whose exercise the user removed', async () => {
    sqlite.exec('UPDATE session_exercises SET deleted_at = 123, updated_at = 123 WHERE id = 2');

    await queries.duplicateSessionData(SOURCE, TARGET);

    expect(copiedSlots()).toBe(1);
    expect(copiedSets()).toEqual(['1:1', '1:2', '1:3']);
  });
});
