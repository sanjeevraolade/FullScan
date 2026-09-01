# Migration: GitHub Copilot workspace → Claude Code

This repo previously carried a full "Copilot workspace" under `.github/` (instructions, agents,
prompts, skills). The project is now developed with Claude Code, so that workspace has been migrated
into the equivalent Claude Code structures and removed. This document records what changed and why,
so the mapping isn't lost.

## What was created

### `CLAUDE.md` (repo root)

Always-loaded project brief. Condensed from `FULLSCAN_MASTER_PROMPT.md`, `.github/PROJECT_CONTEXT.md`,
and `.github/copilot-instructions.md`: project identity, tech stack, the frozen layered architecture
and `src/` folder ownership table, the ten Runtime Engines, non-negotiable platform rules, coding
conventions, and a note on current build status (docs/architecture complete, `src/` implementation is
still a near-empty scaffold — see "Current status" section in the file itself).

### `.claude/agents/` — 5 role subagents

Converted from `.github/agents/*.agent.md`, condensed from ~350–520 lines each to ~50–90 lines,
keeping mission, source-of-truth docs, decision rules, review checklists, and "never do this" lists.
`model` was changed from the original `GPT-5` to `inherit` (Claude Code subagents use `sonnet` /
`opus` / `haiku` / `inherit`, not third-party model names).

| Old | New |
|---|---|
| `solution-architect.agent.md` | `.claude/agents/solution-architect.md` |
| `runtime-engineer.agent.md` | `.claude/agents/runtime-engineer.md` |
| `mobile-engineer.agent.md` | `.claude/agents/mobile-engineer.md` |
| `integration-engineer.agent.md` | `.claude/agents/integration-engineer.md` |
| `qa-engineer.agent.md` | `.claude/agents/qa-engineer.md` |
| `reviewer.agent.md` | **not migrated** — declined during this session; the source content was read but the file was intentionally not written. Recreate from `.github`'s git history if wanted later. |

### `.claude/skills/` — 14 domain skills

Converted from `.github/instructions/*.instructions.md` (+ `.github/skills/SKILLS.md`, since the
individual `*.skill.md` files were all empty placeholders). Each skill has a `description` written as
a trigger condition so Claude loads it automatically when working in that area, instead of every rule
being crammed into the always-loaded `CLAUDE.md`.

| Old instructions file | New skill |
|---|---|
| `architecture.instructions.md` | `fullscan-architecture` |
| `engineering-standards.instructions.md` | `fullscan-engineering-standards` |
| `runtime.instructions.md` | `fullscan-runtime-engine` |
| `widget.instructions.md` | `fullscan-widget-development` |
| `dynamic-form.instructions.md` | `fullscan-dynamic-form` |
| `validation.instructions.md` | `fullscan-validation` |
| `configuration.instructions.md` | `fullscan-configuration-engine` |
| `attachment.instructions.md` | `fullscan-attachment-engine` |
| `synchronization.instructions.md` | `fullscan-synchronization-engine` |
| `security.instructions.md` | `fullscan-security` |
| `theme.instructions.md` | `fullscan-theme-engine` |
| `localization.instructions.md` | `fullscan-localization` |
| `state.instructions.md` | `fullscan-state-management` |
| `navigation.instructions.md` | `fullscan-navigation` |

`api.instructions.md`, `code-review.instructions.md`, `logging.instructions.md`,
`testing.instructions.md`, and `workflow.instructions.md` were empty in the source and had nothing to
migrate; their relevant rules (logging, testing expectations) that existed elsewhere (mainly
`copilot-instructions.md`) were folded into `CLAUDE.md` and `fullscan-engineering-standards` instead.

### `.claude/commands/` — 7 slash commands

Converted from `.github/prompts/*.prompt.md` (the current flat-numbered set — the older
`.github/prompts1/` set was explicitly excluded from migration per your decision). Commands are
shorter than the originals: instead of repeating the full rule set inline, each one points at the
relevant `.claude/skills/*` skill(s) and gives a completion checklist. The shared
`00-prompt-execution-rules.md` "how Copilot should think before generating code" content was folded
into `CLAUDE.md` rather than duplicated in every command.

| Old prompt | New command |
|---|---|
| `01-create-feature.prompt.md` | `/create-feature` |
| `02-create-screen.prompt.md` | `/create-screen` |
| `03-create-widget.prompt.md` | `/create-widget` |
| `04-create-runtime-engine.prompt.md` | `/create-runtime-engine` |
| `05-create-api.prompt.md` | `/create-api` |
| `06-create-repository.prompt.md` | `/create-repository` |
| `07-create-state.prompt.md` (was empty in source) | `/create-state` — written from scratch, following the same pattern as the sibling commands and the `fullscan-state-management` skill (Zustand store slices only — session/theme/config/localization, never business entities) |

## What was removed

From `.github/`: `copilot-instructions.md`, `agents/`, `instructions/`, `skills/`, and the current
`prompts/` (the flat `00-08` set). All of their content is now represented above.

**Kept as-is** in `.github/`: `PROJECT_CONTEXT.md` and `PROJECT_GLOSSARY.md` (tool-agnostic project
reference, not Copilot-specific), `workflows/` (CI), `modernize/java-upgrade/` (unrelated tooling).
`README.md` was updated in place to point at the new Claude structure instead of the old Copilot one.

**Not touched, out of scope for this pass** — `.github/prompts1/` (the older, unmigrated prompt set —
was already gone from your working tree before this session started, as an uncommitted deletion from
your own prior restructuring work, not something this migration did) and `.github/modernize/`.

## Known stale content flagged, not fixed

Two things this migration surfaced but didn't touch, since fixing them wasn't part of the request:

- **Root `README.md` and `AGENTS.md`** describe an older `mobile/` + `server/` monorepo layout that no
  longer matches the actual `src/` structure or `CLAUDE.md`. Root `README.md`'s "Project Structure"
  tree is the most visibly wrong part. Worth a separate rewrite pass.
- **`.github/PROJECT_CONTEXT.md`** still says `Current Project Phase: Phase 2 — GitHub Copilot
  Workspace`, and **`.github/PROJECT_GLOSSARY.md`** still defines a `Copilot Workspace` glossary term.
  Left as-is per your instruction to keep both files, but they're now slightly out of date.

## Net effect

```
.github/copilot-instructions.md  ┐
.github/agents/*.agent.md         ├──►  CLAUDE.md + .claude/agents/*.md
.github/instructions/*.md         ├──►  .claude/skills/*/SKILL.md
.github/prompts/*.prompt.md       ┘  ┴─►  .claude/commands/*.md
.github/skills/*.skill.md (empty stubs, SKILLS.md had the real content) ──►  folded into skills above
```
