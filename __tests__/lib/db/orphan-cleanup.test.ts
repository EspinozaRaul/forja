/* eslint-disable @typescript-eslint/no-explicit-any */
import { CREATE_TABLES_SQL } from '../../../lib/db/ddl';

// U1: `initializeDatabase` must clean up the unambiguous orphan rows that the
// inert `ON DELETE CASCADE` / `SET NULL` declarations left behind on installed
// databases, *before* the early return that every such database takes.
//
// Only the native module boundary is faked: `expo-sqlite`'s `openDatabaseSync`
// returns a `node:sqlite`-backed client implementing the sync API the shipping
// `drizzle-orm/expo-sqlite` session calls. `lib/db/index` is the real module, so
// the cleanup under test is the statement that ships, not a copy of it.
jest.mock('expo-sqlite', () => {
  const { DatabaseSync } = require('node:sqlite');
  const sqlite = new DatabaseSync(':memory:');
  const isRowReturning = (sql: string) =>
    /^\s*(select|pragma|with)\b/i.test(sql) || /\breturning\b/i.test(sql);

  const client: any = {
    // `__onExecSync` is a test-only hook. It lets a case make one specific
    // statement throw, at the native boundary, without rewriting the cleanup
    // SQL the production module ships.
    execSync: (sql: string) => {
      if (client.__onExecSync) client.__onExecSync(sql);
      sqlite.exec(sql);
    },
    // `initializeDatabase` reads `PRAGMA user_version` through this method.
    getFirstSync: (sql: string, ...params: unknown[]) =>
      sqlite.prepare(sql).get(...params) ?? null,
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

  return { __esModule: true, openDatabaseSync: () => client, __sqlite: sqlite, __client: client };
});

import { initializeDatabase } from '../../../lib/db/index';

const sqlite: any = require('expo-sqlite').__sqlite;
const client: any = require('expo-sqlite').__client;

// The one-time migration version `initializeDatabase` records in
// `PRAGMA user_version`. It must match `ORPHAN_CLEANUP_VERSION` in
// `lib/db/index.ts`; it is duplicated here so the test asserts the number the
// device will read, not a value the module hands back.
const ORPHAN_CLEANUP_VERSION = 1;

const ORPHAN_QUERIES = {
  // A set whose parent session_exercise no longer exists.
  orphanSets:
    'SELECT COUNT(*) AS c FROM sets WHERE session_exercise_id NOT IN (SELECT id FROM session_exercises)',
  // A routine_exercise whose parent routine no longer exists.
  orphanRoutineExercises:
    'SELECT COUNT(*) AS c FROM routine_exercises WHERE routine_id NOT IN (SELECT id FROM routines)',
  // A routine still pointing at a deleted folder.
  danglingRoutineFolders:
    'SELECT COUNT(*) AS c FROM routines WHERE folder_id IS NOT NULL AND folder_id NOT IN (SELECT id FROM routine_folders)',
  // A session still pointing at a deleted routine.
  danglingSessionRoutines:
    'SELECT COUNT(*) AS c FROM sessions WHERE routine_id IS NOT NULL AND routine_id NOT IN (SELECT id FROM routines)',
} as const;

const NO_ORPHANS = {
  orphanSets: 0,
  orphanRoutineExercises: 0,
  danglingRoutineFolders: 0,
  danglingSessionRoutines: 0,
};

function count(sql: string): number {
  return sqlite.prepare(sql).get().c;
}

function currentUserVersion(): number {
  return sqlite.prepare('PRAGMA user_version').get().user_version;
}

function orphanCounts() {
  return {
    orphanSets: count(ORPHAN_QUERIES.orphanSets),
    orphanRoutineExercises: count(ORPHAN_QUERIES.orphanRoutineExercises),
    danglingRoutineFolders: count(ORPHAN_QUERIES.danglingRoutineFolders),
    danglingSessionRoutines: count(ORPHAN_QUERIES.danglingSessionRoutines),
  };
}

const ID_QUERIES = {
  sets: 'SELECT id FROM sets ORDER BY id',
  routineExercises: 'SELECT id FROM routine_exercises ORDER BY id',
} as const;

function ids(table: keyof typeof ID_QUERIES): number[] {
  return sqlite
    .prepare(ID_QUERIES[table])
    .all()
    .map((row: { id: number }) => row.id);
}

function seedOrphansAndLiveData(): void {
  // PRODUCTION FIDELITY: `node:sqlite` defaults `PRAGMA foreign_keys` to 1,
  // while production expo-sqlite 57.0.2 leaves it at 0 (the defect U2 fixes).
  // Without forcing it OFF, deleting the parents below would cascade / SET NULL
  // and leave no orphans, making every assertion in this file vacuously true.
  sqlite.exec('PRAGMA foreign_keys = OFF');

  sqlite.exec(
    "INSERT INTO categories (id, name, color, icon, created_at) VALUES (1, 'Strength', '#fff', 'x', 0);"
  );
  // An exercise exists, so `initializeDatabase` takes its early-return branch —
  // precisely the branch a real installed database with orphans takes. The
  // cleanup must run before that return. `original_id` stays NULL so the
  // metadata repair ignores this row.
  sqlite.exec("INSERT INTO exercises (id, name, created_at) VALUES (1, 'Bench press', 0);");

  // --- the four orphan kinds, created with foreign keys OFF ---
  sqlite.exec(
    'INSERT INTO sets (id, session_exercise_id, set_number, reps, weight, completed, created_at)' +
      ' VALUES (900, 900, 1, 8, 100, 0, 0);'
  );
  sqlite.exec(
    'INSERT INTO routine_exercises (id, routine_id, exercise_id, "order") VALUES (901, 901, 1, 0);'
  );
  sqlite.exec(
    "INSERT INTO routine_folders (id, name, created_at) VALUES (902, 'Ghost folder', 0);"
  );
  sqlite.exec(
    'INSERT INTO routines (id, name, folder_id, created_at)' +
      " VALUES (902, 'Routine in ghost folder', 902, 0);"
  );
  sqlite.exec('DELETE FROM routine_folders WHERE id = 902;');
  sqlite.exec("INSERT INTO routines (id, name, created_at) VALUES (903, 'Deleted routine', 0);");
  sqlite.exec('INSERT INTO sessions (id, routine_id, started_at) VALUES (903, 903, 0);');
  sqlite.exec('DELETE FROM routines WHERE id = 903;');

  // --- valid rows that must survive untouched ---
  sqlite.exec("INSERT INTO routine_folders (id, name, created_at) VALUES (1, 'Push folder', 0);");
  sqlite.exec("INSERT INTO routines (id, name, created_at) VALUES (1, 'Push Day', 0);");
  // A live routine with a live folder_id: the cleanup must not clear it.
  sqlite.exec(
    "INSERT INTO routines (id, name, folder_id, created_at) VALUES (2, 'Pull Day', 1, 0);"
  );
  sqlite.exec('INSERT INTO sessions (id, routine_id, started_at) VALUES (1, 1, 0);');
  sqlite.exec(
    'INSERT INTO session_exercises (id, session_id, exercise_id, "order") VALUES (1, 1, 1, 0);'
  );
  sqlite.exec(
    'INSERT INTO sets (id, session_exercise_id, set_number, reps, weight, completed, created_at)' +
      ' VALUES (1, 1, 1, 8, 100, 0, 0);'
  );
  sqlite.exec(
    'INSERT INTO routine_exercises (id, routine_id, exercise_id, "order") VALUES (1, 1, 1, 0);'
  );
}

/**
 * Seeds one fresh orphan of each kind, with foreign keys forced OFF, for the
 * gate cases: these rows appear *after* the cleanup version has been recorded,
 * so a gated cleanup must leave them alone.
 */
function seedNewOrphans(): void {
  sqlite.exec('PRAGMA foreign_keys = OFF');

  sqlite.exec(
    'INSERT INTO sets (id, session_exercise_id, set_number, reps, weight, completed, created_at)' +
      ' VALUES (910, 910, 1, 8, 100, 0, 0);'
  );
  sqlite.exec(
    'INSERT INTO routine_exercises (id, routine_id, exercise_id, "order") VALUES (911, 911, 1, 0);'
  );
  sqlite.exec(
    "INSERT INTO routine_folders (id, name, created_at) VALUES (912, 'Late ghost folder', 0);"
  );
  sqlite.exec(
    'INSERT INTO routines (id, name, folder_id, created_at)' +
      " VALUES (912, 'Late routine in ghost folder', 912, 0);"
  );
  sqlite.exec('DELETE FROM routine_folders WHERE id = 912;');
  sqlite.exec("INSERT INTO routines (id, name, created_at) VALUES (913, 'Late deleted routine', 0);");
  sqlite.exec('INSERT INTO sessions (id, routine_id, started_at) VALUES (913, 913, 0);');
  sqlite.exec('DELETE FROM routines WHERE id = 913;');
}

const ONE_ORPHAN_OF_EACH_KIND = {
  orphanSets: 1,
  orphanRoutineExercises: 1,
  danglingRoutineFolders: 1,
  danglingSessionRoutines: 1,
};

describe('initializeDatabase one-time orphan cleanup (U1)', () => {
  beforeAll(() => {
    sqlite.exec(CREATE_TABLES_SQL);
  });

  beforeEach(() => {
    sqlite.exec('PRAGMA foreign_keys = OFF');
    // Required now that the cleanup is gated by `PRAGMA user_version`: the
    // version lives on the connection, which this harness reuses across cases.
    // Without resetting it, the cleanup version stamped by an earlier case
    // would survive into the next one and silently skip its cleanup.
    sqlite.exec('PRAGMA user_version = 0');
    delete client.__onExecSync;
    sqlite.exec(
      'DELETE FROM sets; DELETE FROM session_exercises; DELETE FROM routine_exercises;' +
        'DELETE FROM sessions; DELETE FROM routines; DELETE FROM routine_folders;' +
        'DELETE FROM exercises; DELETE FROM categories;'
    );
    seedOrphansAndLiveData();
  });

  it('removes all four orphan kinds while leaving valid rows intact', async () => {
    // Precondition: all four orphan kinds really exist before the cleanup runs.
    expect(orphanCounts()).toEqual({
      orphanSets: 1,
      orphanRoutineExercises: 1,
      danglingRoutineFolders: 1,
      danglingSessionRoutines: 1,
    });

    await initializeDatabase();

    // Zero orphans of each kind remain.
    expect(orphanCounts()).toEqual(NO_ORPHANS);

    // Deletes remove only the unrenderable rows; the valid ones stay.
    expect(ids('sets')).toEqual([1]);
    expect(ids('routineExercises')).toEqual([1]);

    // SET NULL columns are unlinked, not deleted, matching the FK intent.
    expect(
      sqlite.prepare('SELECT folder_id FROM routines WHERE id = 902').get().folder_id
    ).toBeNull();
    expect(
      sqlite.prepare('SELECT routine_id FROM sessions WHERE id = 903').get().routine_id
    ).toBeNull();
    // A live folder_id is left alone: proves the UPDATE is not a blanket clear.
    expect(sqlite.prepare('SELECT folder_id FROM routines WHERE id = 2').get().folder_id).toBe(1);

    // The live session, its exercise and its sets survive with the same data.
    const liveSession = sqlite.prepare('SELECT routine_id FROM sessions WHERE id = 1').get();
    const liveSessionExercise = sqlite
      .prepare('SELECT session_id, exercise_id FROM session_exercises WHERE id = 1')
      .get();
    const liveSet = sqlite
      .prepare('SELECT session_exercise_id, set_number, reps, weight, completed FROM sets WHERE id = 1')
      .get();

    expect(liveSession.routine_id).toBe(1);
    expect(liveSessionExercise.session_id).toBe(1);
    expect(liveSessionExercise.exercise_id).toBe(1);
    expect(liveSet.session_exercise_id).toBe(1);
    expect(liveSet.set_number).toBe(1);
    expect(liveSet.reps).toBe(8);
    expect(liveSet.weight).toBe(100);
    expect(liveSet.completed).toBe(0);

    // Counts after cleanup: the two unlinked parents survive, children removed.
    expect(count('SELECT COUNT(*) AS c FROM sessions')).toBe(2);
    expect(count('SELECT COUNT(*) AS c FROM session_exercises')).toBe(1);
    expect(count('SELECT COUNT(*) AS c FROM sets')).toBe(1);
    expect(count('SELECT COUNT(*) AS c FROM routines')).toBe(3);
    expect(count('SELECT COUNT(*) AS c FROM routine_exercises')).toBe(1);
  });

  it('is idempotent: a second run deletes or changes zero rows', async () => {
    await initializeDatabase();

    const snapshot = () => ({
      sets: sqlite.prepare('SELECT * FROM sets ORDER BY id').all(),
      routineExercises: sqlite.prepare('SELECT * FROM routine_exercises ORDER BY id').all(),
      routines: sqlite.prepare('SELECT * FROM routines ORDER BY id').all(),
      sessions: sqlite.prepare('SELECT * FROM sessions ORDER BY id').all(),
    });

    const before = snapshot();

    await expect(initializeDatabase()).resolves.toBeUndefined();

    expect(snapshot()).toEqual(before);
    expect(orphanCounts()).toEqual(NO_ORPHANS);
  });

  // U8 -------------------------------------------------------------------

  it('stamps the cleanup version once the cleanup has succeeded', async () => {
    expect(currentUserVersion()).toBe(0);

    await initializeDatabase();

    expect(currentUserVersion()).toBe(ORPHAN_CLEANUP_VERSION);
  });

  it('skips the cleanup once the database is already at the cleanup version', async () => {
    // First run records the migration for this database.
    await initializeDatabase();

    // Orphans that appear afterwards must survive the next cold start: the
    // cleanup is one-time data migration, not a startup scan. Against the
    // ungated code this second run removes them, which is what this case pins.
    seedNewOrphans();
    expect(orphanCounts()).toEqual(ONE_ORPHAN_OF_EACH_KIND);

    await initializeDatabase();

    expect(orphanCounts()).toEqual(ONE_ORPHAN_OF_EACH_KIND);
    expect(currentUserVersion()).toBe(ORPHAN_CLEANUP_VERSION);
  });

  it('treats a failing cleanup as non-fatal and retries it on the next run', async () => {
    // Fail exactly at the native boundary of the cleanup statement, as an
    // absent `routines.folder_id` would: the statement never reaches SQLite.
    client.__onExecSync = (sql: string) => {
      if (sql.includes('DELETE FROM sets')) throw new Error('simulated cleanup failure');
    };

    // Non-fatal: the app must still start, because those rows are invisible to
    // every read, so it is usable without the cleanup.
    await expect(initializeDatabase()).resolves.toBeUndefined();

    // Nothing was removed, and the version was NOT stamped, so the next launch
    // retries instead of skipping the migration forever.
    expect(currentUserVersion()).toBe(0);
    expect(orphanCounts()).toEqual(ONE_ORPHAN_OF_EACH_KIND);

    delete client.__onExecSync;
    await initializeDatabase();

    expect(orphanCounts()).toEqual(NO_ORPHANS);
    expect(currentUserVersion()).toBe(ORPHAN_CLEANUP_VERSION);
  });
});
