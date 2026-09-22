# technical-defects-batch-2

**Status**: in progress — V1 implemented (the documents are corrected, `scripts/ui-metrics.js` and `__tests__/lib/metrics.test.ts` added), awaiting the parent's commit. V2–V7 pending; V8 blocked on an observation; S3-e closed as a decision, not a defect.

**Branch**: `fix/technical-defects-batch-2`, branched from `main` @ `30a7e89` (pushed to `origin/main`).

**TDD**: **strict, ON**. Source: `.pi/project.json` → `gentlePi.strictTDD: true`, plus the user's explicit choice on 2026-09-21. Runner: `npx jest` (focused: `npx jest <path>`). A unit that cannot have a meaningful pre-implementation behaviour test must declare that as a narrow, named exception.

**Gate**: `npx tsc --noEmit` clean and `npx jest` green. Baseline on `30a7e89`: **29 suites / 271 tests**.

**Provenance**: every unit below was mapped read-only on 2026-09-21. The map **corrected the roadmap on five of the seven items and found three defects nobody had listed**. The corrections are load-bearing — acting on the original notes would have fixed a non-bug as if it were live, missed a real one of the same class as the previous batch's, and left two false paragraphs in the document `AGENTS.md` tells every contributor to read before building UI.

---

## Goal

Close the second slice of already-diagnosed leftovers: the living documentation that no longer matches the tree, one real atomicity defect, one dialog that clips at large text, and a set of mechanical consistency items.

---

## V1 — The living documentation tells the truth

**Why first.** `docs/ui-standard.md` is the spec `AGENTS.md` points contributors to before they build or restyle a screen, and two of its current-state paragraphs are measurably false. `docs/roadmap.md` still carries two claims the previous batch disproved and a delivery status that is stale. A spec that lies is worse than a spec that is silent, because it is followed.

**What is false, measured on 2026-09-21 with `scripts/ui-metrics.js`** (the table is a claim set; the run is the data):

| Claim | Where | Measured |
| --- | --- | --- |
| "`<Button>` is used 28 times, but only 14 of those call sites choose a variant … the other 14 fall through to `primary`" | `docs/ui-standard.md:244-247` | **27 call sites, 27 with a variant, 0 fall-throughs.** The "28" was `<ButtonVariant` in `components/ui/Button.tsx`, not a call site |
| "Text glyphs are still the action in 14 places (`✕` 4, `›` 4, `←` 2, `×` 2, `↻` 2)" | `docs/ui-standard.md:251-253` | **0 named glyph actions** (`glyphActions`), but **3 ASCII arrow actions survive** (`glyphAsciiCandidates`): `{'<'}` / `{'>'}` at `app/(tabs)/progress.tsx:182`, `:199`, `:133`. The named sweep is structurally blind to them; the script reports them separately |
| "The `compact` size is passed at 4 call sites" | `docs/ui-standard.md` §9 | **5** (`buttonCompactCallsites`) |
| "31 files still mount a bare `TouchableOpacity` (131 tags in total)" | `docs/ui-standard.md` §9 | 31 files, **129 tags** (`bareTouchableOpacityTags`) |
| "28 of them paint their own `backgroundColor`" | `docs/ui-standard.md` §9 | **28** — confirmed (`ownBackgroundColorFiles`) |
| "`borderRadius.md` (83), `.lg` (37) and `.full` (20)" | `docs/ui-standard.md` §9 | 83 / 37 / **22** (`radiusFull`) |
| The pressable denominator "10 of 29" | `docs/roadmap.md:66`, `odd/tasks/ui-action-standard.md:150` | **10 of 33** — the previous batch's own modal-dismissal unit added 4 `Pressable`s to `app/session/[id].tsx` (`pressableAuditDenominator`) |
| `deleteSession` "leaves orphan rows" | `docs/roadmap.md` §4.2 | The deletes are children-first; the residue is a **half-deleted session**. Corrected in the previous batch's doc, still wrong in the roadmap |
| "The N+1 fix landed for the session and home paths" | `docs/roadmap.md` §4.3 | What landed is `Promise.all` **fan-out**; the round-trip count is unchanged |
| `accessibilityHint` "at 36 sites backed by ~30 catalogue keys" (S3-e, from this document) | `odd/tasks/technical-defects-batch-2.md` | **35 sites** backed by **29** keys (`accessibilityHintSites` / `accessibilityHintKeys`); `role="header"` is **0** |
| N2's five `db.transaction` lines `388`, `630`, `744`, `921`, `1110` | this document | the current lines are `388`, `646`, `760`, `937`, `1126`; `:518` is the now-synchronous `deleteSession` |

**Order of work inside this unit matters**: the script runs **first**, and the documents quote the script's output. Writing the numbers first and the script after would reproduce exactly the failure this unit exists to fix.

### The measurement script

`scripts/ui-metrics.js` — Node stdlib only, no dependencies, matching the repository's existing "guard reads source" idiom. It prints named counts, each alongside the exact predicate it used: `modals`, `buttonCallsites`, `buttonVariants`, `pressablesByFile`, `bareTouchableOpacityFiles` + tags, `ownBackgroundColorFiles`, `radii` (md/lg/full), `glyphActions`, `unlabelledInteractive`, `catalogueKeys.es` / `.en`.

**A trap the script must not fall into**: a glyph metric that searches only `✕ › ← × ↻` will report a clean tree forever, because the app's surviving arrow glyphs are **ASCII `<` and `>`** (`app/(tabs)/progress.tsx:182`, `:199`, `:133`). §9's own text warns about exactly this shape of blindness, and the previous session lost two marks to a structurally blind sweep. Report ASCII candidates separately and let the reader judge whether each is an action or typography — do not silently fold them into a single number.

**Scope note for later units.** Judged by the script's output, all three ASCII candidates are actions: two month-navigation controls and the session-row chevron. The named-glyph migration is therefore complete but the glyph work is not — §9 names five characters and never mentions ASCII. A later unit either extends the rule to ASCII arrows or accepts them as typography; this document's own "0 glyph actions" framing would have ended the work one screen early, which is exactly the drift the scripted block exists to catch.

**The invariant test**: `__tests__/lib/metrics.test.ts` imports the same module, parses the
`ui-metrics` block out of `docs/ui-standard.md`, and asserts **both** that every quoted count equals
the measurement and that the invariants hold — `buttonVariants === buttonCallsites`,
`glyphActions === 0`, `unlabelledInteractive === 0`, `catalogueKeys.es === catalogueKeys.en`. The
quoted numbers are the reported output; the equality against the block is what stops the drift from
returning silently. (`flatten()` already exists in
`__tests__/lib/i18n/catalog-parity.test.ts:18-29`, and the script mirrors it; the catalogue count was
nearly free.)

### The roadmap corrections

- §4.2 and §4.3: correct both claims (the half-deleted session; fan-out is not batching).
- §0: record that `main` was pushed (`616a25a..79df39e`, then `79df39e..30a7e89`) and that the previous batch landed as six units.
- Record the two defects the map found and nobody had listed: **N1** (`PRAGMA foreign_keys` is never enabled anywhere, so every declared `ON DELETE CASCADE` is inert and `deleteSessionExercise` leaves genuinely orphaned `sets` rows — a live data-integrity bug, and not a one-liner) and **N2** (the five other `db.transaction` sites carry the same sync-driver defect the previous batch fixed in `deleteSession`).
- §5.2/§5.5: replace the imprecise framings with the map's findings (see V6 and V7).

### S3-e — closed here, as a decision

The `accessibilityHint` and `role="header"` item is **closed, not done**. It has **no origin in this repository**: it appears in no file under `docs/audits/` (the only a11y mention there praises the existing guard), and its single reference is one roadmap line with no provenance, no per-site list and no reason. `accessibilityHint` is already applied selectively at **35 sites** backed by **29** catalogue keys, on inputs, toggles and expand/collapse controls and deliberately omitted where the label plus role already states the outcome — that *is* the principled policy, and it is already implemented. `role="header"` has **zero** occurrences and no candidate list; adding one would be a new convention with no rule to violate, and `docs/ui-standard.md` says nothing about heading roles. Record the policy and the reasoning in the roadmap so the item stops re-entering batches.

**Allowed edit surfaces**: `docs/ui-standard.md`, `docs/roadmap.md`, `odd/tasks/ui-action-standard.md`, `scripts/ui-metrics.js`, `__tests__/lib/metrics.test.ts`, `odd/tasks/technical-defects-batch-2.md`.

---

## V2 — `handleDeleteSuperSet` is not atomic

**This is the real defect that B8 was hiding.** `app/session/[id].tsx:582-588` awaits an unlink plus **two separate `deleteSessionExercise` mutations** with no transaction, and it only ever deletes `members[0]` and `members[1]`. `deleteSessionExercise` (`lib/db/queries.ts:734`) never clears `supersetPairId`. A failure between the three operations, or a group with any other member count, leaves a row holding a dangling pair id — which is precisely the one-member orphan case the renderer's own comment at `app/session/[id].tsx:687` acknowledges.

Same class as the previous batch's U1, which now has a harness to copy: `__tests__/lib/db/delete-session-atomicity.test.ts` drives the real `drizzle-orm/expo-sqlite` session over a fake expo-sqlite client backed by `node:sqlite`. **The callback must stay synchronous** (`.run()`, no `await` inside): the session never awaits its callback, so `COMMIT` fires at the first `await` and later statements run in autocommit.

**B8 itself is not a live bug and must be documented as such, not fixed as one.** No UI can produce a superset with anything other than two members: pairing is binary at all three entry points (`app/session/[id].tsx:513-522`, `:524-556`, and the intensity-method bridge at `components/session/SessionExerciseItem.tsx:221-226`), the partner picker filters out already-paired rows (`:782`), `SupersetBlock` receives no pairing callback at all (`:666-684`), its only delete is `onDeletePair` (both members), and the migration added the column with no backfill (`lib/db/index.ts:151-153`). It is also **not data-losing** — each member renders standalone with its sets intact. What is lost is the pairing UI, silently.

**Do not "fix" it by routing every group size through `SupersetBlock`**: that component reads only `exercises[0]` and `exercises[1]` (`components/session/SupersetComponents.tsx:138-139`), so a three-member group would **silently drop the third** — worse than today. Making the block N-wide is a redesign, not a fix.

**Fix shape**: make the delete path atomic, and make the ≠2 case an explicit, visible outcome instead of a silent fallthrough. A strict-TDD-testable version wants the grouping predicate extracted into a pure helper (nothing in `lib/utils/` does it today; `lib/utils/session-sets.ts` is the nearest sibling).

**Allowed edit surfaces**: `app/session/[id].tsx`, `lib/db/queries.ts`, `lib/utils/`, `__tests__/lib/db/`, `__tests__/lib/utils/`, `__tests__/components/`.

---

## V3 — The custom-rest dialog clips at large text, and the bigger cause is horizontal

`components/session/SessionExerciseItem.tsx:523-581`. The note said "bound-only"; the card **already carries** `maxHeight: MODAL.MAX_HEIGHT` at `:526`. What is actually missing:

- **No scrollable body.** Title, input row and buttons are all direct children of the card with fixed padding, so at large text the last child — the Cancel/Save row — is the overflow and there is nothing to absorb it. The fix is the standard's own rule (`docs/ui-standard.md:145-158`): a body `ScrollView` with `flexShrink: 1` and `maxHeight: MODAL.MAX_BODY_HEIGHT`, actions as siblings after it. `ScrollView` is **not currently imported** in that file (`:1`).
- **A hard `width: 280`** on a `flexDirection: 'row'` containing two `width: 80` inputs plus three scaled texts (`:528-554`), with no `flexWrap` and no `flexShrink` — so it clips **horizontally** before height is ever the issue. Replace with `width: '100%', maxWidth: MODAL.MAX_WIDTH`.
- **No `onRequestClose`** (`:524`), the same gap the previous batch fixed on the bottom sheets.

**Copy the right reference.** `docs/ui-standard.md:140-141` names `components/progress/RoutinePickerModal.tsx` as a reference, but it uses **literals** (`maxHeight: '70%'`, `<ScrollView style={{ maxHeight: 360 }}>` with no `flexShrink`) and never imports the tokens. The reference with a committed test is `app/routine/[id].tsx:450-452`.

**Two neighbours in the same state, worth listing while here**: `app/session/history/[id].tsx:257-258` (`maxWidth: MODAL.MAX_WIDTH` but **no `maxHeight` at all**) and the rest-picker block starting at `components/session/SessionExerciseItem.tsx:466`.

**Test home**: no test file exists for this component. Model on `__tests__/components/routine-start-modal.test.ts` (card bound, scroll region present, body cap, `flexShrink`, actions after the scroll region). Declare the source-structural exception.

**Allowed edit surfaces**: `components/session/SessionExerciseItem.tsx`, `__tests__/components/custom-rest-modal.test.ts`, `docs/ui-standard.md`.

---

## V4 — The mechanical consistency items

Three of these are token substitutions; one is a real untranslated string. None needs a design decision.

**Four `fontWeight` without `fontFamily`** (the roadmap says 6; measured, **4 are mechanical and 2 are a decision**):
- `components/session/SessionExerciseItem.tsx:540` and `:553` → `fonts.bodySemiBold`.
- `app/routine/create.tsx:218` → `fonts.bodySemiBold` (or `fonts.display` — see the decision below).
- `components/ExerciseNotes.tsx:179` → `fonts.bodyMedium` (500 ↔ `fontWeights.medium`; its sibling `typeIconText` at `:150` already does exactly this).
- **The decision pair**: `app/(tabs)/index.tsx:212` and `:218` are stat *values*, whose convention elsewhere is the display face (`app/session/history/[id].tsx:137`, `:141` use `fonts.display` + `fontWeights.bold`). Picking `fonts.display` matches history; picking `fonts.bodySemiBold` matches `ConfirmDialog`. This changes which typeface the user sees on the home screen, so it is **not** a mechanical swap — flag it, do not guess.
- **A seventh site the note missed**: `components/NewRecordBanner.tsx:86` sets `fonts.bodyMedium` **with** `fontWeights.bold` — a family/weight mismatch (500 family, 700 weight). Include it.

**Two untranslated strings, not one** — `app/session/history/[id].tsx:342` (`{completedSets.length} sets • …`) and `:360` (`{set.reps ?? '-'} reps × …`). Both are English hard-coded in JSX on a screen whose every other string is translated. **The catalogue keys already exist** (`session.set`, `session.sets`, `session.reps`, `session.collapsedSummary`), and `app/routine/[id].tsx:396` is the already-fixed version of the same sentence — copy that shape. Both sites are inside the file-local `SessionExerciseSummary` (`:319-365`).

**A sibling nobody listed, same class and arguably worse**: `components/RoutineCard.tsx:20` hand-rolls English pluralization — `` `${exerciseCount} exercise${exerciseCount !== 1 ? 's' : ''}` `` — so a Spanish user reads "5 exercises". It is also the **only** place in the app that computes an exercise count today, which matters for V6.

**Allowed edit surfaces**: `components/session/SessionExerciseItem.tsx`, `app/routine/create.tsx`, `components/ExerciseNotes.tsx`, `app/(tabs)/index.tsx`, `components/NewRecordBanner.tsx`, `app/session/history/[id].tsx`, `components/RoutineCard.tsx`, `lib/i18n/es.json`, `lib/i18n/en.json`, `__tests__/`.

---

## V5 — The `!exercise` early return is not an outlier; it is 14 files

The note called this a §4.9 cosmetic item on one screen. It is the §1 rule ("never use a raw `View` as a screen root: when the native header is hidden, nothing else offsets the content") violated in **14 places**, and the whole `app/progress` group hides the native header (`app/progress/_layout.tsx:7`).

The same bare early return exists at: `app/progress/exercise-detail/[id].tsx:302-331` (the one the note names), `app/progress/exercises.tsx:176-185`, `app/progress/statistics.tsx:140`, `app/progress/measurements.tsx:215`, `app/(tabs)/routines.tsx:104`, `app/(tabs)/index.tsx:186`, `app/session/history/index.tsx:17`, `app/session/history/[id].tsx:59`, `app/session/new.tsx:89`, `app/session/[id].tsx:297`, `app/exercise/[id].tsx:158`, `app/exercise/create.tsx:60`, `app/routine/[id].tsx:264`, `app/routine/create.tsx:136`, `app/routine/folder/[id].tsx:131`.

**Two traps**: the three tab screens keep the native header and must pass `edges={[]}` (`docs/ui-standard.md:32-34`) or they will double-pad; and `app/session/history/[id].tsx:49-55` uses a **raw `View`** as its `isNaN` root — a literal §1 violation the note does not mention.

**This needs a scope decision** (one screen, or all 14) before it is a unit, because it is a 14-file sweep and it changes layout on nearly every screen. Not started.

**Allowed edit surfaces**: TBD pending the decision.

---

## V6 — Delete `session.exerciseCount`, and do not confuse it with its two live namesakes

`components/SessionCard.tsx:9` declares `exerciseCount?: number`, `:29-33` renders it, and **no caller passes it** — both call sites are `app/session/history/index.tsx:36` and `app/(tabs)/index.tsx:265`, and neither passes a count. `lib/i18n/es.json:209` / `en.json:209` hold the orphan key.

**Three same-named keys exist and only one is dead**: `session.exerciseCount` (orphan, `es.json:209`), `session.new.exerciseCount` (**live**, `app/session/new.tsx:107`), `progress.exerciseCount` (**live**, `app/(tabs)/progress.tsx:127`). Deleting the wrong one is easy.

**Delete it — this is the recorded decision, three times over**: `docs/audits/03-dead-code.md:61`, `:88` (F2) and `:102` (cleanup step 6), plus `docs/audits/00-consolidated.md:56` (row 18, P3). Nothing in the roadmap, the audits or the batch docs says a session-list row should show an exercise count, and the two callers show name, relative date and notes.

**One honest counterpoint to record**: the map found that wiring it is *smaller than the roadmap implies* — `app/(tabs)/index.tsx:265` already has per-session counts available (`lib/progress/queries.ts:45` surfaces `exerciseCount`), so only the history index would need a new grouped count (the precedent is `getRoutineSessionCounts`, `lib/db/queries.ts:282-304`). So this is a deliberate decision to delete, not an elimination by cost. Say that in the commit.

**Also in this unit**: `components/RoutineCard.tsx:20`'s hand-rolled English plural (V4) is the only live exercise count; if the key is deleted, that string must adopt a proper translated key, not be left as the last English plural in the app.

**TDD note**: this is deletion-only, so a failing test must assert an **absence**. `__tests__/lib/i18n/catalog-parity.test.ts` is key-set based and has no reverse check, so it cannot fail on an orphan key today. A whole-repo orphan sweep is a separate unit with a real false-positive problem (template-literal and dynamic keys). **Declare the exception** and rely on `tsc` + the existing suite, or add the orphan sweep as its own unit.

**Allowed edit surfaces**: `components/SessionCard.tsx`, `lib/i18n/es.json`, `lib/i18n/en.json`, `components/RoutineCard.tsx`.

---

## V7 — Prune three stale tokens from the Jest transform allow-list

`jest.config.js:5` names `@sentry/react-native` **and `native-base`**, and both are absent — `package.json` has neither, and `node_modules/@sentry/react-native/package.json` and `node_modules/native-base/package.json` both return ENOENT (control: `node_modules/react-native-svg/package.json` reads fine, so the reads do see `node_modules`). `native-base` was already recorded in `docs/audits/00-consolidated.md:53` (row 15), whose remedy explicitly includes pruning the Jest config.

**Removal is safe**: the pattern is a transpilation allow-list, so an entry naming an absent package is inert; and removing an alternative from the negative lookahead can only *widen* the ignore set, which surfaces immediately as a Jest syntax error, not a silent pass. The existing suite is a sufficient gate.

**Do not budget work against the `expo-updates` comparison.** The roadmap calls this "the same shape as the `expo-updates` hit knip reported", but `expo-updates` is absent from the tree entirely (`package.json`, `package-lock.json`, `app.json`, `node_modules`), knip is not a dependency of this repository, and the only mention of it anywhere is that roadmap line. Treat them as unrelated.

**TDD exception**: nothing in `__tests__` reads `jest.config.js`, so no assertion worth writing can fail here. A guard that reads `node_modules` from a test would add a dependency I do not want. **Declare the exception**; the gate is the existing suite.

**Allowed edit surfaces**: `jest.config.js`.

---

## V8 — The empty Progreso card: BLOCKED on one observation

The map **could not diagnose it from the source, and proved the two candidate cards cannot render an empty interior**: the calendar grid always renders 42 cells with 1-31 day numbers (`lib/progress/calendar.ts:1-18`) and its month label and count are always resolvable (`app/(tabs)/progress.tsx:316`); the selected-day card always has a hard-coded title (`:326-328`) and cannot survive a month change (`:299-300`).

**Leading hypothesis, and it is a shared-primitive problem**: `components/ui/EmptyState.tsx:31` and `components/ui/LoadingSpinner.tsx:9` are both `flex: 1` **and** `backgroundColor: colors.bg.primary` — one shade below `bg.card`. Rendered inside a content-sized `cardStyle` container (`app/(tabs)/progress.tsx:379-387`), a `flex: 1` child inside a `ScrollView` is the classic zero-height-collapse setup, and it paints a screen-coloured slab inside a card. `QueryState` picks that branch precisely when the month has no sessions.

**The discriminator is the screenshot the note came from**: is there a **"Sesiones del mes" line above the empty box, inside the same border**? If yes, this is the collapsed empty state, not a mystery card. If no, it is a real fourth container and the screenshot predates `30a7e89`. Also worth observing: the selected month and the account's actual data, and a **clean cold start** repro (the repository already learned that Fast Refresh after a structural JSX change fakes layout measurements).

**If confirmed, the fix is a presentation rule, not a condition change** — and it touches shared primitives used by 17 screens, so it needs its own unit and its own decision. `docs/ui-standard.md` §7 currently says nothing about how `QueryState` should look *inside* a container, which is the gap that produced the screenshot.

---

## V9 — The ASCII arrows were the blind spot §9 warned about (found during V1)

V1's sweep for the five named glyphs (`✕ › ← × ↻`) reported zero and was **structurally blind** to the three that survived: `{'<'}` and `{'>'}` as standalone JSX children in `app/(tabs)/progress.tsx`. The script reports them separately as `glyphAsciiCandidates` precisely so they could never be folded into a comfortable zero — that decision is what surfaced this unit.

**The three sites — all actions, none typography:**

| Site | Today | Replaced with | Copied from |
| --- | --- | --- | --- |
| `app/(tabs)/progress.tsx:133` — session-row chevron | `{'>'}` | `chevron-forward` size 16, `text.muted` | `components/progress/NavigationButton.tsx:50` (the app's row chevron) |
| `:182` — month back | `{'<'}` | `chevron-back` size 20, `text.secondary` | counterpart of the row chevron; keeps the 36×36 control balanced |
| `:199` — month forward | `{'>'}` | `chevron-forward` size 20, `text.secondary` | same |

All three sit inside already-labelled `Pressable`s (`accessibilityLabel` + `accessibilityRole="button"`). The labels were not touched, so `unlabelledInteractive` stays **0**; the icon carries no separate accessible name, which is the app's convention for an icon inside a labelled pressable (`components/ui/ScreenHeader.tsx:58-60`).

**The invariant.** `__tests__/lib/metrics.test.ts` now asserts `glyphAsciiCandidates === 0` next to `glyphActions === 0`. It failed before the fix — **Expected: 0, Received: 3** — and is the only thing that keeps this class from creeping back silently. A second, source-structural test pins the three Ionicons and the two month labels, because the metric's `unlabelledInteractive` counter accepts a label OR a role and would stay green if a site lost its label.

**Measured before/after** (`node scripts/ui-metrics.js`): `glyphAsciiCandidates` **3 → 0**, and no other metric moved. All three candidates were actions, so the remainder after the fix is empty — **the predicate was not changed**, and no refinement was needed. §9's typography boundary was not exercised by this unit.

**Allowed edit surfaces**: `app/(tabs)/progress.tsx`, `scripts/ui-metrics.js`, `__tests__/lib/metrics.test.ts`, `docs/ui-standard.md`.

---

## Closed here, deliberately

- **S3-e** (`accessibilityHint` / `role="header"`) — closed as a decision in V1: no origin in the repository, and the hint policy is already implemented at 35 sites.
- **The `accessibilityHint`-adjacent TextInput guard** — **not a defect**: all 31 `<TextInput>` sites already carry an `accessibilityLabel`, so a guard has **zero** offenders and no test can fail against the current tree. It is coverage, not repair, and it carries two real design holes worth its own unit: `components/ui/Input.tsx:30-31` sets `accessibilityLabel={label}` where `label` is optional and `{...props}` spreads **after** it, so a caller can silence it while the guard stays green; and the guard's accepted list (`accessibilityRole`, `accessible={false}`) must be per-element-kind — `accessible={false}` on a text input is not a valid exemption.

---

## Gate

- `npx tsc --noEmit` — clean.
- `npx jest` — green. Baseline on `30a7e89`: 29 suites / 271 tests. Every unit states the numbers it observed.
- Per unit: the focused test observed failing first (RED), then passing (GREEN), with the exact commands reported; exceptions declared by name.
- One work-unit commit per unit on `fix/technical-defects-batch-2`. Merge and push stay the user's decision.

## Revert

One commit per unit, so `git revert <sha>` per unit is clean. V1 touches documents plus one new script and one new test. V2 changes `deleteSession`-class transaction internals and the superset delete path. V3 is confined to one dialog. V4 is token substitutions plus two strings. V6 is a deletion. V7 is two tokens in one line.
