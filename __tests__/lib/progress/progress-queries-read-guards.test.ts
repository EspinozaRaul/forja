/* eslint-disable @typescript-eslint/no-explicit-any */
import { CREATE_TABLES_SQL } from '../../../lib/db/ddl';

// U2e — the second data-access layer (`lib/progress/queries.ts`, audit L3) must
// exclude tombstoned rows (`deleted_at` set) from every read, exactly like
// `lib/db/queries.ts` already does. While every `deleted_at` is still NULL this
// is a provable no-op; the guard only becomes observable by setting the column
// directly, which is what U2d's soft delete will do.
//
// THE TRAP THIS SUITE PINS: the month readers use NESTED LEFT JOINs
//
//   from(sessions).leftJoin(sessionExercises).leftJoin(sets)
//
// where `sessions` is the FROM table and therefore non-nullable, but every
// child is optional. The FROM table's guard belongs in the WHERE; a LEFT-JOINed
// table's guard belongs in that join's ON clause. Moving a LEFT-JOIN guard into
// the WHERE silently turns the LEFT JOIN into an INNER JOIN and drops every
// session that legitimately has no children. S_EMPTY (`S3`) exists to pin that:
// it has no children at all and must still be returned.
//
// FIXTURE (live = `deleted_at IS NULL`, twin = `deleted_at` set). All sessions
// are completed and owned by `user-a`, January 2026:
//
//   S1  live          -> SE11 live (E1), sets 21/22 live, set 25 tombstoned
//   S2  TOMBSTONED    -> SE12 live (E1), set 23 live
//   S3  live, NO CHILDREN  (the LEFT JOIN probe)
//   S4  live          -> SE13 TOMBSTONED (E1), set 24 live
//   S5  live          -> SE14 live (E2 TOMBSTONED), set 26 live
//   S6  live          -> SE16 live (E3 live), set 27 live
//
// So a correct reader returns S1, S3, S4, S5 and S6 (S2 gone), counts only the
// live/live leaves (E1 contributes sets 21/22; E3 contributes set 27), and
// never surfaces E2.
//
// PRODUCTION FIDELITY: only the native `expo-sqlite` boundary is faked over a
// real `node:sqlite` database, so the real `drizzle-orm/expo-sqlite` driver and
// the real `lib/db` + `lib/progress/queries` layers run unmodified.
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

import * as progress from '../../../lib/progress/queries';
import { setCurrentUserId } from '../../../lib/db/user-scope';

const sqlite: any = require('expo-sqlite').__sqlite;

const OWNER = 'user-a';
const MONTH = '2026-01';
const TOMBSTONE = 1_800_000_000;

/** Unix seconds for a January 2026 fixture day. */
const day = (n: number): number => Date.UTC(2026, 0, n) / 1000;

// Exercises: E1 + E3 live, E2 tombstoned.
const E_LIVE = 1;
const E_TOMB = 2;
const E_OTHER = 3;

const R_PUSH = 1;
const R_PULL = 2;

const S_LIVE = 1;
const S_TOMB = 2;
const S_EMPTY = 3;
const S_TOMB_SE = 4;
const S_TOMB_EX = 5;
const S_OTHER = 6;

const SE_LIVE = 11;
const SE_UNDER_TOMB_SESSION = 12;
const SE_TOMB = 13;
const SE_UNDER_TOMB_EXERCISE = 14;
const SE_OTHER = 16;

const SET_LIVE_1 = 21;
const SET_LIVE_2 = 22;
const SET_UNDER_TOMB_SESSION = 23;
const SET_UNDER_TOMB_SE = 24;
const SET_TOMB = 25;
const SET_UNDER_TOMB_EXERCISE = 26;
const SET_OTHER = 27;

function seedFixture(): void {
  sqlite.exec(
    "INSERT INTO categories (id, name, color, icon, created_at) VALUES (1, 'Strength', '#fff', 'x', 0);"
  );
  sqlite.exec(
    'INSERT INTO exercises (id, name, unit, created_at) VALUES' +
      ` (${E_LIVE}, 'Bench press', 'kg', 0),` +
      ` (${E_TOMB}, 'Squat', 'kg', 0),` +
      ` (${E_OTHER}, 'Deadlift', 'kg', 0);`
  );
  sqlite.prepare('UPDATE exercises SET deleted_at = ? WHERE id = ?').run(TOMBSTONE, E_TOMB);

  sqlite.exec(
    'INSERT INTO routines (id, user_id, name, created_at) VALUES' +
      ` (${R_PUSH}, '${OWNER}', 'Push', 0),` +
      ` (${R_PULL}, '${OWNER}', 'Pull', 0);`
  );

  sqlite.exec(
    'INSERT INTO sessions (id, user_id, routine_id, started_at, completed_at, duration) VALUES' +
      ` (${S_LIVE}, '${OWNER}', ${R_PUSH}, ${day(10)}, ${day(10) + 3600}, 100),` +
      ` (${S_TOMB}, '${OWNER}', ${R_PUSH}, ${day(11)}, ${day(11) + 3600}, 200),` +
      ` (${S_EMPTY}, '${OWNER}', ${R_PULL}, ${day(12)}, ${day(12) + 3600}, 300),` +
      ` (${S_TOMB_SE}, '${OWNER}', ${R_PUSH}, ${day(13)}, ${day(13) + 3600}, 400),` +
      ` (${S_TOMB_EX}, '${OWNER}', ${R_PUSH}, ${day(14)}, ${day(14) + 3600}, 500),` +
      ` (${S_OTHER}, '${OWNER}', ${R_PULL}, ${day(15)}, ${day(15) + 3600}, 600);`
  );
  sqlite.prepare('UPDATE sessions SET deleted_at = ? WHERE id = ?').run(TOMBSTONE, S_TOMB);

  sqlite.exec(
    'INSERT INTO session_exercises (id, session_id, exercise_id, "order", notes, created_at) VALUES' +
      ` (${SE_LIVE}, ${S_LIVE}, ${E_LIVE}, 0, 'live se', 11),` +
      ` (${SE_UNDER_TOMB_SESSION}, ${S_TOMB}, ${E_LIVE}, 0, 'tomb session se', 12),` +
      ` (${SE_TOMB}, ${S_TOMB_SE}, ${E_LIVE}, 0, 'tomb se', 13),` +
      ` (${SE_UNDER_TOMB_EXERCISE}, ${S_TOMB_EX}, ${E_TOMB}, 0, 'tomb exercise se', 14),` +
      ` (${SE_OTHER}, ${S_OTHER}, ${E_OTHER}, 0, 'other se', 16);`
  );
  sqlite.prepare('UPDATE session_exercises SET deleted_at = ? WHERE id = ?').run(TOMBSTONE, SE_TOMB);

  sqlite.exec(
    'INSERT INTO sets (id, session_exercise_id, set_number, reps, weight, completed, rir, created_at) VALUES' +
      ` (${SET_LIVE_1}, ${SE_LIVE}, 1, 5, 10, 1, 1, 21),` +
      ` (${SET_LIVE_2}, ${SE_LIVE}, 2, 6, 20, 1, 2, 22),` +
      ` (${SET_UNDER_TOMB_SESSION}, ${SE_UNDER_TOMB_SESSION}, 1, 7, 30, 1, 3, 23),` +
      ` (${SET_UNDER_TOMB_SE}, ${SE_TOMB}, 1, 8, 40, 1, 4, 24),` +
      ` (${SET_TOMB}, ${SE_LIVE}, 3, 7, 30, 1, 5, 25),` +
      ` (${SET_UNDER_TOMB_EXERCISE}, ${SE_UNDER_TOMB_EXERCISE}, 1, 9, 50, 1, 6, 26),` +
      ` (${SET_OTHER}, ${SE_OTHER}, 1, 10, 60, 1, 7, 27);`
  );
  sqlite.prepare('UPDATE sets SET deleted_at = ? WHERE id = ?').run(TOMBSTONE, SET_TOMB);
}

describe('progress read guards exclude tombstoned rows (U2e)', () => {
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

  // ─── getSessionsByMonth: nested LEFT JOINs ──────────

  it('getSessionsByMonth drops the tombstoned session and keeps the childless one', async () => {
    const byMonth = await progress.getSessionsByMonth(MONTH);
    expect(byMonth.map((r) => [r.id, r.exerciseCount, r.totalVolume])).toEqual([
      [S_LIVE, 1, 170], // sets 21 (5x10) + 22 (6x20); set 25 tombstoned
      [S_EMPTY, 0, 0], // NO children: proves the LEFT JOINs stayed LEFT
      [S_TOMB_SE, 0, 0], // only a tombstoned slot
      [S_TOMB_EX, 1, 450], // slot live, set 26 (9x50)
      [S_OTHER, 1, 600], // set 27 (10x60)
    ]);
  });

  it('getSessionsByMonth ignores a set tombstoned under a live slot', async () => {
    const byMonth = await progress.getSessionsByMonth(MONTH);
    const live = byMonth.find((r) => r.id === S_LIVE);
    // 25 is a tombstoned twin under the live SE_LIVE; a set guard dropping it
    // from the ON clause is what keeps the volume at 170 instead of 290.
    expect(live?.totalVolume).toBe(170);
    expect(live?.exerciseCount).toBe(1);
  });

  // ─── getSessionMonthIndex: nested LEFT JOINs ────────

  it('getSessionMonthIndex counts only live sessions and live sets', async () => {
    const index = await progress.getSessionMonthIndex();
    expect(index).toEqual([{ yearMonth: MONTH, sessionCount: 5, totalVolume: 1220 }]);
    // 170 (S1) + 450 (S5) + 600 (S6); S2's set 23 and S4's set 24 are gone.
  });

  // ─── getSessionWithSets / getSessionCompare: delegated reads ───

  it('getSessionWithSets refuses a tombstoned session and shows only live sets', async () => {
    await expect(progress.getSessionWithSets(S_TOMB)).resolves.toBeNull();

    const detail = await progress.getSessionWithSets(S_LIVE);
    expect(detail?.session.id).toBe(S_LIVE);
    expect(detail?.exercises.map((se) => se.id)).toEqual([SE_LIVE]);
    expect(detail?.exercises[0].sets.map((s) => s.id)).toEqual([SET_LIVE_1, SET_LIVE_2]);
  });

  it('getSessionCompare pairs the live session with a null tombstone', async () => {
    const compare = await progress.getSessionCompare(S_LIVE, S_TOMB);
    expect(compare.a?.session.id).toBe(S_LIVE);
    expect(compare.b).toBeNull();
  });

  // ─── getMostUsedExercises: INNER JOINs + a sets read ─

  it('getMostUsedExercises drops the tombstoned exercise and every tombstoned twin', async () => {
    const result = await progress.getMostUsedExercises();
    const rows = result
      .map((r) => [r.exerciseId, r.sessionCount, r.setCount, r.maxWeight])
      .sort((a, b) => (a[0] as number) - (b[0] as number));

    expect(rows).toEqual([
      [E_LIVE, 1, 2, 20], // SE11 under S1; sets 21/22 live, 25 tombstoned
      [E_OTHER, 1, 1, 60], // SE16 under S6; set 27 live
    ]);
    // E2 is tombstoned; E1's set 23 lives under a tombstoned session and set 24
    // under a tombstoned slot, so neither is reachable here.
  });

  // ─── getRoutineSessionsByPeriods: INNER JOINs ───────

  it('getRoutineSessionsByPeriods keeps only live/live/live/completed leaves', async () => {
    const push = await progress.getRoutineSessionsByPeriods(R_PUSH, [MONTH]);
    expect(push.map((r) => [r.sessionId, r.exerciseId, r.weight])).toEqual([
      [S_LIVE, E_LIVE, 10],
      [S_LIVE, E_LIVE, 20],
    ]);

    const pull = await progress.getRoutineSessionsByPeriods(R_PULL, [MONTH]);
    expect(pull.map((r) => [r.sessionId, r.exerciseId, r.weight])).toEqual([
      [S_OTHER, E_OTHER, 60],
    ]);
  });

  it('getRoutineSessionsByPeriods returns nothing for a period with no rows', async () => {
    await expect(progress.getRoutineSessionsByPeriods(R_PUSH, ['2025-12'])).resolves.toEqual([]);
    await expect(progress.getRoutineSessionsByPeriods(R_PUSH, [])).resolves.toEqual([]);
  });
});
