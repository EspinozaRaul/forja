/* eslint-disable @typescript-eslint/no-explicit-any */
import { CREATE_TABLES_SQL } from '../../../lib/db/ddl';

// U2d — the last user-facing delete family stops hard-deleting.
// `deleteBodyMeasurement` and `deleteProgressPhoto` both become tombstones: the
// row stays and gains `deleted_at` (plus an `updated_at` bump so the removal wins
// sync conflict resolution), and the U2e read guards make the soft delete
// observable instead of the row simply vanishing.
//
// THE TRAP THIS SUITE PINS: `progress_photos.uri` is a local file path, and the
// account-deletion path in `lib/hooks/useAuth.ts` reads the row's `uri` to unlink
// the file. A tombstone must keep that column readable on the raw row — the soft
// delete cannot blank it, and the file itself is NOT deleted here.
//
// FIXTURE. For each table an owner row to delete, an owner sibling, and (for
// measurements) another account's row. Only the targeted owner row may be
// tombstoned; the sibling and the foreign row must be untouched.
//
// PRODUCTION FIDELITY: only the native `expo-sqlite` boundary is faked over a
// real `node:sqlite` database, so the real `drizzle-orm/expo-sqlite` driver and
// the real `lib/db` layer run unmodified. The fake exposes the raw database as
// `__sqlite` so the assertions read the tombstone directly, not through the guard
// the soft delete is supposed to trip.
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
const OTHER = 'user-b';

/** A stale timestamp so a real `now()` bump is unambiguous. */
const STALE = 1;

/** The owner's measurement to tombstone. */
const MEASUREMENT = 1;
/** The owner's sibling measurement — untouched by the delete. */
const SIBLING_MEASUREMENT = 2;
/** Another account's measurement — untouched by the delete. */
const OTHER_MEASUREMENT = 3;

/** The owner's photo to tombstone. */
const PHOTO = 1;
/** The owner's sibling photo — untouched by the delete. */
const SIBLING_PHOTO = 2;

function rawMeasurement(
  id: number
): { deleted_at: number | null; updated_at: number | null } | undefined {
  return sqlite
    .prepare('SELECT deleted_at, updated_at FROM body_measurements WHERE id = ?')
    .get(id) as { deleted_at: number | null; updated_at: number | null } | undefined;
}

function rawPhoto(
  id: number
): { deleted_at: number | null; updated_at: number | null; uri: string } | undefined {
  return sqlite
    .prepare('SELECT deleted_at, updated_at, uri FROM progress_photos WHERE id = ?')
    .get(id) as { deleted_at: number | null; updated_at: number | null; uri: string } | undefined;
}

function seedFixture(): void {
  sqlite
    .prepare(
      'INSERT INTO body_measurements (id, user_id, date, weight, created_at, updated_at)' +
        ' VALUES (?, ?, ?, ?, 0, ?)'
    )
    .run(MEASUREMENT, OWNER, 1000, 80, STALE);
  sqlite
    .prepare(
      'INSERT INTO body_measurements (id, user_id, date, weight, created_at, updated_at)' +
        ' VALUES (?, ?, ?, ?, 0, ?)'
    )
    .run(SIBLING_MEASUREMENT, OWNER, 2000, 81, STALE);
  sqlite
    .prepare(
      'INSERT INTO body_measurements (id, user_id, date, weight, created_at, updated_at)' +
        ' VALUES (?, ?, ?, ?, 0, ?)'
    )
    .run(OTHER_MEASUREMENT, OTHER, 3000, 82, STALE);

  sqlite
    .prepare(
      'INSERT INTO progress_photos (id, user_id, date, uri, created_at, updated_at)' +
        ' VALUES (?, ?, ?, ?, 0, ?)'
    )
    .run(PHOTO, OWNER, 1000, 'file:///to-delete.jpg', STALE);
  sqlite
    .prepare(
      'INSERT INTO progress_photos (id, user_id, date, uri, created_at, updated_at)' +
        ' VALUES (?, ?, ?, ?, 0, ?)'
    )
    .run(SIBLING_PHOTO, OWNER, 2000, 'file:///sibling.jpg', STALE);
}

describe('measurements / photos delete tombstones instead of hard-deleting (U2d)', () => {
  beforeAll(() => {
    sqlite.exec(CREATE_TABLES_SQL);
  });

  beforeEach(() => {
    sqlite.exec('DELETE FROM body_measurements; DELETE FROM progress_photos;');
    seedFixture();
    setCurrentUserId(OWNER);
  });

  // ─── body measurements ──────────────────────────────

  it('keeps the measurement row, stamps deleted_at, and the read drops it', async () => {
    expect(rawMeasurement(MEASUREMENT)?.deleted_at).toBeNull();

    await queries.deleteBodyMeasurement(MEASUREMENT);

    // A tombstone is an UPDATE: the row must still be physically there with the
    // marker set and `updated_at` bumped. These assertions fail while the delete
    // is hard, because the row would simply be gone.
    const row = rawMeasurement(MEASUREMENT);
    expect(row).toBeDefined();
    expect(row?.deleted_at).not.toBeNull();
    expect(row?.updated_at).not.toBe(STALE);

    // And the U2e guard is what makes it invisible.
    expect((await queries.getBodyMeasurements()).map((m) => m.id)).not.toContain(MEASUREMENT);

    // The owner sibling and another account's row are untouched.
    expect(rawMeasurement(SIBLING_MEASUREMENT)).toEqual({ deleted_at: null, updated_at: STALE });
    expect(rawMeasurement(OTHER_MEASUREMENT)).toEqual({ deleted_at: null, updated_at: STALE });
    expect((await queries.getBodyMeasurements()).map((m) => m.id)).toEqual([
      SIBLING_MEASUREMENT,
    ]);
  });

  // ─── progress photos ────────────────────────────────

  it('keeps the photo row, stamps deleted_at, and the read drops it', async () => {
    expect(rawPhoto(PHOTO)?.deleted_at).toBeNull();

    await queries.deleteProgressPhoto(PHOTO);

    const row = rawPhoto(PHOTO);
    expect(row).toBeDefined();
    expect(row?.deleted_at).not.toBeNull();

    expect((await queries.getProgressPhotos()).map((p) => p.id)).not.toContain(PHOTO);

    // The sibling is untouched.
    expect(rawPhoto(SIBLING_PHOTO)).toEqual({
      deleted_at: null,
      updated_at: STALE,
      uri: 'file:///sibling.jpg',
    });
    expect((await queries.getProgressPhotos()).map((p) => p.id)).toEqual([SIBLING_PHOTO]);
  });

  it('leaves the photo uri readable on the raw row for the account-deletion unlink', async () => {
    await queries.deleteProgressPhoto(PHOTO);

    // `lib/hooks/useAuth.ts` reads `uri` from the raw rows to unlink the local
    // files. A tombstone is a write, not a delete, and it must not blank the
    // column: the path stays recoverable.
    expect(rawPhoto(PHOTO)?.uri).toBe('file:///to-delete.jpg');
  });
});
