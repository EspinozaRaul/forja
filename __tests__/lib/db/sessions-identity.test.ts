/* eslint-disable @typescript-eslint/no-explicit-any */
import { CREATE_TABLES_SQL } from '../../../lib/db/ddl';

// U2c — the `sessions` write paths mint cross-system identity.
//
// Each INSERT into `sessions` must write both a `uuid` (from `lib/db/identity`)
// and an `updated_at`; each UPDATE must bump `updated_at` without rewriting
// `uuid`. `sessions` has no `created_at`, so `updated_at` is its only identity
// timestamp and `started_at`/`completed_at` carry the dates.
//
// The harness mirrors `session-exercises-identity.test.ts` and
// `sets-identity.test.ts`: only the native `expo-sqlite` module boundary is
// faked over a real `node:sqlite` database, and the real `lib/db/index` module
// runs unmodified. `expo-crypto` is a native module too, so `uuid()` is backed
// by a deterministic unique generator (the assertions care that uuids are
// present, non-null and distinct, not what they contain).
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

interface SessionIdentity {
  uuid: string | null;
  updated_at: number | null;
}

/** Reads the identity columns of one `sessions` row. */
function sessionIdentity(id: number): SessionIdentity | undefined {
  const row = sqlite.prepare('SELECT uuid, updated_at FROM sessions WHERE id = ?').get(id);
  return row === undefined ? undefined : { ...row };
}

/** Pins one session's `updated_at` to the past so a same-second bump is observable. */
function pinUpdatedAt(id: number, value: number): void {
  sqlite.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(value, id);
}

describe('sessions write paths mint identity (U2c)', () => {
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
    sqlite.exec(
      "INSERT INTO categories (id, name, color, icon, created_at) VALUES (1, 'Strength', '#fff', 'x', 0);"
    );
    sqlite.exec("INSERT INTO exercises (id, name, created_at) VALUES (1, 'Bench press', 0);");
    setCurrentUserId(OWNER);
  });

  it('createSession writes a non-null uuid and a positive updatedAt', async () => {
    const [created] = await queries.createSession({
      startedAt: new Date('2026-01-01T10:00:00Z'),
    });

    const stored = sessionIdentity(created.id);
    expect(stored?.uuid).toEqual(expect.any(String));
    expect(stored?.uuid).not.toHaveLength(0);
    expect(stored?.updated_at).toBeGreaterThan(0);
  });

  it('completeSession moves updatedAt forward', async () => {
    const [created] = await queries.createSession({
      startedAt: new Date('2026-01-01T10:00:00Z'),
    });
    const before = sessionIdentity(created.id);
    expect(before?.uuid).toEqual(expect.any(String));

    // Pinned into the past first, so the bump is observable without depending on
    // the wall clock crossing a whole second between two calls.
    pinUpdatedAt(created.id, 1);
    await queries.completeSession(created.id, {
      completedAt: new Date('2026-01-01T11:00:00Z'),
    });

    const after = sessionIdentity(created.id);
    expect(after?.uuid).toBe(before?.uuid);
    expect(after?.updated_at).toBeGreaterThan(1);
  });

  it('updateSessionNotes moves updatedAt and writes the notes', async () => {
    const [created] = await queries.createSession({
      startedAt: new Date('2026-01-01T10:00:00Z'),
    });
    const before = sessionIdentity(created.id);
    expect(before?.uuid).toEqual(expect.any(String));

    pinUpdatedAt(created.id, 1);
    await queries.updateSessionNotes(created.id, 'felt strong');

    const after = sessionIdentity(created.id);
    expect(after?.uuid).toBe(before?.uuid);
    expect(after?.updated_at).toBeGreaterThan(1);
    expect(sqlite.prepare('SELECT notes FROM sessions WHERE id = ?').get(created.id).notes).toBe(
      'felt strong'
    );
  });

  it('claimLegacyRows stamps updatedAt on a claimed session', async () => {
    // A row written before user scoping existed: no owner and no identity. The id
    // is taken from the insert because AUTOINCREMENT does not reset between tests.
    const legacyId = Number(
      sqlite
        .prepare('INSERT INTO sessions (user_id, started_at) VALUES (NULL, 1767225600)')
        .run().lastInsertRowid
    );
    expect(sessionIdentity(legacyId)?.updated_at).toBeNull();

    setCurrentUserId(OWNER);
    await queries.claimLegacyRows();

    const claimed = sessionIdentity(legacyId);
    expect(claimed?.updated_at).toBeGreaterThan(0);
    expect(sqlite.prepare('SELECT user_id FROM sessions WHERE id = ?').get(legacyId).user_id).toBe(
      OWNER
    );
  });
});
