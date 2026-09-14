import { CREATE_TABLES_SQL } from '../../../lib/db/ddl';

// This suite runs the REAL lib/db layer against a real in-memory SQLite database.
// `lib/db/index` is the only module replaced: it is rewired to drizzle's
// sqlite-proxy driver over node:sqlite, so the queries under test execute the same
// SQL that ships instead of a mocked query chain. That is the only way to actually
// verify that one account cannot read another account's rows.
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
import * as progressQueries from '../../../lib/progress/queries';
import { getCurrentUserId, setCurrentUserId } from '../../../lib/db/user-scope';
import { DEFAULT_TARGET_SETS } from '../../../lib/constants/routine-defaults';

/* eslint-disable @typescript-eslint/no-explicit-any */
let sqlite: any;

function rawRows(sql: string): any[] {
  return sqlite.prepare(sql).all();
}

function rawCount(sql: string): number {
  return sqlite.prepare(sql).get().c;
}

describe('user scoping', () => {
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
    // node:sqlite enforces foreign keys, so exercises need a category to reference.
    sqlite.exec(
      "INSERT INTO categories (id, name, color, icon, created_at) VALUES (1, 'Strength', '#fff', 'x', 0);"
    );
    setCurrentUserId(null);
  });

  it('does not expose user A rows to user B (sessions, routines, measurements, photos)', async () => {
    setCurrentUserId('user-a');
    await queries.createSession({ startedAt: new Date('2026-01-01') });
    await queries.createRoutine({ name: 'A routine' });
    await queries.createBodyMeasurement({ date: new Date('2026-01-02'), weight: 80 });
    await queries.createProgressPhoto({ date: new Date('2026-01-03'), uri: 'file:///a.jpg' });

    // Account A sees exactly its own rows.
    expect(await queries.getAllSessions()).toHaveLength(1);
    expect(await queries.getAllRoutines()).toHaveLength(1);
    expect(await queries.getBodyMeasurements()).toHaveLength(1);
    expect(await queries.getProgressPhotos()).toHaveLength(1);

    // Account B sees none of them.
    setCurrentUserId('user-b');
    expect(await queries.getAllSessions()).toHaveLength(0);
    expect(await queries.getAllRoutines()).toHaveLength(0);
    expect(await queries.getBodyMeasurements()).toHaveLength(0);
    expect(await queries.getProgressPhotos()).toHaveLength(0);
  });

  it('keeps A rows after B signs in and out (no data loss)', async () => {
    setCurrentUserId('user-a');
    await queries.createSession({ startedAt: new Date('2026-02-01') });

    setCurrentUserId('user-b');
    await queries.createSession({ startedAt: new Date('2026-02-02') });
    expect(await queries.getAllSessions()).toHaveLength(1);

    setCurrentUserId(null); // B signs out — rows stay on disk

    setCurrentUserId('user-a');
    expect(await queries.getAllSessions()).toHaveLength(1);

    setCurrentUserId('user-b');
    expect(await queries.getAllSessions()).toHaveLength(1);
  });

  it('stamps the active user id on inserts', async () => {
    setCurrentUserId('user-a');
    await queries.createSession({ startedAt: new Date() });
    await queries.createRoutine({ name: 'r' });
    await queries.createFolder({ name: 'f' });
    await queries.createBodyMeasurement({ date: new Date() });
    await queries.createProgressPhoto({ date: new Date(), uri: 'file:///a.jpg' });
    await queries.createExercise({ name: 'Custom move', categoryId: 1 });

    expect(rawCount("SELECT COUNT(*) AS c FROM sessions WHERE user_id = 'user-a'")).toBe(1);
    expect(rawCount("SELECT COUNT(*) AS c FROM routines WHERE user_id = 'user-a'")).toBe(1);
    expect(rawCount("SELECT COUNT(*) AS c FROM routine_folders WHERE user_id = 'user-a'")).toBe(1);
    expect(rawCount("SELECT COUNT(*) AS c FROM body_measurements WHERE user_id = 'user-a'")).toBe(1);
    expect(rawCount("SELECT COUNT(*) AS c FROM progress_photos WHERE user_id = 'user-a'")).toBe(1);
    expect(rawCount("SELECT COUNT(*) AS c FROM exercises WHERE user_id = 'user-a'")).toBe(1);

    // The shared exercise library is never stamped.
    expect(rawCount('SELECT COUNT(*) AS c FROM exercises WHERE user_id IS NULL')).toBe(0);
  });

  it('claims pre-existing NULL rows for the first account and is idempotent', async () => {
    // Simulate rows written before user scoping existed.
    sqlite.exec(
      "INSERT INTO sessions (user_id, started_at) VALUES (NULL, 1767225600);" +
        "INSERT INTO routines (user_id, name, created_at) VALUES (NULL, 'legacy routine', 1767225600);" +
        "INSERT INTO routine_folders (user_id, name, created_at) VALUES (NULL, 'legacy folder', 1767225600);" +
        "INSERT INTO body_measurements (user_id, date, created_at) VALUES (NULL, 1767225600, 1767225600);" +
        "INSERT INTO progress_photos (user_id, date, uri, created_at) VALUES (NULL, 1767225600, 'file:///legacy.jpg', 1767225600);"
    );

    setCurrentUserId('user-a');
    await queries.claimLegacyRows();

    // The first account adopts every legacy row.
    expect(await queries.getAllSessions()).toHaveLength(1);
    expect(await queries.getAllRoutines()).toHaveLength(1);
    expect(await queries.getBodyMeasurements()).toHaveLength(1);
    expect(await queries.getProgressPhotos()).toHaveLength(1);
    expect(rawCount('SELECT COUNT(*) AS c FROM sessions WHERE user_id IS NULL')).toBe(0);

    // Second run claims nothing new — the rows keep the id they already have.
    const before = rawRows('SELECT user_id FROM sessions');
    await queries.claimLegacyRows();
    expect(rawRows('SELECT user_id FROM sessions')).toEqual(before);
  });

  it('claims pre-scoping custom exercises but leaves the seeded library shared', async () => {
    // Rows written before user scoping existed. Only the seeded library row carries
    // an original_id; a user-invented custom exercise has original_id NULL.
    sqlite.exec(
      "INSERT INTO exercises (user_id, name, original_id, created_at) VALUES (NULL, 'My invented move', NULL, 1767225600);" +
        "INSERT INTO exercises (user_id, name, original_id, created_at) VALUES (NULL, 'Bench press', 'dataset-1', 1767225600);"
    );

    setCurrentUserId('user-a');
    await queries.claimLegacyRows();

    // The custom row is adopted by the first account; the seeded row stays shared.
    expect(
      rawCount("SELECT COUNT(*) AS c FROM exercises WHERE user_id = 'user-a' AND original_id IS NULL")
    ).toBe(1);
    expect(
      rawCount('SELECT COUNT(*) AS c FROM exercises WHERE user_id IS NULL AND original_id IS NOT NULL')
    ).toBe(1);

    // B must not see A's custom exercise, but still sees the shared library.
    setCurrentUserId('user-b');
    const names = (await queries.getAllExercises()).map((e) => e.name);
    expect(names).toContain('Bench press');
    expect(names).not.toContain('My invented move');
  });

  it('repairs routine target defaults only inside the active account', async () => {
    sqlite.exec("INSERT INTO exercises (id, name, created_at) VALUES (1, 'Bench press', 0);");

    // A and B each own a routine whose template row has the buggy target_sets = 1.
    setCurrentUserId('user-a');
    const [routineA] = await queries.createRoutine({ name: 'A routine' });
    await queries.addExerciseToRoutine({
      routineId: routineA.id,
      exerciseId: 1,
      order: 0,
      targetSets: 1,
    });

    setCurrentUserId('user-b');
    const [routineB] = await queries.createRoutine({ name: 'B routine' });
    await queries.addExerciseToRoutine({
      routineId: routineB.id,
      exerciseId: 1,
      order: 0,
      targetSets: 1,
    });

    // B is the active account: the repair may touch B's row only.
    await queries.repairRoutineTargetDefaults();

    const targetSetsFor = (userId: string): number =>
      rawRows(
        `SELECT re.target_sets AS target_sets FROM routine_exercises re JOIN routines r ON r.id = re.routine_id WHERE r.user_id = '${userId}'`
      )[0].target_sets;
    expect(targetSetsFor('user-b')).toBe(DEFAULT_TARGET_SETS);
    expect(targetSetsFor('user-a')).toBe(1);
  });

  it('scopes session children through the owning session and refuses foreign writes', async () => {
    setCurrentUserId('user-a');
    const [session] = await queries.createSession({ startedAt: new Date() });
    // Shared library exercise (user_id NULL) for the session child to reference.
    sqlite.exec("INSERT INTO exercises (id, name, created_at) VALUES (1, 'Bench press', 0);");
    await queries.addExerciseToSession({ sessionId: session.id, exerciseId: 1, order: 0 });

    expect(await queries.getSessionExercises(session.id)).toHaveLength(1);
    expect(await queries.getSessionExercisesWithSets(session.id)).toHaveLength(1);

    setCurrentUserId('user-b');
    expect(await queries.getSessionExercises(session.id)).toHaveLength(0);
    expect(await queries.getSessionExercisesWithSets(session.id)).toHaveLength(0);
    await expect(
      queries.addExerciseToSession({ sessionId: session.id, exerciseId: 2, order: 1 })
    ).rejects.toThrow();
        expect(rawCount('SELECT COUNT(*) AS c FROM session_exercises')).toBe(1);
      });

      it('keeps aggregate reads inside the active account', async () => {
        // Regression: these paths correlate ownership with a subquery on the SAME
        // table they read from, which makes the EXISTS a tautology (`id = id`) and
        // lets one account's statistics include another account's sets.
        sqlite.exec("INSERT INTO exercises (id, name, created_at) VALUES (1, 'Bench press', 0);");

        const logSet = async (userId: string, weight: number, at: number) => {
          setCurrentUserId(userId);
          const [session] = await queries.createSession({ startedAt: new Date(at) });
          await queries.addExerciseToSession({ sessionId: session.id, exerciseId: 1, order: 0 });
          const [sessionExercise] = await queries.getSessionExercises(session.id);
          sqlite
            .prepare(
              'INSERT INTO sets (session_exercise_id, set_number, reps, weight, completed, created_at) VALUES (?, 1, 10, ?, 1, ?)'
            )
            .run(sessionExercise.id, weight, at);
        };

        await logSet('user-a', 100, 1767225600);
        await logSet('user-b', 50, 1767325600);

        // B is active: no aggregate may include A's 100 kg set.
        expect(await queries.getSetsByExerciseId(1)).toHaveLength(1);
        expect((await queries.getExerciseStats(1)).maxWeight).toBe(50);
        expect((await queries.getMaxWeightByExerciseIds([1]))[1]).toBe(50);
        expect((await queries.getLastWeightByExerciseIds([1]))[1]?.weight).toBe(50);
        expect((await queries.getExercisePRs(1)).maxWeight?.value).toBe(50);

        // A still sees their own.
        setCurrentUserId('user-a');
        expect((await queries.getExerciseStats(1)).maxWeight).toBe(100);

        // Signed out: nothing at all.
        setCurrentUserId(null);
        expect(await queries.getSetsByExerciseId(1)).toHaveLength(0);
        expect((await queries.getExerciseStats(1)).maxWeight).toBeNull();
      });

      it('keeps the most-used ranking inside the active account', async () => {
        // lib/progress/queries.ts had no coverage at all, which is how a second
        // tautological ownership filter survived there while the same bug class was
        // being fixed in lib/db/queries.ts.
        sqlite.exec("INSERT INTO exercises (id, name, created_at) VALUES (1, 'Bench press', 0);");

        const logCompletedSession = async (userId: string, weight: number, at: number) => {
          setCurrentUserId(userId);
          const [session] = await queries.createSession({ startedAt: new Date(at) });
          await queries.addExerciseToSession({ sessionId: session.id, exerciseId: 1, order: 0 });
          const [sessionExercise] = await queries.getSessionExercises(session.id);
          sqlite
            .prepare(
              'INSERT INTO sets (session_exercise_id, set_number, reps, weight, completed, created_at) VALUES (?, 1, 10, ?, 1, ?)'
            )
            .run(sessionExercise.id, weight, at);
          await queries.completeSession(session.id, { completedAt: new Date(at) });
        };

        await logCompletedSession('user-a', 100, 1767225600);
        await logCompletedSession('user-b', 50, 1767325600);

        // B's ranking must not fold in A's 100 kg set.
        setCurrentUserId('user-b');
        const [mostUsedB] = await progressQueries.getMostUsedExercises(6);
        expect(mostUsedB.setCount).toBe(1);
        expect(mostUsedB.maxWeight).toBe(50);

        setCurrentUserId('user-a');
        const [mostUsedA] = await progressQueries.getMostUsedExercises(6);
        expect(mostUsedA.setCount).toBe(1);
        expect(mostUsedA.maxWeight).toBe(100);

        setCurrentUserId(null);
        expect(await progressQueries.getMostUsedExercises(6)).toEqual([]);
      });

  it('returns no owned rows while signed out', async () => {
    setCurrentUserId('user-a');
    await queries.createSession({ startedAt: new Date() });
    setCurrentUserId(null);
    expect(getCurrentUserId()).toBeNull();
    expect(await queries.getAllSessions()).toHaveLength(0);
  });

  it('wipes only the deleted account on delete-account', async () => {
    setCurrentUserId('user-a');
    await queries.createSession({ startedAt: new Date('2026-03-01') });
    await queries.createRoutine({ name: 'A routine' });
    await queries.createBodyMeasurement({ date: new Date('2026-03-02') });
    await queries.createProgressPhoto({ date: new Date('2026-03-03'), uri: 'file:///a.jpg' });

    setCurrentUserId('user-b');
    await queries.createSession({ startedAt: new Date('2026-03-04') });
    await queries.createRoutine({ name: 'B routine' });
    await queries.createBodyMeasurement({ date: new Date('2026-03-05') });
    await queries.createProgressPhoto({ date: new Date('2026-03-06'), uri: 'file:///b.jpg' });

    const deletedPhotoUris = await queries.deleteUserLocalData('user-a');
    expect(deletedPhotoUris).toEqual(['file:///a.jpg']);

    // A is gone…
    setCurrentUserId('user-a');
    expect(await queries.getAllSessions()).toHaveLength(0);
    expect(await queries.getAllRoutines()).toHaveLength(0);
    expect(await queries.getBodyMeasurements()).toHaveLength(0);
    expect(await queries.getProgressPhotos()).toHaveLength(0);

    // …B is untouched.
    setCurrentUserId('user-b');
    expect(await queries.getAllSessions()).toHaveLength(1);
    expect(await queries.getAllRoutines()).toHaveLength(1);
    expect(await queries.getBodyMeasurements()).toHaveLength(1);
    expect(await queries.getProgressPhotos()).toHaveLength(1);
  });
});
