import { CREATE_TABLES_SQL } from '../../../lib/db/ddl';

// This suite runs the REAL lib/db layer against a real in-memory SQLite database,
// the same wiring `user-scope.test.ts` uses. The mocked query-chain tests in
// `queries.test.ts` can only assert WHICH methods are called; they cannot prove
// that a write left a column untouched or that a WHERE predicate actually filters
// rows. Both behaviours under test here are exactly that kind of SQL-level claim.
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

function sessionRow(id: number): { completed_at: number | null; notes: string | null } {
  return sqlite.prepare('SELECT completed_at, notes FROM sessions WHERE id = ?').get(id);
}

describe('live data-integrity fixes', () => {
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
    sqlite.exec(
      "INSERT INTO categories (id, name, color, icon, created_at) VALUES (1, 'Strength', '#fff', 'x', 0);"
    );
    sqlite.exec(
      "INSERT INTO exercises (id, name, created_at) VALUES (1, 'Bench press', 0), (2, 'Squat', 0);"
    );
    setCurrentUserId('user-a');
  });

  describe('updateSessionNotes', () => {
    it('rewrites only notes and leaves completed_at untouched', async () => {
      const [session] = await queries.createSession({
        startedAt: new Date('2026-01-01T10:00:00Z'),
      });
      await queries.completeSession(session.id, {
        completedAt: new Date('2026-01-01T11:00:00Z'),
      });

      const before = sessionRow(session.id).completed_at;
      expect(before).not.toBeNull();

      await queries.updateSessionNotes(session.id, 'felt strong');

      const after = sessionRow(session.id);
      expect(after.completed_at).toBe(before);
      expect(after.notes).toBe('felt strong');
    });

    it('does not invent a completion date for a still-active session', async () => {
      const [session] = await queries.createSession({
        startedAt: new Date('2026-01-01T10:00:00Z'),
      });

      await queries.updateSessionNotes(session.id, 'warmup note');

      const row = sessionRow(session.id);
      expect(row.completed_at).toBeNull();
      expect(row.notes).toBe('warmup note');
    });

    it("refuses to write another account's session", async () => {
      const [session] = await queries.createSession({
        startedAt: new Date('2026-01-01T10:00:00Z'),
      });

      setCurrentUserId('user-b');
      await queries.updateSessionNotes(session.id, 'stolen');
      setCurrentUserId('user-a');

      expect(sessionRow(session.id).notes).toBeNull();
    });
  });

  describe('completeSession', () => {
    it('still stamps completed_at with now() on first completion', async () => {
      const [session] = await queries.createSession({
        startedAt: new Date('2026-01-01T10:00:00Z'),
      });

      const before = Math.floor(Date.now() / 1000);
      await queries.completeSession(session.id, {});
      const after = Math.floor(Date.now() / 1000);

      const { completed_at } = sessionRow(session.id);
      expect(completed_at).toBeGreaterThanOrEqual(before);
      expect(completed_at).toBeLessThanOrEqual(after);
    });

    it('keeps the original completed_at when completed a second time', async () => {
      const [session] = await queries.createSession({
        startedAt: new Date('2026-01-01T10:00:00Z'),
      });

      const first = new Date('2026-01-01T11:00:00Z');
      await queries.completeSession(session.id, { completedAt: first });
      await queries.completeSession(session.id, {
        completedAt: new Date('2026-02-02T12:00:00Z'),
      });

      expect(sessionRow(session.id).completed_at).toBe(Math.floor(first.getTime() / 1000));
    });
  });

  describe('getGlobalStats mostFrequentExercise', () => {
    it('ignores abandoned sessions when ranking the most frequent exercise', async () => {
      // One completed session using exercise 1.
      const [completed] = await queries.createSession({
        startedAt: new Date('2026-01-01T10:00:00Z'),
      });
      await queries.addExerciseToSession({ sessionId: completed.id, exerciseId: 1, order: 0 });
      await queries.completeSession(completed.id, {
        completedAt: new Date('2026-01-01T11:00:00Z'),
      });

      // Two abandoned sessions using exercise 2. Without a completed-session
      // filter, exercise 2 outranks exercise 1 (count 2 vs 1) and the card lies.
      for (const at of ['2026-01-02T10:00:00Z', '2026-01-03T10:00:00Z']) {
        const [abandoned] = await queries.createSession({ startedAt: new Date(at) });
        await queries.addExerciseToSession({ sessionId: abandoned.id, exerciseId: 2, order: 0 });
      }

      const stats = await queries.getGlobalStats();
      expect(stats.mostFrequentExercise).toBe('Bench press');
    });
  });
});
