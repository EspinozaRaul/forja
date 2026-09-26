# db-integrity-foreign-keys

**Status**: **N1 and N2 both closed.** U1–U5 landed on this branch; nothing is merged or pushed. The user's
decisions: clean only the unambiguous orphans automatically (N1), do N1 before N2, and **relocate** the
`duplicateSessionData` owner-copy case to the synchronous harness rather than leave a proxy file asserting
against a driver it cannot represent.

### Landed on this branch

| Unit | Commit | What landed |
| --- | --- | --- |
| tracking | `8104f03` | this document, plus N2's stale line numbers corrected in the roadmap |
| U1 | `7dff330` | the idempotent orphan cleanup in `initializeDatabase`, pragma still OFF |
| U2 | `2338c70` | `PRAGMA foreign_keys = ON` at module scope, plus the boundary and behaviour tests |
| U3 | `fd4cb4c` | `repairRoutineTargetDefaults` and `createSuperSetPair` converted to the synchronous shape |
| U4 | `57ab1c4` | `replaceDropSetGroup` and `duplicateSessionData` converted; the owner-copy case relocated |
| U5 | `b3d7d44` | `replaceSessionExercise` converted, and its fake `tx` made to model the driver |
| U6 | `200e0c1` | the referential contract pinned by test — no production change |
| docs | this commit | the plan below becomes the record |

`grep -c "async (tx)" lib/db/queries.ts` is **0**, and all eight `db.transaction` callbacks now run inside one
transaction on the shipping driver. The unit table below is the measured map from *before* the conversion;
the file has grown since, so its line numbers are history rather than current addresses.

**Branch**: `fix/db-integrity-foreign-keys`, branched from `main` @ `af8c436`. Merge and push stay the user's
decision.

**TDD**: **strict, ON.** Source: `.pi/project.json` → `gentlePi.strictTDD: true`, honored by explicit user
choice since 2026-09-21. Runner: `npx jest`; focused: `npx jest <path>`. A unit that cannot have a meaningful
pre-implementation test must declare that as a narrow, named exception.

**Gate**: `npx tsc --noEmit` clean and `npx jest` green. Baseline on `af8c436`: **36 suites / 347 tests**.

---

## Why this exists

Two defects that were diagnosed but never repaired, both on shipped paths.

**N1 — `PRAGMA foreign_keys` is never enabled, so every declared `ON DELETE CASCADE` is inert.** No source file
in the repository issues the pragma (grep over `*.ts/*.tsx/*.js` excluding `node_modules` and `dist/` → zero
matches). SQLite defaults it **off**, and so does expo-sqlite.

**N2 — five `db.transaction` callbacks are `async`, which gives no atomicity on this driver.** The drizzle
expo-sqlite session never awaits its callback, so `COMMIT` fires at the first `await` and the later statements
run in autocommit.

---

## The map, measured on 2026-09-24

The roadmap's line numbers for N2 were **wrong** (it said `760`, `937`, `1126`). The real set, from
`grep -n "async (tx)" lib/db/queries.ts`:

| Line | Function | Callback | Unit |
| --- | --- | --- | --- |
| `:388` | `repairRoutineTargetDefaults` | `async` | U3 |
| `:518` | `deleteSession` | **sync** — the reference | — |
| `:646` | `replaceSessionExercise` | `async` | **U5** |
| `:752` | `deleteSessionExercise` | sync | — |
| `:777` | `deleteSuperSetMembers` | sync | — |
| `:820` | `createSuperSetPair` | `async` | U3 |
| `:997` | `replaceDropSetGroup` | `async` | U4 |
| `:1186` | `duplicateSessionData` | `async` | U4 |

N1 is **wider than "orphaned sets"**. Three cascade dependencies are inert, not one:

| Declaration | Path that depends on it firing | Consequence today |
| --- | --- | --- |
| `ddl.ts:98` `sets` → `session_exercises` CASCADE | `deleteSessionExercise` (`:734`), `deleteSuperSetMembers` (`:776`) | orphaned `sets` rows |
| `ddl.ts:62` `routine_exercises` → `routines` CASCADE | `deleteRoutine` (`:269`) | orphaned `routine_exercises` rows |
| `ddl.ts:56` / `index.ts:139` `routines.folder_id` SET NULL | `deleteFolder` (`:149`) — its own comment says *"the FK handles unlinking routines automatically"* | `folder_id` pointing at a deleted folder |
| `ddl.ts:72` `sessions.routine_id` SET NULL | `deleteRoutine` (`:269`) | dangling `sessions.routine_id` |

**The knock-on effect nobody had recorded**: `deleteExercise` (`:206`) is **poisoned by those ghosts**. It counts
references without joining against the live parent, so an orphaned `routine_exercises` row makes it refuse with
*"Cannot delete: exercise is used in 1 routines"* about a routine that no longer exists.

**Three confirmation strings are false today**, not one: `session.confirm.deleteExerciseMessage` and
`deleteSuperSetMessage` promise *"Se eliminan sus series"*, and `deleteFolderMessage` promises routines are
*"solo se desvincularán de esta carpeta"* while the column keeps the dead id.

---

## Premises verified **before** writing any code

1. **expo-sqlite v57.0.2 does not enable foreign keys.** `grep -rn "foreign_keys" node_modules/expo-sqlite/{ios,android}`
   over `*.swift/*.kt/*.java/*.m/*.mm` matches **only** inside `sqlite3.c` — the SQLite amalgamation's own
   implementation. `ios/SQLiteOptions.swift`'s `OpenDatabaseOptions` has **no** foreign-key field (unlike the old
   expo-sqlite API). The versioned docs teach `PRAGMA foreign_keys = ON` as something *you* issue. So the premise
   holds in production, and it is not an artifact of reading the config instead of the artifact.
2. **`node:sqlite` — the test harness — defaults `foreign_keys = 1`, and its cascades fire.** Observed by
   execution: `PRAGMA foreign_keys` → `{"foreign_keys":1}`, and deleting a parent left `0` children. The harness
   therefore disagrees with production on exactly the axis this feature fixes, and a naive *"delete the exercise,
   assert the sets are gone"* test would **pass in the harness while production still orphans**. Every test below
   must set the pragma explicitly, in both directions.
3. **The module-scope pragma does not break the startup migrations.** `ALTER TABLE routines ADD COLUMN
   folder_id INTEGER REFERENCES routine_folders(id) ON DELETE SET NULL` (`lib/db/index.ts`) now runs while
   the pragma is already ON, and SQLite forbids a `REFERENCES` clause there only when the new column's
   default is not NULL. Verified by execution with the pragma ON: the column **is** added. This was worth
   checking precisely because that `ALTER` sits inside a `try/catch` that swallows its error — a rejection
   would have silently left `folder_id` missing on older databases, a device-only failure that no test in
   this repository would have seen, since every harness builds its tables from the DDL, where the column
   already exists.

---

## U1 — One-time cleanup of the unambiguous orphans, pragma still OFF

**Instruction**: an idempotent cleanup block in `initializeDatabase`, issued with `expoDb.execSync` in the same
idiom as the existing migrations. Nothing else changes; the pragma stays off in this unit, so the app behaves
exactly as before except that garbage rows disappear.

```sql
DELETE FROM sets               WHERE session_exercise_id NOT IN (SELECT id FROM session_exercises);
DELETE FROM routine_exercises  WHERE routine_id          NOT IN (SELECT id FROM routines);
UPDATE routines SET folder_id  = NULL WHERE folder_id IS NOT NULL AND folder_id NOT IN (SELECT id FROM routine_folders);
UPDATE sessions SET routine_id = NULL WHERE routine_id IS NOT NULL AND routine_id NOT IN (SELECT id FROM routines);
```

**The trap that decides placement**: `initializeDatabase` **early-returns** when exercises already exist
(`if (exerciseCount[0].count > 0) { … return; }`). That is precisely the branch every installed database with
orphans takes. The cleanup must run **before** that block — after the last `ALTER TABLE`, so `routines.folder_id`
exists — or it never runs where it is needed.

**Trimmed to unambiguous rows only** (the user's explicit decision, 2026-09-24): these are rows no screen can
render, because every read joins through a live parent. They are noise the user cannot see, and they are what
poisons `deleteExercise`.

**Proves**: installed databases are made consistent *before* enforcement exists, so U2 cannot fail on pre-existing
data.

**Test home**: `__tests__/lib/db/orphan-cleanup.test.ts`, copying the harness in
`__tests__/lib/db/delete-session-atomicity.test.ts` (mock `expo-sqlite`'s `openDatabaseSync` with
`execSync: jest.fn()`, then replace `lib/db/index` with a real `node:sqlite` `DatabaseSync(':memory:')` behind the
fake sync client, expose `__sqlite`, apply `CREATE_TABLES_SQL` in `beforeAll`).

**Required assertions**: orphans of all four kinds are created **with the pragma forced OFF** (node's default is
ON, so seeding without that would cascade and leave nothing to clean); after the cleanup, zero orphans of each
kind; **valid rows unchanged** (a real session with its sets survives intact); and a **second run deletes zero
rows**, proving idempotency.

**Allowed edit surfaces**: `lib/db/index.ts`, `__tests__/lib/db/orphan-cleanup.test.ts`.

---

## U2 — `PRAGMA foreign_keys = ON`, and the tests that prove it discriminates

**Instruction**: issue the pragma at **module scope** in `lib/db/index.ts`, immediately after
`openDatabaseSync(DATABASE_NAME)` and before `drizzle(expoDb)`. Module scope, not inside `initializeDatabase`:
the connection exists from import time, while `initializeDatabase` runs later, gated by `useDatabase`.

**Decision recorded, not resolved silently**: the pragma applies to the app's own connection only. The two
insert-only script connections (`scripts/import-exercises.ts:46`, `lib/db/import-exercises.ts:53`) delete no
parent and depend on no cascade, so they are left alone. The web mock (`lib/db/index.web.ts`) is an in-memory
store with no FK concept; it keeps its divergence, which is now recorded in the roadmap.

**Two tests, and both are needed**:
1. A **boundary test** — mock `openDatabaseSync` (as `exercise-metadata-repair.test.ts:52` does) and assert the
   fake client received `PRAGMA foreign_keys = ON`. This is the only assertion that proves the *app* issues it.
2. A **behaviour test** on the real harness — with the pragma **OFF**, deleting a `session_exercises` row leaves
   its `sets` behind (this is the defect reproduced); with the pragma **ON**, the same delete removes them. The
   OFF case is what makes the test able to fail.

**Proves**: N1 is closed on the shipping driver, and the three false confirmation strings become true.

**Allowed edit surfaces**: `lib/db/index.ts`, `__tests__/lib/db/foreign-keys.test.ts`.

---

## U3–U5 — N2, landed

All three converted, each with a rollback test on the real expo-sqlite harness and a success-path parity
test. The pattern is the same in every one: the outer function stays `async` (so a synchronous callback
throw reaches callers as a rejected promise, which the tests pin with `rejects.toThrow`), while the
callback itself contains no `await`.

- **U3** — `repairRoutineTargetDefaults` (four repairs) and `createSuperSetPair` (two pair-id writes plus a
  balancing insert). The `Promise.all` over the two set-number reads became two sequential `.all()` calls;
  both read pre-update state, so their order carries no meaning.
- **U4** — `replaceDropSetGroup` (returns the rows it inserted) and `duplicateSessionData` (needs each
  inserted id to attach that exercise's copied sets). These are the two that needed values produced inside
  the callback, and they are why the unit became a test problem: see the relocation note below.
- **U5** — `replaceSessionExercise`, the highest-risk one, because its data-move step reassigns every set of
  the slot to the parked row. Its fake `tx` now implements `.all()` / `.get()` / `.run()` beside `then`,
  and `wire` invokes the callback synchronously and marks the driver's COMMIT boundary. The four
  sequence-pinning assertions were kept exactly as they were; the diff touches setup lines only.

### The relocated case, and why that is a gain rather than a deletion

`cross-account-writes.test.ts` runs on drizzle's `sqlite-proxy`, whose `.all()` resolves with a promise, so
**that harness cannot run a synchronous callback at all**. Its case `duplicateSessionData copies rows for the
owner (transaction path works)` could not survive U4. It was relocated, not dropped: it was green for as
long as the transaction path was broken, so its parenthetical was never verified, and it involved a single
account, so it never tested cross-account behaviour either. Its coverage now lives in
`sync-transaction-atomicity.test.ts` — new ids, each copied set attached to its own copied exercise, copies
starting unchecked, the source untouched, and a mid-callback failure rolling the whole copy back — and a
comment in its old place states the removal and the reason. The other 14 cases, including both ownership
refusals, are untouched.

---

## Recorded, deliberately not fixed here

- **CLOSED, as a refuted premise (2026-09-26) — `createRoutine` / `updateRoutine` need no existence assert.**
  This entry claimed that with enforcement on a stale id "raises a raw SQLite foreign-key error", and only
  the first half held: the **data layer** raises, and the consequence was overstated, because **no caller
  renders a raw error**. All five callers catch and show translated copy (`routine.detail.updateFailed`,
  `routine.create.createFailed`, `tabs.routines.moveError`, `session.history.saveRoutineFailed`, or an
  error haptic), and a grep over `app/` and `components/` finds **zero** places that render
  `error.message` — the only module mapping raw text is `lib/auth/auth-error-message.ts`, which is
  auth-only and was T3. Two further measurements shrank it: **no caller passes `categoryId` at all**, and
  the only `folderId` that can go stale is the move modal's cached list.

  **Decision: pin the contract in tests (U6), not in code.** An existence pre-check would restate the
  invariant in a second place that nothing forces anyone to maintain, so the next FK column added would
  leave that second place quietly wrong. `deleteExercise`'s pre-check is not a precedent: it exists to
  phrase a count the database cannot ("used in N routines"), not because `RESTRICT` was insufficient.

  Still open, and a UX question rather than a defect: the generic message could say *why* ("esa carpeta ya
  no existe"), which would need DB-error classification in the shape of the auth one. Not scheduled.
- **`createSession({ routineId })` is already safe**: it goes through `assertRoutineOwned`
  (existence plus ownership), so the routine case is covered where the category/folder ones are not.
- `deleteUserLocalData` (`queries.ts:2018`) deletes children keyed off *live* parents, so pre-existing
  orphans in an account survive "delete my account". U1 removes them at startup instead, which covers the
  same rows.
- The web mock (`lib/db/index.web.ts`) keeps its divergence: it is an in-memory store with no FK concept,
  so `deleteSessionExercise` still leaves mock `sets` behind there. The store is non-persistent, so the
  residue dies on reload. Recorded as a decision, not a bug.
- **`cross-account-writes.test.ts` runs on a driver that cannot represent the shipping one.** Its
  `sqlite-proxy` adapter resolves with promises, so no synchronous callback can run under it. Every case in
  that file that touches a converted function is therefore limited to the refusal paths, which throw before
  the transaction opens — that is why the 14 survivors still pass. Re-harnessing the file onto the expo-sqlite
  sync harness is the real long-term fix, because a green run there says nothing about transaction semantics.
  **Its own unit, not this batch.**
- The two insert-only script connections (`scripts/import-exercises.ts:46`,
  `lib/db/import-exercises.ts:53`) are left without the pragma: they delete no parent and depend on no
  cascade.
- The roadmap's N2 line numbers (`760`, `937`, `1126`) were wrong. Corrected in the roadmap commit on this
  branch rather than silently edited.

## Gate

- `npx tsc --noEmit` — clean.
- `npx jest` — green. Baseline on `af8c436`: 36 suites / 347 tests. Each unit states the numbers it observed.
- Per unit: the focused test observed failing first (RED), then passing (GREEN), with the exact commands.
- One work-unit commit per unit on `fix/db-integrity-foreign-keys`.

## Revert

One commit per unit, so `git revert <sha>` per unit is clean. U1 is confined to `initializeDatabase`. U2 is two
statements in `lib/db/index.ts` and nothing else. Neither touches a query in `lib/db/queries.ts`.
