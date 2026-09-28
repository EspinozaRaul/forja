/* eslint-disable @typescript-eslint/no-explicit-any */
import { CREATE_TABLES_SQL } from '../../../lib/db/ddl';

// U2e — every read in `lib/db/queries.ts` that touches `body_measurements` or
// `progress_photos` must exclude a tombstoned row (`deleted_at` set). While every
// `deleted_at` is still NULL this is a provable no-op; the guard only becomes
// observable by setting the column directly, which is exactly what U2d's soft
// delete will do.
//
// THE TRAP THIS SUITE PINS: `body_measurements` and `progress_photos` carry their
// own `user_id`, so `ownedByCurrentUser` answers ownership but never inspects
// `deleted_at` — it cannot hide a tombstoned row the user deleted. Each read needs
// the row's OWN `isNull(<table>.deletedAt)` guard.
//
// FIXTURE. For each table a live row and a tombstoned twin, both owned by the
// active account. Only the live row may survive its read.
//
// PRODUCTION FIDELITY: only the native `expo-sqlite` boundary is faked over a
// real `node:sqlite` database, so the real `drizzle-orm/expo-sqlite` driver and
// the real `lib/db` layer run unmodified and these are SQL-level assertions.
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

import * as queries from '../../../lib/db/queries';
import { setCurrentUserId } from '../../../lib/db/user-scope';

const sqlite: any = require('expo-sqlite').__sqlite;

const OWNER = 'user-a';
const TOMBSTONE = 1_800_000_000;

/** Live measurement — must survive its read. */
const LIVE_MEASUREMENT = 1;
/** Tombstoned measurement — must be absent from its read. */
const TOMB_MEASUREMENT = 2;

/** Live photo — must survive its read. */
const LIVE_PHOTO = 1;
/** Tombstoned photo — must be absent from its read. */
const TOMB_PHOTO = 2;

function seedFixture(): void {
  sqlite.exec(
    'INSERT INTO body_measurements (id, user_id, date, weight, created_at) VALUES' +
      ` (${LIVE_MEASUREMENT}, '${OWNER}', 1000, 80, 0),` +
      ` (${TOMB_MEASUREMENT}, '${OWNER}', 2000, 999, 0);`
  );
  sqlite
    .prepare('UPDATE body_measurements SET deleted_at = ? WHERE id = ?')
    .run(TOMBSTONE, TOMB_MEASUREMENT);

  sqlite.exec(
    'INSERT INTO progress_photos (id, user_id, date, uri, created_at) VALUES' +
      ` (${LIVE_PHOTO}, '${OWNER}', 1000, 'file:///live.jpg', 0),` +
      ` (${TOMB_PHOTO}, '${OWNER}', 2000, 'file:///tomb.jpg', 0);`
  );
  sqlite
    .prepare('UPDATE progress_photos SET deleted_at = ? WHERE id = ?')
    .run(TOMBSTONE, TOMB_PHOTO);
}

describe('body_measurements / progress_photos read guards exclude tombstones (U2e)', () => {
  beforeAll(() => {
    sqlite.exec(CREATE_TABLES_SQL);
  });

  beforeEach(() => {
    sqlite.exec('DELETE FROM body_measurements; DELETE FROM progress_photos;');
    seedFixture();
    setCurrentUserId(OWNER);
  });

  it('getBodyMeasurements drops the tombstoned row and keeps the live one', async () => {
    const measurements = await queries.getBodyMeasurements();
    expect(measurements.map((m) => m.id)).toEqual([LIVE_MEASUREMENT]);
    expect(measurements[0].weight).toBe(80);
  });

  it('getProgressPhotos drops the tombstoned row and keeps the live one', async () => {
    const photos = await queries.getProgressPhotos();
    expect(photos.map((p) => p.id)).toEqual([LIVE_PHOTO]);
    expect(photos[0].uri).toBe('file:///live.jpg');
  });
});
