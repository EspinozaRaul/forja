/* eslint-disable @typescript-eslint/no-explicit-any */
import { CREATE_TABLES_SQL } from '../../../lib/db/ddl';

// U2c — the `progress_photos` write paths mint cross-system identity.
//
// `createProgressPhoto`'s INSERT must write both a `uuid` (from
// `lib/db/identity`) and an `updated_at`; `claimLegacyRows` adopts pre-scoping
// photos, so the claimed photo must come out of that write with an identity
// timestamp too. Deletes stay hard and are U2d; the local file deletion in
// `useAuth.ts` is a separate concern.
//
// The harness mirrors `body-measurements-identity.test.ts`: only the native
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

interface PhotoIdentity {
  uuid: string | null;
  updated_at: number | null;
}

/** Reads the identity columns of one `progress_photos` row. */
function photoIdentity(id: number): PhotoIdentity | undefined {
  const row = sqlite.prepare('SELECT uuid, updated_at FROM progress_photos WHERE id = ?').get(id);
  return row === undefined ? undefined : { ...row };
}

describe('progress_photos write paths mint identity (U2c)', () => {
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

  it('createProgressPhoto writes a non-null uuid and a positive updated_at', async () => {
    const [created] = await queries.createProgressPhoto({
      date: new Date('2026-01-01T10:00:00Z'),
      uri: 'file:///photos/a.jpg',
    });

    const stored = photoIdentity(created.id);
    expect(stored?.uuid).toEqual(expect.any(String));
    expect(stored?.uuid).not.toHaveLength(0);
    expect(stored?.updated_at).toBeGreaterThan(0);
  });

  it('claimLegacyRows stamps updated_at on a claimed photo row', async () => {
    // A row written before user scoping existed: no owner and no identity. The id
    // is taken from the insert because AUTOINCREMENT does not reset between tests.
    const legacyId = Number(
      sqlite
        .prepare('INSERT INTO progress_photos (date, uri, created_at) VALUES (?, ?, ?)')
        .run(1767225600, 'file:///photos/legacy.jpg', 1767225600).lastInsertRowid
    );
    expect(photoIdentity(legacyId)?.updated_at).toBeNull();

    setCurrentUserId(OWNER);
    await queries.claimLegacyRows();

    const claimed = photoIdentity(legacyId);
    expect(claimed?.updated_at).toBeGreaterThan(0);
    expect(
      sqlite.prepare('SELECT user_id FROM progress_photos WHERE id = ?').get(legacyId).user_id
    ).toBe(OWNER);
  });
});
