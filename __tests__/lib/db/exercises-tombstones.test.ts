/* eslint-disable @typescript-eslint/no-explicit-any */
import { CREATE_TABLES_SQL } from '../../../lib/db/ddl';

// U2d — `deleteExercise` stops hard-deleting. `exercises` is hybrid: a row with
// `user_id` set is a user custom, a row with `user_id IS NULL` is the shared
// seeded library. Only a custom may ever be removed, and a tombstone is a WRITE,
// not a DELETE: the row stays and gains `deleted_at`, so the U2e read guards make
// the soft delete observable instead of the row simply vanishing.
//
// THE TRAP THIS SUITE PINS — `routine_exercises.exercise_id` and
// `session_exercises.exercise_id` both declare `ON DELETE RESTRICT`. That FK was
// the backstop under the hard delete (and the reason `deleteExercise` counts
// references first). A tombstone never fires a FK action, so the restriction
// cannot block the custom any more; the reference-count pre-check must therefore
// still be the thing that phrases the refusal, and it must keep ignoring
// tombstoned references (U2e-4) while still counting live ones.
//
// FIXTURE. Exercise 1 is a deletable custom, 2 the shared library row, 3 another
// account's custom, 4 a custom referenced ONLY by a tombstoned routine_exercises
// row, 5 a custom referenced by a LIVE routine_exercises row. The shared row and
// the foreign row exist so the assertions can prove the ownership WHERE still
// refuses both.
//
// PRODUCTION FIDELITY: only the native `expo-sqlite` boundary is faked over a
// real `node:sqlite` database, so the real `drizzle-orm/expo-sqlite` driver and
// the real `lib/db` layer run unmodified. The fake exposes the raw database as
// `__sqlite` so the assertions read the tombstone directly, not through the guard
// the soft delete is supposed to trip.
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
const OTHER = 'user-b';
const TOMBSTONE = 1_800_000_000;

/** A stale timestamp so a real `now()` bump is unambiguous. */
const STALE = 1;

/** The owner's custom with no references at all: the plain soft-delete case. */
const DELETABLE_CUSTOM = 1;
/** The shared seeded library row — `user_id IS NULL`, keyed by `original_id`. */
const SHARED = 2;
/** Another account's custom. */
const OTHER_CUSTOM = 3;
/** The owner's custom referenced only by a tombstoned routine_exercises row. */
const TOMB_REF_CUSTOM = 4;
/** The owner's custom referenced by a live routine_exercises row. */
const LIVE_REF_CUSTOM = 5;

const ROUTINE = 10;
/** Tombstoned slot referencing `TOMB_REF_CUSTOM`. */
const TOMB_RE = 101;
/** Live slot referencing `LIVE_REF_CUSTOM`. */
const LIVE_RE = 102;

function rawExercise(
  id: number
): { deleted_at: number | null; updated_at: number | null } | undefined {
  return sqlite
    .prepare('SELECT deleted_at, updated_at FROM exercises WHERE id = ?')
    .get(id) as { deleted_at: number | null; updated_at: number | null } | undefined;
}

function seedExercise(
  id: number,
  userId: string | null,
  name: string,
  originalId: string | null
): void {
  sqlite
    .prepare(
      'INSERT INTO exercises (id, user_id, name, original_id, category_id, created_at,' +
        ' updated_at) VALUES (?, ?, ?, ?, 1, 0, ?)'
    )
    .run(id, userId, name, originalId, STALE);
}

function seedFixture(): void {
  sqlite.exec(
    "INSERT INTO categories (id, name, color, icon, created_at) VALUES (1, 'Strength', '#fff', 'x', 0);"
  );

  seedExercise(DELETABLE_CUSTOM, OWNER, 'Deletable custom', null);
  seedExercise(SHARED, null, 'Barbell bench press', '0001');
  seedExercise(OTHER_CUSTOM, OTHER, 'Other custom', null);
  seedExercise(TOMB_REF_CUSTOM, OWNER, 'Tomb-ref custom', null);
  seedExercise(LIVE_REF_CUSTOM, OWNER, 'Live-ref custom', null);

  sqlite.exec("INSERT INTO routines (id, user_id, name, created_at) VALUES (10, 'user-a', 'Push', 0);");
  sqlite
    .prepare(
      'INSERT INTO routine_exercises (id, routine_id, exercise_id, "order", created_at,' +
        ' updated_at, deleted_at) VALUES (?, ?, ?, 0, 0, ?, NULL)'
    )
    .run(TOMB_RE, ROUTINE, TOMB_REF_CUSTOM, STALE);
  sqlite
    .prepare(
      'INSERT INTO routine_exercises (id, routine_id, exercise_id, "order", created_at,' +
        ' updated_at, deleted_at) VALUES (?, ?, ?, 1, 0, ?, NULL)'
    )
    .run(LIVE_RE, ROUTINE, LIVE_REF_CUSTOM, STALE);
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

describe('exercises delete tombstones instead of hard-deleting (U2d)', () => {
  beforeAll(() => {
    sqlite.exec(CREATE_TABLES_SQL);
  });

  beforeEach(() => {
    // Children before parents: foreign keys are enforced on this connection.
    sqlite.exec(
      'DELETE FROM sets; DELETE FROM session_exercises; DELETE FROM sessions;' +
        'DELETE FROM routine_exercises; DELETE FROM routines; DELETE FROM routine_folders;' +
        'DELETE FROM exercises; DELETE FROM categories;'
    );
    seedFixture();
    setCurrentUserId(OWNER);
  });

  // ─── the soft delete ────────────────────────────────

  it('keeps the custom row, stamps deleted_at, and both readers drop it', async () => {
    expect(rawExercise(DELETABLE_CUSTOM)?.deleted_at).toBeNull();

    await queries.deleteExercise(DELETABLE_CUSTOM);

    // A tombstone is an UPDATE: the row must still be physically there with the
    // marker set and `updated_at` bumped (so the tombstone can win the sync
    // conflict). These are the assertions that fail while the delete is hard, the
    // row would simply be gone.
    const row = rawExercise(DELETABLE_CUSTOM);
    expect(row).toBeDefined();
    expect(row?.deleted_at).not.toBeNull();
    expect(row?.updated_at).not.toBe(STALE);

    // And the U2e guards are what make it invisible.
    expect((await queries.getAllExercises()).map((e) => e.id)).not.toContain(DELETABLE_CUSTOM);
    expect(await queries.getExerciseById(DELETABLE_CUSTOM)).toEqual([]);

    // The other live customs are untouched by the guards.
    const liveIds = (await queries.getAllExercises()).map((e) => e.id);
    expect(liveIds).toEqual(expect.arrayContaining([SHARED, TOMB_REF_CUSTOM, LIVE_REF_CUSTOM]));
  });

  // ─── the shared library ─────────────────────────────

  it('never tombstones the shared library row', async () => {
    await queries.deleteExercise(SHARED);

    // `user_id IS NULL` never equals the owner, so the exact ownership WHERE
    // leaves the shared row live. This is the invariant the tombstone must not
    // broaden: the soft delete is not a physical delete, but it is still scoped.
    expect(rawExercise(SHARED)).toEqual({ deleted_at: null, updated_at: STALE });
    expect((await queries.getAllExercises()).map((e) => e.id)).toContain(SHARED);
    expect((await queries.getExerciseById(SHARED)).map((e) => e.id)).toEqual([SHARED]);
  });

  // ─── the reference-count pre-check ──────────────────

  it('deletes a custom whose only references are tombstoned', async () => {
    // Before U2d the pre-check already ignored the tombstoned reference (U2e-4),
    // but the physical DELETE was still refused by the FK `ON DELETE RESTRICT`.
    // A tombstone fires no FK action, so this delete must now succeed — and the
    // tombstoned reference row must survive it untouched.
    expect(await deleteOutcome(TOMB_REF_CUSTOM)).toBe('deleted');
    expect(rawExercise(TOMB_REF_CUSTOM)?.deleted_at).not.toBeNull();

    const ref = sqlite
      .prepare('SELECT deleted_at, updated_at FROM routine_exercises WHERE id = ?')
      .get(TOMB_RE) as { deleted_at: number | null; updated_at: number | null };
    expect(ref).toEqual({ deleted_at: TOMBSTONE, updated_at: STALE });
  });

  it('still refuses a custom with a live reference, with the same message', async () => {
    expect(await deleteOutcome(LIVE_REF_CUSTOM)).toBe(
      'Cannot delete: exercise is used in 1 routines and 0 sessions'
    );
    // The refusal is a refusal: nothing is tombstoned.
    expect(rawExercise(LIVE_REF_CUSTOM)).toEqual({ deleted_at: null, updated_at: STALE });
  });

  // ─── ownership ──────────────────────────────────────

  it('does not tombstone another account’s custom', async () => {
    await queries.deleteExercise(OTHER_CUSTOM);

    expect(rawExercise(OTHER_CUSTOM)).toEqual({ deleted_at: null, updated_at: STALE });

    // It is still live for its own owner.
    setCurrentUserId(OTHER);
    expect((await queries.getExerciseById(OTHER_CUSTOM)).map((e) => e.id)).toEqual([
      OTHER_CUSTOM,
    ]);
  });
});
