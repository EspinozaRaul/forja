/* eslint-disable @typescript-eslint/no-explicit-any */
import { CREATE_TABLES_SQL } from '../../../lib/db/ddl';

// U2c — the `routine_exercises` write paths mint cross-system identity.
//
// Each INSERT into `routine_exercises` must write `uuid` (from `lib/db/identity`),
// `created_at` and `updated_at`; each UPDATE must bump `updated_at` without
// rewriting `uuid`/`created_at`. This table had no `created_at` before U2a, so the
// insert path has to mint it rather than rely on a column default.
//
// The harness mirrors `routines-identity.test.ts` and `sets-identity.test.ts`:
// only the native `expo-sqlite` module boundary is faked over a real
// `node:sqlite` database, and the real `lib/db/index` module runs unmodified.
// `expo-crypto` is a native module too, so `uuid()` is backed by a deterministic
// unique generator (the assertions care that uuids are present, non-null and
// stable, not what they contain).
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

  // Start OFF, exactly as the shipping driver does on both platforms.
  sqlite.exec('PRAGMA foreign_keys = OFF');

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

interface RoutineExerciseIdentity {
  uuid: string | null;
  created_at: number | null;
  updated_at: number | null;
}

/** Reads the identity columns of one `routine_exercises` row. */
function routineExerciseIdentity(id: number): RoutineExerciseIdentity | undefined {
  const row = sqlite
    .prepare('SELECT uuid, created_at, updated_at FROM routine_exercises WHERE id = ?')
    .get(id);
  return row === undefined ? undefined : { ...row };
}

/** Pins one row's identity timestamps into the past so bumps are observable. */
function pinTimestamps(id: number, value: number): void {
  sqlite
    .prepare('UPDATE routine_exercises SET created_at = ?, updated_at = ? WHERE id = ?')
    .run(value, value, id);
}

/** Seeds a routine owned by `OWNER` and returns its id. */
async function seedRoutine(): Promise<number> {
  const [routine] = await queries.createRoutine({ name: 'Push day' });
  return routine.id;
}

describe('routine_exercises write paths mint identity (U2c)', () => {
  beforeAll(() => {
    sqlite.exec(CREATE_TABLES_SQL);
  });

  beforeEach(() => {
    sqlite.exec(
      'DELETE FROM sets; DELETE FROM session_exercises; DELETE FROM sessions;' +
        'DELETE FROM routine_exercises; DELETE FROM routines; DELETE FROM routine_folders;' +
        'DELETE FROM body_measurements; DELETE FROM progress_photos; DELETE FROM exercises;' +
        'DELETE FROM categories;'
    );
    sqlite.exec("INSERT INTO exercises (id, name, created_at) VALUES (1, 'Bench press', 0);");
    sqlite.exec("INSERT INTO exercises (id, name, created_at) VALUES (2, 'Incline press', 0);");
    setCurrentUserId(OWNER);
  });

  it('addExerciseToRoutine writes uuid, created_at and updated_at', async () => {
    const routineId = await seedRoutine();
    const [created] = await queries.addExerciseToRoutine({
      routineId,
      exerciseId: 1,
      order: 0,
    });

    const stored = routineExerciseIdentity(created.id);
    expect(stored?.uuid).toEqual(expect.any(String));
    expect(stored?.uuid).not.toHaveLength(0);
    expect(stored?.created_at).toBeGreaterThan(0);
    expect(stored?.updated_at).toBeGreaterThan(0);
  });

  it('updateRoutineExerciseOrder moves updated_at and leaves uuid/created_at unchanged', async () => {
    const routineId = await seedRoutine();
    const [created] = await queries.addExerciseToRoutine({
      routineId,
      exerciseId: 1,
      order: 0,
    });
    const before = routineExerciseIdentity(created.id);
    expect(before?.uuid).toEqual(expect.any(String));

    // Pinned into the past first, so the bump is observable without depending on
    // the wall clock crossing a whole second between two calls.
    pinTimestamps(created.id, 1);

    await queries.updateRoutineExerciseOrder(created.id, 5);
    const after = routineExerciseIdentity(created.id);

    expect(after?.uuid).toBe(before?.uuid);
    expect(after?.created_at).toBe(1);
    expect(after?.updated_at).toBeGreaterThan(1);
  });

  it('updateRoutineExerciseTargets moves updated_at and leaves uuid/created_at unchanged', async () => {
    const routineId = await seedRoutine();
    const [created] = await queries.addExerciseToRoutine({
      routineId,
      exerciseId: 1,
      order: 0,
    });
    const before = routineExerciseIdentity(created.id);

    pinTimestamps(created.id, 1);

    await queries.updateRoutineExerciseTargets(created.id, { targetSets: 4, targetReps: 6 });
    const after = routineExerciseIdentity(created.id);

    expect(after?.uuid).toBe(before?.uuid);
    expect(after?.created_at).toBe(1);
    expect(after?.updated_at).toBeGreaterThan(1);
  });

  it('replaceRoutineExercise keeps the row identity and bumps updated_at', async () => {
    const routineId = await seedRoutine();
    const [created] = await queries.addExerciseToRoutine({
      routineId,
      exerciseId: 1,
      order: 0,
    });
    const before = routineExerciseIdentity(created.id);
    expect(before?.uuid).toEqual(expect.any(String));

    pinTimestamps(created.id, 1);

    // `replaceRoutineExercise` swaps the exercise inside an existing slot: it is
    // an UPDATE, so the row keeps its `uuid`/`created_at` and only `updated_at`
    // moves. The `exercises` swap is the mutation under test.
    await queries.replaceRoutineExercise(created.id, 2);
    const after = routineExerciseIdentity(created.id);

    expect(after?.uuid).toBe(before?.uuid);
    expect(after?.created_at).toBe(1);
    expect(after?.updated_at).toBeGreaterThan(1);
    expect(
      sqlite.prepare('SELECT exercise_id FROM routine_exercises WHERE id = ?').get(created.id)
        .exercise_id
    ).toBe(2);
  });

  it('repairRoutineTargetDefaults repairs damaged targets and bumps only the repaired rows', async () => {
    const routineId = await seedRoutine();
    // One row per repair clause, each matching exactly one WHERE clause, so a
    // missing `updatedAt` in any single repair turns this test red (a row that
    // matched two clauses would be bumped by the other one and hide the gap).
    const [lowSets] = await queries.addExerciseToRoutine({
      routineId,
      exerciseId: 1,
      order: 0,
      targetSets: 1,
      targetReps: 10,
    });
    const [nullSets] = await queries.addExerciseToRoutine({
      routineId,
      exerciseId: 2,
      order: 1,
      targetSets: 3,
      targetReps: 10,
    });
    const [nullReps] = await queries.addExerciseToRoutine({
      routineId,
      exerciseId: 1,
      order: 2,
      targetSets: 3,
      targetReps: 10,
    });
    const [zeroReps] = await queries.addExerciseToRoutine({
      routineId,
      exerciseId: 2,
      order: 3,
      targetSets: 3,
      targetReps: 0,
    });
    const [healthy] = await queries.addExerciseToRoutine({
      routineId,
      exerciseId: 1,
      order: 4,
      targetSets: 3,
      targetReps: 10,
    });

    // Reach the two IS NULL clauses, which a typed insert cannot express.
    sqlite.prepare('UPDATE routine_exercises SET target_sets = NULL WHERE id = ?').run(nullSets.id);
    sqlite.prepare('UPDATE routine_exercises SET target_reps = NULL WHERE id = ?').run(nullReps.id);

    const damaged = [lowSets, nullSets, nullReps, zeroReps];
    // Pin every row into the past so the bump is observable without depending on
    // the wall clock crossing a whole second between two calls.
    for (const row of [...damaged, healthy]) pinTimestamps(row.id, 1);

    await queries.repairRoutineTargetDefaults();

    for (const row of damaged) {
      const repaired = sqlite
        .prepare('SELECT target_sets, target_reps FROM routine_exercises WHERE id = ?')
        .get(row.id) as { target_sets: number; target_reps: number };
      expect(repaired.target_sets).toBe(3);
      expect(repaired.target_reps).toBe(10);
      expect(routineExerciseIdentity(row.id)?.updated_at).toBeGreaterThan(1);
    }

    // The healthy row matched no repair WHERE clause, so its updated_at is untouched.
    expect(routineExerciseIdentity(healthy.id)?.updated_at).toBe(1);
  });
});
