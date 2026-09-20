# Forja — Consolidated Audit Report & Prioritized Fix Plan

**Date:** 2026-05
**Auditor:** el Gentleman (Pi orchestrator) + delegated exploration/implementation agents
**Scope:** Full app audit — security, architecture, data flow, dead code, code quality
**Reports:** `01-security.md`, `02-architecture.md`, `03-dead-code.md`, `04-quality.md`
**Status:** 2 CRITICAL bugs fixed and test-approved (C1, C2); all other findings open

---

## Summary of findings by phase

| Phase | CRITICAL | HIGH | MEDIUM | LOW | INFO |
|---|---|---|---|---|---|
| 1 — Security | 0 | 0 | 4 | 6 | 4 |
| 2 — Architecture | 2 (FIXED) | 3 | 9 | 5 | 3 |
| 3 — Dead code | 0 | 0 | 3 hygiene | 4 | 5 |
| 4 — Quality | 0 | 1 | 5 | 5 | 3 |
| **Total** | **2 fixed** | **4** | **21** | **20** | **15** |

---

## Prioritized fix plan

### Tier 1 — Do before Supabase migration (blocks sync correctness)

| # | From | Finding | What to do | Effort |
|---|---|---|---|---|
| 1 | P2-H2 | FKs declared but never enforced; deletes leave orphans | Add `PRAGMA foreign_keys = ON` at DB open; add missing child deletes in `deleteSessionExercise`/`deleteRoutine` | Small |
| 2 | P2-H1 | Drizzle migration folder dead/disconnected | Archive `lib/db/migrations/` to `migrations_legacy/`; document `ddl.ts` as source of truth; remove `drizzle-kit` devDep + `drizzle.config.ts` | Small |
| 3 | P2-H3 | No offline-safe identity, no updated_at, no tombstones | Add `uuid TEXT NOT NULL UNIQUE` + `updated_at INTEGER NOT NULL` + `deleted_at INTEGER` to all synced tables (see Phase 2 checklist items 1-3) | Medium-large |
| 4 | P2-M5 | Per-exercise `unit` edits on shared library can't sync | Create `exercise_preferences` table for user-owned overrides | Small-medium |
| 5 | P1-M1 | Progress photos in image-picker cache, not app-owned | Copy picked images to `Paths.document` before persisting | Small |
| 6 | P1-M1 | Data unencrypted at rest | Document as accepted trade-off for v1 OR enable SQLCipher (depends on scope) | Decision |

### Tier 2 — Fix now (bugs, data integrity, low effort)

| # | From | Finding | What to do | Effort |
|---|---|---|---|---|
| 7 | P2-M1 | Optimistic cache writes target wrong query keys | Add `userId` to query keys in `SessionExerciseItem.tsx` and `app/session/[id].tsx` | Small |
| 8 | P2-M3 | Per-keystroke mutations race (last-write-wins) | Debounce `onUpdate` (300-500ms) in `SetLogger.tsx` | Small |
| 9 | P2-M9 | `mutateAsync` without try/catch (10 sites) | Wrap in try/catch or switch to `mutate()` | Small |
| 10 | P2-L1 | `session/new.tsx` returns before hooks | Move guard below all hooks (same fix as `session/[id].tsx` already has) | Tiny |
| 11 | P2-I2 | Rest-timer notification ID not persisted | Persist `notificationId` alongside rest-timer state | Small |
| 12 | P4-Q1 | SessionExerciseItem.tsx quality (869 lines) | Extract `useSetMutations` hook; memoize callbacks. Incremental, not a rewrite. | Medium |
| 13 | P2-M7 | Asymmetric cache invalidation | Create `invalidateSessionData(qc, sessionId)` helper | Small |
| 14 | P2-M8 | QueryClient no defaults; retry:3 on SQLite | Set `staleTime: 30_000`, `retry: <2` for deterministic errors | Tiny |

### Tier 3 — Clean up when convenient (hygiene, no urgency)

| # | From | Finding | What to do | Effort |
|---|---|---|---|---|
| 15 | P3 | 6 unused npm deps | `npm uninstall expo-background-fetch react-native-chart-kit react-native-svg react-native-draggable-flatlist expo-auth-session expo-crypto` + prune jest config | Tiny |
| 16 | P3 | 5 dead source files | Delete sample-exercises, load-exercises, import-exercises, exercise-localization, progress/compare | Tiny |
| 17 | P3 | 17 MB dead dataset | Delete `assets/exercises/data/exercises.json` after #16 | Tiny |
| 18 | P3 | Dead exports (SessionCard.exerciseCount, ExercisePicker.multiSelect) | Remove props + orphan i18n keys | Tiny |
| 19 | P3+P4 | jest.config.js missing collectCoverageFrom | Add one line | Tiny |
| 20 | P3+P4 | tsconfig.json missing noUnusedLocals | Add two lines | Tiny |
| 21 | P4 | 7 screens missing `<Screen>` wrapper | Add where feasible; document session screen's exception | Small |
| 22 | P4 | NativeWind half-wired | Verify on device; decide: wire metro.config.js OR strip className | Decision |
| 23 | P3 | 125 MB tracked GIFs | Move out of repo (roadmap §2.1) | Decision |

### Tier 4 — Later / decision needed

| # | From | Finding | Decision needed |
|---|---|---|---|
| 24 | P3 | Web target (.web.ts files, react-native-web) | Drop or keep? |
| 25 | P1 | Supabase RLS "plan not applied" | Apply schema before migration |
| 26 | P1 | Supabase Auth settings (email confirm, redirect URLs) | Configure in dashboard |
| 27 | P2 | Duplicated data-access layers (useProgress vs queries.ts) | Consolidate |
| 28 | P4 | Component tests for session logging | Start with one SetLogger test |

---

## What's done WELL (keep doing this)

These are things many professional projects get wrong — you got them right:

1. **QueryState 100% adoption** — every data-backed screen handles loading/error/empty correctly
2. **User-scope isolation with tests** — `user-scope.ts` + `cross-account-writes.test.ts` is exactly right
3. **Zero secrets in the repo** — Supabase anon key only, .env gitignored
4. **RLS design complete and correct** — per-operation policies, deny-by-default, indexes on RLS columns
5. **mutationErrorHandler consistent** — every mutation hook uses it, no empty catch blocks
6. **Token-based colors** — 1 hardcoded hex in the entire codebase
7. **i18n with parity tests** — enforced bilingual catalog
8. **Accessibility test exists** — rare in hobby projects
9. **Auth fail-closed** — no infinite splash, clear session on error
10. **Documentation from real bugs** — ui-standard.md written from actual issues, not theory

---

## Recommended execution order

```
Week 1 (Tier 2 — bugs + quick wins):
  #10 (hook guard) → #14 (QueryClient defaults) → #7 (query keys) →
  #8 (debounce) → #9 (try/catch) → #11 (notification persist) →
  #13 (invalidation helper) → #19+#20 (config)

Week 2 (Tier 3 — dead code cleanup):
  #15 (npm uninstall) → #16 (dead files) → #17 (dead dataset) →
  #18 (dead exports)

Week 3+ (Tier 1 — migration prep, when ready):
  #2 (archive migrations) → #1 (enable FKs + child deletes) →
  #4 (exercise_preferences) → #5 (photo storage) →
  #3 (uuid + updated_at + tombstones) → #6 (encryption decision)
```

---

## Token optimization notes (for future sessions)

- **RDD disabled** for this clone (`gentle-ai review mode disable --scope clone`). Re-enable with `gentle-ai review mode enable --scope clone` for critical changes.
- **Subagents reserved for code implementation only**. Analysis done inline by the orchestrator.
- **Estimated savings: ~150-250K tokens per session** by not delegating analysis and skipping RDD for routine changes.
- **Session structure:** prefer shorter focused sessions (3-5 tasks) over marathon sessions. Save context with `mem_session_summary` between sessions.
