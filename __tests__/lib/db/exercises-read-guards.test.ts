/* eslint-disable @typescript-eslint/no-explicit-any */
import { CREATE_TABLES_SQL } from '../../../lib/db/ddl';

// U2e — every read in `lib/db/queries.ts` that touches `exercises` must exclude
// a tombstoned row (`deleted_at` set). While every `deleted_at` is still NULL
// this is a provable no-op; the guard only becomes observable by setting the
// column directly, which is exactly what U2d's soft delete will do.
//
// THE TRAP THIS SUITE PINS: `exercises` is hybrid. The shared seeded library has
// `user_id IS NULL`; a custom row carries the owner's id. `visibleToCurrentUser`
// only encodes that visibility rule — it is a column-level fragment that never
// inspects `deleted_at`, so it cannot hide a tombstoned row. A row's OWN
// tombstone therefore needs its OWN `isNull(exercises.deletedAt)`.
//
// FIXTURE. Exercise 1 is a live custom, exercise 2 a tombstoned custom. Exercise
// 3 is a live shared row (`user_id IS NULL`, keyed by `original_id`); exercise 4
// is a tombstoned shared row, so the suite pins that the guard hides tombstones
// on BOTH sides of the hybrid and that the live shared library survives it.
//
// S1 (routine 10, completed) carries three live slots: one for the live custom
// (11), one for the tombstoned custom (12 — the LEFT-JOIN trap: it must keep the
// slot with a null exercise name, not drop the slot), and one for the live shared
// row (13). S2 (no routine, completed) carries two extra slots for the
// tombstoned custom so the most-frequent aggregate has a deterministic loser
// when the tombstone is excluded.
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

const CATEGORY = 1;

/** Live custom — owned by the active account. */
const LIVE_CUSTOM = 1;
/** Tombstoned custom — its OWN tombstone must hide it. */
const TOMB_CUSTOM = 2;
/** Live shared seed row — `user_id IS NULL`, keyed by `original_id`. */
const LIVE_SHARED = 3;
/** Tombstoned shared seed row — the guard must apply here too. */
const TOMB_SHARED = 4;

const ROUTINE = 10;
/** Completed session in the routine, holding the LEFT-JOIN trap. */
const LIVE_SESSION = 1;
/** Completed session outside the routine, inflating the tombstoned exercise. */
const TOMB_FODDER_SESSION = 2;

const SE_LIVE_CUSTOM = 11;
/** Live slot whose exercise is tombstoned: the LEFT-JOIN trap. */
const SE_TOMB_CUSTOM = 12;
const SE_LIVE_SHARED = 13;
const SE_FODDER_A = 14;
const SE_FODDER_B = 15;

const SET_LIVE_CUSTOM = 21;
/** Live set under a live slot whose exercise is tombstoned. */
const SET_TOMB_CUSTOM = 22;
const SET_LIVE_SHARED = 23;

function seedFixture(): void {
  sqlite.exec(
    "INSERT INTO categories (id, name, color, icon, created_at) VALUES (1, 'Strength', '#fff', 'x', 0);"
  );
  sqlite.exec(
    'INSERT INTO exercises (id, user_id, name, category_id, original_id, unit, created_at) VALUES' +
      ` (${LIVE_CUSTOM}, '${OWNER}', 'AAA live custom', ${CATEGORY}, NULL, 'kg', 0),` +
      ` (${TOMB_CUSTOM}, '${OWNER}', 'BBB tomb custom', ${CATEGORY}, NULL, 'kg', 0),` +
      ` (${LIVE_SHARED}, NULL, 'CCC shared', ${CATEGORY}, 'seed-1', 'lb', 0),` +
      ` (${TOMB_SHARED}, NULL, 'DDD shared tomb', ${CATEGORY}, 'seed-2', 'kg', 0);`
  );
  sqlite
    .prepare('UPDATE exercises SET deleted_at = ? WHERE id IN (?, ?)')
    .run(TOMBSTONE, TOMB_CUSTOM, TOMB_SHARED);

  sqlite.exec(
    "INSERT INTO routines (id, user_id, name, created_at) VALUES (10, 'user-a', 'Push', 0);"
  );

  sqlite.exec(
    'INSERT INTO sessions (id, user_id, routine_id, started_at, completed_at, duration) VALUES' +
      ` (${LIVE_SESSION}, '${OWNER}', ${ROUTINE}, 3000, 4000, 100),` +
      ` (${TOMB_FODDER_SESSION}, '${OWNER}', NULL, 5000, 6000, 200);`
  );

  sqlite.exec(
    'INSERT INTO session_exercises (id, session_id, exercise_id, "order", created_at) VALUES' +
      ` (${SE_LIVE_CUSTOM}, ${LIVE_SESSION}, ${LIVE_CUSTOM}, 0, 0),` +
      ` (${SE_TOMB_CUSTOM}, ${LIVE_SESSION}, ${TOMB_CUSTOM}, 1, 0),` +
      ` (${SE_LIVE_SHARED}, ${LIVE_SESSION}, ${LIVE_SHARED}, 2, 0),` +
      ` (${SE_FODDER_A}, ${TOMB_FODDER_SESSION}, ${TOMB_CUSTOM}, 0, 0),` +
      ` (${SE_FODDER_B}, ${TOMB_FODDER_SESSION}, ${TOMB_CUSTOM}, 1, 0);`
  );

  sqlite.exec(
    'INSERT INTO sets (id, session_exercise_id, set_number, reps, weight, completed, created_at) VALUES' +
      ` (${SET_LIVE_CUSTOM}, ${SE_LIVE_CUSTOM}, 1, 5, 10, 1, 21),` +
      ` (${SET_TOMB_CUSTOM}, ${SE_TOMB_CUSTOM}, 1, 6, 999, 1, 22),` +
      ` (${SET_LIVE_SHARED}, ${SE_LIVE_SHARED}, 1, 7, 5, 1, 23);`
  );
}

describe('exercises read guards exclude tombstones (U2e)', () => {
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

  // ─── Direct reads of exercises ──────────────────────

  it('getAllExercises drops tombstoned customs AND tombstoned shared rows', async () => {
    const ids = (await queries.getAllExercises()).map((e) => e.id);
    expect(ids).toEqual([LIVE_CUSTOM, LIVE_SHARED]);
  });

  it('getExercisesByCategory drops both tombstones and keeps both live rows', async () => {
    const ids = (await queries.getExercisesByCategory(CATEGORY)).map((e) => e.id);
    expect([...ids].sort((a, b) => a - b)).toEqual([LIVE_CUSTOM, LIVE_SHARED]);
  });

  it('getExerciseById drops a tombstoned custom but keeps the live custom', async () => {
    expect((await queries.getExerciseById(TOMB_CUSTOM)).map((e) => e.id)).toEqual([]);
    expect((await queries.getExerciseById(LIVE_CUSTOM)).map((e) => e.id)).toEqual([LIVE_CUSTOM]);
  });

  it('getExerciseById drops a tombstoned shared row but keeps the live shared library', async () => {
    expect((await queries.getExerciseById(TOMB_SHARED)).map((e) => e.id)).toEqual([]);
    expect((await queries.getExerciseById(LIVE_SHARED)).map((e) => e.id)).toEqual([LIVE_SHARED]);
  });

  // ─── LEFT JOIN: getLastSessionForRoutine ────────────

  it('getLastSessionForRoutine keeps a live slot whose exercise is tombstoned, with a null name', async () => {
    const last = await queries.getLastSessionForRoutine(ROUTINE);
    expect(last?.id).toBe(LIVE_SESSION);
    // The LEFT JOIN must stay LEFT: the slot for the tombstoned exercise is
    // still returned (its guard lives in the ON clause), but its exercise name
    // is null — the read never joins through the tombstone.
    expect(last?.exercises.map((se) => [se.id, se.exerciseName])).toEqual([
      [SE_LIVE_CUSTOM, 'AAA live custom'],
      [SE_TOMB_CUSTOM, null],
      [SE_LIVE_SHARED, 'CCC shared'],
    ]);
  });

  // ─── INNER JOINs reading exercises ──────────────────

  it('getLastWeightByExerciseIds drops a set whose exercise is tombstoned', async () => {
    const result = await queries.getLastWeightByExerciseIds([TOMB_CUSTOM]);
    expect(result).toEqual({});
  });

  it('getLastWeightByExerciseIds still returns the live custom and the live shared row', async () => {
    const result = await queries.getLastWeightByExerciseIds([LIVE_CUSTOM, LIVE_SHARED]);
    expect(result).toEqual({
      [LIVE_CUSTOM]: { weight: 10, unit: 'kg' },
      [LIVE_SHARED]: { weight: 5, unit: 'lb' },
    });
  });

  it('getLastWorkoutPerExercise drops an exercise whose only sets are tombstoned', async () => {
    const result = await queries.getLastWorkoutPerExercise([LIVE_CUSTOM, TOMB_CUSTOM]);
    expect(result[LIVE_CUSTOM]).toEqual({ sets: 1, reps: 5, weight: 10, unit: 'kg' });
    expect(result[TOMB_CUSTOM]).toBeNull();
  });

  it('getGlobalStats most-frequent exercise ignores the tombstoned exercise', async () => {
    const stats = await queries.getGlobalStats();
    // Unguarded, the tombstoned custom wins the count (3 slots vs 1 per live
    // exercise); guarded, every one of its rows is dropped.
    expect(stats.mostFrequentExercise).not.toBe('BBB tomb custom');
    expect(stats.mostFrequentExercise).not.toBe('DDD shared tomb');
    expect(stats.mostFrequentExercise).not.toBeNull();
  });
});
