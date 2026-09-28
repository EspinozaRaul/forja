import { randomUUID } from 'expo-crypto';
import {
  IDENTITY_BACKFILL_VERSION,
  ORPHAN_CLEANUP_VERSION,
} from './migration-versions';

// Re-exported so the backfill's consumers (its test) can pin the version without
// reaching into the migration-versions module.
export { IDENTITY_BACKFILL_VERSION };

// The identity layer's low-level generators and its one-time data backfill.
//
// `uuid()` and `nowSeconds()` are the single place both this backfill and the
// write paths (U2c) mint identity, so the two conventions live in one module.

/**
 * A v4 UUID for cross-system identity.
 *
 * Synchronous on purpose (expo-crypto's `randomUUID`): every write path needs a
 * uuid without an `await`, and the seeded-library rule (see the backfill) means
 * only user-created rows call it.
 */
export function uuid(): string {
  return randomUUID();
}

/** Unix seconds. The decided timestamp convention for `updated_at`/`deleted_at`. */
export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * The minimal database surface the backfill needs, matching the overlapping
 * shape of `expo-sqlite` and `node:sqlite` so the migration is testable with a
 * real in-memory database and no native module.
 */
export interface IdentityBackfillDatabase {
  execSync(sql: string): void;
  runSync(sql: string, ...params: unknown[]): void;
  getAllSync<T>(sql: string, ...params: unknown[]): T[];
  getFirstSync<T>(sql: string, ...params: unknown[]): T | undefined | null;
}

/** The nine synced tables. `categories` is admin seed data and is excluded. */
const SYNCED_TABLES = [
  'exercises',
  'routine_folders',
  'routines',
  'routine_exercises',
  'sessions',
  'session_exercises',
  'sets',
  'body_measurements',
  'progress_photos',
] as const;

/** Tables whose `created_at` was added by U2a and is still NULL on upgrade. */
const CHILD_TABLES = ['routine_exercises', 'session_exercises'] as const;

/**
 * One-time backfill of `uuid` and `updated_at` for rows created before the
 * identity layer existed.
 *
 * Idempotent by construction: every statement changes only rows whose target
 * column is still NULL, so no transaction is needed — a partial run leaves the
 * remaining rows NULL and the next launch finishes the job. The watermark is
 * stamped only after every step succeeded, so a failure is retried rather than
 * skipped forever.
 *
 * `deleted_at` is intentionally left NULL: no historical row is tombstoned.
 */
export function runIdentityBackfill(database: IdentityBackfillDatabase): void {
  const version =
    database.getFirstSync<{ user_version: number }>('PRAGMA user_version')?.user_version ?? 0;

  // A failed orphan cleanup leaves the version at 0; the backfill must skip it
  // (not consume the watermark) so that cleanup is still retried. A version at
  // or past ours means it already ran.
  if (version < ORPHAN_CLEANUP_VERSION || version >= IDENTITY_BACKFILL_VERSION) return;

  const now = nowSeconds();

  // Give every existing row an `updated_at`: its creation time when the table
  // records one, otherwise `now`. `sessions` is the one synced table with no
  // `created_at`: its last write is `completed_at`, or `started_at` while it is
  // still active, so those two are the proxy for it.
  for (const table of SYNCED_TABLES) {
    const timestamp =
      table === 'sessions' ? 'COALESCE(completed_at, started_at, ?)' : 'COALESCE(created_at, ?)';
    database.runSync(
      `UPDATE ${table} SET updated_at = ${timestamp} WHERE updated_at IS NULL`,
      now
    );
  }

  // The two child tables never had `created_at`; it was added by U2a and is
  // NULL everywhere on an upgraded database. Backfill it from the `updated_at`
  // just written (or `now`, if that was somehow NULL too).
  for (const table of CHILD_TABLES) {
    database.runSync(
      `UPDATE ${table} SET created_at = COALESCE(updated_at, ?) WHERE created_at IS NULL`,
      now
    );
  }

  // SQL cannot mint a v4 uuid, so they are generated per row in JS. A shared
  // seed exercise is identified by its `original_id` (seeded rows always carry
  // one) and stays NULL, keyed by that `original_id` instead; a custom —
  // including a legacy custom that predates scoping and has neither `user_id`
  // nor `original_id` — gets a cross-system identity.
  for (const table of SYNCED_TABLES) {
    const predicate =
      table === 'exercises' ? 'uuid IS NULL AND original_id IS NULL' : 'uuid IS NULL';
    const rows = database.getAllSync<{ id: number }>(
      `SELECT id FROM ${table} WHERE ${predicate}`
    );
    for (const row of rows) {
      database.runSync(`UPDATE ${table} SET uuid = ? WHERE id = ?`, uuid(), row.id);
    }
  }

  // Stamped last: only a fully successful backfill claims the version.
  database.execSync(`PRAGMA user_version = ${IDENTITY_BACKFILL_VERSION}`);
}
