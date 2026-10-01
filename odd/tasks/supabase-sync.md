# supabase-sync

**Status**: **NOT STARTED — this is the next feature.** Everything below is what is left after
`supabase-migration-prep`, which is closed on the code side (PRs #1–#8, all in `main`).

**The one-sentence state**: the app is still **offline-first**. Every user row lives in a local SQLite file on the
phone (`fitness-tracker.db`), and Supabase is used for **auth only**. There is **no data layer** toward Supabase
today — the single non-auth call in the whole app is `supabase.rpc('delete_user_account')`
(`lib/hooks/useAuth.ts:140`). No `from()`, no Storage, no sync.

**What that means to the user, stated plainly** (verified 2026-09-29):

| Scenario | Today |
| --- | --- |
| Delete the app, reinstall, sign in with the same email | **The data is gone.** The SQLite file dies with the app and there is no cloud copy. |
| Sign in on another device with the same email | **The data is not there.** Each phone has its own database. |
| Two people, two phones | Each sees only their own rows (they never mix), but **nothing is backed up**. |
| Two accounts on the **same** phone | Correctly isolated (each account sees its own rows) — but that is local scoping, not sync. |

---

## What is already done, and why it matters here

The foundation exists so the sync can be built without producing duplicates and resurrected rows. None of it
syncs anything by itself.

- **Cross-system identity (`uuid`)** on every synced table, backfilled for existing rows and minted on every write
  (PR #3). Without it, the same workout uploaded from two phones would be two different rows.
- **Versioning (`updated_at`)** on every write (PR #3). It is what lets a conflict be resolved by "newest wins"
  instead of one side silently overwriting the other.
- **Tombstones (`deleted_at`)**: deletes mark the row instead of removing it, and every read refuses a tombstoned
  row or a tombstoned parent (PRs #4 and #5). Without this, a pull-based sync **resurrects** everything the user
  deleted.
- **`uuid` unique indexes** (`SCHEMA_VERSION` 3, PR #7) and **drizzle ↔ manifest parity** (PR #8).
- **Account deletion in one transaction** (PR #6) — a failure can no longer leave a half-erased account.
- **The server is ready**: `scripts/supabase-schema.sql`, `create-delete-account-rpc.sql` and
  `import-exercises.sql` were run in the dashboard and verified — the tables, the RLS policies, the RPC (now
  correctly refusing an anonymous caller) and the **3 categories + 1324 shared exercises** exist.

  **Corrected by measurement on 2026-09-29 — "ready" is too strong.** Re-checked from this machine with the
  anon key, read-only and RLS-respecting: the 3 categories, the 1324 shared exercises, the default-deny (anon
  gets 0 rows from `sessions` and `progress_photos`) and the RPC's `P0001 … no authenticated user` all hold.
  What does **not** hold is the shape: the deployed tables have **no `uuid`, no `updated_at` and no
  `deleted_at`** — Postgres answers `42703` for each one, on `body_measurements`, `exercises`, `routines` and
  `sessions`. The nine unique indexes do not exist either. So the server has the old shape: a sync cannot
  upsert by `uuid`, cannot resolve a conflict by `updated_at`, and cannot propagate a delete without
  resurrecting it. **The first work unit of this feature is a server-side migration** adding those three
  columns plus the unique index to the nine synced tables — written here, run in the Supabase SQL editor
  (this machine has no service key and no `psql`), then verified with the same anon-key checks.

---

## The order for the next session

1. **The Supabase data layer.** There is none today: no insert, no select, no update toward the tables. This is the
   first real piece and everything else depends on it. Decide its shape before writing it (one module, error
   handling, retry, and what "offline" means for a call).
2. **The exporter/importer (push and pull)** with conflict resolution. `uuid` + `updated_at` are the inputs;
   the rule (newest wins, per row) is the decision to make explicitly.
3. **The server-side identity mapping.** The remote tables use `id SERIAL`; the cross-system key is the local
   `uuid` (and `original_id` for seeded exercises). The schema plan already carries both; the mapper does not
   exist.
4. **`progress_photos` → Storage.** The `uri` is a local `file://` path today; it needs a bucket, a path
   convention (`{user_id}/{uuid}.jpg`), policies, and both the local URI and the remote path stored.
5. **The timer state.** `session_timer_state` / `rest_timer_state` are keyed by the **local integer id as a
   string**; after an id remap they would bind old state to a different session. Decide whether they stay
   local-only (probably) and record it.
6. **Seed parity**, then **the exporter** — which is the last thing, not the first.

---

## Recorded, not scheduled (independent of the sync)

- **The `SET_LOGGER` set grid at large text.** Its columns are fixed pixel widths and cannot reflow; the table
  needs a shape decision (horizontal scroll, or a stacked card per set). Obs-06 deliberately left it.
- **`app/reset-password.tsx`'s password eye** overlaps the input the same way `login.tsx` did before Slice 4 of
  `large-text-strategy`; the fix there is the pattern to copy.
- **`app/routine/folder/[id].tsx`'s main return is a raw `View` screen root** (§1 of `docs/ui-standard.md`). The
  existing `screen-roots.test.ts` pins the early returns of the header-hidden screens, not this one.
- **Obs-06's device verification.** Every large-text fix is reasoned from the style tree; jest cannot render. A
  cold start at the largest accessibility size on a real device is the only proof.

---

## The rule that keeps this honest

The native review gate is the **user's** switch, and every unit lands with strict TDD plus a parent negative
control. For this feature, the one thing that cannot be tested in the repo is the same thing the migration prep
already documented: **the device**. A sync that passes 592 tests and has never run against the real Supabase
project is not done.
