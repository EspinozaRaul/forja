/* eslint-disable @typescript-eslint/no-explicit-any */
import { CREATE_TABLES_SQL } from '../../../lib/db/ddl';

// U2e — every read in `lib/db/queries.ts` that touches `routines`,
// `routine_folders` or `routine_exercises` must exclude a tombstoned row
// (`deleted_at` set). While every `deleted_at` is still NULL this is a provable
// no-op; the guard only becomes observable by setting the column directly, which
// is exactly what U2d's soft delete will do.
//
// THE TRAP THIS SUITE PINS: `lib/db/user-scope.ts` resolves a child's ownership
// through the PARENT (`routine_exercises` -> live `routines`), and it already
// refuses a tombstoned routine there. But that guard never hides a tombstoned
// `routine_exercises` row under a LIVE routine, nor a live row under a
// tombstoned one — the row's OWN tombstone needs its own guard. This suite seeds
// both directions.
//
// FIXTURE. Folder 1 is live, folder 2 is tombstoned. Routine 10 is live in
// folder 1; routine 20 is tombstoned in the same folder, so an unguarded read or
// count returns resurrects it. `routine_exercises` carries 101 (live, under the
// live routine), 102 (tombstoned, under the live routine — the direct-read
// twin) and 103 (live, under the tombstoned routine).
//
// Exercises 1 and 2 isolate the `deleteExercise` reference count: exercise 1 is
// referenced by every live `routine_exercises` row, exercise 2 only by the
// tombstoned 102. The count for exercise 2 must clear once the tombstone is
// excluded, so the "Cannot delete: ..." refusal must not fire for it.
//
// PRODUCTION FIDELITY: only the native `expo-sqlite` boundary is faked over a
// real `node:sqlite` database, so the real `drizzle-orm/expo-sqlite` driver and
// the real `lib/db` layer run unmodified and these are SQL-level assertions.
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

import * as queries from '../../../lib/db/queries';
import { setCurrentUserId } from '../../../lib/db/user-scope';

const sqlite: any = require('expo-sqlite').__sqlite;

const OWNER = 'user-a';
const TOMBSTONE = 1_800_000_000;

const LIVE_FOLDER = 1;
const TOMB_FOLDER = 2;

const LIVE_ROUTINE = 10;
const TOMB_ROUTINE = 20;

/** Referenced by live `routine_exercises` rows. */
const LIVE_REF_EXERCISE = 1;
/** Referenced only by the tombstoned `routine_exercises` row. */
const TOMB_REF_EXERCISE = 2;

const LIVE_RE = 101;
const TOMB_RE = 102;
const LIVE_RE_UNDER_TOMB_ROUTINE = 103;

function seedFixture(): void {
  sqlite.exec(
    "INSERT INTO categories (id, name, color, icon, created_at) VALUES (1, 'Strength', '#fff', 'x', 0);"
  );
  sqlite.exec(
    'INSERT INTO exercises (id, user_id, name, created_at) VALUES' +
      ` (${LIVE_REF_EXERCISE}, '${OWNER}', 'Bench press', 0),` +
      ` (${TOMB_REF_EXERCISE}, '${OWNER}', 'Squat', 0);`
  );

  sqlite.exec(
    'INSERT INTO routine_folders (id, user_id, name, created_at) VALUES' +
      ` (${LIVE_FOLDER}, '${OWNER}', 'Push', 0),` +
      ` (${TOMB_FOLDER}, '${OWNER}', 'Legacy', 0);`
  );
  sqlite
    .prepare('UPDATE routine_folders SET deleted_at = ? WHERE id = ?')
    .run(TOMBSTONE, TOMB_FOLDER);

  sqlite.exec(
    'INSERT INTO routines (id, user_id, name, folder_id, created_at) VALUES' +
      ` (${LIVE_ROUTINE}, '${OWNER}', 'Push A', ${LIVE_FOLDER}, 0),` +
      ` (${TOMB_ROUTINE}, '${OWNER}', 'Push old', ${LIVE_FOLDER}, 0);`
  );
  sqlite.prepare('UPDATE routines SET deleted_at = ? WHERE id = ?').run(TOMBSTONE, TOMB_ROUTINE);

  sqlite.exec(
    'INSERT INTO routine_exercises (id, routine_id, exercise_id, "order", created_at) VALUES' +
      ` (${LIVE_RE}, ${LIVE_ROUTINE}, ${LIVE_REF_EXERCISE}, 0, 0),` +
      // A tombstoned slot under a LIVE routine: the direct-read trap.
      ` (${TOMB_RE}, ${LIVE_ROUTINE}, ${TOMB_REF_EXERCISE}, 1, 0),` +
      // A live slot under a TOMBSTONED routine: the parent-resolved trap.
      ` (${LIVE_RE_UNDER_TOMB_ROUTINE}, ${TOMB_ROUTINE}, ${LIVE_REF_EXERCISE}, 0, 0);`
  );
  sqlite.prepare('UPDATE routine_exercises SET deleted_at = ? WHERE id = ?').run(TOMBSTONE, TOMB_RE);
}

/** Runs `deleteExercise` and returns either its error message or 'deleted'. */
async function deleteOutcome(id: number): Promise<string> {
  try {
    await queries.deleteExercise(id);
    return 'deleted';
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

describe('routines / folder / routine_exercises read guards exclude tombstones (U2e)', () => {
  beforeAll(() => {
    sqlite.exec(CREATE_TABLES_SQL);
  });

  beforeEach(() => {
    // Children first so the FK-enforcing connection (`PRAGMA foreign_keys = ON`,
    // issued by `lib/db/index` at import) can delete parents.
    sqlite.exec(
      'DELETE FROM sets; DELETE FROM session_exercises; DELETE FROM sessions;' +
        'DELETE FROM routine_exercises; DELETE FROM routines; DELETE FROM routine_folders;' +
        'DELETE FROM body_measurements; DELETE FROM progress_photos;' +
        'DELETE FROM exercises; DELETE FROM categories;'
    );
    seedFixture();
    setCurrentUserId(OWNER);
  });

  // ─── Direct reads of routines ───────────────────────

  it('getAllRoutines drops the tombstoned twin', async () => {
    const ids = (await queries.getAllRoutines()).map((r) => r.id);
    expect(ids).toEqual([LIVE_ROUTINE]);
  });

  it('getRoutineById drops the tombstoned twin but returns the live one', async () => {
    expect((await queries.getRoutineById(TOMB_ROUTINE)).map((r) => r.id)).toEqual([]);
    expect((await queries.getRoutineById(LIVE_ROUTINE)).map((r) => r.id)).toEqual([LIVE_ROUTINE]);
  });

  it('getRoutinesByFolder drops the tombstoned twin in the folder', async () => {
    const ids = (await queries.getRoutinesByFolder(LIVE_FOLDER)).map((r) => r.id);
    expect(ids).toEqual([LIVE_ROUTINE]);
  });

  it('getFolderRoutineCount counts only live routines in the folder', async () => {
    expect(await queries.getFolderRoutineCount(LIVE_FOLDER)).toBe(1);
  });

  // ─── Direct reads of routine_folders ────────────────

  it('getAllFolders drops the tombstoned twin', async () => {
    const ids = (await queries.getAllFolders()).map((f) => f.id);
    expect(ids).toEqual([LIVE_FOLDER]);
  });

  it('getFolderById drops the tombstoned twin but returns the live one', async () => {
    expect((await queries.getFolderById(TOMB_FOLDER)).map((f) => f.id)).toEqual([]);
    expect((await queries.getFolderById(LIVE_FOLDER)).map((f) => f.id)).toEqual([LIVE_FOLDER]);
  });

  // ─── Direct reads of routine_exercises ──────────────

  it('getRoutineExercises drops the tombstoned slot under a live routine', async () => {
    const ids = (await queries.getRoutineExercises(LIVE_ROUTINE)).map((re) => re.id);
    expect(ids).toEqual([LIVE_RE]);
  });

  it('getRoutineExercises returns nothing for a tombstoned routine', async () => {
    expect(await queries.getRoutineExercises(TOMB_ROUTINE)).toEqual([]);
  });

  // ─── Ownership assert (parent resolved through a read) ─

  it('assertRoutineOwned refuses a tombstoned routine but accepts the live one', async () => {
    await expect(
      queries.addExerciseToRoutine({
        routineId: TOMB_ROUTINE,
        exerciseId: LIVE_REF_EXERCISE,
        order: 0,
      })
    ).rejects.toThrow('Routine does not belong to the current user');

    await expect(
      queries.addExerciseToRoutine({
        routineId: LIVE_ROUTINE,
        exerciseId: LIVE_REF_EXERCISE,
        order: 5,
      })
    ).resolves.toBeDefined();
  });

  // ─── deleteExercise reference count ─────────────────

  it('deleteExercise ignores a tombstoned routine_exercises reference', async () => {
    // The only row referencing `TOMB_REF_EXERCISE` is tombstoned, so the
    // reference-count refusal must no longer fire. Under today's hard FK
    // (`ON DELETE RESTRICT`) the physical DELETE still fails — U2d converts
    // deletes to soft deletes — so the observable proof is the absence of the
    // custom "Cannot delete" guard.
    expect(await deleteOutcome(TOMB_REF_EXERCISE)).not.toMatch(/Cannot delete/);
  });

  it('deleteExercise still refuses a live routine_exercises reference', async () => {
    // Both live rows (101 under the live routine, 103 under the tombstoned one)
    // count: only the ROW's own tombstone hides it, never the parent's.
    expect(await deleteOutcome(LIVE_REF_EXERCISE)).toMatch(
      /Cannot delete: exercise is used in 2 routines/
    );
  });

  it('deleteExercise ignores a tombstoned session_exercises reference but still counts a live one', async () => {
    sqlite.exec("INSERT INTO sessions (id, user_id, started_at) VALUES (1, 'user-a', 0);");
    sqlite.exec(
      'INSERT INTO session_exercises (id, session_id, exercise_id, "order", created_at)' +
        ` VALUES (201, 1, ${TOMB_REF_EXERCISE}, 0, 0);`
    );
    sqlite.prepare('UPDATE session_exercises SET deleted_at = ? WHERE id = ?').run(TOMBSTONE, 201);

    // Arm 1: the only session reference is tombstoned, so the count guard must
    // not fire. Under today's hard `ON DELETE RESTRICT` the physical DELETE still
    // fails on that tombstoned FK (U2d converts deletes to soft deletes), so the
    // proof is the ABSENCE of the custom "Cannot delete" refusal, not a delete.
    expect(await deleteOutcome(TOMB_REF_EXERCISE)).not.toMatch(/Cannot delete/);

    // Arm 2: a live session reference must still refuse, so the guard is not
    // over-broad.
    sqlite.exec(
      'INSERT INTO session_exercises (id, session_id, exercise_id, "order", created_at)' +
        ` VALUES (202, 1, ${TOMB_REF_EXERCISE}, 1, 0);`
    );
    expect(await deleteOutcome(TOMB_REF_EXERCISE)).toMatch(
      /Cannot delete: exercise is used in 0 routines and 1 sessions/
    );
  });
});
