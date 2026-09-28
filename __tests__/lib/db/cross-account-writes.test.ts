/* eslint-disable @typescript-eslint/no-explicit-any */
import { CREATE_TABLES_SQL } from '../../../lib/db/ddl';

// Harness: the real database module over the driver that ships.
//
// The only thing faked is the native boundary — `expo-sqlite`'s `openDatabaseSync`
// returns a synchronous client backed by `node:sqlite` — so `lib/db/index` runs
// unmodified and every assertion below executes the SQL that ships through
// `drizzle-orm/expo-sqlite`, the session production uses. `foreign-keys.test.ts`
// and `orphan-cleanup.test.ts` use this same harness.
//
// This file used to replace `lib/db/index` with a `sqlite-proxy` database instead.
// That adapter resolves with promises, so no synchronous `db.transaction` callback
// could run under it: `duplicateSessionData` reads its source rows with `.all()` and
// iterates them, and on that adapter `.all()` yields a promise, so the loop threw
// `TypeError: sourceExercises is not iterable` before copying a single row. Only the
// refusal paths, which throw before the transaction opens, were representable. Here
// the converted (synchronous-callback) functions run their success paths too, which
// is the axis the N2 fix was about.
//
// FOREIGN-KEY STATE: production runs with `PRAGMA foreign_keys = ON` (U2 issues it at
// module scope in `lib/db/index`), so this file establishes ON explicitly and asserts
// it in the setup instead of inheriting `node:sqlite`'s own default. The declared
// `ON DELETE CASCADE` / `SET NULL` actions are therefore enforced here, exactly as on
// the device.
jest.mock('expo-sqlite', () => {
  const { DatabaseSync } = require('node:sqlite');
  const sqlite = new DatabaseSync(':memory:');
  const execSyncCalls: string[] = [];

  // Set explicitly, never inherited: `node:sqlite` happens to default this to 1,
  // while a shipping connection would be 0 if `lib/db/index` did not issue the
  // pragma itself.
  sqlite.exec('PRAGMA foreign_keys = ON');

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
            const rowList = statement.all(...params);
            return {
              changes: 0,
              lastInsertRowId: 0,
              getAllSync: () => rowList,
              getFirstSync: () => rowList[0],
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
          const rowList = statement.all(...params);
          return { getAllSync: () => rowList, getFirstSync: () => rowList[0] };
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

let sqlite: any;
let execSyncCalls: string[];

function count(sql: string, ...params: unknown[]): number {
  return sqlite.prepare(sql).get(...params).c;
}

function rows(sql: string, ...params: unknown[]): any[] {
  return sqlite.prepare(sql).all(...params);
}

function foreignKeysEnabled(): number {
  return sqlite.prepare('PRAGMA foreign_keys').get().foreign_keys;
}

const T0 = 1767225600000; // 2026-01-01T00:00:00Z
const T1 = 1767312000000; // 2026-01-02T00:00:00Z

/** A session + one session_exercise owned by `userId`. */
async function seedOwnedSessionExercise(userId: string, exerciseId = 1, at = T0) {
  setCurrentUserId(userId);
  const [session] = await queries.createSession({ startedAt: new Date(at) });
  await queries.addExerciseToSession({ sessionId: session.id, exerciseId, order: 0 });
  const [sessionExercise] = await queries.getSessionExercises(session.id);
  return { session, sessionExercise };
}

function insertSet(
  sessionExerciseId: number,
  options: { setNumber?: number; reps?: number; weight?: number; rir?: number | null; completed?: boolean } = {}
): void {
  const { setNumber = 1, reps = 8, weight = 100, rir = null, completed = false } = options;
  sqlite
    .prepare(
      'INSERT INTO sets (session_exercise_id, set_number, reps, weight, completed, rir, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .run(sessionExerciseId, setNumber, reps, weight, completed ? 1 : 0, rir, T0);
}

interface SeedOptions {
  exerciseId?: number;
  routineId?: number;
  reps?: number;
  weight?: number;
  rir?: number | null;
  notes?: string;
  completed?: boolean;
  at?: number;
}

/** A completed session with one exercise and one set, owned by `userId`. */
async function seedCompletedSession(userId: string, options: SeedOptions = {}) {
  const { exerciseId = 1, reps = 8, weight = 100, rir = null, notes, completed = true, at = T0 } = options;
  const data: { routineId?: number; startedAt: Date } = { startedAt: new Date(at) };
  if (options.routineId !== undefined) data.routineId = options.routineId;

  setCurrentUserId(userId);
  const [session] = await queries.createSession(data);
  await queries.addExerciseToSession({ sessionId: session.id, exerciseId, order: 0, notes });
  const [sessionExercise] = await queries.getSessionExercises(session.id);
  insertSet(sessionExercise.id, { reps, weight, rir, completed });
  await queries.completeSession(session.id, { completedAt: new Date(at) });
  return { session, sessionExercise };
}

describe('data layer cross-account gaps', () => {
  beforeAll(() => {
    sqlite = require('expo-sqlite').__sqlite;
    execSyncCalls = require('expo-sqlite').__execSyncCalls;

    // The state is production's, and it is asserted rather than assumed: the app
    // module issues the pragma itself at module scope (recorded by the fake client),
    // and the connection this file drives is enforcing it.
    expect(execSyncCalls).toContain('PRAGMA foreign_keys = ON');
    expect(foreignKeysEnabled()).toBe(1);

    sqlite.exec(CREATE_TABLES_SQL);
  });

  beforeEach(() => {
    // Children first: the connection enforces foreign keys, so parents cannot be
    // deleted while children still reference them.
    sqlite.exec(
      'DELETE FROM sets; DELETE FROM session_exercises; DELETE FROM sessions;' +
        'DELETE FROM routine_exercises; DELETE FROM routines; DELETE FROM routine_folders;' +
        'DELETE FROM body_measurements; DELETE FROM progress_photos; DELETE FROM exercises;' +
        'DELETE FROM categories;'
    );
    sqlite.exec(
      "INSERT INTO categories (id, name, color, icon, created_at) VALUES (1, 'Strength', '#fff', 'x', 0);"
    );
    // Shared exercise library (user_id NULL) referenced by the session children.
    sqlite.exec("INSERT INTO exercises (id, name, created_at) VALUES (1, 'Bench press', 0), (2, 'Squat', 0);");
    setCurrentUserId(null);
  });

  describe('write guards refuse a foreign parent and leave the table unchanged', () => {
    it("addExerciseToRoutine refuses another account's routine", async () => {
      setCurrentUserId('user-a');
      const [routine] = await queries.createRoutine({ name: 'A routine' });

      setCurrentUserId('user-b');
      await expect(
        queries.addExerciseToRoutine({ routineId: routine.id, exerciseId: 1, order: 0 })
      ).rejects.toThrow();
      expect(count('SELECT COUNT(*) AS c FROM routine_exercises')).toBe(0);
    });

    it("createSession refuses another account's routine", async () => {
      setCurrentUserId('user-a');
      const [routine] = await queries.createRoutine({ name: 'A routine' });

      setCurrentUserId('user-b');
      await expect(
        queries.createSession({ routineId: routine.id, startedAt: new Date(T0) })
      ).rejects.toThrow();
      expect(count('SELECT COUNT(*) AS c FROM sessions')).toBe(0);
    });

    it("createSet refuses another account's session exercise", async () => {
      const { sessionExercise } = await seedOwnedSessionExercise('user-a');

      setCurrentUserId('user-b');
      await expect(
        queries.createSet({ sessionExerciseId: sessionExercise.id, setNumber: 1, reps: 10, weight: 50 })
      ).rejects.toThrow();
      expect(count('SELECT COUNT(*) AS c FROM sets')).toBe(0);
    });

    it("createDropSets refuses another account's session exercise", async () => {
      const { sessionExercise } = await seedOwnedSessionExercise('user-a');

      setCurrentUserId('user-b');
      await expect(
        queries.createDropSets({
          sessionExerciseId: sessionExercise.id,
          setNumber: 1,
          drops: [{ reps: 8, weight: 40 }],
        })
      ).rejects.toThrow();
      expect(count('SELECT COUNT(*) AS c FROM sets')).toBe(0);
    });

    it("replaceDropSetGroup refuses another account's session exercise", async () => {
      const { sessionExercise } = await seedOwnedSessionExercise('user-a');
      insertSet(sessionExercise.id, { reps: 8, weight: 40 });

      setCurrentUserId('user-b');
      await expect(
        queries.replaceDropSetGroup({
          sessionExerciseId: sessionExercise.id,
          setNumber: 1,
          drops: [{ reps: 9, weight: 45 }],
        })
      ).rejects.toThrow();
      // The guard throws before the transaction deletes anything: A's set is intact.
      expect(count('SELECT COUNT(*) AS c FROM sets')).toBe(1);
      expect(count('SELECT COUNT(*) AS c FROM sets WHERE weight = 40')).toBe(1);
    });

    it('duplicateSessionData refuses when either session is foreign', async () => {
      const { session: sourceA } = await seedCompletedSession('user-a', { exerciseId: 1 });

      setCurrentUserId('user-b');
      const [targetB] = await queries.createSession({ startedAt: new Date(T1) });
      const beforeSe = count('SELECT COUNT(*) AS c FROM session_exercises');
      const beforeSets = count('SELECT COUNT(*) AS c FROM sets');

      // B cannot pull A's data in (source guard)…
      await expect(queries.duplicateSessionData(sourceA.id, targetB.id)).rejects.toThrow();
      // …and A cannot push its data into B's session (target guard).
      setCurrentUserId('user-a');
      await expect(queries.duplicateSessionData(sourceA.id, targetB.id)).rejects.toThrow();

      expect(count('SELECT COUNT(*) AS c FROM session_exercises')).toBe(beforeSe);
      expect(count('SELECT COUNT(*) AS c FROM sets')).toBe(beforeSets);
    });
  });

  // The owner-copy case that used to live in the block above was relocated to
  // `sync-transaction-atomicity.test.ts` on 2026-09-26, when this file still ran on
  // `sqlite-proxy` and could not execute `duplicateSessionData`'s synchronous
  // callback at all. The file is on the shipping driver now, so the cross-account
  // dimension of that copy is pinned here again; the atomicity dimension (one copied
  // set per copied exercise, rollback on a mid-callback failure) stays there to keep
  // the two suites from restating each other.
  describe('duplicateSessionData copies inside the owner account (converted sync callback)', () => {
    it("copies the owner's session into the owner's target and leaves the other account's data untouched", async () => {
      // `duplicateSessionData` is one of the functions whose transaction callback was
      // converted to be synchronous. The previous harness could not execute this path
      // at all: the callback loads the source slots with `.all()` and then iterates
      // them, and on the `sqlite-proxy` adapter `.all()` resolves with a promise, so
      // the loop threw `TypeError: sourceExercises is not iterable` before any row was
      // copied. Only the refusal arms above — which throw in `assertSessionOwned`
      // before the transaction opens — were representable on that adapter.
      const source = await seedCompletedSession('user-a', { exerciseId: 1, reps: 8, weight: 100 });
      const other = await seedCompletedSession('user-b', { exerciseId: 2, reps: 5, weight: 60 });

      const otherSlots = rows('SELECT * FROM session_exercises WHERE session_id = ?', other.session.id);
      const otherSets = rows(
        'SELECT s.* FROM sets s JOIN session_exercises se ON se.id = s.session_exercise_id WHERE se.session_id = ?',
        other.session.id
      );

      setCurrentUserId('user-a');
      const [target] = await queries.createSession({ startedAt: new Date(T1) });

      await queries.duplicateSessionData(source.session.id, target.id);

      // The copy landed in the owner's target, as new rows attached to each other.
      const copiedSlots = rows('SELECT * FROM session_exercises WHERE session_id = ?', target.id);
      expect(copiedSlots).toHaveLength(1);
      expect(copiedSlots[0].id).not.toBe(source.sessionExercise.id);
      expect(copiedSlots[0].exercise_id).toBe(1);

      const copiedSets = rows('SELECT * FROM sets WHERE session_exercise_id = ?', copiedSlots[0].id);
      expect(copiedSets).toHaveLength(1);
      expect(copiedSets[0].completed).toBe(0);

      // The source session still holds exactly what it held.
      expect(
        count('SELECT COUNT(*) AS c FROM session_exercises WHERE id = ?', source.sessionExercise.id)
      ).toBe(1);
      expect(
        count('SELECT COUNT(*) AS c FROM sets WHERE session_exercise_id = ?', source.sessionExercise.id)
      ).toBe(1);

      // The other account's session is untouched, down to its ids.
      expect(
        rows('SELECT * FROM session_exercises WHERE session_id = ?', other.session.id)
      ).toEqual(otherSlots);
      expect(
        rows(
          'SELECT s.* FROM sets s JOIN session_exercises se ON se.id = s.session_exercise_id WHERE se.session_id = ?',
          other.session.id
        )
      ).toEqual(otherSets);
      expect(otherSlots).toHaveLength(1);
      expect(otherSets).toHaveLength(1);
    });
  });

  describe('deleteSessionExercise cross-account', () => {
    it("removes the owner's sets through the declared CASCADE and leaves the other account's slot intact", async () => {
      const mine = await seedOwnedSessionExercise('user-a');
      insertSet(mine.sessionExercise.id);
      const theirs = await seedOwnedSessionExercise('user-b');
      insertSet(theirs.sessionExercise.id);

      setCurrentUserId('user-a');
      await queries.deleteSessionExercise(mine.sessionExercise.id);

      // `deleteSessionExercise` deletes only the `session_exercises` row; its sets go
      // through the declared `ON DELETE CASCADE`, which is real only while the pragma
      // is ON. With the pragma forced OFF this case fails here, which is what makes it
      // the file's evidence that the harness enforces the state it sets.
      expect(
        count('SELECT COUNT(*) AS c FROM session_exercises WHERE id = ?', mine.sessionExercise.id)
      ).toBe(0);
      expect(
        count('SELECT COUNT(*) AS c FROM sets WHERE session_exercise_id = ?', mine.sessionExercise.id)
      ).toBe(0);

      // The other account's slot and its set survive the ownership-scoped delete.
      expect(count('SELECT COUNT(*) AS c FROM session_exercises')).toBe(1);
      expect(count('SELECT COUNT(*) AS c FROM sets')).toBe(1);
      expect(
        count('SELECT COUNT(*) AS c FROM sets WHERE session_exercise_id = ?', theirs.sessionExercise.id)
      ).toBe(1);
    });
  });

  describe('deleteSession cross-account', () => {
    it("cannot delete another account's session or its children; the owner cascades", async () => {
      const { session, sessionExercise } = await seedOwnedSessionExercise('user-a');
      insertSet(sessionExercise.id);

      // B tries to delete A's session: nothing happens.
      setCurrentUserId('user-b');
      await queries.deleteSession(session.id);
      expect(count('SELECT COUNT(*) AS c FROM sessions')).toBe(1);
      expect(count('SELECT COUNT(*) AS c FROM session_exercises')).toBe(1);
      expect(count('SELECT COUNT(*) AS c FROM sets')).toBe(1);

      // The owner deletes: sets → session_exercises → sessions.
      setCurrentUserId('user-a');
      await queries.deleteSession(session.id);
      expect(count('SELECT COUNT(*) AS c FROM sessions WHERE deleted_at IS NOT NULL')).toBe(1);
      expect(
        count('SELECT COUNT(*) AS c FROM session_exercises WHERE deleted_at IS NOT NULL')
      ).toBe(1);
      expect(count('SELECT COUNT(*) AS c FROM sets WHERE deleted_at IS NOT NULL')).toBe(1);
    });
  });

  describe('reads stay inside the active account', () => {
    it('getActiveSession', async () => {
      setCurrentUserId('user-a');
      const [active] = await queries.createSession({ startedAt: new Date(T0) });
      expect((await queries.getActiveSession())?.id).toBe(active.id);

      setCurrentUserId('user-b');
      expect(await queries.getActiveSession()).toBeNull();

      setCurrentUserId(null);
      expect(await queries.getActiveSession()).toBeNull();
    });

    it('getLastSetsForExercise', async () => {
      await seedCompletedSession('user-a', { exerciseId: 1, reps: 8, weight: 100 });

      setCurrentUserId('user-a');
      const own = await queries.getLastSetsForExercise(1);
      expect(own).toHaveLength(1);
      expect(own?.[0].weight).toBe(100);

      setCurrentUserId('user-b');
      expect(await queries.getLastSetsForExercise(1)).toBeNull();
    });

    it('getLastSetsPerExercise', async () => {
      await seedCompletedSession('user-a', { exerciseId: 1, reps: 8, weight: 100 });

      setCurrentUserId('user-a');
      const own = await queries.getLastSetsPerExercise([1, 2]);
      expect(own[1]).toHaveLength(1);
      expect(own[1]?.[0].weight).toBe(100);
      expect(own[2]).toBeNull();

      setCurrentUserId('user-b');
      const other = await queries.getLastSetsPerExercise([1]);
      expect(other[1]).toBeNull();
    });

    it('getLastNotesByExerciseIds', async () => {
      await seedCompletedSession('user-a', { exerciseId: 1, notes: 'Seat height 4' });

      setCurrentUserId('user-a');
      expect((await queries.getLastNotesByExerciseIds([1]))[1]).toBe('Seat height 4');

      setCurrentUserId('user-b');
      expect(await queries.getLastNotesByExerciseIds([1])).toEqual({});
    });

    it('getExerciseSessions', async () => {
      await seedCompletedSession('user-a', { exerciseId: 1, reps: 8, weight: 100 });

      setCurrentUserId('user-a');
      const own = await queries.getExerciseSessions(1);
      expect(own).toHaveLength(1);
      expect(own[0].volume).toBe(800);
      expect(own[0].completedSets).toBe(1);

      setCurrentUserId('user-b');
      expect(await queries.getExerciseSessions(1)).toEqual([]);
    });

    it('getExerciseProgressionData', async () => {
      await seedCompletedSession('user-a', { exerciseId: 1, reps: 8, weight: 100, rir: 2 });

      setCurrentUserId('user-a');
      const own = await queries.getExerciseProgressionData(1);
      expect(own).toHaveLength(1);
      expect(own[0].avgWeight).toBe(100);
      expect(own[0].avgReps).toBe(8);
      expect(own[0].avgRir).toBe(2);

      setCurrentUserId('user-b');
      expect(await queries.getExerciseProgressionData(1)).toEqual([]);
    });

    it('getLastRirByRoutineExerciseIds', async () => {
      setCurrentUserId('user-a');
      const [routine] = await queries.createRoutine({ name: 'A routine' });
      await seedCompletedSession('user-a', {
        routineId: routine.id,
        exerciseId: 1,
        reps: 8,
        weight: 100,
        rir: 2,
      });

      expect((await queries.getLastRirByRoutineExerciseIds(routine.id, [1]))[1]?.[1]).toBe(2);

      setCurrentUserId('user-b');
      expect(await queries.getLastRirByRoutineExerciseIds(routine.id, [1])).toEqual({});
    });
  });
});
