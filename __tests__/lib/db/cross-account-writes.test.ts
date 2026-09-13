import { CREATE_TABLES_SQL } from '../../../lib/db/ddl';

// Same real-SQLite harness as `user-scope.test.ts`: the only module replaced is
// `lib/db/index`, rewired to drizzle's sqlite-proxy over `node:sqlite`, so every
// assertion below runs the SQL that ships instead of a mocked query chain.
jest.mock('../../../lib/db/index', () => {
  const { DatabaseSync } = require('node:sqlite');
  const { drizzle } = require('drizzle-orm/sqlite-proxy');

  const sqlite = new DatabaseSync(':memory:');
  const db = drizzle((sql: string, params: unknown[], method: string) => {
    const statement = sqlite.prepare(sql);
    if (method === 'run') {
      statement.run(...params);
      return Promise.resolve({ rows: [] });
    }
    statement.setReturnArrays(true);
    const rows = statement.all(...params);
    return Promise.resolve(method === 'get' ? { rows: rows[0] } : { rows });
  });

  return { __esModule: true, db, __sqlite: sqlite, initializeDatabase: jest.fn() };
});

import * as queries from '../../../lib/db/queries';
import { setCurrentUserId } from '../../../lib/db/user-scope';

/* eslint-disable @typescript-eslint/no-explicit-any */
let sqlite: any;

function count(sql: string): number {
  return sqlite.prepare(sql).get().c;
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
    sqlite = require('../../../lib/db/index').__sqlite;
    sqlite.exec(CREATE_TABLES_SQL);
  });

  beforeEach(() => {
    // Children first so this works even if a connection enables FK enforcement.
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

    it('duplicateSessionData copies rows for the owner (transaction path works)', async () => {
      const { session: source, sessionExercise } = await seedCompletedSession('user-a', {
        exerciseId: 1,
        reps: 6,
        weight: 90,
      });
      insertSet(sessionExercise.id, { setNumber: 2, reps: 6, weight: 95, completed: true });

      const [target] = await queries.createSession({ startedAt: new Date(T1) });
      await queries.duplicateSessionData(source.id, target.id);

      // source (1 SE / 2 sets) + target (1 SE / 2 sets)
      expect(count('SELECT COUNT(*) AS c FROM session_exercises')).toBe(2);
      expect(count('SELECT COUNT(*) AS c FROM sets')).toBe(4);
      expect(count(`SELECT COUNT(*) AS c FROM session_exercises WHERE session_id = ${target.id}`)).toBe(1);
      expect(count(`SELECT COUNT(*) AS c FROM sets WHERE completed = 0`)).toBe(2);
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
      expect(count('SELECT COUNT(*) AS c FROM sessions')).toBe(0);
      expect(count('SELECT COUNT(*) AS c FROM session_exercises')).toBe(0);
      expect(count('SELECT COUNT(*) AS c FROM sets')).toBe(0);
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
