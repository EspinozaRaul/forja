/* eslint-disable @typescript-eslint/no-explicit-any */
import { CREATE_TABLES_SQL } from '../../../lib/db/ddl';

// U2c — the `exercises` write paths mint cross-system identity.
//
// `exercises` is hybrid: a row with `user_id IS NULL` is the shared seeded
// library, keyed by `original_id`; a row with `user_id` set is a user custom.
// Only customs get a `uuid` (decision 3). Every write that creates or mutates a
// row must stamp `updated_at`, but a shared row must never acquire a uuid — not
// from the seed insert, not from `claimLegacyRows`, not from `updateExercise`.
//
// The harness mirrors `routines-identity.test.ts`: only the native
// `expo-sqlite` module boundary is faked over a real `node:sqlite` database, and
// the real `lib/db/index` module runs unmodified. `expo-crypto` is a native
// module too, so `uuid()` is backed by a deterministic unique generator (the
// assertions care that uuids are present, non-null and stable, not what they
// contain).
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

  const client: any = {
    execSync: (sql: string) => {
      sqlite.exec(sql);
    },
    // `initializeDatabase` reads `PRAGMA user_version` and the identity backfill
    // reads rows through these client-level sync methods, so the double models
    // that half of the `SQLiteDatabase` contract too.
    getFirstSync: (sql: string, ...params: unknown[]) =>
      sqlite.prepare(sql).get(...params) ?? null,
    runSync: (sql: string, ...params: unknown[]) => sqlite.prepare(sql).run(...params),
    getAllSync: (sql: string, ...params: unknown[]) => sqlite.prepare(sql).all(...params),
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

  return { __esModule: true, openDatabaseSync: () => client, __sqlite: sqlite, __client: client };
});

import * as queries from '../../../lib/db/queries';
import { initializeDatabase } from '../../../lib/db/index';
import { setCurrentUserId } from '../../../lib/db/user-scope';

const sqlite: any = require('expo-sqlite').__sqlite;

const OWNER = 'user-a';

interface ExerciseIdentity {
  uuid: string | null;
  updated_at: number | null;
  user_id: string | null;
  original_id: string | null;
}

/** Reads the identity columns of one `exercises` row. */
function exerciseIdentity(id: number): ExerciseIdentity | undefined {
  const row = sqlite
    .prepare('SELECT uuid, updated_at, user_id, original_id FROM exercises WHERE id = ?')
    .get(id);
  return row === undefined ? undefined : { ...row };
}

/** Pins one exercise's `updated_at` to the past so a same-second bump is observable. */
function pinUpdatedAt(id: number, value: number): void {
  sqlite.prepare('UPDATE exercises SET updated_at = ? WHERE id = ?').run(value, id);
}

/**
 * A custom exercise references a category, and `lib/db/index` enables foreign
 * keys at import time, so the referenced row has to exist.
 */
function insertCategory(): void {
  sqlite
    .prepare('INSERT INTO categories (id, name, color, icon, created_at) VALUES (1, ?, ?, ?, 0)')
    .run('Strength', '#EF4444', '💪');
}

describe('exercises write paths mint identity (U2c)', () => {
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
    setCurrentUserId(OWNER);
  });

  // First on purpose: a fresh (empty) `exercises` table is what makes
  // `initializeDatabase` take the seed branch instead of its early return.
  it('seeds shared library rows with updated_at and keeps their uuid NULL', async () => {
    await initializeDatabase();

    const seeded = sqlite
      .prepare('SELECT * FROM exercises WHERE original_id IS NOT NULL LIMIT 1')
      .get();
    expect(seeded).toBeDefined();
    expect(seeded.user_id).toBeNull();
    expect(seeded.uuid).toBeNull();
    expect(seeded.updated_at).toBeGreaterThan(0);
  });

  it('createExercise writes a non-null uuid and a positive updated_at', async () => {
    insertCategory();
    const [created] = await queries.createExercise({ name: 'My custom lift', categoryId: 1 });

    const stored = exerciseIdentity(created.id);
    expect(stored?.user_id).toBe(OWNER);
    expect(stored?.uuid).toEqual(expect.any(String));
    expect(stored?.uuid).not.toHaveLength(0);
    expect(stored?.updated_at).toBeGreaterThan(0);
  });

  it('updateExercise moves updated_at and leaves uuid unchanged', async () => {
    insertCategory();
    const [created] = await queries.createExercise({ name: 'My custom lift', categoryId: 1 });
    const before = exerciseIdentity(created.id);
    expect(before?.uuid).toEqual(expect.any(String));

    // Pinned into the past first, so the bump is observable without depending on
    // the wall clock crossing a whole second between two calls.
    pinUpdatedAt(created.id, 1);

    const [updated] = await queries.updateExercise(created.id, { unit: 'lbs' });
    const after = exerciseIdentity(created.id);

    expect(updated.uuid).toBe(before?.uuid);
    expect(after?.uuid).toBe(before?.uuid);
    expect(after?.updated_at).toBeGreaterThan(1);
  });

  it('updateExercise bumps a shared row without minting it a uuid', async () => {
    // The guard is intentionally visible to the shared library, so the unit of a
    // seeded row is editable. That edit is still not an identity event: the row
    // stays shared and uuid-less.
    const sharedId = Number(
      sqlite
        .prepare('INSERT INTO exercises (name, original_id, created_at) VALUES (?, ?, ?)')
        .run('Barbell bench press', '0001', 1767225600).lastInsertRowid
    );
    pinUpdatedAt(sharedId, 1);

    await queries.updateExercise(sharedId, { unit: 'lbs' });
    const after = exerciseIdentity(sharedId);

    expect(after?.user_id).toBeNull();
    expect(after?.uuid).toBeNull();
    expect(after?.updated_at).toBeGreaterThan(1);
  });

  it('claimLegacyRows stamps a claimed custom without minting a uuid for a shared row', async () => {
    // Two rows written before user scoping existed: a legacy custom
    // (`original_id IS NULL`) that the first account adopts, and a seeded
    // library row (`original_id` set) that must stay shared and uuid-less.
    const legacyCustomId = Number(
      sqlite
        .prepare('INSERT INTO exercises (name, created_at) VALUES (?, ?)')
        .run('Legacy custom lift', 1767225600).lastInsertRowid
    );
    const sharedId = Number(
      sqlite
        .prepare('INSERT INTO exercises (name, original_id, created_at) VALUES (?, ?, ?)')
        .run('Barbell bench press', '0001', 1767225600).lastInsertRowid
    );
    expect(exerciseIdentity(legacyCustomId)?.updated_at).toBeNull();

    setCurrentUserId(OWNER);
    await queries.claimLegacyRows();

    const claimed = exerciseIdentity(legacyCustomId);
    expect(claimed?.user_id).toBe(OWNER);
    expect(claimed?.updated_at).toBeGreaterThan(0);

    const shared = exerciseIdentity(sharedId);
    expect(shared?.user_id).toBeNull();
    expect(shared?.uuid).toBeNull();
  });
});
