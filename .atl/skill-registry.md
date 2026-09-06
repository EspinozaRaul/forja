# Skill Registry — Forja (Gentle Pi)

> **Project**: forja (formerly fitness-tracker)  
> **Platform**: Gentle Pi (migrated from Open Code)  
> **Updated**: 2026-08-31

---

## Active Skills (Gentle Pi)

| Name | Trigger | Path | Status |
|------|---------|------|--------|
| branch-pr | Create Gentle AI pull requests with issue-first checks. Trigger: creating, opening, or preparing PRs for review. | `~/.pi/agent/npm/node_modules/gentle-pi/skills/branch-pr/SKILL.md` | active |
| chained-pr | Trigger: PRs over 400 lines, stacked PRs, review slices. Split oversized changes into chained PRs that protect review focus. | `~/.pi/agent/npm/node_modules/gentle-pi/skills/chained-pr/SKILL.md` | active |
| cognitive-doc-design | Design docs that reduce cognitive load. Trigger: writing guides, READMEs, RFCs, onboarding, architecture, or review-facing docs. | `~/.pi/agent/npm/node_modules/gentle-pi/skills/cognitive-doc-design/SKILL.md` | active |
| comment-writer | Write warm, direct collaboration comments. Trigger: PR feedback, issue replies, reviews, Slack messages, or GitHub comments. | `~/.pi/agent/npm/node_modules/gentle-pi/skills/comment-writer/SKILL.md` | active |
| go-testing | Trigger: Go tests, go test coverage, Bubbletea teatest, golden files. Apply focused Go testing patterns. | `~/.pi/agent/npm/node_modules/gentle-pi/skills/go-testing/SKILL.md` | active |
| issue-creation | Create Gentle AI issues with issue-first checks. Trigger: creating GitHub issues, bug reports, or feature requests. | `~/.pi/agent/npm/node_modules/gentle-pi/skills/issue-creation/SKILL.md` | active |
| judgment-day | Trigger: judgment day, dual review, adversarial review, juzgar. Run explicit blind dual review with at most two scoped fix/re-judgment rounds. | `~/.pi/agent/npm/node_modules/gentle-pi/skills/judgment-day/SKILL.md` | active |
| skill-creator | Trigger: new skills, agent instructions, documenting AI usage patterns. Create LLM-first skills with valid frontmatter. | `~/.pi/agent/npm/node_modules/gentle-pi/skills/skill-creator/SKILL.md` | active |
| skill-improver | Trigger: improve skills, audit skills, refactor skills, skill quality. Audit and upgrade existing LLM-first skills. | `~/.pi/agent/npm/node_modules/gentle-pi/skills/skill-improver/SKILL.md` | active |
| skill-registry | Trigger: update skills, skill registry, actualizar skills, after skill changes. Index available skills by trigger and path. | `~/.pi/agent/npm/node_modules/gentle-pi/skills/skill-registry/SKILL.md` | active |
| work-unit-commits | Plan commits as reviewable work units. Trigger: implementation, commit splitting, chained PRs, or keeping tests and docs with code. | `~/.pi/agent/npm/node_modules/gentle-pi/skills/work-unit-commits/SKILL.md` | active |
| release | Release gentle-pi through GitHub and npm. Trigger: release, publish, npm publish, GitHub release, version bump. | `~/.pi/agent/npm/node_modules/gentle-pi/skills/release/SKILL.md` | active |
| gentle-ai | Use Gentle AI harness discipline for Pi work: clarify first, preserve OpenSpec artifacts, use strict TDD where available, delegate through subagents when useful, and protect review workload. | `~/.pi/agent/npm/node_modules/gentle-pi/skills/gentle-ai/SKILL.md` | active |

## SDD Skills (Gentle Pi)

| Name | Trigger | Path | Status |
|------|---------|------|--------|
| sdd-init | Bootstrap SDD context and project configuration | `~/.pi/agent/npm/node_modules/gentle-pi/skills/gentle-ai/SKILL.md` | active |
| sdd-explore | Investigate codebase and think through ideas | `~/.pi/agent/npm/node_modules/gentle-pi/skills/gentle-ai/SKILL.md` | active |
| sdd-propose | Create change proposals from explorations | `~/.pi/agent/npm/node_modules/gentle-pi/skills/gentle-ai/SKILL.md` | active |
| sdd-spec | Write detailed specifications from proposals | `~/.pi/agent/npm/node_modules/gentle-pi/skills/gentle-ai/SKILL.md` | active |
| sdd-design | Create technical design from proposals | `~/.pi/agent/npm/node_modules/gentle-pi/skills/gentle-ai/SKILL.md` | active |
| sdd-tasks | Break down specs and designs into implementation tasks | `~/.pi/agent/npm/node_modules/gentle-pi/skills/gentle-ai/SKILL.md` | active |
| sdd-apply | Implement code changes from task definitions | `~/.pi/agent/npm/node_modules/gentle-pi/skills/gentle-ai/SKILL.md` | active |
| sdd-verify | Validate implementation against specs | `~/.pi/agent/npm/node_modules/gentle-pi/skills/gentle-ai/SKILL.md` | active |
| sdd-archive | Archive completed change artifacts | `~/.pi/agent/npm/node_modules/gentle-pi/skills/gentle-ai/SKILL.md` | active |
| sdd-onboard | Guide user through a complete SDD cycle using their real codebase | `~/.pi/agent/npm/node_modules/gentle-pi/skills/gentle-ai/SKILL.md` | active |

## Legacy Skills (Open Code — archived)

The following skills were previously used via Open Code and are now superseded by Gentle Pi equivalents:

- All SDD skills (sdd-*) → Now handled by `gentle-ai` skill with SDD workflow
- All review skills (review-*) → Now integrated in Gentle Pi orchestrator
- All judgment-day agents → Now handled by `judgment-day` skill

## Project Convention Files

- `.pi/project.json` — Gentle Pi project configuration
- `.atl/skill-registry.md` — This file
- `.codegraph/` — CodeGraph intelligence index (preserved from Open Code)

## Memory Configuration

- **Engram**: `~/.engram/` — Global memory store with project alias mapping
- **Project aliases**: `forja`, `fitness-tracker`

---

Registry generated: 2026-08-31T19:45:00Z  
Platform: Gentle Pi v0.14.0  
Migration: Open Code → Gentle Pi (complete)
