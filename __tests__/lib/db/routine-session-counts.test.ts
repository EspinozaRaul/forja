import { CREATE_TABLES_SQL } from '../../../lib/db/ddl';

// This suite runs the REAL lib/db layer against a real in-memory SQLite database,
// the same wiring `queries-live-fixes.test.ts` uses. The claim under test — a
// grouped count scoped to the active account — is a SQL-level claim: a mocked
// query chain could only assert WHICH methods run, not that the WHERE predicate
// actually filters another account's rows or that routines with no sessions are
// absent from the result.
jest.mock('../../../lib/db/index', () => {
  const { DatabaseSync } = require('node:sqlite');
  const { drizzle } = require('drizzle-orm/sqlite-proxy');

  const sqlite = new DatabaseSync(':memory:');
  const db = drizzle((sql: string, params: unknown[], method: string) => {
    const statement = sqlite.prepare(sql);
    if (method === 'run') {
      statement.run(...params);
      return Promise.resolve({ rows: [] });
    }
    statement.setReturnArrays(true);
    const rows = statement.all(...params);
    return Promise.resolve(method === 'get' ? { rows: rows[0] } : { rows });
  });

  return { __esModule: true, db, __sqlite: sqlite, initializeDatabase: jest.fn() };
});

import * as queries from '../../../lib/db/queries';
import { setCurrentUserId } from '../../../lib/db/user-scope';

/* eslint-disable @typescript-eslint/no-explicit-any */
let sqlite: any;

async function logCompletedSession(routineId: number, at: string): Promise<void> {
  const [session] = await queries.createSession({
    routineId,
    startedAt: new Date(at),
  });
  await queries.completeSession(session.id, { completedAt: new Date(at) });
}

describe('getRoutineSessionCounts', () => {
  beforeAll(() => {
    sqlite = require('../../../lib/db/index').__sqlite;
    sqlite.exec(CREATE_TABLES_SQL);
  });

  beforeEach(() => {
    sqlite.exec(
      'DELETE FROM sets; DELETE FROM session_exercises; DELETE FROM sessions;' +
        'DELETE FROM routine_exercises; DELETE FROM routines; DELETE FROM routine_folders;' +
        'DELETE FROM body_measurements; DELETE FROM progress_photos; DELETE FROM exercises;' +
        'DELETE FROM categories;'
    );
    setCurrentUserId('user-a');
  });

  it('counts the sessions logged for each routine', async () => {
    const [routine] = await queries.createRoutine({ name: 'Push' });
    await logCompletedSession(routine.id, '2026-01-01T10:00:00Z');
    await logCompletedSession(routine.id, '2026-01-03T10:00:00Z');

    const counts = await queries.getRoutineSessionCounts();

    expect(counts[routine.id]).toBe(2);
  });

  it("does not count another account's sessions", async () => {
    const [mine] = await queries.createRoutine({ name: 'Mine' });
    await logCompletedSession(mine.id, '2026-01-01T10:00:00Z');

    setCurrentUserId('user-b');
    const [theirs] = await queries.createRoutine({ name: 'Theirs' });
    await logCompletedSession(theirs.id, '2026-01-02T10:00:00Z');
    await logCompletedSession(theirs.id, '2026-01-04T10:00:00Z');

    setCurrentUserId('user-a');
    const counts = await queries.getRoutineSessionCounts();

    expect(counts[mine.id]).toBe(1);
    expect(counts[theirs.id]).toBeUndefined();
  });

  it('reports 0 for a routine with no sessions', async () => {
    const [routine] = await queries.createRoutine({ name: 'Empty' });

    const counts = await queries.getRoutineSessionCounts();

    expect(counts[routine.id] ?? 0).toBe(0);
  });

  it('does not count a session that was never completed', async () => {
    const [routine] = await queries.createRoutine({ name: 'Abandoned' });
    await queries.createSession({ routineId: routine.id, startedAt: new Date('2026-01-05T10:00:00Z') });

    const counts = await queries.getRoutineSessionCounts();

    expect(counts[routine.id] ?? 0).toBe(0);
  });
});
