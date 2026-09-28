/* eslint-disable @typescript-eslint/no-explicit-any */
import { CREATE_TABLES_SQL } from '../../../lib/db/ddl';

// U2c — the `session_exercises` write paths mint cross-system identity.
//
// Each INSERT into `session_exercises` must write a `uuid` (from
// `lib/db/identity`), a `created_at` and an `updated_at`; each UPDATE must bump
// `updated_at` without rewriting `uuid` or `created_at`. `duplicateSessionData`
// copies a session's slots, so its copies must get NEW uuids, never the source
// row's — otherwise the copy and its origin collapse to one row on the remote
// side.
//
// The harness mirrors `sets-identity.test.ts` and `foreign-keys.test.ts`: only
// the native `expo-sqlite` module boundary is faked over a real `node:sqlite`
// database, and the real `lib/db/index` module runs unmodified. `expo-crypto` is
// a native module too, so `uuid()` is backed by a deterministic unique generator
// (the assertions care that uuids are present, non-null and distinct, not what
// they contain).
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

interface SlotIdentity {
  uuid: string | null;
  created_at: number | null;
  updated_at: number | null;
}

/** Reads the identity columns of one `session_exercises` row. */
function slotIdentity(id: number): SlotIdentity | undefined {
  const row = sqlite
    .prepare('SELECT uuid, created_at, updated_at FROM session_exercises WHERE id = ?')
    .get(id);
  return row === undefined ? undefined : { ...row };
}

/** A secondary session owned by the same account, for the copy path. */
function seedTargetSession(id: number): void {
  sqlite
    .prepare('INSERT INTO sessions (id, user_id, started_at) VALUES (?, ?, ?)')
    .run(id, OWNER, 0);
}

/** Pins one slot's `updated_at` to the past so a same-second bump is observable. */
function pinUpdatedAt(id: number, value: number): void {
  sqlite.prepare('UPDATE session_exercises SET updated_at = ? WHERE id = ?').run(value, id);
}

/** Point a slot at a superset pair id, the state `unlinkSuperSetPair` consumes. */
function pinPairId(id: number, pairId: number | null): void {
  sqlite.prepare('UPDATE session_exercises SET superset_pair_id = ? WHERE id = ?').run(pairId, id);
}

function pairIdOf(id: number): number | null {
  const row = sqlite.prepare('SELECT superset_pair_id AS p FROM session_exercises WHERE id = ?').get(id);
  return row ? row.p : null;
}

describe('session_exercises write paths mint identity (U2c)', () => {
  beforeAll(() => {
    sqlite.exec(CREATE_TABLES_SQL);
  });

  beforeEach(() => {
    sqlite.exec(
      'DELETE FROM sets; DELETE FROM session_exercises; DELETE FROM sessions;' +
        'DELETE FROM exercises; DELETE FROM categories;'
    );
    sqlite.exec(
      "INSERT INTO categories (id, name, color, icon, created_at) VALUES (1, 'Strength', '#fff', 'x', 0);"
    );
    sqlite.exec("INSERT INTO exercises (id, name, created_at) VALUES (1, 'Bench press', 0);");
    sqlite
      .prepare('INSERT INTO sessions (id, user_id, started_at) VALUES (?, ?, ?)')
      .run(1, OWNER, 0);
    setCurrentUserId(OWNER);
  });

  it('addExerciseToSession writes a non-null uuid, createdAt and updatedAt', async () => {
    const [created] = await queries.addExerciseToSession({
      sessionId: 1,
      exerciseId: 1,
      order: 0,
    });

    const stored = slotIdentity(created.id);
    expect(stored?.uuid).toEqual(expect.any(String));
    expect(stored?.uuid).not.toHaveLength(0);
    expect(stored?.created_at).toBeGreaterThan(0);
    expect(stored?.updated_at).toBeGreaterThan(0);
  });

  it('every metadata update moves updatedAt and leaves uuid/createdAt unchanged', async () => {
    const [created] = await queries.addExerciseToSession({
      sessionId: 1,
      exerciseId: 1,
      order: 0,
      notes: 'first',
    });
    const before = slotIdentity(created.id);
    expect(before?.uuid).toEqual(expect.any(String));

    // Each update is pinned into the past first, so the bump is observable without
    // depending on the wall clock crossing a whole second between two calls.
    pinUpdatedAt(created.id, 1);
    const [afterNotes] = await queries.updateSessionExerciseNotes(created.id, 'second');
    expect(afterNotes.uuid).toBe(before?.uuid);
    expect(slotIdentity(created.id)?.updated_at).toBeGreaterThan(1);

    pinUpdatedAt(created.id, 2);
    const [afterOrder] = await queries.updateSessionExerciseOrder(created.id, 3);
    expect(afterOrder.uuid).toBe(before?.uuid);
    expect(slotIdentity(created.id)?.updated_at).toBeGreaterThan(2);

    pinUpdatedAt(created.id, 3);
    const [afterRest] = await queries.updateSessionExerciseRestTime(created.id, 120);
    expect(afterRest.uuid).toBe(before?.uuid);
    expect(slotIdentity(created.id)?.updated_at).toBeGreaterThan(3);

    const after = slotIdentity(created.id);
    expect(after?.uuid).toBe(before?.uuid);
    expect(after?.created_at).toBe(before?.created_at);
  });

  it('createSuperSetPair keeps both rows uuids and moves updatedAt on both', async () => {
    const [first] = await queries.addExerciseToSession({ sessionId: 1, exerciseId: 1, order: 0 });
    const [second] = await queries.addExerciseToSession({ sessionId: 1, exerciseId: 1, order: 1 });

    const firstBefore = slotIdentity(first.id);
    const secondBefore = slotIdentity(second.id);
    expect(firstBefore?.uuid).toEqual(expect.any(String));
    expect(secondBefore?.uuid).toEqual(expect.any(String));
    expect(firstBefore?.uuid).not.toBe(secondBefore?.uuid);

    sqlite
      .prepare('UPDATE session_exercises SET updated_at = ? WHERE id IN (?, ?)')
      .run(1, first.id, second.id);

    await queries.createSuperSetPair(first.id, second.id);

    const firstAfter = slotIdentity(first.id);
    const secondAfter = slotIdentity(second.id);
    expect(firstAfter?.uuid).toBe(firstBefore?.uuid);
    expect(secondAfter?.uuid).toBe(secondBefore?.uuid);
    expect(firstAfter?.created_at).toBe(firstBefore?.created_at);
    expect(secondAfter?.created_at).toBe(secondBefore?.created_at);
    expect(firstAfter?.updated_at).toBeGreaterThan(1);
    expect(secondAfter?.updated_at).toBeGreaterThan(1);
  });

  it('duplicateSessionData gives the copied session_exercises uuids distinct from the source', async () => {
    const [source] = await queries.addExerciseToSession({ sessionId: 1, exerciseId: 1, order: 0 });
    const sourceUuid = slotIdentity(source.id)?.uuid;
    expect(sourceUuid).toEqual(expect.any(String));

    seedTargetSession(2);
    await queries.duplicateSessionData(1, 2);

    const copied = sqlite
      .prepare('SELECT id, uuid, created_at, updated_at FROM session_exercises WHERE session_id = ?')
      .get(2) as { id: number } & SlotIdentity;

    expect(copied).toBeDefined();
    expect(copied.uuid).toEqual(expect.any(String));
    expect(copied.uuid).not.toBe(sourceUuid);
    expect(copied.created_at).toBeGreaterThan(0);
    expect(copied.updated_at).toBeGreaterThan(0);
  });

  it('replaceSessionExercise parks a fresh-uuid row and recycles the slot with its identity intact', async () => {
    // The incoming exercise must exist: `index.ts` enables foreign keys.
    sqlite.exec("INSERT INTO exercises (id, name, created_at) VALUES (2, 'Squat', 0);");

    const [slot] = await queries.addExerciseToSession({ sessionId: 1, exerciseId: 1, order: 0 });
    const before = slotIdentity(slot.id);
    expect(before?.uuid).toEqual(expect.any(String));

    // Real data on the slot's sets, so the call takes the park-and-rebuild branch.
    await queries.createSet({ sessionExerciseId: slot.id, setNumber: 1, reps: 8, weight: 100 });
    pinUpdatedAt(slot.id, 1);

    await queries.replaceSessionExercise(slot.id, 2);

    // The parked row is a new row: its own uuid, never the source slot's.
    const parked = sqlite
      .prepare(
        'SELECT id, uuid, created_at, updated_at FROM session_exercises' +
          ' WHERE session_id = 1 AND id <> ?'
      )
      .get(slot.id) as { id: number } & SlotIdentity;
    expect(parked).toBeDefined();
    expect(parked.uuid).toEqual(expect.any(String));
    expect(parked.uuid).not.toBe(before?.uuid);
    expect(parked.created_at).toBeGreaterThan(0);
    expect(parked.updated_at).toBeGreaterThan(0);

    // The recycled slot keeps its identity and moves its updated_at forward.
    const recycled = slotIdentity(slot.id);
    expect(recycled?.uuid).toBe(before?.uuid);
    expect(recycled?.created_at).toBe(before?.created_at);
    expect(recycled?.updated_at).toBeGreaterThan(1);
  });

  it('replaceSessionExercise swaps in place when the slot is an empty template and still moves updatedAt', async () => {
    sqlite.exec("INSERT INTO exercises (id, name, created_at) VALUES (2, 'Squat', 0);");

    const [slot] = await queries.addExerciseToSession({ sessionId: 1, exerciseId: 1, order: 0 });
    const before = slotIdentity(slot.id);
    expect(before?.uuid).toEqual(expect.any(String));
    pinUpdatedAt(slot.id, 1);

    await queries.replaceSessionExercise(slot.id, 2);

    const after = slotIdentity(slot.id);
    expect(after?.uuid).toBe(before?.uuid);
    expect(after?.created_at).toBe(before?.created_at);
    expect(after?.updated_at).toBeGreaterThan(1);
  });

  it('unlinkSuperSetPair moves updatedAt on every unpaired row and keeps their uuids', async () => {
    const [first] = await queries.addExerciseToSession({ sessionId: 1, exerciseId: 1, order: 0 });
    const [second] = await queries.addExerciseToSession({ sessionId: 1, exerciseId: 1, order: 1 });
    pinPairId(first.id, 999);
    pinPairId(second.id, 999);

    const firstBefore = slotIdentity(first.id);
    const secondBefore = slotIdentity(second.id);
    sqlite
      .prepare('UPDATE session_exercises SET updated_at = ? WHERE id IN (?, ?)')
      .run(1, first.id, second.id);

    await queries.unlinkSuperSetPair(999);

    expect(pairIdOf(first.id)).toBeNull();
    expect(pairIdOf(second.id)).toBeNull();
    const firstAfter = slotIdentity(first.id);
    const secondAfter = slotIdentity(second.id);
    expect(firstAfter?.uuid).toBe(firstBefore?.uuid);
    expect(secondAfter?.uuid).toBe(secondBefore?.uuid);
    expect(firstAfter?.updated_at).toBeGreaterThan(1);
    expect(secondAfter?.updated_at).toBeGreaterThan(1);
  });

  it('deleteSessionExercise clears the survivor pair id and moves its updatedAt', async () => {
    const [mine] = await queries.addExerciseToSession({ sessionId: 1, exerciseId: 1, order: 0 });
    const [survivor] = await queries.addExerciseToSession({ sessionId: 1, exerciseId: 1, order: 1 });
    pinPairId(mine.id, 777);
    pinPairId(survivor.id, 777);

    const survivorBefore = slotIdentity(survivor.id);
    expect(survivorBefore?.uuid).toEqual(expect.any(String));
    pinUpdatedAt(survivor.id, 1);

    await queries.deleteSessionExercise(mine.id);

    // The deleted row is gone (a hard delete); the survivor is unpaired and its
    // identity survives the dissolve.
    expect(slotIdentity(mine.id)).toBeUndefined();
    expect(pairIdOf(survivor.id)).toBeNull();
    const survivorAfter = slotIdentity(survivor.id);
    expect(survivorAfter?.uuid).toBe(survivorBefore?.uuid);
    expect(survivorAfter?.created_at).toBe(survivorBefore?.created_at);
    expect(survivorAfter?.updated_at).toBeGreaterThan(1);
  });

  it('deleteSuperSetMembers clears the carried-over pair id and moves updatedAt on the survivor', async () => {
    const [member] = await queries.addExerciseToSession({ sessionId: 1, exerciseId: 1, order: 0 });
    const [survivor] = await queries.addExerciseToSession({ sessionId: 1, exerciseId: 1, order: 1 });
    pinPairId(member.id, 888);
    pinPairId(survivor.id, 888);

    const survivorBefore = slotIdentity(survivor.id);
    expect(survivorBefore?.uuid).toEqual(expect.any(String));
    pinUpdatedAt(survivor.id, 1);

    await queries.deleteSuperSetMembers([member.id], 888);

    expect(slotIdentity(member.id)).toBeUndefined();
    // The pair id was already carried over by whoever called the delete (the list
    // arrives as an argument), so the row keeps its id and only loses identity when
    // it is a member of `memberIds`.
    expect(pairIdOf(survivor.id)).toBeNull();
    const survivorAfter = slotIdentity(survivor.id);
    expect(survivorAfter?.uuid).toBe(survivorBefore?.uuid);
    expect(survivorAfter?.updated_at).toBeGreaterThan(1);
  });
});
