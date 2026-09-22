/* eslint-disable @typescript-eslint/no-explicit-any */
import { and, eq, inArray } from 'drizzle-orm';
import { CREATE_TABLES_SQL } from '../../../lib/db/ddl';
import { sessionExercises, sessions, sets } from '../../../lib/db/schema';
import {
  ownedByCurrentUser,
  sessionOwnedByCurrentUser,
  setCurrentUserId,
} from '../../../lib/db/user-scope';

// U1: `deleteSession` must be atomic on the driver that actually ships.
//
// `cross-account-writes.test.ts` cannot exercise this: it wires `lib/db/index` to
// drizzle's sqlite-proxy, whose `RemotePreparedQuery.all()` is async, so a synchronous
// `.all().map(…)` callback dies on `.map` (after the transaction's `begin`). This file drives
// `drizzle-orm/expo-sqlite` — the session that ships — over a fake expo-sqlite client
// backed by `node:sqlite`. Only the native module boundary is fake; the transaction
// semantics under test (including the commit-before-`await` trap) are the driver's real
// ones. It still does not prove on-device atomicity.
jest.mock('expo-sqlite', () => ({
  openDatabaseSync: () => ({ execSync: jest.fn() }),
}));

jest.mock('../../../lib/db/index', () => {
  const { DatabaseSync } = require('node:sqlite');
  const { drizzle } = require('drizzle-orm/expo-sqlite');

  const sqlite = new DatabaseSync(':memory:');
  const hooks: { onStatement: ((sql: string) => void) | null } = { onStatement: null };

  const isRowReturning = (sql: string) =>
    /^\s*(select|pragma|with)\b/i.test(sql) || /\breturning\b/i.test(sql);

  const client = {
    prepareSync(sql: string) {
      const statement = sqlite.prepare(sql);
      return {
        executeSync(params: unknown[] = []) {
          hooks.onStatement?.(sql);
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
          hooks.onStatement?.(sql);
          statement.setReturnArrays(true);
          const rows = statement.all(...params);
          return { getAllSync: () => rows, getFirstSync: () => rows[0] };
        },
      };
    },
  };

  return {
    __esModule: true,
    db: drizzle(client as any),
    __sqlite: sqlite,
    __hooks: hooks,
    initializeDatabase: jest.fn(),
  };
});

import * as queries from '../../../lib/db/queries';

const mockedIndex = require('../../../lib/db/index') as {
  db: any;
  __sqlite: any;
  __hooks: { onStatement: ((sql: string) => void) | null };
};

const SESSION_ID = 1;
const OWNER = 'user-a';

let sqlite: any;

const COUNT_SQL: Record<'sets' | 'session_exercises' | 'sessions', string> = {
  sets: 'SELECT COUNT(*) AS c FROM sets',
  session_exercises: 'SELECT COUNT(*) AS c FROM session_exercises',
  sessions: 'SELECT COUNT(*) AS c FROM sessions',
};

function count(table: keyof typeof COUNT_SQL): number {
  return sqlite.prepare(COUNT_SQL[table]).get().c;
}

/** Make the named delete throw, so the earlier child deletes are at risk. */
function injectFailureOnDelete(table: 'session_exercises' | 'sessions'): void {
  const pattern = new RegExp('^delete\\s+from\\s+["`]?' + table + '["`]?', 'i');
  mockedIndex.__hooks.onStatement = (sql: string) => {
    if (pattern.test(sql.trim())) {
      throw new Error(`injected ${table} delete failure`);
    }
  };
}

describe('deleteSession atomicity (expo-sqlite sync driver)', () => {
  beforeAll(() => {
    sqlite = mockedIndex.__sqlite;
    sqlite.exec(CREATE_TABLES_SQL);
  });

  beforeEach(() => {
    mockedIndex.__hooks.onStatement = null;
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
      .run(SESSION_ID, OWNER, 0);
    sqlite
      .prepare(
        'INSERT INTO session_exercises (id, session_id, exercise_id, "order") VALUES (?, ?, ?, ?)'
      )
      .run(1, SESSION_ID, 1, 0);
    sqlite.exec(
      'INSERT INTO sets (id, session_exercise_id, set_number, reps, weight, completed, created_at)' +
        ' VALUES (1, 1, 1, 8, 100, 0, 0);'
    );
    setCurrentUserId(OWNER);
  });

  afterEach(() => {
    mockedIndex.__hooks.onStatement = null;
  });

  it('rolls back the sets delete when the session_exercises delete throws', async () => {
    injectFailureOnDelete('session_exercises');

    await expect(queries.deleteSession(SESSION_ID)).rejects.toThrow(
      'injected session_exercises delete failure'
    );

    // The sets delete runs first; without a transaction it is already permanent.
    expect(count('sets')).toBe(1);
    expect(count('session_exercises')).toBe(1);
    expect(count('sessions')).toBe(1);
  });

  it('negative control: the async-callback shape commits the sets delete before the failure (the trap)', async () => {
    injectFailureOnDelete('session_exercises');

    const ownedSession = and(
      eq(sessionExercises.sessionId, SESSION_ID),
      sessionOwnedByCurrentUser(sessionExercises.sessionId)
    );

    // TEST-ONLY replica of the naive shape the fix must avoid — never production code.
    // expo-sqlite's session calls this callback, runs `commit`, and only then lets the
    // first `await` resume, so the sets delete below is already committed when the
    // session_exercises delete throws.
    const asyncCallbackReplica = async (tx: any) => {
      const seIds = (
        await tx.select({ id: sessionExercises.id }).from(sessionExercises).where(ownedSession)
      ).map((r: { id: number }) => r.id);
      if (seIds.length > 0) {
        await tx.delete(sets).where(inArray(sets.sessionExerciseId, seIds));
      }
      await tx.delete(sessionExercises).where(ownedSession);
      return tx
        .delete(sessions)
        .where(and(eq(sessions.id, SESSION_ID), ownedByCurrentUser(sessions.userId)));
    };

    await expect(mockedIndex.db.transaction(asyncCallbackReplica)).rejects.toThrow(
      'injected session_exercises delete failure'
    );

    // No rollback: the earlier sets delete stuck, leaving a half-deleted session.
    expect(count('sets')).toBe(0);
    expect(count('session_exercises')).toBe(1);
    expect(count('sessions')).toBe(1);
  });

  it('rolls back both child deletes when the sessions delete throws', async () => {
    injectFailureOnDelete('sessions');

    await expect(queries.deleteSession(SESSION_ID)).rejects.toThrow(
      'injected sessions delete failure'
    );

    // The residual-session failure mode: the surviving `sessions` row is what
    // `getActiveSession` keeps returning, so both child tables must come back.
    expect(count('sets')).toBe(1);
    expect(count('session_exercises')).toBe(1);
    expect(count('sessions')).toBe(1);
  });

  it('negative control: the pre-fix shape leaves the half-deleted session when the sessions delete throws', async () => {
    injectFailureOnDelete('sessions');

    const ownedSession = and(
      eq(sessionExercises.sessionId, SESSION_ID),
      sessionOwnedByCurrentUser(sessionExercises.sessionId)
    );

    // TEST-ONLY replica of the pre-fix `deleteSession` — three sequential awaited
    // autocommit statements with no transaction at all. Never production code. It exists
    // to show the rollback assertion above is discriminating: this shape empties both
    // child tables and leaves the `sessions` row, the empty session `getActiveSession`
    // returns, without touching the committed fix.
    async function preFixReplica(): Promise<unknown> {
      const seIds = (
        await mockedIndex.db
          .select({ id: sessionExercises.id })
          .from(sessionExercises)
          .where(ownedSession)
      ).map((r: { id: number }) => r.id);
      if (seIds.length > 0) {
        await mockedIndex.db.delete(sets).where(inArray(sets.sessionExerciseId, seIds));
      }
      await mockedIndex.db.delete(sessionExercises).where(ownedSession);
      return mockedIndex.db
        .delete(sessions)
        .where(and(eq(sessions.id, SESSION_ID), ownedByCurrentUser(sessions.userId)));
    }

    await expect(preFixReplica()).rejects.toThrow('injected sessions delete failure');

    // The actual residue: children gone, parent survives.
    expect(count('sets')).toBe(0);
    expect(count('session_exercises')).toBe(0);
    expect(count('sessions')).toBe(1);
  });
});
