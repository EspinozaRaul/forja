/* eslint-disable @typescript-eslint/no-explicit-any */
import { CREATE_TABLES_SQL } from '../../../lib/db/ddl';

// U2c — the `routines` write paths mint cross-system identity.
//
// Each INSERT into `routines` must write both a `uuid` (from `lib/db/identity`)
// and an `updated_at`; each UPDATE must bump `updated_at` without rewriting
// `uuid`. `claimLegacyRows` adopts pre-scoping rows, so the claimed routine must
// come out of that write with an identity timestamp too.
//
// The harness mirrors `sessions-identity.test.ts` and `sets-identity.test.ts`:
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

interface RoutineIdentity {
  uuid: string | null;
  updated_at: number | null;
}

/** Reads the identity columns of one `routines` row. */
function routineIdentity(id: number): RoutineIdentity | undefined {
  const row = sqlite.prepare('SELECT uuid, updated_at FROM routines WHERE id = ?').get(id);
  return row === undefined ? undefined : { ...row };
}

/** Pins one routine's `updated_at` to the past so a same-second bump is observable. */
function pinUpdatedAt(id: number, value: number): void {
  sqlite.prepare('UPDATE routines SET updated_at = ? WHERE id = ?').run(value, id);
}

describe('routines write paths mint identity (U2c)', () => {
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

  it('createRoutine writes a non-null uuid and a positive updated_at', async () => {
    const [created] = await queries.createRoutine({ name: 'Push day' });

    const stored = routineIdentity(created.id);
    expect(stored?.uuid).toEqual(expect.any(String));
    expect(stored?.uuid).not.toHaveLength(0);
    expect(stored?.updated_at).toBeGreaterThan(0);
  });

  it('updateRoutine moves updated_at and leaves uuid unchanged', async () => {
    const [created] = await queries.createRoutine({ name: 'Push day' });
    const before = routineIdentity(created.id);
    expect(before?.uuid).toEqual(expect.any(String));

    // Pinned into the past first, so the bump is observable without depending on
    // the wall clock crossing a whole second between two calls.
    pinUpdatedAt(created.id, 1);

    const [updated] = await queries.updateRoutine(created.id, { name: 'Push day (v2)' });
    const after = routineIdentity(created.id);

    expect(updated.uuid).toBe(before?.uuid);
    expect(after?.uuid).toBe(before?.uuid);
    expect(after?.updated_at).toBeGreaterThan(1);
  });

  it('claimLegacyRows stamps updated_at on a claimed routine', async () => {
    // A row written before user scoping existed: no owner and no identity. The id
    // is taken from the insert because AUTOINCREMENT does not reset between tests.
    const legacyId = Number(
      sqlite
        .prepare('INSERT INTO routines (name, created_at) VALUES (?, ?)')
        .run('Legacy routine', 1767225600).lastInsertRowid
    );
    expect(routineIdentity(legacyId)?.updated_at).toBeNull();

    setCurrentUserId(OWNER);
    await queries.claimLegacyRows();

    const claimed = routineIdentity(legacyId);
    expect(claimed?.updated_at).toBeGreaterThan(0);
    expect(sqlite.prepare('SELECT user_id FROM routines WHERE id = ?').get(legacyId).user_id).toBe(
      OWNER
    );
  });
});
