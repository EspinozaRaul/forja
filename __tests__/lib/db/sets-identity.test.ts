/* eslint-disable @typescript-eslint/no-explicit-any */
import { CREATE_TABLES_SQL } from '../../../lib/db/ddl';

// U2c — the `sets` write paths mint cross-system identity.
//
// Each INSERT into `sets` must write a `uuid` (from `lib/db/identity`) and an
// `updated_at`; each UPDATE must bump `updated_at` without rewriting `uuid`.
// `duplicateSessionData` copies a session's sets, so its copies must get NEW
// uuids, never the source row's — otherwise the copy and its origin collapse to
// one row on the remote side.
//
// The harness mirrors `foreign-keys.test.ts`: only the native `expo-sqlite`
// module boundary is faked over a real `node:sqlite` database, and the real
// `lib/db/index` module runs unmodified. `expo-crypto` is a native module too,
// so `uuid()` is backed by a deterministic unique generator (the assertions care
// that uuids are present, non-null and distinct, not what they contain).
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

/** Reads the identity columns of one `sets` row, or undefined if it is gone. */
function setIdentity(id: number): { uuid: string | null; updated_at: number | null } | undefined {
  const row = sqlite.prepare('SELECT uuid, updated_at FROM sets WHERE id = ?').get(id);
  return row === undefined ? undefined : { ...row };
}

function sessionExerciseRow(id: number): { id: number } | undefined {
  const row = sqlite.prepare('SELECT id FROM session_exercises WHERE id = ?').get(id);
  return row === undefined ? undefined : { ...row };
}

function setIdsOf(sessionExerciseId: number): number[] {
  return (
    sqlite
      .prepare('SELECT id FROM sets WHERE session_exercise_id = ? ORDER BY id')
      .all(sessionExerciseId) as any[]
  ).map((row) => row.id);
}

describe('sets write paths mint identity (U2c)', () => {
  beforeAll(() => {
    sqlite.exec(CREATE_TABLES_SQL);
  });

  beforeEach(() => {
    sqlite.exec(
      'DELETE FROM sets; DELETE FROM session_exercises; DELETE FROM sessions;' +
        'DELETE FROM exercises; DELETE FROM categories;'
    );
    sqlite.exec(
      "INSERT INTO categories (id, name, color, icon, created_at) VALUES (1, 'Strength', '#fff', 'x', 0);"
    );
    sqlite.exec("INSERT INTO exercises (id, name, created_at) VALUES (1, 'Bench press', 0);");
    sqlite
      .prepare('INSERT INTO sessions (id, user_id, started_at) VALUES (?, ?, ?)')
      .run(1, OWNER, 0);
    sqlite
      .prepare(
        'INSERT INTO session_exercises (id, session_id, exercise_id, "order") VALUES (?, ?, ?, ?)'
      )
      .run(1, 1, 1, 0);
    setCurrentUserId(OWNER);
  });

  it('createSet writes a non-null uuid and a positive updated_at', async () => {
    const [created] = await queries.createSet({
      sessionExerciseId: 1,
      setNumber: 1,
      reps: 8,
      weight: 100,
    });

    const stored = setIdentity(created.id);
    expect(stored?.uuid).toEqual(expect.any(String));
    expect(stored?.uuid).not.toHaveLength(0);
    expect(stored?.updated_at).toBeGreaterThan(0);
  });

  it('createDropSets writes a distinct non-null uuid per row', async () => {
    const rows = await queries.createDropSets({
      sessionExerciseId: 1,
      setNumber: 1,
      drops: [
        { reps: 8, weight: 100 },
        { reps: 6, weight: 80 },
        { reps: 4, weight: 60 },
      ],
    });

    expect(rows).toHaveLength(3);
    const uuids = rows.map((row) => setIdentity(row.id)?.uuid);
    for (const uuid of uuids) {
      expect(uuid).toEqual(expect.any(String));
      expect(uuid).not.toHaveLength(0);
    }
    expect(new Set(uuids).size).toBe(3);
  });

  it('updateSet leaves uuid unchanged and moves updated_at forward', async () => {
    const [created] = await queries.createSet({
      sessionExerciseId: 1,
      setNumber: 1,
      reps: 8,
      weight: 100,
    });
    const before = setIdentity(created.id);
    expect(before?.uuid).toEqual(expect.any(String));

    // Pin the stored timestamp into the past so the bump is observable without
    // depending on the wall clock crossing a whole second between the two calls.
    sqlite.prepare('UPDATE sets SET updated_at = ? WHERE id = ?').run(1, created.id);

    const [updated] = await queries.updateSet(created.id, { reps: 12 });
    const after = setIdentity(created.id);

    expect(updated.uuid).toBe(before?.uuid);
    expect(after?.uuid).toBe(before?.uuid);
    expect(after?.updated_at).toBeGreaterThan(1);
  });

  it('duplicateSessionData gives the copied sets uuids distinct from the source sets', async () => {
    const [sourceSet] = await queries.createSet({
      sessionExerciseId: 1,
      setNumber: 1,
      reps: 8,
      weight: 100,
    });
    const sourceUuid = setIdentity(sourceSet.id)?.uuid;
    expect(sourceUuid).toEqual(expect.any(String));

    sqlite
      .prepare('INSERT INTO sessions (id, user_id, started_at) VALUES (?, ?, ?)')
      .run(2, OWNER, 0);

    await queries.duplicateSessionData(1, 2);

    const targetExercise = sqlite
      .prepare('SELECT id FROM session_exercises WHERE session_id = ?')
      .get(2) as { id: number };
    const copied = setIdsOf(targetExercise.id);

    expect(copied).toHaveLength(1);
    const copiedUuid = setIdentity(copied[0])?.uuid;
    expect(copiedUuid).toEqual(expect.any(String));
    expect(copiedUuid).not.toBe(sourceUuid);
  });

  it('replaceDropSetGroup writes non-null uuids on the rows it inserts', async () => {
    const rows = await queries.replaceDropSetGroup({
      sessionExerciseId: 1,
      setNumber: 1,
      drops: [
        { reps: 8, weight: 100 },
        { reps: 6, weight: 80 },
      ],
    });

    expect(rows).toHaveLength(2);
    const uuids = rows.map((row) => setIdentity(row.id)?.uuid);
    for (const uuid of uuids) {
      expect(uuid).toEqual(expect.any(String));
      expect(uuid).not.toHaveLength(0);
    }
    expect(new Set(uuids).size).toBe(2);
  });

  it('createSuperSetPair writes a non-null uuid on the balance set it inserts', async () => {
    sqlite
      .prepare(
        'INSERT INTO session_exercises (id, session_id, exercise_id, "order") VALUES (?, ?, ?, ?)'
      )
      .run(2, 1, 1, 1);
    await queries.createSet({ sessionExerciseId: 1, setNumber: 1, reps: 8, weight: 100 });

    await queries.createSuperSetPair(1, 2);

    const inserted = setIdsOf(2);
    expect(inserted).toHaveLength(1);
    expect(setIdentity(inserted[0])?.uuid).toEqual(expect.any(String));
    expect(sessionExerciseRow(2)).toBeDefined();
  });

  it('replaceSessionExercise mints the rebuilt template uuids and bumps the moved sets', async () => {
    // The incoming exercise must exist: `index.ts` enables foreign keys.
    sqlite.exec("INSERT INTO exercises (id, name, created_at) VALUES (2, 'Squat', 0);");

    const [setA] = await queries.createSet({
      sessionExerciseId: 1,
      setNumber: 1,
      reps: 8,
      weight: 100,
    });
    const [setB] = await queries.createSet({
      sessionExerciseId: 1,
      setNumber: 2,
      reps: 10,
      weight: 80,
    });
    const originalUuids = [setIdentity(setA.id)?.uuid, setIdentity(setB.id)?.uuid];

    // Pin both moved rows into the past so the bump is observable without racing
    // the wall clock across a whole second.
    sqlite.prepare('UPDATE sets SET updated_at = ? WHERE id IN (?, ?)').run(1, setA.id, setB.id);

    // The slot carries real data, so this takes the park-and-rebuild branch.
    await queries.replaceSessionExercise(1, 2);

    // The recycled slot (id 1) now holds the rebuilt template: fresh rows, each
    // with its own non-null uuid, never a moved row's uuid.
    const templateIds = setIdsOf(1);
    expect(templateIds).toHaveLength(2);
    const templateUuids = templateIds.map((id) => setIdentity(id)?.uuid);
    for (const value of templateUuids) {
      expect(value).toEqual(expect.any(String));
      expect(value).not.toHaveLength(0);
    }
    expect(new Set(templateUuids).size).toBe(2);
    for (const value of templateUuids) {
      expect(originalUuids).not.toContain(value);
    }

    // The original rows moved with the parked outgoing exercise: same uuid, and
    // an updated_at bumped forward by the move.
    const parked = sqlite
      .prepare('SELECT id FROM session_exercises WHERE session_id = 1 AND exercise_id = 1')
      .get() as { id: number };
    const movedIds = setIdsOf(parked.id).sort((a, b) => a - b);
    expect(movedIds).toEqual([setA.id, setB.id].sort((a, b) => a - b));
    for (const id of movedIds) {
      const moved = setIdentity(id);
      expect(moved?.updated_at).toBeGreaterThan(1);
      expect(originalUuids).toContain(moved?.uuid);
    }
  });
});
