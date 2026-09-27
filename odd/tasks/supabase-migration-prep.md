# supabase-migration-prep

**Status**: **IN PROGRESS — Unit 1 (schema freeze) LANDED, suite green on the merged base.** PR #1
(`fix/db-integrity-foreign-keys`) was **merged** into `main` (`92264cb`) and this branch was rebased onto it, so
Unit 1 now sits on top of the N1/N2 fixes. Branch `feat/sqlite-schema-freeze`, local only (not pushed). The next
merge and any push stay the user's decision.

**TDD**: **strict, ON** (`.pi/project.json` → `gentlePi.strictTDD: true`). Runner: `npx jest`; focused:
`npx jest <path>`.

**Gate**: `npx tsc --noEmit` clean and `npx jest` green. On `main` after PR #1 (`92264cb`): **39 suites / 374
tests**. On this branch over that base: **40 suites / 379 tests**.

### Landed on this branch

| Unit | Commit | What landed |
| --- | --- | --- |
| tracking | `49dfa7d` | this document |
| U1 | `edb7532` | `runSchemaMigrations` extracted from `initializeDatabase`; `SCHEMA_VERSION` + `SCHEMA_MANIFEST` + `MIGRATION_ADDED_COLUMNS`; the freeze test pinning the fresh shape and the legacy upgrade path |
| tracking | `3ad2d32` | Unit 1's landing recorded |

Gate observed on `edb7532` over the pre-merge base `af8c436`: `npx tsc --noEmit` exit 0 · `npx jest` **37 suites
/ 352 tests**; after the rebase onto `92264cb`: exit 0 · **40 suites / 379 tests**. Parent negative control
(independent of the writer): dropping the `note_type` ALTER fails 2 tests; renaming a manifest column fails 3;
both files byte-identical after revert.

---

## Why this exists

The audit (`docs/audits/02-architecture.md:136-146`) lists **12 concrete changes to do before any sync code**.
The ordered dependency chain (`docs/audits/02-architecture.md`, Engram #533) is:

1. **Merge PR #1** — otherwise the export carries rows Postgres rejects (FK violations abort the import).
2. **Freeze the SQLite schema.** The drizzle migrations are dead; the truth is `lib/db/ddl.ts` plus the ~20
   idempotent `ALTER`s in `initializeDatabase`. Nothing versioned sits underneath, so nothing can be built on
   top of it deliberately.
3. Run the three SQL scripts in the dashboard, in order (schema → RPC → seed).
4. **The cross-system identity layer: `uuid`, `updated_at`, `deleted_at`.** This is the real gate, and the
   roadmap does not name it.
5. `progress_photos.uri` (Storage) and the timer state keyed by local integer ids.
6. Seed parity (`name_es` / `body_part` / `unit`, the `::jsonb` cast, `original_id` uniqueness).
7. Only then, the exporter.

**The identity layer is the gate, not the exporter.** Without `uuid` + `updated_at` + `deleted_at`, the import is
one-shot, all-or-nothing, against the only copy of the data, and a pull-based sync resurrects rows U1 already
hard-deleted.

### The decision taken

The user chose to **freeze the SQLite schema first** (step 2) before the identity layer: it is the prerequisite,
it is cheap, and it keeps this work from colliding with PR #1. Each later layer bumps the frozen version.

---

## Measured facts on the fake-freeze target (verified, not remembered)

- `lib/db/ddl.ts` — `CREATE_TABLES_SQL`, the **final** shape (every table's current columns, including the ones
  the `ALTER`s were added for). 10 tables: `categories`, `exercises`, `routine_folders`, `routines`,
  `routine_exercises`, `sessions`, `session_exercises`, `sets`, `body_measurements`, `progress_photos`.
- `lib/db/index.ts` — `initializeDatabase` runs `CREATE_TABLES_SQL`, then ~20 `ALTER TABLE ... ADD COLUMN`
  statements each wrapped in a swallow-all `try/catch` (an existing column throws "duplicate column name" and is
  ignored). These are the upgrade path for databases older than the column.
- **No version.** `PRAGMA user_version` is used today only for the Unit-1 orphan cleanup
  (`ORPHAN_CLEANUP_VERSION = 1`, on the PR branch). There is no schema-shape version and no contract that pins
  the shape, so nothing fails when `ddl.ts` and reality drift.
- **The drizzle `0000` snapshot is NOT a faithful install** and was rejected as the upgrade fixture.
  `lib/db/migrations/0000_charming_alex_wilder.sql` has no `routine_folders` and no `user_id` anywhere, and its
  `exercises` lacks 9 columns (`equipment`, `target_muscle`, `muscle_group`, `body_part`, `secondary_muscles`,
  `instructions_es`, `image_url`, `gif_url`, `original_id`) that the earliest indexed runtime DDL always
  declared. See Unit 1, "As built".
- **The gap the audit names**: every test harness builds its schema from `CREATE_TABLES_SQL`, where the columns
  already exist, so the `ALTER` path — the only path that runs on an installed device — is covered by nothing.

### Remote Supabase state (recorded here, acted on later)

Read-only probes against project `tvhirldahraymahvthfq` (Engram #539) show the live schema is an **early
version** of `scripts/supabase-schema.sql`: `routine_folders`, `body_measurements`, `progress_photos` return
`404 PGRST205`, and `routines.folder_id` / `exercises.unit` return `42703 does not exist`. `delete_user_account`
exists and is invocable, but a POST with the anon key returns `204` where the script's guard
(`scripts/create-delete-account-rpc.sql:41-45`) demands an error — the deployed function is not the repo script.
**Step 3 of the order (run the three scripts) is therefore not done, and is a dashboard action, not code.**

---

## Unit 1 — Freeze the SQLite schema as a versioned contract — LANDED (`af39968`)

**Goal**: introduce a single versioned description of the local schema and a test that reads the *real*
database back and fails on drift, covering both the fresh-create path and the old-install upgrade path.

**As built, one deviation from the spec below.** The upgrade fixture is **not** the drizzle `0000` snapshot: the
writer proved (read-only, `node:sqlite`) that `0000` is a stale artifact — its `exercises` is missing 9 columns
that the earliest runtime DDL already declared, and no ALTER adds them — so "every manifest column exists after
`0000` + migrations" is unsatisfiable. The fixture is synthesized as `SCHEMA_MANIFEST` minus
`MIGRATION_ADDED_COLUMNS` (authored from the ALTERs), with a precondition that each listed column is genuinely
absent. This is strictly stronger: it also pins a `CREATE`-vs-`ALTER` divergence in type / notnull / default
between a fresh and an upgraded install. `body_part` stays out of the map (its ALTER is on the early-return
branch) and the legacy fixture therefore includes it — a documented infidelity.

**Deliverables**

- **`lib/db/schema-manifest.ts`** (new): `SCHEMA_VERSION` (positive integer, `1` for this baseline) and
  `SCHEMA_MANIFEST`, a declarative description of every table in `CREATE_TABLES_SQL` — ordered columns with
  `{ name, type, notNull, pk, dfltValue }` exactly as SQLite reports them, plus each table's indexes
  (`name`, `unique`, ordered `columns`).
- **`lib/db/schema-migrations.ts`** (new): `runSchemaMigrations(database)` containing the ~20 `ALTER`s currently
  inline in `initializeDatabase`, in the same order, each preserving the current swallow-all semantics. A
  local `addColumn` helper keeps it readable without changing behaviour.
- **`lib/db/index.ts`** (edit): replace the inline `ALTER` block with a single `runSchemaMigrations(expoDb)` call.
  Behaviour must be byte-for-byte equivalent: same statements, same order, same silent failure. The
  `exercises.body_part` `ALTER` stays where it is (it runs on the early-return branch and moving it would change
  when it executes).
- **`__tests__/lib/db/schema-freeze.test.ts`** (new): a real `node:sqlite` `DatabaseSync` behind a minimal
  `{ execSync }` client, importing the real `CREATE_TABLES_SQL` and `runSchemaMigrations`.

**Required assertions**

1. **Fresh shape freeze.** Apply `CREATE_TABLES_SQL`, run `runSchemaMigrations` (a no-op on a fresh DB), read
   back `PRAGMA table_info(<t>)` and `PRAGMA index_list` / `index_info` for every manifest table, and assert the
   result **equals `SCHEMA_MANIFEST`** — same tables, same columns in declaration order, same `type`, `notnull`,
   `pk`, `dflt_value`, same indexes.
2. **Upgrade path (the audit's gap).** Apply `lib/db/migrations/0000_charming_alex_wilder.sql` (strip the
   `--> statement-breakpoint` markers), insert a representative row per core table, run `runSchemaMigrations`,
   then assert every manifest column now exists and the inserted rows survive. This is the only path that runs
   on an upgraded device and nothing covers it today.
3. **Idempotency.** Running `runSchemaMigrations` twice does not throw (the second run's duplicate-column errors
   are swallowed) and leaves the shape equal to the manifest.
4. `SCHEMA_VERSION` is a positive integer.

**TDD exception, declared and narrow.** This is a characterization/contract test: there is no product behaviour
to write first, so the RED is the absent `lib/db/schema-manifest.ts` module, and the durable value is that a
future drift fails. The **negative control is mandatory**: mutate the manifest (rename or drop a column) and
observe the test fail, then revert. That is what proves the test can fail at all.

**Allowed edit surfaces**: `lib/db/schema-manifest.ts`, `lib/db/schema-migrations.ts`, `lib/db/index.ts`,
`__tests__/lib/db/schema-freeze.test.ts`.

**Proves**: the local schema has a version and a contract; a change to `ddl.ts` (or to the `ALTER` upgrade path)
without updating the contract fails the suite, and an old install provably reaches the frozen shape.

**Revert**: three files, two of them new; the `index.ts` hunk is one removed block replaced by one call, so
`git revert <sha>` is clean and cannot disturb PR #1's regions (the PR touches the pragma above the block and
inserts the cleanup below it, not the block itself).

---

## Unit 2 — Identity layer (`uuid` / `updated_at` / `deleted_at`) — mapped, not started

A read-only map of every write and delete path exists (Engram #543, `forja/delivery/identity-layer-map`). Headline
facts, all `file:line` evidenced:

- **Both sides lack the identity columns.** No `uuid`/`updated_at`/`deleted_at` in `ddl.ts`, `schema.ts` or
  `scripts/supabase-schema.sql`; `created_at` itself is absent on `routine_exercises` and `session_exercises`.
- **`expo-crypto` is installed (~57.0.2) and imported nowhere**; the API is synchronous
  `randomUUID(): string` (`expo-crypto/build/Crypto.d.ts`).
- **All 23 deletes are hard**, `deleteUserLocalData` is **not transactional** (9 sequential deletes,
  `queries.ts:2087-2101`), and every hook funnels through `lib/db/queries.ts` — `lib/progress/queries.ts` has
  zero writes.
- `now()` returns a `Date` (`lib/utils/date.ts:4-6`) and `initializeDatabase` shadows it (`index.ts:213`).

**Fork decisions — RESOLVED (user, 2026-09-27).**

1. **Timestamps**: **unix-seconds** `INTEGER`, consistent with drizzle `mode:'timestamp'` and `created_at`.
2. **Tombstones**: **in-table `deleted_at` columns** on every synced table, not a side table.
3. **Seed identity for shared `exercises`**: **`uuid` only on user-created customs**; the seeded library is keyed
   by `original_id`. This sidesteps the seed-parity problem instead of versioning an algorithm for it.
4. **`body_measurements`**: **add `updateBodyMeasurement`** so an edit is an `UPDATE` (stable `uuid`, one
   `updated_at` bump), not tombstone + re-create. Lands in U2c.
5. **Retention/purge policy** for tombstones: deferred to U2d, where the first tombstone is written.

**Proposed slicing** (detail and line lists in Engram #543).

- **U2a — contract plumbing, zero behaviour change. Spec below.**
- **U2b — generators + backfill.** `uuid()` over `Crypto.randomUUID()`, one shared timestamp convention, and a
  version-gated backfill. `exercises` is blocked by decision 3; the nine user-owned tables are not.
- **U2c — write paths, one table per commit**, starting with `sets` (highest churn, most tx-bound writes).
- **U2d — tombstone conversion, one delete family per commit**, ordered by resurrection damage.
- **U2e — read guards**, starting with `user-scope.ts:42-79` (the EXISTS subqueries): the single highest-leverage
  fix, because a tombstoned parent otherwise keeps authorizing its live children.
- **U2f — account deletion** in one transaction, and reconcile the deployed `delete_user_account`.

### U2a — identity contract plumbing (spec)

**Goal**: the schema carries the identity, versioning and tombstone columns, with **zero behaviour change** —
nothing reads or writes them yet.

**Columns** (all nullable: SQLite cannot `ALTER TABLE ... ADD COLUMN ... NOT NULL` without a default, so the
`NOT NULL` the audit asks for is an app-level invariant locally; the server column can be `NOT NULL`).

- `uuid TEXT`, `updated_at INTEGER`, `deleted_at INTEGER` on the nine synced tables: `exercises`,
  `routine_folders`, `routines`, `routine_exercises`, `sessions`, `session_exercises`, `sets`,
  `body_measurements`, `progress_photos`.
- `created_at INTEGER` on `routine_exercises` and `session_exercises` (audit item 8; the other seven already have it).
- **`categories` is excluded**: admin-seeded global reference data (`schema.ts:4-9`), never written by a client, so
  it has no identity to sync. Recorded, not silent.
- 29 new columns total, all in `SCHEMA_MANIFEST` and `MIGRATION_ADDED_COLUMNS`; `SCHEMA_VERSION` → 2.

**Method (strict TDD, contract-first).**

1. Update `schema-manifest.ts` only — `SCHEMA_VERSION = 2`, the manifest, `MIGRATION_ADDED_COLUMNS`. Run the
   freeze test: **RED** (a fresh `CREATE_TABLES_SQL` no longer matches the manifest, and the legacy fixture no
   longer reaches it).
2. Add the columns to `ddl.ts` (fresh shape), `schema.ts` (drizzle, so U2c can write them) and
   `runSchemaMigrations` (29 `addColumn` calls). **GREEN.**
3. Negative control: rename one new column in the manifest, watch the freeze test fail, revert.

**Allowed edit surfaces**: `lib/db/ddl.ts`, `lib/db/schema.ts`, `lib/db/schema-manifest.ts`,
`lib/db/schema-migrations.ts`. No test file changes — the freeze test derives everything from the manifest.

**Invariant**: `SCHEMA_MANIFEST` order must match `ddl.ts` declaration order (the fresh-shape assertion is
order-sensitive); the upgrade path is order-insensitive because SQLite appends.

Highest risks: soft deletes silently disable every FK cascade / `SET NULL` (`index.ts:31`); `user-scope.ts`
subqueries and the ~30 stat aggregates read without a tombstone guard; SQLite cannot `ADD COLUMN ... NOT NULL`
without a default, so the pattern is add-nullable → backfill → `CREATE UNIQUE INDEX`.

---

## Recorded, deliberately not in this unit

- **The identity layer** (`uuid` / `updated_at` / `deleted_at`) is Unit 2+, each bumping `SCHEMA_VERSION`.
- **`lib/db/schema.ts` (drizzle) parity** is not asserted here. It is a real drift risk (queries are typed by
  it, the database is built by `ddl.ts`) but reconciling it is its own unit.
- **The remote Supabase drift** is a dashboard action (run/repair `supabase-schema.sql`, reconcile the RPC);
  it needs no repo change and cannot be done from here without the secret key.
- **`components/ExercisePicker.tsx`** — 3 `Modal`s with `presentationStyle="pageSheet"`, no `onRequestClose`,
  no inset. Different class from the (already closed) B2 bottom sheets; recorded, not scheduled.
- **B2 is closed in `main`** (`086f85c`, Engram #538). It was listed as the next unit in the previous handoff;
  the tree refuted the handoff.
