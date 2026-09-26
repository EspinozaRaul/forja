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

// Contract-pinning for the referential integrity that enabling the pragma
// bought. This block changes no production code: with enforcement on, the
// invariant lives in exactly one place — the database — and the writers
// (`createRoutine`, `updateRoutine`) pass `categoryId` / `folderId` straight
// through. A JavaScript pre-check in those writers would duplicate the
// invariant somewhere nothing forces anyone to maintain, so the contract is
// pinned here instead.
//
// Every rejection asserts the cause is a foreign-key error, not merely that
// something threw. Each ON arm is paired with the pragma OFF for the same
// operation in the negative-control cases at the bottom: without that arm a
// green suite could not distinguish enforcement from a vacuous assertion.
//
// `updateRoutine` with `folderId: null` stays green on purpose — unlinking is
// legitimate, and the contract must state its own boundary.
describe('Referential integrity contract: the database enforces it (pragma ON)', () => {
  const OWNER_ID = OWNER;
  const LIVE_FOLDER_ID = 10;
  const LIVE_ROUTINE_ID = 20;
  const MISSING_ID = 9999;

  function row(sql: string, ...params: unknown[]): any {
    return sqlite.prepare(sql).get(...params);
  }

  function categoryExists(id: number): boolean {
    return row('SELECT COUNT(*) AS c FROM categories WHERE id = ?', id).c > 0;
  }

  function folderExists(id: number): boolean {
    return row('SELECT COUNT(*) AS c FROM routine_folders WHERE id = ?', id).c > 0;
  }

  function routineExists(id: number): boolean {
    return row('SELECT COUNT(*) AS c FROM routines WHERE id = ?', id).c > 0;
  }

  function routineCountNamed(name: string): number {
    return row('SELECT COUNT(*) AS c FROM routines WHERE name = ?', name).c;
  }

  function routineFolderId(id: number): number | null {
    const stored = row('SELECT folder_id FROM routines WHERE id = ?', id);
    return stored === undefined ? null : stored.folder_id;
  }

  function seedLiveRoutine(): void {
    sqlite
      .prepare(
        'INSERT INTO routines (id, user_id, name, folder_id, created_at) VALUES (?, ?, ?, ?, ?)'
      )
      .run(LIVE_ROUTINE_ID, OWNER_ID, 'Push day', LIVE_FOLDER_ID, 0);
  }

  beforeAll(() => {
    sqlite.exec(CREATE_TABLES_SQL);
  });

  beforeEach(() => {
    // Children before parents, so the ON arm's own cleanup obeys the FK it pins.
    sqlite.exec('DELETE FROM routines; DELETE FROM routine_folders; DELETE FROM categories;');
    sqlite.exec(
      "INSERT INTO categories (id, name, color, icon, created_at) VALUES (1, 'Strength', '#fff', 'x', 0);"
    );
    sqlite
      .prepare(
        'INSERT INTO routine_folders (id, user_id, name, created_at) VALUES (?, ?, ?, ?)'
      )
      .run(LIVE_FOLDER_ID, OWNER_ID, 'Push', 0);
    setCurrentUserId(OWNER_ID);
    sqlite.exec('PRAGMA foreign_keys = ON');
  });

  // Case 1 — createRoutine with a nonexistent folderId.
  it('createRoutine rejects a nonexistent folderId and stores nothing', async () => {
    expect(foreignKeysEnabled()).toBe(1);

    await expect(
      queries.createRoutine({ name: 'Dead folder routine', folderId: MISSING_ID })
    ).rejects.toThrow(/foreign key/i);

    // Nothing was stored: a rejected write cannot leave a partial row.
    expect(routineCountNamed('Dead folder routine')).toBe(0);
  });

  // Case 2 — updateRoutine with a nonexistent folderId.
  it('updateRoutine rejects a nonexistent folderId and leaves the stored folder unchanged', async () => {
    seedLiveRoutine();
    expect(routineFolderId(LIVE_ROUTINE_ID)).toBe(LIVE_FOLDER_ID);

    await expect(
      queries.updateRoutine(LIVE_ROUTINE_ID, { folderId: MISSING_ID })
    ).rejects.toThrow(/foreign key/i);

    // The rejection did not damage the row: its live link is intact.
    expect(routineFolderId(LIVE_ROUTINE_ID)).toBe(LIVE_FOLDER_ID);
  });

  // Case 3 — createRoutine with a nonexistent categoryId.
  it('createRoutine rejects a nonexistent categoryId and stores nothing', async () => {
    expect(categoryExists(MISSING_ID)).toBe(false);

    await expect(
      queries.createRoutine({ name: 'Dead category routine', categoryId: MISSING_ID })
    ).rejects.toThrow(/foreign key/i);

    expect(routineCountNamed('Dead category routine')).toBe(0);
  });

  // Case 4 — the boundary: unlinking is legitimate and must stay possible.
  it('updateRoutine with folderId: null still succeeds and unlinks', async () => {
    seedLiveRoutine();

    await expect(queries.updateRoutine(LIVE_ROUTINE_ID, { folderId: null })).resolves.toBeDefined();

    expect(routineFolderId(LIVE_ROUTINE_ID)).toBeNull();
  });

  // Case 5 — the user-visible consequence: deleting a folder unlinks, not dangles.
  it('deleteFolder unlinks its routines instead of leaving a dangling id', async () => {
    seedLiveRoutine();

    await queries.deleteFolder(LIVE_FOLDER_ID);

    // The folder is gone, the routine survives, and the FK's ON DELETE SET NULL
    // fired on the shipping path — so the UI copy that promises "routines are
    // only unlinked from this folder" now tells the truth.
    expect(folderExists(LIVE_FOLDER_ID)).toBe(false);
    expect(routineExists(LIVE_ROUTINE_ID)).toBe(true);
    expect(routineFolderId(LIVE_ROUTINE_ID)).toBeNull();
  });

  // Case 6a — negative control for case 1: OFF, the invalid write is ACCEPTED
  // and stores a dead reference. This is what makes case 1 able to fail.
  it('[negative control] with the pragma OFF, createRoutine accepts an invalid folderId as a dead reference', async () => {
    sqlite.exec('PRAGMA foreign_keys = OFF');
    expect(foreignKeysEnabled()).toBe(0);

    await expect(
      queries.createRoutine({ name: 'Dead folder routine', folderId: MISSING_ID })
    ).resolves.toBeDefined();

    expect(routineCountNamed('Dead folder routine')).toBe(1);
    const stored = sqlite
      .prepare('SELECT folder_id FROM routines WHERE name = ?')
      .get('Dead folder routine') as { folder_id: number };
    expect(stored.folder_id).toBe(MISSING_ID);
    expect(folderExists(MISSING_ID)).toBe(false); // the reference is dead
  });

  // Case 6b — negative control for case 5: OFF, deleteFolder leaves folder_id
  // pointing at a row that no longer exists.
  it('[negative control] with the pragma OFF, deleteFolder leaves folder_id pointing at a deleted row', async () => {
    seedLiveRoutine();
    sqlite.exec('PRAGMA foreign_keys = OFF');
    expect(foreignKeysEnabled()).toBe(0);

    await queries.deleteFolder(LIVE_FOLDER_ID);

    expect(folderExists(LIVE_FOLDER_ID)).toBe(false);
    expect(routineExists(LIVE_ROUTINE_ID)).toBe(true);
    expect(routineFolderId(LIVE_ROUTINE_ID)).toBe(LIVE_FOLDER_ID); // dangling
  });
});
