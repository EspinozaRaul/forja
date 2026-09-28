/* eslint-disable @typescript-eslint/no-explicit-any */
import { CREATE_TABLES_SQL } from '../../../lib/db/ddl';

// U2c — the `body_measurements` write paths mint cross-system identity.
//
// Each INSERT into `body_measurements` must write both a `uuid` (from
// `lib/db/identity`) and an `updated_at`; each UPDATE must bump `updated_at`
// without rewriting `uuid`. This table also gains the `updateBodyMeasurement`
// path it never had: an edit is an UPDATE (stable uuid, one `updated_at` bump),
// never tombstone + re-create. An update is ownership-scoped exactly like the
// other updates, so another account's row is untouchable. `claimLegacyRows`
// adopts pre-scoping rows, so the claimed measurement must come out of that write
// with an identity timestamp too. Deletes stay hard and are U2d.
//
// The harness mirrors `routines-identity.test.ts` and `routine-folders-identity.test.ts`:
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
const OTHER = 'user-b';

interface MeasurementIdentity {
  uuid: string | null;
  updated_at: number | null;
}

/** Reads the identity columns of one `body_measurements` row. */
function measurementIdentity(id: number): MeasurementIdentity | undefined {
  const row = sqlite.prepare('SELECT uuid, updated_at FROM body_measurements WHERE id = ?').get(id);
  return row === undefined ? undefined : { ...row };
}

/** Pins one measurement's `updated_at` to the past so a same-second bump is observable. */
function pinUpdatedAt(id: number, value: number): void {
  sqlite.prepare('UPDATE body_measurements SET updated_at = ? WHERE id = ?').run(value, id);
}

describe('body_measurements write paths mint identity (U2c)', () => {
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

  it('createBodyMeasurement writes a non-null uuid and a positive updated_at', async () => {
    const [created] = await queries.createBodyMeasurement({
      date: new Date('2026-01-01T10:00:00Z'),
      weight: 80,
    });

    const stored = measurementIdentity(created.id);
    expect(stored?.uuid).toEqual(expect.any(String));
    expect(stored?.uuid).not.toHaveLength(0);
    expect(stored?.updated_at).toBeGreaterThan(0);
  });

  it('updateBodyMeasurement moves updated_at, leaves uuid unchanged and writes the new values', async () => {
    const [created] = await queries.createBodyMeasurement({
      date: new Date('2026-01-01T10:00:00Z'),
      weight: 80,
    });
    const before = measurementIdentity(created.id);
    expect(before?.uuid).toEqual(expect.any(String));

    // Pinned into the past first, so the bump is observable without depending on
    // the wall clock crossing a whole second between two calls.
    pinUpdatedAt(created.id, 1);

    const updated = await queries.updateBodyMeasurement(created.id, { weight: 82, notes: 'lean' });
    const after = measurementIdentity(created.id);

    expect(updated[0]?.uuid).toBe(before?.uuid);
    expect(after?.uuid).toBe(before?.uuid);
    expect(after?.updated_at).toBeGreaterThan(1);

    const row = sqlite
      .prepare('SELECT weight, notes FROM body_measurements WHERE id = ?')
      .get(created.id);
    expect(row.weight).toBe(82);
    expect(row.notes).toBe('lean');
  });

  it('updateBodyMeasurement refuses a row owned by another account (no write)', async () => {
    // A row belonging to a different account: the ownership scope must make the
    // update match nothing and leave it byte-identical.
    const otherId = Number(
      sqlite
        .prepare(
          'INSERT INTO body_measurements (user_id, date, weight, created_at) VALUES (?, ?, ?, ?)'
        )
        .run(OTHER, 1767225600, 70, 1767225600).lastInsertRowid
    );
    const before = measurementIdentity(otherId);

    setCurrentUserId(OWNER);
    const updated = await queries.updateBodyMeasurement(otherId, { weight: 55 });

    expect(updated).toHaveLength(0);
    const after = measurementIdentity(otherId);
    expect(after?.uuid).toBe(before?.uuid);
    expect(after?.updated_at).toBe(before?.updated_at);
    expect(sqlite.prepare('SELECT weight FROM body_measurements WHERE id = ?').get(otherId).weight).toBe(
      70
    );
  });

  it('claimLegacyRows stamps updated_at on a claimed measurement', async () => {
    // A row written before user scoping existed: no owner and no identity. The id
    // is taken from the insert because AUTOINCREMENT does not reset between tests.
    const legacyId = Number(
      sqlite
        .prepare('INSERT INTO body_measurements (date, created_at) VALUES (?, ?)')
        .run(1767225600, 1767225600).lastInsertRowid
    );
    expect(measurementIdentity(legacyId)?.updated_at).toBeNull();

    setCurrentUserId(OWNER);
    await queries.claimLegacyRows();

    const claimed = measurementIdentity(legacyId);
    expect(claimed?.updated_at).toBeGreaterThan(0);
    expect(
      sqlite.prepare('SELECT user_id FROM body_measurements WHERE id = ?').get(legacyId).user_id
    ).toBe(OWNER);
  });
});
