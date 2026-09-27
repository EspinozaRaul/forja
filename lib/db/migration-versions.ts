// One-time data-migration watermarks stamped on `PRAGMA user_version`.
//
// `PRAGMA user_version` is a single integer, so one-time migrations are a
// sequential watermark, not independent gates: each version is claimed only
// after its migration succeeded, and a later migration runs only while the
// version sits at the previous step. They live here so `lib/db/index.ts` (the
// orphan cleanup) and `lib/db/identity.ts` (the identity backfill) cannot drift,
// and so `identity.ts` never has to import `index.ts` (which would open the
// device database at import time).

/** Orphan-row cleanup, shipped together with `PRAGMA foreign_keys = ON`. */
export const ORPHAN_CLEANUP_VERSION = 1;

/** `uuid` / `updated_at` / child `created_at` backfill for pre-existing rows. */
export const IDENTITY_BACKFILL_VERSION = 2;
