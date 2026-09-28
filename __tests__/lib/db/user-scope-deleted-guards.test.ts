/* eslint-disable @typescript-eslint/no-explicit-any */
import { CREATE_TABLES_SQL } from '../../../lib/db/ddl';

// U2e — the `user-scope.ts` EXISTS guards must treat a tombstoned parent as gone.
//
// A soft delete (`deleted_at` set) with no guard resurrects the row into every
// read: the delete-family writes (`U2d`) land after this, so the guards must
// already exclude tombstones. The `EXISTS` fragments are the highest-leverage
// fix, because a tombstoned session or routine otherwise keeps authorizing its
// live children (`session_exercises`, `routine_exercises`, `sets`) forever.
//
// The harness mirrors `foreign-keys.test.ts` / `sets-identity.test.ts`: only the
// native `expo-sqlite` boundary is faked over a real `node:sqlite` database, so
// the real `lib/db/index` module runs unmodified. `expo-crypto` is a native
// module too, so `uuid()` is backed by a deterministic generator (nothing here
// reads the value; the write paths are U2c).
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

  const isRowReturning = (sql: string) =>
    /^\s*(select|pragma|with)\b/i.test(sql) || /\breturning\b/i.test(sql);

  const client = {
    execSync: (sql: string) => {
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
  };
});

import { db } from '../../../lib/db/index';
import * as queries from '../../../lib/db/queries';
import { routineExercises, sessionExercises, sets } from '../../../lib/db/schema';
import {
  routineOwnedByCurrentUser,
  sessionExerciseOwnedByCurrentUser,
  sessionOwnedByCurrentUser,
  setCurrentUserId,
} from '../../../lib/db/user-scope';

const sqlite: any = require('expo-sqlite').__sqlite;

const OWNER = 'user-a';
const TOMBSTONE = 1_800_000_000;

/** Sets `deleted_at` on one row directly, the way U2d's soft delete will. */
function tombstone(sql: string, id: number): void {
  sqlite.prepare(sql).run(TOMBSTONE, id);
}

const TOMBSTONE_ROUTINE = 'UPDATE routines SET deleted_at = ? WHERE id = ?';
const TOMBSTONE_SESSION = 'UPDATE sessions SET deleted_at = ? WHERE id = ?';
const TOMBSTONE_SESSION_EXERCISE = 'UPDATE session_exercises SET deleted_at = ? WHERE id = ?';

// Composed reads that use the guard exactly as the shipping queries do: the
// guard runs against a foreign key column of a DIFFERENT table, so the EXISTS
// subquery resolves the parent row and not an alias of itself.
const ownedRoutineExercises = () =>
  db
    .select()
    .from(routineExercises)
    .where(routineOwnedByCurrentUser(routineExercises.routineId));

const ownedSessionExercises = () =>
  db
    .select()
    .from(sessionExercises)
    .where(sessionOwnedByCurrentUser(sessionExercises.sessionId));

const ownedSets = () =>
  db.select().from(sets).where(sessionExerciseOwnedByCurrentUser(sets.sessionExerciseId));

describe('user-scope EXISTS guards exclude tombstoned rows (U2e)', () => {
  beforeAll(() => {
    sqlite.exec(CREATE_TABLES_SQL);
  });

  beforeEach(() => {
    // Children first so the FK-enforcing connection (PRAGMA foreign_keys = ON,
    // issued by `lib/db/index` at import) can delete parents.
    sqlite.exec(
      'DELETE FROM sets; DELETE FROM session_exercises; DELETE FROM sessions;' +
        'DELETE FROM routine_exercises; DELETE FROM routines;' +
        'DELETE FROM exercises; DELETE FROM categories;'
    );
    sqlite.exec(
      "INSERT INTO categories (id, name, color, icon, created_at) VALUES (1, 'Strength', '#fff', 'x', 0);"
    );
    sqlite.exec("INSERT INTO exercises (id, name, created_at) VALUES (1, 'Bench press', 0);");
    sqlite.exec("INSERT INTO routines (id, user_id, name, created_at) VALUES (1, 'user-a', 'Push', 0);");
    sqlite.exec(
      'INSERT INTO routine_exercises (id, routine_id, exercise_id, "order", created_at)' +
        ' VALUES (1, 1, 1, 0, 0);'
    );
    sqlite.exec("INSERT INTO sessions (id, user_id, started_at) VALUES (1, 'user-a', 0);");
    sqlite.exec(
      'INSERT INTO session_exercises (id, session_id, exercise_id, "order", created_at)' +
        ' VALUES (1, 1, 1, 0, 0);'
    );
    sqlite.exec(
      'INSERT INTO sets (id, session_exercise_id, set_number, completed, created_at)' +
        ' VALUES (1, 1, 1, 0, 0);'
    );
    setCurrentUserId(OWNER);
  });

  it('1. a tombstoned routine stops authorizing its routine_exercises', async () => {
    expect(await ownedRoutineExercises()).toHaveLength(1);
    expect(await queries.getRoutineExercises(1)).toHaveLength(1);

    tombstone(TOMBSTONE_ROUTINE, 1);

    expect(await ownedRoutineExercises()).toHaveLength(0);
    expect(await queries.getRoutineExercises(1)).toHaveLength(0);
  });

  it('2. a tombstoned session stops authorizing its session_exercises', async () => {
    expect(await ownedSessionExercises()).toHaveLength(1);
    expect(await queries.getSessionExercises(1)).toHaveLength(1);

    tombstone(TOMBSTONE_SESSION, 1);

    expect(await ownedSessionExercises()).toHaveLength(0);
    expect(await queries.getSessionExercises(1)).toHaveLength(0);
  });

  it('3. tombstoning the session de-authorizes its session_exercise and its sets', async () => {
    expect(await ownedSets()).toHaveLength(1);
    expect(await queries.getSetsForSessionExercise(1)).toHaveLength(1);

    tombstone(TOMBSTONE_SESSION, 1);

    expect(await ownedSets()).toHaveLength(0);
    expect(await queries.getSetsForSessionExercise(1)).toHaveLength(0);
  });

  it("4. a tombstoned session_exercise is refused by its OWN deleted_at, with a live session", async () => {
    expect(await ownedSets()).toHaveLength(1);

    tombstone(TOMBSTONE_SESSION_EXERCISE, 1);

    // The session it hangs from is still live, so the session guard alone would
    // still return the row...
    expect(await queries.getSessionExercises(1)).toHaveLength(1);
    // ...and the child guard is what excludes it.
    expect(await ownedSets()).toHaveLength(0);
    expect(await queries.getSetsForSessionExercise(1)).toHaveLength(0);
  });
});
