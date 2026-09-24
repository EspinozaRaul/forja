# db-integrity-foreign-keys

**Status**: in progress — **U1 and U2 (N1) authorized to land now**; **U3–U5 (N2) scheduled next** in the same
feature. The user's decision (2026-09-24): clean only the unambiguous orphans automatically, and do N1 first.

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

## Two premises verified **before** writing any code

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

## U3–U5 — N2, scheduled but not authorized yet

Not started. **U3** `repairRoutineTargetDefaults` (`:388`) and `createSuperSetPair` (`:820`) — no dependent reads,
the two easy ones. **U4** `replaceDropSetGroup` (`:997`) and `duplicateSessionData` (`:1186`) — need
`.returning().all()` / `.get()` inside the callback. **U5** `replaceSessionExercise` (`:646`) — **the highest-risk
unit**, because its existing test is structurally coupled to the async shape: the fake `tx` in
`__tests__/lib/db/replace-session-exercise.test.ts` has no `.all()`/`.get()`/`.run()`, so the unit forces a harness
redesign alongside the conversion. Each gets a negative-control atomicity test in the
`delete-session-atomicity.test.ts` idiom (inject a failure mid-callback, assert full rollback).

---

## Recorded, deliberately not fixed here

- `deleteUserLocalData` (`queries.ts:2018`) deletes children keyed off *live* parents, so pre-existing orphans
  in an account survive "delete my account". U1 removes them at startup instead, which covers the same rows.
- The roadmap's N2 line numbers (`760`, `937`, `1126`) were wrong. The roadmap carries them; correcting it belongs
  to this batch's first commit rather than to a silent edit.

## Gate

- `npx tsc --noEmit` — clean.
- `npx jest` — green. Baseline on `af8c436`: 36 suites / 347 tests. Each unit states the numbers it observed.
- Per unit: the focused test observed failing first (RED), then passing (GREEN), with the exact commands.
- One work-unit commit per unit on `fix/db-integrity-foreign-keys`.

## Revert

One commit per unit, so `git revert <sha>` per unit is clean. U1 is confined to `initializeDatabase`. U2 is two
statements in `lib/db/index.ts` and nothing else. Neither touches a query in `lib/db/queries.ts`.
