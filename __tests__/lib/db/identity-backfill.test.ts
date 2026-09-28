/* eslint-disable @typescript-eslint/no-explicit-any */
import { DatabaseSync } from 'node:sqlite';
import { CREATE_TABLES_SQL } from '../../../lib/db/ddl';
import {
  IDENTITY_BACKFILL_VERSION,
  runIdentityBackfill,
  type IdentityBackfillDatabase,
} from '../../../lib/db/identity';

// U2b — the one-time identity backfill.
//
// This is a real `node:sqlite` in-memory database behind the minimal client
// `runIdentityBackfill` needs (`execSync` / `runSync` / `getAllSync` /
// `getFirstSync`), so the SQL and the parameters are exercised for real. The
// schema comes from the production `CREATE_TABLES_SQL`, and `expo-crypto` is a
// native module, so it is mocked with a deterministic unique generator: the
// assertions care that uuids are present and unique, not what they contain.
//
// Three contracts are pinned:
//   * the data migration itself (uuids, timestamps, the shared-exercise rule),
//   * the `PRAGMA user_version` watermark (skip at 0 and at 2, run only at 1),
//   * idempotency (a partial or repeated run is safe).

jest.mock('expo-crypto', () => {
  let counter = 0;
  return {
    randomUUID: () => {
      counter += 1;
      return `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
    },
  };
});

/** The nine synced tables, in backfill order. Mirrors `runIdentityBackfill`. */
const SYNCED_TABLES = [
  'exercises',
  'routine_folders',
  'routines',
  'routine_exercises',
  'sessions',
  'session_exercises',
  'sets',
  'body_measurements',
  'progress_photos',
] as const;

/** The two child tables whose `created_at` was added and starts NULL. */
const CHILD_TABLES = ['routine_exercises', 'session_exercises'] as const;

function makeDatabase(): { sqlite: DatabaseSync; database: IdentityBackfillDatabase } {
  const sqlite = new DatabaseSync(':memory:');
  const database: IdentityBackfillDatabase = {
    execSync: (sql: string): void => {
      sqlite.exec(sql);
    },
    runSync: (sql: string, ...params: unknown[]): unknown =>
      sqlite.prepare(sql).run(...(params as any[])),
    getAllSync: <T>(sql: string, ...params: unknown[]): T[] =>
      sqlite.prepare(sql).all(...(params as any[])) as T[],
    getFirstSync: <T>(sql: string, ...params: unknown[]): T | undefined =>
      sqlite.prepare(sql).get(...(params as any[])) as T | undefined,
  };
  return { sqlite, database };
}

/** Builds the production schema and seeds one row per table, identity NULL. */
function buildAndSeed(sqlite: DatabaseSync): void {
  sqlite.exec(CREATE_TABLES_SQL);
  sqlite.exec(`
    INSERT INTO categories (id, name, color, icon, created_at)
      VALUES (1, 'Strength', '#EF4444', 'x', 1000);

    -- 1 = shared seed (user_id NULL, keyed by original_id), 2 = user custom.
    INSERT INTO exercises (id, user_id, name, category_id, original_id, created_at)
      VALUES (1, NULL, 'Bench Press', 1, 'ex-1', 1000),
             (2, 'user-1', 'My Custom', 1, NULL, 1000);

    INSERT INTO routine_folders (id, user_id, name, created_at)
      VALUES (1, 'user-1', 'Push', 1000);

    INSERT INTO routines (id, user_id, name, created_at)
      VALUES (1, 'user-1', 'Push Day', 1000);

    -- created_at intentionally omitted: it is migration-added and starts NULL.
    INSERT INTO routine_exercises (id, routine_id, exercise_id, "order")
      VALUES (1, 1, 2, 0);

    -- sessions has no created_at column at all, only started_at/completed_at.
    -- 1 is still active (completed_at NULL); 2 is already completed.
    INSERT INTO sessions (id, user_id, started_at, completed_at)
      VALUES (1, 'user-1', 1000, NULL),
             (2, 'user-1', 1000, 2000);

    INSERT INTO session_exercises (id, session_id, exercise_id, "order")
      VALUES (1, 1, 2, 0);

    INSERT INTO sets (id, session_exercise_id, set_number, reps, weight, completed, created_at)
      VALUES (1, 1, 1, 8, 100, 0, 1000);

    INSERT INTO body_measurements (id, user_id, date, created_at)
      VALUES (1, 'user-1', 1000, 1000);

    INSERT INTO progress_photos (id, user_id, date, uri, created_at)
      VALUES (1, 'user-1', 1000, 'file:///photo.jpg', 1000);
  `);
}

function readUserVersion(sqlite: DatabaseSync): number {
  return (first(sqlite, 'PRAGMA user_version') as { user_version: number }).user_version;
}

/** A plain-object row (strips node:sqlite's null prototype) or undefined. */
function first(sqlite: DatabaseSync, sql: string, ...params: any[]): any {
  const row = sqlite.prepare(sql).get(...params) as any;
  return row === undefined ? undefined : { ...row };
}

/** A stable snapshot of the nine tables' rows, used to prove no-op behaviour. */
function snapshot(sqlite: DatabaseSync): Record<string, any[]> {
  const result: Record<string, any[]> = {};
  for (const table of SYNCED_TABLES) {
    result[table] = (sqlite.prepare(`SELECT * FROM ${table} ORDER BY id`).all() as any[]).map(
      (row) => ({ ...row })
    );
  }
  return result;
}

function uuidValues(sqlite: DatabaseSync, table: string): (string | null)[] {
  return (sqlite.prepare(`SELECT uuid FROM ${table}`).all() as any[]).map((row) => row.uuid);
}

describe('identity backfill (U2b)', () => {
  it('backfills the nine synced tables when user_version is 1', () => {
    const { sqlite, database } = makeDatabase();
    buildAndSeed(sqlite);
    sqlite.exec('PRAGMA user_version = 1');

    runIdentityBackfill(database);

    // uuid: every present value is a non-empty string, unique within its table.
    for (const table of SYNCED_TABLES) {
      const values = uuidValues(sqlite, table);
      const present = values.filter((value): value is string => value !== null);
      for (const value of present) {
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      }
      expect(new Set(present).size).toBe(present.length);

      if (table === 'exercises') {
        // Two exercises seeded, but only the user custom may carry a uuid.
        expect(values.length).toBe(2);
        expect(present.length).toBe(1);
      } else {
        expect(values.length).toBeGreaterThan(0);
        expect(present.length).toBe(values.length);
      }
    }

    // The shared seed row keeps NULL; the custom row gets one (decision 3).
    expect(first(sqlite, 'SELECT uuid FROM exercises WHERE user_id IS NULL')).toEqual({ uuid: null });
    const custom = first(sqlite, "SELECT uuid FROM exercises WHERE user_id = 'user-1'") as {
      uuid: string;
    };
    expect(typeof custom.uuid).toBe('string');
    expect(custom.uuid.length).toBeGreaterThan(0);

    // updated_at is a positive integer everywhere, and nothing is tombstoned.
    for (const table of SYNCED_TABLES) {
      const counts = first(
        sqlite,
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN updated_at IS NULL OR typeof(updated_at) <> 'integer' OR updated_at <= 0 THEN 1 ELSE 0 END) AS bad,
                SUM(CASE WHEN deleted_at IS NOT NULL THEN 1 ELSE 0 END) AS tombstones
           FROM ${table}`
      ) as { total: number; bad: number; tombstones: number };
      expect(counts.total).toBeGreaterThan(0);
      expect(counts.bad).toBe(0);
      expect(counts.tombstones).toBe(0);
    }

    // `sessions` has no `created_at`: updated_at is its last write, so the
    // completed session takes `completed_at` and the active one `started_at`.
    const activeSession = first(
      sqlite,
      'SELECT updated_at, started_at, completed_at FROM sessions WHERE id = 1'
    ) as { updated_at: number; started_at: number; completed_at: number | null };
    expect(activeSession.completed_at).toBeNull();
    expect(activeSession.updated_at).toBe(activeSession.started_at);

    const completedSession = first(
      sqlite,
      'SELECT updated_at, started_at, completed_at FROM sessions WHERE id = 2'
    ) as { updated_at: number; started_at: number; completed_at: number | null };
    expect(completedSession.completed_at).toBe(2000);
    expect(completedSession.updated_at).toBe(completedSession.completed_at);

    // The two child tables get created_at, equal to their updated_at.
    for (const table of CHILD_TABLES) {
      const counts = first(
        sqlite,
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN created_at IS NULL THEN 1 ELSE 0 END) AS missing,
                SUM(CASE WHEN created_at = updated_at THEN 1 ELSE 0 END) AS matching
           FROM ${table}`
      ) as { total: number; missing: number; matching: number };
      expect(counts.total).toBeGreaterThan(0);
      expect(counts.missing).toBe(0);
      expect(counts.matching).toBe(counts.total);
    }

    // The watermark is stamped only after the whole backfill succeeded.
    expect(readUserVersion(sqlite)).toBe(IDENTITY_BACKFILL_VERSION);
  });

  it('gives a legacy custom (user_id NULL, original_id NULL) a uuid and an updated_at', () => {
    const { sqlite, database } = makeDatabase();
    buildAndSeed(sqlite);

    // A legacy custom predates account scoping: no `user_id` and no `original_id`,
    // exactly the shape `claimLegacyRows` adopts at first sign-in. It is a custom,
    // not a shared seed row, so the backfill must give it an identity.
    sqlite.exec(
      "INSERT INTO exercises (id, user_id, name, original_id, created_at) VALUES (3, NULL, 'Legacy custom lift', NULL, 1000);"
    );
    sqlite.exec('PRAGMA user_version = 1');

    runIdentityBackfill(database);

    const legacy = first(sqlite, 'SELECT uuid, updated_at FROM exercises WHERE id = 3') as {
      uuid: string | null;
      updated_at: number | null;
    };
    expect(legacy.uuid).toEqual(expect.any(String));
    expect(legacy.updated_at).toBeGreaterThan(0);

    // The shared seed row (`original_id` set) is still uuid-less.
    expect(first(sqlite, 'SELECT uuid FROM exercises WHERE id = 1')).toEqual({ uuid: null });
  });

  it('is a no-op when user_version is 0 (the failed-cleanup case)', () => {
    const { sqlite, database } = makeDatabase();
    buildAndSeed(sqlite);
    const before = snapshot(sqlite);
    expect(readUserVersion(sqlite)).toBe(0);

    runIdentityBackfill(database);

    expect(readUserVersion(sqlite)).toBe(0);
    expect(snapshot(sqlite)).toEqual(before);

    for (const table of SYNCED_TABLES) {
      const counts = first(
        sqlite,
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN uuid IS NULL THEN 1 ELSE 0 END) AS nullUuid,
                SUM(CASE WHEN updated_at IS NULL THEN 1 ELSE 0 END) AS nullUpdated
           FROM ${table}`
      ) as { total: number; nullUuid: number; nullUpdated: number };
      expect(counts.nullUuid).toBe(counts.total);
      expect(counts.nullUpdated).toBe(counts.total);
    }
  });

  it('is a no-op when user_version already equals IDENTITY_BACKFILL_VERSION', () => {
    const { sqlite, database } = makeDatabase();
    buildAndSeed(sqlite);
    sqlite.exec(`PRAGMA user_version = ${IDENTITY_BACKFILL_VERSION}`);
    const before = snapshot(sqlite);

    runIdentityBackfill(database);

    expect(readUserVersion(sqlite)).toBe(IDENTITY_BACKFILL_VERSION);
    expect(snapshot(sqlite)).toEqual(before);
  });

  it('is idempotent: a second run changes nothing', () => {
    const { sqlite, database } = makeDatabase();
    buildAndSeed(sqlite);
    sqlite.exec('PRAGMA user_version = 1');

    runIdentityBackfill(database);
    const afterFirst = snapshot(sqlite);

    runIdentityBackfill(database);

    expect(snapshot(sqlite)).toEqual(afterFirst);
    expect(readUserVersion(sqlite)).toBe(IDENTITY_BACKFILL_VERSION);
  });
});
