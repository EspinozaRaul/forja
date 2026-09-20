# Feature: Pi subagent effort routing — closing the reasoning-cost hole

**Workflow**: ODD (Organic Driven Development)
**Owner**: parent orchestrator session
**Scope**: global Pi configuration (`~/.pi/agent/`), not Forja application code
**Status**: closed — applied, verified; one depth floor restored after the cost decomposition (task 9)

---

## Goal

Stop the subscription bleed caused by Pi silently running every configured `low`/`medium`
effort at `high`, without degrading the roles where reasoning depth protects correctness.

## Constraints

1. The orchestrator (`settings.json` `defaultModel`) keeps strong reasoning. Decided by the
   user: coordination quality is worth the cost.
2. Cost reduction is the objective. Pi's own recommendation table is **input, not authority** —
   it must not be used to justify leaving a cost hole open.
3. Where Pi flags something as *important* (verification and adversarial judgment being strong,
   fresh-context), that advice is honored.
4. Never degrade a safety-relevant role (verification, remediation) as a side effect of changing
   a default.

---

## Root cause (evidence, not inference)

Pi treats a configured effort as a **request**. It clamps the request to the levels the model
actually exposes, and it rounds **upward**.

- `~/.pi/agent/models-store.json` → `opencode-go/deepseek-v4.1-flash` declares
  `thinkingLevelMap = {"minimal":null,"low":null,"medium":null,"high":"high","max":"max"}`.
- `dist/bundle/chunks/chunk-IDDQWTHI.js` → `getSupportedThinkingLevels()` drops every level whose
  map value is `null` (and requires an explicit mapping for `xhigh`/`max`), yielding
  `["off","high","max"]`; `clampThinkingLevel()` then scans upward before downward.
- Net effect: `medium`, `low` and `minimal` all became **`high`**. Only `off` survived below.
- The clamp runs at session creation, so it applied to the orchestrator *and* to every child
  process the subagent runner spawned.

Two contributing defects found along the way:

- `PI_REASONING_LEVEL` is **output-only** in pi 0.85.1 (`dist/core/tools/bash.js:125,137`).
  Nothing reads it as input, so `export PI_REASONING_LEVEL=medium` in `~/.zshrc:9` never did
  anything. A previously recorded "cost lever" was a false premise.
- `subagents.json` `default_model` + `default_effort` is a silent trap: four agents had no
  explicit profile and therefore inherited it. They ran at `high` while the config read `low`.
  `gentle-ai-explore` — the measured cost center — was one of them.

## Gate (blocking)

`thinkingLevelMap[level] === null` means that level does not exist for that model. No config key
can produce it: per-model overrides (`settings.json` `modelThinkingLevels`) and
`defaultThinkingLevel` are applied *before* the clamp, so the model overwrites them too. The only
lever is the model choice. Models that honor a medium cap: `qwen3.8-flash`, `longcat-2.0`,
`minimax-m3`, `qwen3.7-plus`, `qwen3.6-plus` (`thinkingLevelMap` null → unrestricted);
`gpt-5.6-luna`, `grok-4.6`, `qwen3.8-max`, `muse-spark-1.3-contributor` (explicit `medium`).

---

## Tasks

| # | Task | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Diagnose why effort reads `high` against a `medium` cap | done | models-store `thinkingLevelMap`; `chunk-IDDQWTHI.js` clamp; session transcripts |
| 2 | Establish effective levels empirically before touching config | done | `deepseek-v4.1-flash:medium` → transcript records `high` (control) |
| 3 | Confirm the intended model is entitled on the plan | done | `qwen3.8-flash:medium` → `medium`; `qwen3.8-flash:low` → `low` |
| 4 | Pin safety-relevant roles explicitly *before* changing the default | done | `gentle-ai-verify`, `sdd-remediate` → deepseek `high` |
| 5 | Move the cheap tier to a model where `low`/`medium` hold | done | edit in `~/.pi/agent/subagents.json` |
| 6 | Verify the applied routing in a real launch | done | task `mu5pjqin-1-qbt6` + child session: `qwen3.8-flash` / `low` |
| 7 | Measure real spend per subagent before deciding further caps | done | 8 recoverable child sessions; explore = 86% of measured spend |
| 8 | Decide the fate of the tiers still at effective `high` | done | closed: no further cap; rationale in Decision |
| 9 | Restore the exploration depth floor after decomposing the cost | done | `gentle-ai-explore` low → medium on qwen3.8-flash; effective level verified as `medium` |

### Task 5 — applied changes

Backup: `~/.pi/agent/subagents.json.bak-pre-effort-fix-202609171142`

- `default_model`: `deepseek-v4.1-flash` → `qwen3.8-flash` (`default_effort` stays `low`).
- Added the four previously unprofiled agents so the default change could not silently
  downgrade them: `gentle-ai-explore` (qwen3.8-flash/low), `sdd-research` (qwen3.8-flash/medium),
  `gentle-ai-verify` (deepseek/high), `sdd-remediate` (deepseek/high).
- Moved to `qwen3.8-flash`, efforts unchanged and now honored: `sdd-explore` medium,
  `sdd-proposal` medium, `sdd-onboard` medium, `sdd-archive` low, `sdd-init` low, `sdd-status` low.
- Left untouched: `sdd-spec`, `sdd-design`, `sdd-tasks`, `sdd-apply`, `sdd-verify`,
  `gentle-ai-worker`, `jd-fix-agent`, `jd-judge-a`, `jd-judge-b`, `review-*` (4 lenses),
  `image-analyst`.
- Result: 24 profiles, JSON valid, every profile backed by an existing agent definition and a
  model present in the catalog.

### Task 7 — measured spend (small sample, directional)

Only 8 child sessions were recoverable (history is pruned by `historyMaxTasks`), total $0.19.

| agent | runs | cost | tokens in | tokens out | reasoning |
| --- | --- | --- | --- | --- | --- |
| `gentle-ai-explore` | 5 | $0.163 | 556,235 | 88,743 | 51,113 |
| `gentle-ai-worker` | 1 | $0.023 | 38,417 | 23,225 | 13,542 |
| `image-analyst` | 2 | $0.004 | 25,890 | 2,714 | 523 |

Exploration was 86% of measured spend. In `gentle-ai-explore`, 58% of billed output tokens were
reasoning — the dominant term, pinned at the `high` ceiling. This is the hole tasks 4–5 closed.

## Decision (closed 2026-09-17): close here — no further cap

Chosen by the user: **option 1**. The measured hole is closed, and further capping buys nothing
measurable. Residual cost is to be attacked with volume levers, not by lowering reasoning depth.

Rationale from the measurement, not from Pi's recommendation table:

- `sdd-spec`, `sdd-design`, `sdd-tasks` are one-shot and low-volume; capping them is declarative
  consistency, not savings.
- The writers and the four review lenses are the remaining structurally expensive roles, and they
  are where reasoning depth protects correctness.
- Estimated from the measured `gentle-ai-worker` token shape, capping at
  `gpt-5.6-luna`/`medium` *raises* cost (~$0.023 → ~$0.029 per run) because its output price is
  double. Only `qwen3.8-flash`/`medium` cuts it (~39% per run) — at the cost of writing code on a
  flash-tier model.

### Amendment (same day): the effort lever is second-order for exploration

Decomposing the measured spend per token term corrected the framing above. For
`gentle-ai-explore`, input context is **61%** of the attributable cost — 111,247 input tokens per
run — while the *entire* effort range (high→low) is worth only ~15% of a run. Cutting that agent to
`low` traded 5x reasoning depth for a 15% saving: a poor exchange on the layer that produces the
audits. Raised to `medium` in task 9, which recovers 4x the depth (2,000 → 8,000 reasoning tokens)
for ~$0.003 per run, 11% of that run.

Note the asymmetry: for `gentle-ai-worker` the output dominates (71% of cost, 58% of it reasoning),
so the effort lever is worth ~30% per run there — strongest exactly where depth protects
correctness. Exploration cost is a **context-volume** problem, not a depth problem; the lever is
narrower scopes and file-only child reports.

Rejected alternatives, recorded so this is not re-litigated:

- **Cap the artifact tier only.** Expected saving near zero, so the agreement would be satisfied on
  paper and unchanged in practice.
- **Cap everything, writers and reviewers included.** A real quality risk for a saving that
  `gpt-5.6-luna` does not even deliver.

## Next steps (follow-up, not part of this feature)

1. Volume levers for the writers and the review lenses: implementation-only subagent policy and
   `outputMode: file-only` for large child reports, so only decisions, blockers and paths enter
   the parent thread.
2. Gather more evidence before any future cap decision: accumulate several runs of the four
   review lenses and the writers. Current data is 8 recoverable sessions, pruned by
   `historyMaxTasks`.
3. `~/.zshrc:9` (`export PI_REASONING_LEVEL=medium`) is dead weight and can be deleted: the
   variable is output-only in pi 0.85.1.

## Process note

This document is left untracked and uncommitted in Forja. ODD's work-unit commit rule was not
applied here: the change touched global Pi configuration rather than Forja code, the working tree
carries unrelated in-progress work, and the repository is on `main`. Committing requires an
explicit user request and a feature branch.

## Revert

```bash
cp ~/.pi/agent/subagents.json.bak-pre-effort-fix-202609171142 ~/.pi/agent/subagents.json
```
