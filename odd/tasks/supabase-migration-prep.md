# supabase-migration-prep

**Status**: **IN PROGRESS — Unit 1 (schema freeze) LANDED, not pushed, not merged.** Branch
`feat/sqlite-schema-freeze`, branched from `main` @ `af8c436`. PR #1 (`fix/db-integrity-foreign-keys`) is still
**open and unmerged**, so this branch starts from the same base the PR did; neither is stacked on the other.
Merge and push stay the user's decision.

**TDD**: **strict, ON** (`.pi/project.json` → `gentlePi.strictTDD: true`). Runner: `npx jest`; focused:
`npx jest <path>`.

**Gate**: `npx tsc --noEmit` clean and `npx jest` green. Baseline on `af8c436` alone: **36 suites / 347
tests**; with Unit 1 landed: **37 suites / 352 tests** (this branch). The PR branch's larger count (39 / 374)
lives only in PR #1.

### Landed on this branch

| Unit | Commit | What landed |
| --- | --- | --- |
| tracking | `961f38e` | this document |
| U1 | `af39968` | `runSchemaMigrations` extracted from `initializeDatabase`; `SCHEMA_VERSION` + `SCHEMA_MANIFEST` + `MIGRATION_ADDED_COLUMNS`; the freeze test pinning the fresh shape and the legacy upgrade path |

Gate observed on `af39968`: `npx tsc --noEmit` exit 0 · `npx jest` **37 suites / 352 tests**. Parent negative
control (independent of the writer): dropping the `note_type` ALTER fails 2 tests; renaming a manifest column
fails 3; both files byte-identical after revert.

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
- **The original shape exists as an artifact**: `lib/db/migrations/0000_charming_alex_wilder.sql` is the drizzle
  v1 schema (no `routine_folders`, no `user_id`, no `folder_id`, no `unit`, no drop-set columns). It is the
  fixture for "old install upgraded by the `ALTER`s".
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
