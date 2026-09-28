/* eslint-disable @typescript-eslint/no-explicit-any */
import { CREATE_TABLES_SQL } from '../../../lib/db/ddl';

// U2d — the `session_exercises` delete family stops hard-deleting. A tombstone is
// a WRITE, not a delete: the row stays and gains `deleted_at`, so the U2e read
// guards make the soft delete observable instead of the old row simply vanishing.
//
// THE TRAP THIS SUITE PINS: `deleteSessionExercise` and `deleteSuperSetMembers`
// must keep the exact ownership `WHERE` they had as hard deletes. A soft delete
// that quietly widened its predicate would tombstone another account's rows
// while still "passing" a same-account happy path.
//
// `deleteSessionExercise` also dissolves the pair before tombstoning the row, and
// both it and `deleteSuperSetMembers` tombstone the affected slots' sets in the
// same transaction: a tombstone makes the FK `ON DELETE CASCADE` inert, so without
// that the sets would stay live (unreachable from the UI) and would sync.
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

/** The owner's session under test. */
const SESSION = 1;
/** Another account's session, used only for the ownership probes. */
const OTHER_SESSION = 2;

/** The two members of the owner's pair, the unpaired sibling, and a foreign row. */
const SE_PAIR_A = 1;
const SE_PAIR_B = 2;
const SE_UNPAIRED = 3;
const SE_OTHER = 9;

const PAIR_ID = 555;
const OTHER_PAIR_ID = 777;

/** A live set per slot, to prove the slot tombstone never cascades here. */
const SET_PAIR_A = 101;
const SET_PAIR_B = 102;
const SET_UNPAIRED = 103;
const SET_OTHER = 201;

/** A stale timestamp so a real `now()` bump is unambiguous. */
const STALE = 1;

interface RawSessionExercise {
  deleted_at: number | null;
  updated_at: number | null;
  superset_pair_id: number | null;
}

/** Raw row read, straight from SQLite — never through a guarded query. */
function rawSessionExercise(id: number): RawSessionExercise | undefined {
  return sqlite
    .prepare(
      'SELECT deleted_at, updated_at, superset_pair_id FROM session_exercises WHERE id = ?'
    )
    .get(id) as RawSessionExercise | undefined;
}

function rawSet(id: number): { deleted_at: number | null; updated_at: number | null } | undefined {
  return sqlite
    .prepare('SELECT deleted_at, updated_at FROM sets WHERE id = ?')
    .get(id) as { deleted_at: number | null; updated_at: number | null } | undefined;
}

function seedSessionExercise(id: number, sessionId: number, order: number, pairId: number | null): void {
  sqlite
    .prepare(
      'INSERT INTO session_exercises (id, session_id, exercise_id, "order", superset_pair_id,' +
        ' created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)'
    )
    .run(id, sessionId, EXERCISE_ID, order, pairId, STALE, STALE);
}

function seedSet(id: number, sessionExerciseId: number, setNumber: number): void {
  sqlite
    .prepare(
      'INSERT INTO sets (id, session_exercise_id, set_number, reps, weight, completed, created_at,' +
        ' updated_at, deleted_at) VALUES (?, ?, ?, 8, 100, 0, ?, ?, NULL)'
    )
    .run(id, sessionExerciseId, setNumber, STALE, STALE);
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

  seedSessionExercise(SE_PAIR_A, SESSION, 0, PAIR_ID);
  seedSessionExercise(SE_PAIR_B, SESSION, 1, PAIR_ID);
  seedSessionExercise(SE_UNPAIRED, SESSION, 2, null);
  seedSessionExercise(SE_OTHER, OTHER_SESSION, 0, OTHER_PAIR_ID);

  seedSet(SET_PAIR_A, SE_PAIR_A, 1);
  seedSet(SET_PAIR_B, SE_PAIR_B, 1);
  seedSet(SET_UNPAIRED, SE_UNPAIRED, 1);
  seedSet(SET_OTHER, SE_OTHER, 1);
}

async function liveIds(sessionId: number): Promise<number[]> {
  return (await queries.getSessionExercises(sessionId)).map((row) => row.id);
}

describe('session_exercises delete family tombstones instead of hard-deleting (U2d)', () => {
  beforeAll(() => {
    sqlite.exec(CREATE_TABLES_SQL);
  });

  beforeEach(() => {
    sqlite.exec(
      'DELETE FROM sets; DELETE FROM session_exercises; DELETE FROM sessions;' +
        'DELETE FROM exercises; DELETE FROM categories;'
    );
    seedFixture();
    setCurrentUserId(OWNER);
  });

  // ─── deleteSessionExercise ──────────────────────────

  describe('deleteSessionExercise', () => {
    it('tombstones the row instead of removing it, keeping the raw row', async () => {
      expect(rawSessionExercise(SE_PAIR_A)?.deleted_at).toBeNull();

      await queries.deleteSessionExercise(SE_PAIR_A);

      // The row still exists in the table, with a tombstone and a bumped
      // `updated_at`. This is the assertion that fails while the delete is hard.
      const row = rawSessionExercise(SE_PAIR_A);
      expect(row).toBeDefined();
      expect(row?.deleted_at).not.toBeNull();
      expect(row?.updated_at).not.toBe(STALE);

      // And the U2e guard makes the tombstone observable to the reader.
      const live = await liveIds(SESSION);
      expect(live).not.toContain(SE_PAIR_A);
      expect(live).toEqual(expect.arrayContaining([SE_PAIR_B, SE_UNPAIRED]));
    });

    it('clears the surviving pair partner and leaves the unpaired sibling untouched', async () => {
      await queries.deleteSessionExercise(SE_PAIR_A);

      // The pair dissolves: the survivor stays live but loses the pair id.
      expect(rawSessionExercise(SE_PAIR_B)).toEqual({
        deleted_at: null,
        updated_at: expect.any(Number),
        superset_pair_id: null,
      });
      expect(rawSessionExercise(SE_PAIR_B)?.updated_at).not.toBe(STALE);

      // The unpaired sibling is not part of the pair and must not be touched.
      expect(rawSessionExercise(SE_UNPAIRED)).toEqual({
        deleted_at: null,
        updated_at: STALE,
        superset_pair_id: null,
      });
    });

    it('tombstones the deleted slot’s sets and leaves the survivor’s set live', async () => {
      await queries.deleteSessionExercise(SE_PAIR_A);

      // A tombstone makes the FK CASCADE inert, so the function tombstones the
      // deleted slot's sets itself; the survivor's set must stay live.
      const deletedSet = rawSet(SET_PAIR_A);
      expect(deletedSet?.deleted_at).not.toBeNull();
      expect(deletedSet?.updated_at).not.toBe(STALE);
      expect(rawSet(SET_PAIR_B)).toEqual({ deleted_at: null, updated_at: STALE });
    });
  });

  // ─── deleteSuperSetMembers ──────────────────────────

  describe('deleteSuperSetMembers', () => {
    it('tombstones every member and keeps the raw rows', async () => {
      await queries.deleteSuperSetMembers([SE_PAIR_A, SE_PAIR_B], PAIR_ID);

      for (const id of [SE_PAIR_A, SE_PAIR_B]) {
        const row = rawSessionExercise(id);
        expect(row).toBeDefined();
        expect(row?.deleted_at).not.toBeNull();
        expect(row?.updated_at).not.toBe(STALE);
      }

      const live = await liveIds(SESSION);
      expect(live).not.toContain(SE_PAIR_A);
      expect(live).not.toContain(SE_PAIR_B);
      expect(live).toContain(SE_UNPAIRED);
    });

    it('leaves a non-member slot and its set untouched', async () => {
      await queries.deleteSuperSetMembers([SE_PAIR_A, SE_PAIR_B], PAIR_ID);

      expect(rawSessionExercise(SE_UNPAIRED)).toEqual({
        deleted_at: null,
        updated_at: STALE,
        superset_pair_id: null,
      });
      expect(rawSet(SET_UNPAIRED)).toEqual({ deleted_at: null, updated_at: STALE });
      expect(await liveIds(SESSION)).toContain(SE_UNPAIRED);
    });

    it('tombstones each member’s sets and leaves the unpaired sibling’s set live', async () => {
      await queries.deleteSuperSetMembers([SE_PAIR_A, SE_PAIR_B], PAIR_ID);

      for (const id of [SET_PAIR_A, SET_PAIR_B]) {
        const set = rawSet(id);
        expect(set?.deleted_at).not.toBeNull();
        expect(set?.updated_at).not.toBe(STALE);
      }
      expect(rawSet(SET_UNPAIRED)).toEqual({ deleted_at: null, updated_at: STALE });
    });

    it('tombstones the members even when no pair id is supplied (no unlink to run)', async () => {
      await queries.deleteSuperSetMembers([SE_PAIR_A, SE_PAIR_B], null);

      for (const id of [SE_PAIR_A, SE_PAIR_B]) {
        const row = rawSessionExercise(id);
        expect(row).toBeDefined();
        expect(row?.deleted_at).not.toBeNull();
      }
      expect(await liveIds(SESSION)).not.toContain(SE_PAIR_A);
    });
  });

  // ─── ownership ──────────────────────────────────────

  describe('ownership', () => {
    it('deleteSessionExercise does not tombstone another account’s row', async () => {
      await queries.deleteSessionExercise(SE_OTHER);

      expect(rawSessionExercise(SE_OTHER)).toEqual({
        deleted_at: null,
        updated_at: STALE,
        superset_pair_id: OTHER_PAIR_ID,
      });
    });

    it('deleteSuperSetMembers does not tombstone another account’s members', async () => {
      await queries.deleteSuperSetMembers([SE_OTHER], OTHER_PAIR_ID);

      expect(rawSessionExercise(SE_OTHER)).toEqual({
        deleted_at: null,
        updated_at: STALE,
        superset_pair_id: OTHER_PAIR_ID,
      });
      expect(rawSet(SET_OTHER)).toEqual({ deleted_at: null, updated_at: STALE });
    });
  });
});
