/* eslint-disable @typescript-eslint/no-explicit-any */
import { and, eq } from 'drizzle-orm';
import { CREATE_TABLES_SQL } from '../../../lib/db/ddl';
import { sessionExercises } from '../../../lib/db/schema';
import {
  sessionExerciseOwnedByCurrentUser,
  sessionOwnedByCurrentUser,
  setCurrentUserId,
} from '../../../lib/db/user-scope';

// V2: deleting a super set must be atomic on the driver that actually ships.
//
// The same harness as `delete-session-atomicity.test.ts`: `drizzle-orm/expo-sqlite`
// over a fake expo-sqlite client backed by `node:sqlite`. Only the native module
// boundary is fake, so the transaction semantics under test — including the
// commit-before-`await` trap — are the driver's real ones. This proves the SQL
// state after a failure, not on-device atomicity.
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

const SESSION_ID = 1;
const OTHER_SESSION_ID = 2;
const OWNER = 'user-a';
const PAIR_ID = 555;

let sqlite: any;

const COUNT_SQL = 'SELECT COUNT(*) AS c FROM session_exercises';

function count(): number {
  return sqlite.prepare(COUNT_SQL).get().c;
}

function pairIdOf(id: number): number | null {
  const row = sqlite
    .prepare('SELECT superset_pair_id AS p FROM session_exercises WHERE id = ?')
    .get(id);
  return row ? row.p : null;
}

/** Make the Nth matching delete throw, so an earlier statement is at risk. */
function injectFailureOnDelete(table: string, occurrence: number): void {
  let seen = 0;
  const pattern = new RegExp('^delete\\s+from\\s+["`]?' + table + '["`]?', 'i');
  mockedIndex.__hooks.onStatement = (sql: string) => {
    if (!pattern.test(sql.trim())) return;
    seen += 1;
    if (seen === occurrence) {
      throw new Error(`injected ${table} delete failure #${occurrence}`);
    }
  };
}

function seedMember(id: number, order: number, pairId: number | null): void {
  sqlite
    .prepare(
      'INSERT INTO session_exercises (id, session_id, exercise_id, "order", superset_pair_id)' +
        ' VALUES (?, ?, ?, ?, ?)'
    )
    .run(id, SESSION_ID, 1, order, pairId);
}

describe('super set delete atomicity (expo-sqlite sync driver)', () => {
  beforeAll(() => {
    sqlite = mockedIndex.__sqlite;
    sqlite.exec(CREATE_TABLES_SQL);
  });

  beforeEach(() => {
    mockedIndex.__hooks.onStatement = null;
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
      .run(SESSION_ID, OWNER, 0);
    sqlite
      .prepare('INSERT INTO sessions (id, user_id, started_at) VALUES (?, ?, ?)')
      .run(OTHER_SESSION_ID, OWNER, 0);
    seedMember(1, 0, PAIR_ID);
    seedMember(2, 1, PAIR_ID);
    setCurrentUserId(OWNER);
  });

  afterEach(() => {
    mockedIndex.__hooks.onStatement = null;
  });

  describe('deleteSuperSetMembers', () => {
    it('deletes both members of the pair', async () => {
      await queries.deleteSuperSetMembers([1, 2], PAIR_ID);

      expect(count()).toBe(0);
    });

    it('rolls back the unlink and the first delete when the second delete throws', async () => {
      injectFailureOnDelete('session_exercises', 2);

      await expect(queries.deleteSuperSetMembers([1, 2], PAIR_ID)).rejects.toThrow(
        'injected session_exercises delete failure #2'
      );

      // The unlink ran first and member 1 was already deleted; both must come back,
      // including the pair ids the unlink cleared.
      expect(count()).toBe(2);
      expect(pairIdOf(1)).toBe(PAIR_ID);
      expect(pairIdOf(2)).toBe(PAIR_ID);
    });

    it('deletes both members even when no pair id is supplied (no unlink to run)', async () => {
      await queries.deleteSuperSetMembers([1, 2], null);

      expect(count()).toBe(0);
    });

    it('rolls back the unlink when the first delete throws', async () => {
      injectFailureOnDelete('session_exercises', 1);

      await expect(queries.deleteSuperSetMembers([1, 2], PAIR_ID)).rejects.toThrow(
        'injected session_exercises delete failure #1'
      );

      expect(count()).toBe(2);
      expect(pairIdOf(1)).toBe(PAIR_ID);
      expect(pairIdOf(2)).toBe(PAIR_ID);
    });

    it('leaves another account’s members and pairing untouched', async () => {
      sqlite
        .prepare('INSERT INTO sessions (id, user_id, started_at) VALUES (?, ?, ?)')
        .run(3, 'user-b', 0);
      sqlite
        .prepare(
          'INSERT INTO session_exercises (id, session_id, exercise_id, "order", superset_pair_id)' +
            ' VALUES (?, ?, ?, ?, ?)'
        )
        .run(9, 3, 1, 0, 777);

      await queries.deleteSuperSetMembers([9], 777);

      expect(count()).toBe(3);
      expect(pairIdOf(9)).toBe(777);
    });

    it('negative control: the pre-fix shape leaves a half-deleted, unpaired group behind', async () => {
      injectFailureOnDelete('session_exercises', 2);

      // TEST-ONLY replica of the pre-fix `handleDeleteSuperSet` SQL: an unlink plus
      // two sequential autocommit deletes with no transaction. Never production code.
      // It exists to show the rollback assertion above is discriminating.
      async function preFixReplica(): Promise<void> {
        await mockedIndex.db
          .update(sessionExercises)
          .set({ supersetPairId: null })
          .where(
            and(
              eq(sessionExercises.supersetPairId, PAIR_ID),
              sessionOwnedByCurrentUser(sessionExercises.sessionId)
            )
          );
        await mockedIndex.db
          .delete(sessionExercises)
          .where(
            and(eq(sessionExercises.id, 1), sessionExerciseOwnedByCurrentUser(sessionExercises.sessionId))
          );
        await mockedIndex.db
          .delete(sessionExercises)
          .where(
            and(eq(sessionExercises.id, 2), sessionExerciseOwnedByCurrentUser(sessionExercises.sessionId))
          );
      }

      await expect(preFixReplica()).rejects.toThrow('injected session_exercises delete failure #2');

      // No rollback: member 1 is gone and the survivor lost its pair id, so the
      // deleted half of the group is not coming back and the pairing is gone.
      expect(count()).toBe(1);
      expect(pairIdOf(2)).toBeNull();
    });
  });

  describe('deleteSessionExercise', () => {
    it('clears the surviving members pair id, so no dangling id is left', async () => {
      seedMember(3, 2, PAIR_ID);

      await queries.deleteSessionExercise(1);

      expect(count()).toBe(2);
      expect(pairIdOf(2)).toBeNull();
      expect(pairIdOf(3)).toBeNull();
    });

    it('leaves another account’s paired rows untouched', async () => {
      sqlite
        .prepare('INSERT INTO sessions (id, user_id, started_at) VALUES (?, ?, ?)')
        .run(3, 'user-b', 0);
      sqlite
        .prepare(
          'INSERT INTO session_exercises (id, session_id, exercise_id, "order", superset_pair_id)' +
            ' VALUES (?, ?, ?, ?, ?)'
        )
        .run(9, 3, 1, 0, 777);

      await queries.deleteSessionExercise(9);

      expect(count()).toBe(3);
      expect(pairIdOf(9)).toBe(777);
    });

    it('deletes an unpaired exercise without touching any other row', async () => {
      seedMember(3, 2, null);

      await queries.deleteSessionExercise(3);

      expect(count()).toBe(2);
      expect(pairIdOf(1)).toBe(PAIR_ID);
      expect(pairIdOf(2)).toBe(PAIR_ID);
    });

    it('negative control: the pre-fix single delete leaves the survivor holding the dangling pair id', async () => {
      // TEST-ONLY replica of the pre-fix `deleteSessionExercise` body: one autocommit
      // delete that never looks at the pair id. Never production code. It shows the
      // dangling one-member pair the cleaned-up function above must not leave.
      await mockedIndex.db
        .delete(sessionExercises)
        .where(
          and(eq(sessionExercises.id, 1), sessionExerciseOwnedByCurrentUser(sessionExercises.sessionId))
        );

      expect(count()).toBe(1);
      expect(pairIdOf(2)).toBe(PAIR_ID); // dangling: id with no partner
    });
  });
});
