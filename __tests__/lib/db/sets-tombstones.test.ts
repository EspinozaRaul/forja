/* eslint-disable @typescript-eslint/no-explicit-any */
import { CREATE_TABLES_SQL } from '../../../lib/db/ddl';

// U2d — the `sets` delete family stops hard-deleting. A tombstone is a WRITE,
// not a delete: the row stays and gains `deleted_at`, so the U2e read guards
// make the soft delete observable instead of the old row simply vanishing.
//
// THE TRAP THIS SUITE PINS: `deleteSet`, `deleteDropSetGroup` and the delete
// inside `replaceDropSetGroup` must keep the exact ownership `WHERE` they had as
// hard deletes. A soft delete that quietly widened its predicate would tombstone
// another account's rows while still "passing" a same-account happy path.
//
// PRODUCTION FIDELITY: only the native `expo-sqlite` boundary is faked over a
// real `node:sqlite` database, so the real `drizzle-orm/expo-sqlite` driver and
// the real `lib/db` layer run unmodified. The fake exposes the raw database as
// `__sqlite` so the assertions can read the tombstone directly, not through the
// guard the soft delete is supposed to trip.
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
const EXERCISE_ID = 1;

/** The owner's session and its session_exercise (the one under test). */
const SESSION = 1;
const SE = 11;
/** Another account's session and slot, used only for the ownership probes. */
const OTHER_SESSION = 2;
const OTHER_SE = 21;

/** A plain set deleted by `deleteSet`. */
const SET_DELETE = 101;
/** A sibling in the same slot; every delete family must leave it alone. */
const SET_SIBLING = 102;
/** The owner's drop group at set_number 5 (rows 111 and 112). */
const GROUP_HEAD = 111;
const GROUP_DROP = 112;
/** Another account's set and drop group at the same shape. */
const OTHER_SET = 201;
const OTHER_GROUP_HEAD = 211;
const OTHER_GROUP_DROP = 212;

/** A stale timestamp so a real `now()` bump is unambiguous. */
const STALE = 1;

function seedSet(
  id: number,
  sessionExerciseId: number,
  setNumber: number,
  extra: { dropOrder?: number; isDropGroup?: number; method?: string } = {}
): void {
  sqlite
    .prepare(
      'INSERT INTO sets (id, session_exercise_id, set_number, reps, weight, completed, method, drop_order,' +
        ' is_drop_group, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .run(
      id,
      sessionExerciseId,
      setNumber,
      5,
      10,
      1,
      extra.method ?? 'linear',
      extra.dropOrder ?? 0,
      extra.isDropGroup ?? 0,
      STALE,
      STALE
    );
}

function seedFixture(): void {
  sqlite.exec(
    "INSERT INTO categories (id, name, color, icon, created_at) VALUES (1, 'Strength', '#fff', 'x', 0);"
  );
  sqlite.exec("INSERT INTO exercises (id, name, created_at) VALUES (1, 'Bench press', 0);");
  sqlite.exec(
    'INSERT INTO sessions (id, user_id, started_at, completed_at) VALUES' +
      ` (${SESSION}, '${OWNER}', 3000, 4000),` +
      ` (${OTHER_SESSION}, '${OTHER}', 3000, 4000);`
  );
  sqlite.exec(
    'INSERT INTO session_exercises (id, session_id, exercise_id, "order", created_at, updated_at) VALUES' +
      ` (${SE}, ${SESSION}, ${EXERCISE_ID}, 0, ${STALE}, ${STALE}),` +
      ` (${OTHER_SE}, ${OTHER_SESSION}, ${EXERCISE_ID}, 0, ${STALE}, ${STALE});`
  );

  seedSet(SET_DELETE, SE, 1);
  seedSet(SET_SIBLING, SE, 2);
  seedSet(GROUP_HEAD, SE, 5, { dropOrder: 1, isDropGroup: 1, method: 'dropset' });
  seedSet(GROUP_DROP, SE, 5, { dropOrder: 2, method: 'dropset' });

  seedSet(OTHER_SET, OTHER_SE, 1);
  seedSet(OTHER_GROUP_HEAD, OTHER_SE, 5, { dropOrder: 1, isDropGroup: 1, method: 'dropset' });
  seedSet(OTHER_GROUP_DROP, OTHER_SE, 5, { dropOrder: 2, method: 'dropset' });
}

/** Raw row read, straight from SQLite — never through a guarded query. */
function rawSet(id: number): { deleted_at: number | null; updated_at: number | null } | undefined {
  return sqlite
    .prepare('SELECT deleted_at, updated_at FROM sets WHERE id = ?')
    .get(id) as { deleted_at: number | null; updated_at: number | null } | undefined;
}

function liveIdsFor(sessionExerciseId: number): number[] {
  const rows = sqlite
    .prepare(
      'SELECT id FROM sets WHERE session_exercise_id = ? AND deleted_at IS NULL ORDER BY set_number,' +
        ' drop_order, id'
    )
    .all(sessionExerciseId) as Array<{ id: number }>;
  return rows.map((row) => row.id);
}

describe('sets delete family tombstones instead of hard-deleting (U2d)', () => {
  beforeAll(() => {
    sqlite.exec(CREATE_TABLES_SQL);
  });

  beforeEach(() => {
    sqlite.exec(
      'DELETE FROM sets; DELETE FROM session_exercises; DELETE FROM sessions;' +
        'DELETE FROM routine_exercises; DELETE FROM routines;' +
        'DELETE FROM body_measurements; DELETE FROM progress_photos;' +
        'DELETE FROM exercises; DELETE FROM categories;'
    );
    seedFixture();
    setCurrentUserId(OWNER);
  });

  // ─── deleteSet ──────────────────────────────────────

  describe('deleteSet', () => {
    it('tombstones the row instead of removing it', async () => {
      const before = await queries.getSetsForSessionExercise(SE);
      expect(before.map((s) => s.id)).toContain(SET_DELETE);
      expect(rawSet(SET_DELETE)?.deleted_at).toBeNull();

      await queries.deleteSet(SET_DELETE);

      // The row still exists in the table, with a tombstone and a bumped
      // `updated_at`. This is the assertion that fails while the delete is hard.
      const after = rawSet(SET_DELETE);
      expect(after).toBeDefined();
      expect(after?.deleted_at).not.toBeNull();
      expect(after?.updated_at).not.toBe(STALE);

      // And the U2e guard makes the tombstone observable to the reader.
      const live = await queries.getSetsForSessionExercise(SE);
      expect(live.map((s) => s.id)).not.toContain(SET_DELETE);
    });

    it('leaves a sibling set in the same slot untouched', async () => {
      await queries.deleteSet(SET_DELETE);

      expect(rawSet(SET_SIBLING)).toEqual({
        deleted_at: null,
        updated_at: STALE,
      });
      expect((await queries.getSetsForSessionExercise(SE)).map((s) => s.id)).toContain(SET_SIBLING);
    });

    it('does not tombstone a set owned by another account', async () => {
      await queries.deleteSet(OTHER_SET);

      expect(rawSet(OTHER_SET)).toEqual({
        deleted_at: null,
        updated_at: STALE,
      });
      expect(liveIdsFor(OTHER_SE)).toContain(OTHER_SET);
    });
  });

  // ─── deleteDropSetGroup ─────────────────────────────

  describe('deleteDropSetGroup', () => {
    it('tombstones every drop in the group and keeps the rows', async () => {
      await queries.deleteDropSetGroup(SE, 5);

      for (const id of [GROUP_HEAD, GROUP_DROP]) {
        const row = rawSet(id);
        expect(row).toBeDefined();
        expect(row?.deleted_at).not.toBeNull();
        expect(row?.updated_at).not.toBe(STALE);
      }

      expect((await queries.getSetsForSessionExercise(SE)).map((s) => s.id)).not.toContain(
        GROUP_HEAD
      );
    });

    it('leaves a set outside the group untouched', async () => {
      await queries.deleteDropSetGroup(SE, 5);

      expect(rawSet(SET_SIBLING)).toEqual({ deleted_at: null, updated_at: STALE });
      expect(liveIdsFor(SE)).toContain(SET_SIBLING);
    });

    it('does not tombstone another account’s group at the same set number', async () => {
      await queries.deleteDropSetGroup(SE, 5);

      for (const id of [OTHER_GROUP_HEAD, OTHER_GROUP_DROP]) {
        expect(rawSet(id)).toEqual({ deleted_at: null, updated_at: STALE });
      }
      expect(liveIdsFor(OTHER_SE)).toContain(OTHER_GROUP_HEAD);
      expect(liveIdsFor(OTHER_SE)).toContain(OTHER_GROUP_DROP);
    });
  });

  // ─── replaceDropSetGroup ────────────────────────────

  describe('replaceDropSetGroup', () => {
    it('tombstones the old group rows and inserts live replacements', async () => {
      const created = await queries.replaceDropSetGroup({
        sessionExerciseId: SE,
        setNumber: 5,
        method: 'dropset',
        drops: [
          { reps: 8, weight: 20 },
          { reps: 6, weight: 15 },
        ],
      });

      // The old rows are gone from the live view but still present in the table.
      for (const id of [GROUP_HEAD, GROUP_DROP]) {
        const row = rawSet(id);
        expect(row).toBeDefined();
        expect(row?.deleted_at).not.toBeNull();
      }

      // The replacements are live and readable.
      expect(created).toHaveLength(2);
      const createdIds = created.map((s) => s.id);
      for (const id of createdIds) {
        expect(rawSet(id)?.deleted_at).toBeNull();
      }

      const live = (await queries.getSetsForSessionExercise(SE)).map((s) => s.id);
      expect(live).toEqual(expect.arrayContaining(createdIds));
      expect(live).not.toContain(GROUP_HEAD);
      expect(live).not.toContain(GROUP_DROP);
    });

    it('refuses to replace another account’s group and leaves it untouched', async () => {
      await expect(
        queries.replaceDropSetGroup({
          sessionExerciseId: OTHER_SE,
          setNumber: 5,
          drops: [{ reps: 8, weight: 20 }],
        })
      ).rejects.toThrow('Session exercise does not belong to the current user');

      for (const id of [OTHER_GROUP_HEAD, OTHER_GROUP_DROP]) {
        expect(rawSet(id)).toEqual({ deleted_at: null, updated_at: STALE });
      }
    });
  });
});
