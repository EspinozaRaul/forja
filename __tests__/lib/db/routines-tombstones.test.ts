/* eslint-disable @typescript-eslint/no-explicit-any */
import { CREATE_TABLES_SQL } from '../../../lib/db/ddl';

// U2d — the routines / routine_folders / routine_exercises delete family stops
// hard-deleting. A tombstone is a WRITE, not a delete: the row stays and gains
// `deleted_at`, so the U2e read guards make the soft delete observable instead of
// the row simply vanishing.
//
// THE TRAP THIS SUITE PINS — two declared FK actions go inert the moment the
// parent is tombstoned instead of deleted:
//
//   1. `routine_exercises.routine_id → routines ON DELETE CASCADE`. `deleteRoutine`
//      used to rely on it to remove the routine's exercises. A tombstone never
//      fires the cascade, so the children would stay LIVE (and would sync) while
//      the routine vanished from the UI. `deleteRoutine` must tombstone the
//      children explicitly, children-before-parent.
//   2. `routines.folder_id → routine_folders ON DELETE SET NULL`. `deleteFolder`
//      used to rely on it to unlink the folder's routines. A tombstone never fires
//      it, so the routines would keep a `folder_id` pointing at a tombstoned
//      folder. `deleteFolder` must unlink explicitly, inside one transaction.
//
// The order children-before-parent is load-bearing: `routineOwnedByCurrentUser`
// refuses a tombstoned routine, so tombstoning `routines` first would make the
// child update match nothing and leave live orphaned children.
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

/** The owner's folder, its routine and its two routine_exercises. */
const OWNER_FOLDER = 10;
const OWNER_ROUTINE = 100;
const OWNER_ROUTINE_2 = 101;
const OWNER_RE = 1000;
const OWNER_RE_2 = 1001;
const OWNER_RE_ROUTINE_2 = 1002;

/** Another account's folder, routine and routine_exercise. */
const OTHER_FOLDER = 20;
const OTHER_ROUTINE = 200;
const OTHER_RE = 2000;

/** A cross-account dangling link: another account's routine pointing at the
 *  owner's folder. Only the ownership `WHERE` on the unlink keeps it safe. */
const OTHER_ROUTINE_DANGLING = 201;
const OTHER_RE_DANGLING = 2001;

/** A stale timestamp so a real `now()` bump is unambiguous. */
const STALE = 1;

function rawFolder(
  id: number
): { deleted_at: number | null; updated_at: number | null } | undefined {
  return sqlite
    .prepare('SELECT deleted_at, updated_at FROM routine_folders WHERE id = ?')
    .get(id) as { deleted_at: number | null; updated_at: number | null } | undefined;
}

function rawRoutine(
  id: number
):
  | { folder_id: number | null; deleted_at: number | null; updated_at: number | null }
  | undefined {
  return sqlite
    .prepare('SELECT folder_id, deleted_at, updated_at FROM routines WHERE id = ?')
    .get(id) as
    | { folder_id: number | null; deleted_at: number | null; updated_at: number | null }
    | undefined;
}

function rawRoutineExercise(
  id: number
): { deleted_at: number | null; updated_at: number | null } | undefined {
  return sqlite
    .prepare('SELECT deleted_at, updated_at FROM routine_exercises WHERE id = ?')
    .get(id) as { deleted_at: number | null; updated_at: number | null } | undefined;
}

function seedFolder(id: number, userId: string, name: string): void {
  sqlite
    .prepare(
      'INSERT INTO routine_folders (id, user_id, name, created_at, updated_at, deleted_at)' +
        ' VALUES (?, ?, ?, ?, ?, NULL)'
    )
    .run(id, userId, name, STALE, STALE);
}

function seedRoutine(id: number, userId: string, name: string, folderId: number | null): void {
  sqlite
    .prepare(
      'INSERT INTO routines (id, user_id, name, folder_id, created_at, updated_at, deleted_at)' +
        ' VALUES (?, ?, ?, ?, ?, ?, NULL)'
    )
    .run(id, userId, name, folderId, STALE, STALE);
}

function seedRoutineExercise(id: number, routineId: number, order: number): void {
  sqlite
    .prepare(
      'INSERT INTO routine_exercises (id, routine_id, exercise_id, "order", created_at, updated_at,' +
        ' deleted_at) VALUES (?, ?, ?, ?, ?, ?, NULL)'
    )
    .run(id, routineId, EXERCISE_ID, order, STALE, STALE);
}

function seedFixture(): void {
  sqlite.exec(
    "INSERT INTO categories (id, name, color, icon, created_at) VALUES (1, 'Strength', '#fff', 'x', 0);"
  );
  sqlite.exec("INSERT INTO exercises (id, name, created_at) VALUES (1, 'Bench press', 0);");

  seedFolder(OWNER_FOLDER, OWNER, 'Push');
  seedFolder(OTHER_FOLDER, OTHER, 'Pull');

  seedRoutine(OWNER_ROUTINE, OWNER, 'Push day', OWNER_FOLDER);
  seedRoutine(OWNER_ROUTINE_2, OWNER, 'Push day B', OWNER_FOLDER);
  seedRoutine(OTHER_ROUTINE, OTHER, 'Pull day', OTHER_FOLDER);
  // Another account's routine pointing at the owner's folder: a corrupt link that
  // only the unlink's ownership `WHERE` must refuse to touch.
  seedRoutine(OTHER_ROUTINE_DANGLING, OTHER, 'Dangling', OWNER_FOLDER);

  seedRoutineExercise(OWNER_RE, OWNER_ROUTINE, 0);
  seedRoutineExercise(OWNER_RE_2, OWNER_ROUTINE, 1);
  seedRoutineExercise(OWNER_RE_ROUTINE_2, OWNER_ROUTINE_2, 0);
  seedRoutineExercise(OTHER_RE, OTHER_ROUTINE, 0);
  seedRoutineExercise(OTHER_RE_DANGLING, OTHER_ROUTINE_DANGLING, 0);
}

/** Make the named UPDATE throw, so the earlier writes are at risk. */
function injectFailureOnUpdate(table: string): void {
  const pattern = new RegExp('^\\s*update\\s+["`]?' + table + '["`]?\\s+set\\b', 'i');
  mockedSqlite.__hooks.onStatement = (sql: string) => {
    if (pattern.test(sql.trim())) {
      throw new Error(`injected ${table} update failure`);
    }
  };
}

describe('routines delete family tombstones instead of hard-deleting (U2d)', () => {
  beforeAll(() => {
    sqlite.exec(CREATE_TABLES_SQL);
  });

  beforeEach(() => {
    mockedSqlite.__hooks.onStatement = null;
    // Children before parents: foreign keys are enforced on this connection.
    sqlite.exec(
      'DELETE FROM sets; DELETE FROM session_exercises; DELETE FROM sessions;' +
        'DELETE FROM routine_exercises; DELETE FROM routines; DELETE FROM routine_folders;' +
        'DELETE FROM exercises; DELETE FROM categories;'
    );
    seedFixture();
    setCurrentUserId(OWNER);
  });

  afterEach(() => {
    mockedSqlite.__hooks.onStatement = null;
  });

  // ─── deleteRoutine: the inert CASCADE ───────────────

  describe('deleteRoutine', () => {
    it('tombstones the routine and every one of its routine_exercises (the inert CASCADE)', async () => {
      // Precondition: parent and both children start live.
      expect(rawRoutine(OWNER_ROUTINE)?.deleted_at).toBeNull();
      expect(rawRoutineExercise(OWNER_RE)?.deleted_at).toBeNull();
      expect(rawRoutineExercise(OWNER_RE_2)?.deleted_at).toBeNull();

      await queries.deleteRoutine(OWNER_ROUTINE);

      // A tombstone makes the FK `ON DELETE CASCADE` inert, so the children must
      // be tombstoned explicitly. These are the assertions that fail while the
      // delete is hard (the rows would be physically gone) and while the cascade
      // is assumed to do the work (the children would stay live).
      for (const id of [OWNER_RE, OWNER_RE_2]) {
        const child = rawRoutineExercise(id);
        expect(child).toBeDefined();
        expect(child?.deleted_at).not.toBeNull();
        expect(child?.updated_at).not.toBe(STALE);
      }

      const routine = rawRoutine(OWNER_ROUTINE);
      expect(routine).toBeDefined();
      expect(routine?.deleted_at).not.toBeNull();
      expect(routine?.updated_at).not.toBe(STALE);

      // The other routine's exercise is a sibling, not a child: untouched.
      expect(rawRoutineExercise(OWNER_RE_ROUTINE_2)).toEqual({
        deleted_at: null,
        updated_at: STALE,
      });
    });

    it('hides the tombstoned routine and its exercises from the guarded readers', async () => {
      await queries.deleteRoutine(OWNER_ROUTINE);

      expect((await queries.getAllRoutines()).map((r) => r.id)).not.toContain(OWNER_ROUTINE);
      expect(await queries.getRoutineExercises(OWNER_ROUTINE)).toEqual([]);

      // The sibling routine and its exercise stay visible.
      expect((await queries.getAllRoutines()).map((r) => r.id)).toContain(OWNER_ROUTINE_2);
      expect((await queries.getRoutineExercises(OWNER_ROUTINE_2)).map((re) => re.id)).toEqual([
        OWNER_RE_ROUTINE_2,
      ]);
    });

    it('rolls back the routine_exercises tombstones when the routines update throws', async () => {
      injectFailureOnUpdate('routines');

      await expect(queries.deleteRoutine(OWNER_ROUTINE)).rejects.toThrow(
        'injected routines update failure'
      );

      // The child tombstones already ran; without a transaction they would be
      // permanent. `deleted_at` — not a row count — is what proves the rollback,
      // since a tombstone is an UPDATE and leaves the row in place.
      for (const id of [OWNER_RE, OWNER_RE_2]) {
        expect(rawRoutineExercise(id)).toEqual({ deleted_at: null, updated_at: STALE });
      }
      expect(rawRoutine(OWNER_ROUTINE)).toEqual({
        folder_id: OWNER_FOLDER,
        deleted_at: null,
        updated_at: STALE,
      });
    });
  });

  // ─── deleteFolder: the inert SET NULL ───────────────

  describe('deleteFolder', () => {
    it('tombstones the folder and explicitly unlinks its routines, bumping their updated_at', async () => {
      expect(rawFolder(OWNER_FOLDER)?.deleted_at).toBeNull();

      await queries.deleteFolder(OWNER_FOLDER);

      // The folder survives as a tombstone.
      const folder = rawFolder(OWNER_FOLDER);
      expect(folder).toBeDefined();
      expect(folder?.deleted_at).not.toBeNull();
      expect(folder?.updated_at).not.toBe(STALE);

      // The FK `ON DELETE SET NULL` is inert under a tombstone, so the routines
      // must be unlinked explicitly. Both of the folder's routines survive, live,
      // with `folder_id = NULL` (never pointing at the tombstoned folder) and a
      // bumped `updated_at`.
      for (const id of [OWNER_ROUTINE, OWNER_ROUTINE_2]) {
        expect(rawRoutine(id)).toEqual({
          folder_id: null,
          deleted_at: null,
          updated_at: expect.any(Number),
        });
        expect(rawRoutine(id)?.updated_at).not.toBe(STALE);
      }

      // And the reader hides the tombstoned folder while the routines stay visible.
      expect((await queries.getAllFolders()).map((f) => f.id)).not.toContain(OWNER_FOLDER);
      const liveRoutines = (await queries.getAllRoutines()).map((r) => r.id);
      expect(liveRoutines).toEqual(expect.arrayContaining([OWNER_ROUTINE, OWNER_ROUTINE_2]));
    });

    it('rolls back the explicit unlink when the routine_folders update throws', async () => {
      injectFailureOnUpdate('routine_folders');

      await expect(queries.deleteFolder(OWNER_FOLDER)).rejects.toThrow(
        'injected routine_folders update failure'
      );

      // The unlink ran first; without a transaction the routines would be left
      // unlinked even though the folder tombstone failed.
      for (const id of [OWNER_ROUTINE, OWNER_ROUTINE_2]) {
        expect(rawRoutine(id)).toEqual({
          folder_id: OWNER_FOLDER,
          deleted_at: null,
          updated_at: STALE,
        });
      }
      expect(rawFolder(OWNER_FOLDER)).toEqual({ deleted_at: null, updated_at: STALE });
    });
  });

  // ─── removeExerciseFromRoutine ──────────────────────

  describe('removeExerciseFromRoutine', () => {
    it('tombstones the row instead of removing it, and the reader hides it', async () => {
      expect(rawRoutineExercise(OWNER_RE)?.deleted_at).toBeNull();

      await queries.removeExerciseFromRoutine(OWNER_RE);

      const row = rawRoutineExercise(OWNER_RE);
      expect(row).toBeDefined();
      expect(row?.deleted_at).not.toBeNull();
      expect(row?.updated_at).not.toBe(STALE);

      const live = (await queries.getRoutineExercises(OWNER_ROUTINE)).map((re) => re.id);
      expect(live).not.toContain(OWNER_RE);
      expect(live).toContain(OWNER_RE_2);
    });

    it('leaves a sibling routine_exercise untouched', async () => {
      await queries.removeExerciseFromRoutine(OWNER_RE);

      expect(rawRoutineExercise(OWNER_RE_2)).toEqual({ deleted_at: null, updated_at: STALE });
      expect(rawRoutineExercise(OWNER_RE_ROUTINE_2)).toEqual({
        deleted_at: null,
        updated_at: STALE,
      });
    });
  });

  // ─── ownership ──────────────────────────────────────

  describe('ownership', () => {
    it('deleteRoutine does not tombstone another account’s routine or its exercises', async () => {
      await queries.deleteRoutine(OTHER_ROUTINE);

      expect(rawRoutine(OTHER_ROUTINE)).toEqual({
        folder_id: OTHER_FOLDER,
        deleted_at: null,
        updated_at: STALE,
      });
      expect(rawRoutineExercise(OTHER_RE)).toEqual({ deleted_at: null, updated_at: STALE });
    });

    it('deleteFolder does not unlink another account’s routine, even a dangling one', async () => {
      await queries.deleteFolder(OWNER_FOLDER);

      // The owner's routines are unlinked…
      expect(rawRoutine(OWNER_ROUTINE)?.folder_id).toBeNull();
      // …the other account's own folder and routine are untouched…
      expect(rawFolder(OTHER_FOLDER)).toEqual({ deleted_at: null, updated_at: STALE });
      expect(rawRoutine(OTHER_ROUTINE)).toEqual({
        folder_id: OTHER_FOLDER,
        deleted_at: null,
        updated_at: STALE,
      });
      // …and a foreign routine pointing at the owner's folder is NOT unlinked:
      // the ownership `WHERE` is what keeps the soft delete from being broader.
      expect(rawRoutine(OTHER_ROUTINE_DANGLING)).toEqual({
        folder_id: OWNER_FOLDER,
        deleted_at: null,
        updated_at: STALE,
      });
      expect(rawRoutineExercise(OTHER_RE_DANGLING)).toEqual({
        deleted_at: null,
        updated_at: STALE,
      });
    });

    it('removeExerciseFromRoutine does not tombstone another account’s row', async () => {
      await queries.removeExerciseFromRoutine(OTHER_RE);

      expect(rawRoutineExercise(OTHER_RE)).toEqual({ deleted_at: null, updated_at: STALE });
    });
  });
});
