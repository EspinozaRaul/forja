/* eslint-disable @typescript-eslint/no-explicit-any */
import { CREATE_TABLES_SQL } from '../../../lib/db/ddl';

// U2e — every read in `lib/db/queries.ts` that touches `session_exercises` or
// `sets` must exclude a tombstoned row (`deleted_at` set). While every
// `deleted_at` is still NULL this is a provable no-op; the guard only becomes
// observable by setting the column directly, which is exactly what U2d's soft
// delete will do.
//
// THE TRAP THIS SUITE PINS: `lib/db/user-scope.ts` resolves ownership through
// the PARENT (session_exercise -> session), so an "ownership-correct" read can
// still return a tombstoned `session_exercises` row under a live session, or a
// live `sets` row under a tombstoned `session_exercises` row. Each read needs
// the row's OWN `deleted_at IS NULL` guard.
//
// FIXTURE. S1 (live, completed) carries TWO `session_exercises` slots: 11 live
// and 12 tombstoned, so the direct read shows the trap (a live session whose
// child is tombstoned). A NEWER live session S2 carries slot 13, also
// tombstoned: an unguarded "most recent" reader therefore walks into a
// tombstone. S3 is a live completed session with NO slot at all: it pins the
// LEFT JOIN in `getWeeklySessions` — a guard moved into the WHERE would drop S2
// (all children tombstoned) while leaving S3 intact, which is what the negative
// control observes.
//
// Sets: 21 is live under live slot 11, 22 is a tombstoned twin under the same
// live slot 11, and 23 is a live set under the tombstoned slot 13. Only the
// live/live pair survives every guard.
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
const EXERCISE_ID = 1;
const ROUTINE_ID = 1;
const TOMBSTONE = 1_800_000_000;

/** Live completed session holding both the live and the tombstoned twin slot. */
const LIVE_SESSION = 1;
/** Newer live completed session holding a second tombstoned slot. */
const NEWER_SESSION = 2;
/** Live completed session with no children at all; newest. */
const EMPTY_SESSION = 3;

const LIVE_SE = 11;
const TOMB_SE_TWIN = 12;
const TOMB_SE_NEWER = 13;

const LIVE_SET = 21;
const TOMB_SET = 22;
const LIVE_SET_UNDER_TOMB_SE = 23;

function seedFixture(): void {
  sqlite.exec(
    "INSERT INTO categories (id, name, color, icon, created_at) VALUES (1, 'Strength', '#fff', 'x', 0);"
  );
  sqlite.exec(
    "INSERT INTO exercises (id, name, created_at) VALUES (1, 'Bench press', 0);"
  );
  sqlite.exec(
    "INSERT INTO routines (id, user_id, name, created_at) VALUES" +
      " (1, 'user-a', 'Push', 0), (2, 'user-a', 'Pull', 0);"
  );

  sqlite.exec(
    'INSERT INTO sessions (id, user_id, routine_id, started_at, completed_at, duration) VALUES' +
      ` (${LIVE_SESSION}, 'user-a', ${ROUTINE_ID}, 3000, 4000, 100),` +
      ` (${NEWER_SESSION}, 'user-a', ${ROUTINE_ID}, 5000, 6000, 200),` +
      ` (${EMPTY_SESSION}, 'user-a', 2, 7000, 8000, 300);`
  );

  // Two slots under the live session S1 (the direct-read twin), plus a
  // tombstoned slot under the NEWER session S2 so an unguarded "most recent"
  // reader walks straight into a tombstone.
  sqlite.exec(
    'INSERT INTO session_exercises (id, session_id, exercise_id, "order", notes, created_at) VALUES' +
      ` (${LIVE_SE}, ${LIVE_SESSION}, ${EXERCISE_ID}, 0, 'live se note', 11),` +
      ` (${TOMB_SE_TWIN}, ${LIVE_SESSION}, ${EXERCISE_ID}, 1, 'tomb se note', 12),` +
      ` (${TOMB_SE_NEWER}, ${NEWER_SESSION}, ${EXERCISE_ID}, 0, 'newer tomb se note', 13);`
  );
  sqlite
    .prepare('UPDATE session_exercises SET deleted_at = ? WHERE id IN (?, ?)')
    .run(TOMBSTONE, TOMB_SE_TWIN, TOMB_SE_NEWER);

  // Live/tombstoned twins under the LIVE slot, plus a live set under the
  // tombstoned slot (the parent-deleted probe).
  sqlite.exec(
    'INSERT INTO sets (id, session_exercise_id, set_number, reps, weight, completed, rir, created_at) VALUES' +
      ` (${LIVE_SET}, ${LIVE_SE}, 1, 5, 10, 1, 1, 21),` +
      ` (${TOMB_SET}, ${LIVE_SE}, 2, 6, 20, 1, 2, 22),` +
      ` (${LIVE_SET_UNDER_TOMB_SE}, ${TOMB_SE_NEWER}, 1, 7, 30, 1, 3, 23);`
  );
  sqlite.prepare('UPDATE sets SET deleted_at = ? WHERE id = ?').run(TOMBSTONE, TOMB_SET);
}

describe('session_exercises / sets read guards exclude tombstoned rows (U2e)', () => {
  beforeAll(() => {
    sqlite.exec(CREATE_TABLES_SQL);
  });

  beforeEach(() => {
    // Children first so the FK-enforcing connection (`PRAGMA foreign_keys = ON`,
    // issued by `lib/db/index` at import) can delete parents.
    sqlite.exec(
      'DELETE FROM sets; DELETE FROM session_exercises; DELETE FROM sessions;' +
        'DELETE FROM routine_exercises; DELETE FROM routines;' +
        'DELETE FROM body_measurements; DELETE FROM progress_photos;' +
        'DELETE FROM exercises; DELETE FROM categories;'
    );
    seedFixture();
    setCurrentUserId(OWNER);
  });

  // ─── Direct reads of session_exercises ──────────────

  it('getSessionExercises drops a tombstoned slot under a live session', async () => {
    const ids = (await queries.getSessionExercises(LIVE_SESSION)).map((se) => se.id);
    expect(ids).toEqual([LIVE_SE]);
  });

  it('getSessionExercisesWithSets drops the tombstoned slot AND its tombstoned set', async () => {
    const rows = await queries.getSessionExercisesWithSets(LIVE_SESSION);
    expect(rows.map((se) => se.id)).toEqual([LIVE_SE]);
    expect(rows[0].sets.map((s) => s.id)).toEqual([LIVE_SET]);
  });

  it('assertSessionExerciseOwned refuses a tombstoned slot but accepts the live one', async () => {
    await expect(
      queries.createSet({ sessionExerciseId: TOMB_SE_TWIN, setNumber: 99 })
    ).rejects.toThrow('Session exercise does not belong to the current user');

    await expect(
      queries.createSet({ sessionExerciseId: LIVE_SE, setNumber: 99 })
    ).resolves.toBeDefined();
  });

  // ─── Last-session reader (direct select + sets read) ─

  it('getLastSessionForRoutine returns the live session with its tombstoned slot removed', async () => {
    const last = await queries.getLastSessionForRoutine(ROUTINE_ID);
    expect(last?.id).toBe(NEWER_SESSION);
    expect(last?.exercises).toEqual([]);
  });

  // ─── Sets readers ───────────────────────────────────

  it('getSetsForSessionExercise drops the tombstoned twin under a live slot', async () => {
    const ids = (await queries.getSetsForSessionExercise(LIVE_SE)).map((s) => s.id);
    expect(ids).toEqual([LIVE_SET]);
  });

  it('getLastSetsForExercise ignores the newer session whose slot is tombstoned', async () => {
    const setsResult = await queries.getLastSetsForExercise(EXERCISE_ID);
    expect(setsResult?.map((s) => s.id)).toEqual([LIVE_SET]);
  });

  it('getLastSetsPerExercise ignores the newer session whose slot is tombstoned', async () => {
    const result = await queries.getLastSetsPerExercise([EXERCISE_ID]);
    expect(result[EXERCISE_ID]?.map((s) => s.id)).toEqual([LIVE_SET]);
  });

  it('getSetsByExerciseId returns only the live/live set', async () => {
    const ids = (await queries.getSetsByExerciseId(EXERCISE_ID)).map((s) => s.id);
    expect(ids).toEqual([LIVE_SET]);
  });

  // ─── Last set/reps/weight readers ───────────────────

  it('getLastWeightByExerciseIds prefers the live/live set over both tombstones', async () => {
    const result = await queries.getLastWeightByExerciseIds([EXERCISE_ID]);
    expect(result[EXERCISE_ID]).toEqual({ weight: 10, unit: 'kg' });
  });

  it('getLastRepsByExerciseIds prefers the live/live set over both tombstones', async () => {
    const result = await queries.getLastRepsByExerciseIds([EXERCISE_ID]);
    expect(result[EXERCISE_ID]).toEqual({ reps: 5 });
  });

  it('getLastNotesByExerciseIds ignores the newer slot that is tombstoned', async () => {
    const result = await queries.getLastNotesByExerciseIds([EXERCISE_ID]);
    expect(result[EXERCISE_ID]).toBe('live se note');
  });

  it('getLastWorkoutPerExercise ignores tombstoned sets and tombstoned slots', async () => {
    const result = await queries.getLastWorkoutPerExercise([EXERCISE_ID]);
    expect(result[EXERCISE_ID]).toEqual({ sets: 1, reps: 5, weight: 10, unit: 'kg' });
  });

  it('getMaxWeightByExerciseIds ignores every tombstoned contribution', async () => {
    const result = await queries.getMaxWeightByExerciseIds([EXERCISE_ID]);
    expect(result[EXERCISE_ID]).toBe(10);
  });

  it('getLastRirByRoutineExerciseIds drops sets under a tombstoned slot', async () => {
    const result = await queries.getLastRirByRoutineExerciseIds(ROUTINE_ID, [EXERCISE_ID]);
    expect(result).toEqual({});
  });

  // ─── Aggregates ─────────────────────────────────────

  it('getExerciseStats counts only the live/live set', async () => {
    const stats = await queries.getExerciseStats(EXERCISE_ID);
    expect(stats).toEqual({ maxWeight: 10, totalVolume: 50, totalSessions: 1, totalSets: 1 });
  });

  it('getExerciseSessions drops a session whose only slot is tombstoned', async () => {
    const entries = await queries.getExerciseSessions(EXERCISE_ID);
    expect(entries).toEqual([
      {
        sessionId: LIVE_SESSION,
        startedAt: new Date(3000 * 1000),
        duration: 100,
        volume: 50,
        setCount: 1,
        completedSets: 1,
      },
    ]);
  });

  it('getExerciseProgressionData drops tombstoned sets and slots', async () => {
    const rows = await queries.getExerciseProgressionData(EXERCISE_ID);
    expect(rows.map((r) => [r.sessionId, r.avgWeight, r.avgReps, r.setCount])).toEqual([
      [LIVE_SESSION, 10, 5, 1],
    ]);
  });

  it('getExercisePRs drops every tombstoned contribution', async () => {
    const prs = await queries.getExercisePRs(EXERCISE_ID);
    expect(prs.maxWeight?.value).toBe(10);
    expect(prs.bestSet?.volume).toBe(50);
    expect(prs.maxVolumeSession?.sessionId).toBe(LIVE_SESSION);
    expect(prs.estimated1RM).toBe(12);
  });

  it('getGlobalStats drops every tombstoned set and slot', async () => {
    const stats = await queries.getGlobalStats();
    // Three live completed sessions (S1, S2, S3); only S1 contributes a set.
    expect(stats.totalWorkouts).toBe(3);
    expect(stats.totalVolume).toBe(50);
    expect(stats.totalCompletedSets).toBe(1);
    expect(stats.mostFrequentExercise).toBe('Bench press');
  });

  // ─── getWeeklySessions: the LEFT JOIN branch ────────

  it('getWeeklySessions (LEFT JOIN branch) keeps a live session whose slots are tombstoned', async () => {
    const week = sqlite
      .prepare("SELECT strftime('%Y-%W', 3000, 'unixepoch') AS w")
      .get().w;

    const all = await queries.getWeeklySessions(week);
    expect(all.map((r) => [r.sessionId, r.exerciseCount, r.totalVolume])).toEqual([
      [EMPTY_SESSION, 0, 0],
      [NEWER_SESSION, 0, 0],
      [LIVE_SESSION, 1, 50],
    ]);
  });

  it('getWeeklySessions (INNER JOIN branch) drops tombstoned slots and sets', async () => {
    const week = sqlite
      .prepare("SELECT strftime('%Y-%W', 3000, 'unixepoch') AS w")
      .get().w;

    const byExercise = await queries.getWeeklySessions(week, EXERCISE_ID);
    expect(byExercise.map((r) => [r.sessionId, r.exerciseCount, r.totalVolume])).toEqual([
      [LIVE_SESSION, 1, 50],
    ]);
  });
});
