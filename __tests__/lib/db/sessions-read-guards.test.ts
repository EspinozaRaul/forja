/* eslint-disable @typescript-eslint/no-explicit-any */
import { CREATE_TABLES_SQL } from '../../../lib/db/ddl';

// U2e — every read in `lib/db/queries.ts` that touches `sessions` must exclude a
// tombstoned row (`deleted_at` set). While every `deleted_at` is still NULL this
// is a provable no-op; the guard only becomes observable by setting the column
// directly, which is exactly what U2d's soft delete will do.
//
// The direct reads, ownership checks, INNER JOINs and aggregates each need the
// predicate at a different spot, so this suite exercises each read family
// against one fixture: two live sessions and two tombstoned ones, the
// tombstoned pair deliberately MORE RECENT than its live twin (an unguarded read
// would return it first). One live-active / one tomb-active isolates
// `getActiveSession`; one live-completed / one tomb-completed isolates every
// completed-only aggregate.
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
const ROUTINE_ID = 1;
const EXERCISE_ID = 1;
const TOMBSTONE = 1_800_000_000;

const LIVE_ACTIVE = 1;
const TOMB_ACTIVE = 2;
const LIVE_COMPLETED = 3;
const TOMB_COMPLETED = 4;

/** Live completed session startedAt, used to derive the strftime week string. */
const LIVE_COMPLETED_WEEK_EPOCH = 3000;

/** One row per read family; the tombstoned twins are the later timestamps. */
function seedFixture(): void {
  sqlite.exec(
    "INSERT INTO categories (id, name, color, icon, created_at) VALUES (1, 'Strength', '#fff', 'x', 0);"
  );
  sqlite.exec(
    "INSERT INTO exercises (id, name, created_at) VALUES (1, 'Bench press', 0);"
  );
  sqlite.exec(
    "INSERT INTO routines (id, user_id, name, created_at) VALUES (1, 'user-a', 'Push', 0);"
  );

  sqlite.exec(
    'INSERT INTO sessions (id, user_id, routine_id, started_at, completed_at, duration) VALUES' +
      ` (${LIVE_ACTIVE}, 'user-a', ${ROUTINE_ID}, 1000, NULL, NULL),` +
      ` (${TOMB_ACTIVE}, 'user-a', ${ROUTINE_ID}, 2000, NULL, NULL),` +
      ` (${LIVE_COMPLETED}, 'user-a', ${ROUTINE_ID}, 3000, 4000, 100),` +
      ` (${TOMB_COMPLETED}, 'user-a', ${ROUTINE_ID}, 5000, 6000, 200);`
  );
  sqlite
    .prepare('UPDATE sessions SET deleted_at = ? WHERE id IN (?, ?)')
    .run(TOMBSTONE, TOMB_ACTIVE, TOMB_COMPLETED);

  // One session_exercise + one set per session, each with a distinct weight and
  // rir so a returned row identifies which session won.
  sqlite.exec(
    'INSERT INTO session_exercises (id, session_id, exercise_id, "order", notes, created_at) VALUES' +
      ` (11, ${LIVE_ACTIVE}, ${EXERCISE_ID}, 0, NULL, 11),` +
      ` (12, ${TOMB_ACTIVE}, ${EXERCISE_ID}, 0, NULL, 12),` +
      ` (13, ${LIVE_COMPLETED}, ${EXERCISE_ID}, 0, 'live se note', 13),` +
      ` (14, ${TOMB_COMPLETED}, ${EXERCISE_ID}, 0, 'tomb se note', 14);`
  );
  sqlite.exec(
    'INSERT INTO sets (id, session_exercise_id, set_number, reps, weight, completed, rir, created_at) VALUES' +
      ' (21, 11, 1, 5, 10, 1, 1, 21),' +
      ' (22, 12, 1, 5, 20, 1, 2, 22),' +
      ' (23, 13, 1, 5, 30, 1, 3, 23),' +
      ' (24, 14, 1, 5, 40, 1, 4, 24);'
  );
}

describe('sessions read guards exclude tombstoned rows (U2e)', () => {
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

  it('getAllSessions returns only the live sessions', async () => {
    const ids = (await queries.getAllSessions()).map((s) => s.id);
    expect(ids).toEqual([LIVE_COMPLETED, LIVE_ACTIVE]);
  });

  it('getSessionById refuses a tombstoned id and still returns the live one', async () => {
    expect(await queries.getSessionById(TOMB_COMPLETED)).toEqual([]);
    expect((await queries.getSessionById(LIVE_COMPLETED)).map((s) => s.id)).toEqual([
      LIVE_COMPLETED,
    ]);
  });

  it('getActiveSession skips a more recent tombstoned in-progress session', async () => {
    const active = await queries.getActiveSession();
    expect(active?.id).toBe(LIVE_ACTIVE);
  });

  it('getRoutineSessionCounts does not count a tombstoned completed session', async () => {
    const counts = await queries.getRoutineSessionCounts();
    expect(counts[ROUTINE_ID]).toBe(1);
  });

  it('getLastSessionForRoutine ignores a more recent tombstoned session', async () => {
    const last = await queries.getLastSessionForRoutine(ROUTINE_ID);
    expect(last?.id).toBe(LIVE_COMPLETED);
  });

  it('getLastRirByRoutineExerciseIds ignores a more recent tombstoned session', async () => {
    const rir = await queries.getLastRirByRoutineExerciseIds(ROUTINE_ID, [EXERCISE_ID]);
    expect(rir[EXERCISE_ID][1]).toBe(3);
  });

  it('getLastSetsForExercise ignores a more recent tombstoned session', async () => {
    const setsResult = await queries.getLastSetsForExercise(EXERCISE_ID);
    expect(setsResult?.map((s) => s.weight)).toEqual([30]);
  });

  it('getLastSetsPerExercise ignores a more recent tombstoned session', async () => {
    const result = await queries.getLastSetsPerExercise([EXERCISE_ID]);
    expect(result[EXERCISE_ID]?.map((s) => s.weight)).toEqual([30]);
  });

  it('getLastNotesByExerciseIds ignores a more recent tombstoned session', async () => {
    const result = await queries.getLastNotesByExerciseIds([EXERCISE_ID]);
    expect(result[EXERCISE_ID]).toBe('live se note');
  });

  it('getLastWorkoutPerExercise ignores a more recent tombstoned session', async () => {
    const result = await queries.getLastWorkoutPerExercise([EXERCISE_ID]);
    expect(result[EXERCISE_ID]?.weight).toBe(30);
  });

  it('getExerciseSessions drops the tombstoned session', async () => {
    const entries = await queries.getExerciseSessions(EXERCISE_ID);
    expect(entries.map((e) => e.sessionId)).toEqual([LIVE_COMPLETED]);
  });

  it('getExerciseProgressionData drops the tombstoned session', async () => {
    const rows = await queries.getExerciseProgressionData(EXERCISE_ID);
    expect(rows.map((r) => r.sessionId)).toEqual([LIVE_ACTIVE, LIVE_COMPLETED]);
  });

  it('getExercisePRs max-volume session drops the tombstoned session', async () => {
    const prs = await queries.getExercisePRs(EXERCISE_ID);
    expect(prs.maxVolumeSession?.sessionId).toBe(LIVE_COMPLETED);
    expect(prs.maxWeight?.value).toBe(30);
  });

  it('getGlobalStats drops every tombstoned contribution', async () => {
    const stats = await queries.getGlobalStats();
    // Live completed set 23 (5 × 30 = 150) + live active set 21 (5 × 10 = 50).
    expect(stats.totalWorkouts).toBe(1);
    expect(stats.totalVolume).toBe(200);
    expect(stats.totalCompletedSets).toBe(2);
    expect(stats.totalTime).toBe(100);
    expect(stats.mostFrequentExercise).toBe('Bench press');
  });

  it('getWeeklySessions drops the tombstoned session (both branches)', async () => {
    const week = sqlite
      .prepare("SELECT strftime('%Y-%W', ?, 'unixepoch') AS w")
      .get(LIVE_COMPLETED_WEEK_EPOCH).w;

    const all = await queries.getWeeklySessions(week);
    expect(all.map((r) => r.sessionId)).toEqual([LIVE_COMPLETED]);
    expect(all[0].totalVolume).toBe(150);

    const byExercise = await queries.getWeeklySessions(week, EXERCISE_ID);
    expect(byExercise.map((r) => r.sessionId)).toEqual([LIVE_COMPLETED]);
  });

  it('assertSessionOwned refuses a tombstoned session', async () => {
    await expect(
      queries.addExerciseToSession({ sessionId: TOMB_ACTIVE, exerciseId: EXERCISE_ID, order: 0 })
    ).rejects.toThrow('Session does not belong to the current user');

    await expect(
      queries.addExerciseToSession({ sessionId: LIVE_ACTIVE, exerciseId: EXERCISE_ID, order: 0 })
    ).resolves.toBeDefined();
  });
});
