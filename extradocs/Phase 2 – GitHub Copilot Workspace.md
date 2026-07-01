# Phase 2 – GitHub Copilot Workspace

Since this repository is going to be AI-first, I would add one more file alongside the README:

.github/
├── README.md
└── PROJECT_CONTEXT.md

The distinction would be:

README.md → For developers (how the repository is organized, where to find things, development workflow).
PROJECT_CONTEXT.md → For GitHub Copilot and new team members (business domain, architecture summary, runtime model, terminology, and non-negotiable rules).

This separation keeps the README concise and practical while giving AI agents a dedicated, stable context document to reference throughout development. I think this will scale much better as the project grows.


.github/
│
├── README.md                           ⭐ Entry point for developers
│
├── PROJECT_CONTEXT.md                  ⭐ Executive summary of FullScan
│
├── PROJECT_GLOSSARY.md                  ⭐ Executive summary of FullScan
│
├── copilot-instructions.md             ⭐ Global instructions
│
├── instructions/
│   ├── architecture.instructions.md
│   ├── mobile.instructions.md          ✅ (Already exists)
│   ├── runtime.instructions.md
│   ├── ui.instructions.md
│   ├── dynamic-form.instructions.md
│   ├── widget.instructions.md
│   ├── workflow.instructions.md
│   ├── validation.instructions.md
│   ├── configuration.instructions.md
│   ├── attachment.instructions.md
│   ├── synchronization.instructions.md
│   ├── localization.instructions.md
│   ├── theme.instructions.md
│   ├── navigation.instructions.md
│   ├── state.instructions.md
│   ├── api.instructions.md
│   ├── logging.instructions.md
│   ├── testing.instructions.md
│   ├── security.instructions.md
│   └── code-review.instructions.md
│
├── agents/
│   ├── solution-architect.agent.md
│   ├── mobile-architect.agent.md
│   ├── runtime-engineer.agent.md
│   ├── workflow-engineer.agent.md
│   ├── dynamic-form-engineer.agent.md
│   ├── widget-engineer.agent.md
│   ├── validation-engineer.agent.md
│   ├── configuration-engineer.agent.md
│   ├── attachment-engineer.agent.md
│   ├── synchronization-engineer.agent.md
│   ├── localization-engineer.agent.md
│   ├── theme-engineer.agent.md
│   ├── testing-engineer.agent.md
│   └── reviewer.agent.md
│
├── prompts/
│   ├── create-feature.prompt.md
│   ├── create-screen.prompt.md
│   ├── create-widget.prompt.md
│   ├── create-service.prompt.md
│   ├── create-store.prompt.md
│   ├── create-hook.prompt.md
│   ├── create-api.prompt.md
│   ├── create-runtime-engine.prompt.md
│   ├── create-workflow.prompt.md
│   ├── create-json-schema.prompt.md
│   └── review-code.prompt.md
│
└── skills/
    ├── server-driven-ui.skill.md
    ├── runtime.skill.md
    ├── dynamic-form.skill.md
    ├── widget.skill.md
    ├── workflow.skill.md
    ├── validation.skill.md
    ├── configuration.skill.md
    ├── attachment.skill.md
    ├── synchronization.skill.md
    ├── localization.skill.md
    ├── theme.skill.md
    ├── offline.skill.md
    └── security.skill.md



# PROJECT_GLOSSARY.md

One improvement I would make

I would add a PROJECT_GLOSSARY.md next.

This might sound minor, but it's extremely valuable for both developers and AI.

For example:

Term	Meaning
Assignment	A verification case assigned to a Field Executive
Workflow	A sequence of runtime nodes executed by the Workflow Engine
Widget	The smallest reusable UI component
Attachment	A piece of verification evidence (e.g., candidate photo, document)
Runtime Context	Shared execution state across engines
Business Workflow	A verification process (Candidate, Residence, Employment)
Application Workflow	Onboarding, permissions, help, etc.





Phase 2 Roadmap

I recommend this order.

Milestone 1 — Foundation ✅
.github/

README.md                     ✅
PROJECT_CONTEXT.md            ✅
PROJECT_GLOSSARY.md           ✅
copilot-instructions.md       ✅

Status: Complete

Milestone 2 — Instruction Files

These teach Copilot how FullScan is built.

instructions/

01 architecture.instructions.md
02 runtime.instructions.md
03 dynamic-form.instructions.md
instructions/ 04 widget.instructions.md
instructions/ 05 workflow.instructions.md
06 validation.instructions.md
07 configuration.instructions.md
08 attachment.instructions.md
09 synchronization.instructions.md
10 localization.instructions.md
11 theme.instructions.md
12 navigation.instructions.md
13 state.instructions.md
14 api.instructions.md
15 logging.instructions.md
16 testing.instructions.md
17 security.instructions.md
18 code-review.instructions.md
Milestone 3 — AI Agents

Each agent becomes an expert in one architectural area.

agents/

solution-architect.agent.md
mobile-architect.agent.md
runtime-engineer.agent.md
workflow-engineer.agent.md
dynamic-form-engineer.agent.md
widget-engineer.agent.md
validation-engineer.agent.md
configuration-engineer.agent.md
attachment-engineer.agent.md
synchronization-engineer.agent.md
localization-engineer.agent.md
theme-engineer.agent.md
testing-engineer.agent.md
reviewer.agent.md
Milestone 4 — Skills

Reusable architectural knowledge.

skills/

runtime.skill.md
server-driven-ui.skill.md
dynamic-form.skill.md
widget.skill.md
workflow.skill.md
validation.skill.md
configuration.skill.md
attachment.skill.md
synchronization.skill.md
localization.skill.md
theme.skill.md
offline.skill.md
security.skill.md
Milestone 5 — Prompt Library

Standardized development tasks.

prompts/

create-feature.prompt.md
create-screen.prompt.md
create-widget.prompt.md
create-service.prompt.md
create-store.prompt.md
create-hook.prompt.md
create-api.prompt.md
create-runtime-engine.prompt.md
create-workflow.prompt.md
create-json-schema.prompt.md
review-code.prompt.md
Implementation Strategy

We should not generate all 50+ files in one go.

Instead, generate them in dependency order.

Foundation
        │
        ▼
Instructions
        │
        ▼
Agents
        │
        ▼
Skills
        │
        ▼
Prompts
        │
        ▼
React Native Platform

This way, every subsequent artifact can reference the previous ones.



# Agents

agents/

solution-architect.agent.md

runtime-engineer.agent.md

mobile-engineer.agent.md

integration-engineer.agent.md

qa-engineer.agent.md

reviewer.agent.md


I want to make one improvement to our Agent strategy

Now that we've built this first agent, I think we should establish a consistent template for all agents.

Every agent should have the same sections:

Mission

Project Context

Responsibilities

Primary Objectives

Architecture References

Engineering References

Decision Rules

Review Checklist

Communication Style

Things to Avoid

Success Criteria

Guiding Principle



My recommendation for the remaining agents

Now that we've established the pattern, I would generate the remaining agents in this order:

✅ solution-architect.agent.md
✅ runtime-engineer.agent.md
mobile-engineer.agent.md – React Native, Gluestack UI, widgets, screens, localization, theming.
integration-engineer.agent.md – APIs, repositories, DTOs, synchronization integration.
qa-engineer.agent.md – Unit tests, integration tests, Detox, quality gates.
reviewer.agent.md – Architecture compliance, code quality, security, performance, and pull request reviews.

This sequence mirrors how a real engineering team would collaborate and keeps each agent focused on a distinct responsibility without duplicating the knowledge already captured in your instruction library.




.github/

prompts/

01-create-feature.prompt.md
02-create-screen.prompt.md
03-create-widget.prompt.md
04-create-runtime-engine.prompt.md
05-create-api.prompt.md
06-create-repository.prompt.md
07-create-store.prompt.md
08-create-hook.prompt.md
09-create-test.prompt.md
10-review-feature.prompt.md

skills/

01-runtime.skill.md
02-widget.skill.md
03-dynamic-form.skill.md
04-configuration.skill.md
05-validation.skill.md
06-attachment.skill.md
07-synchronization.skill.md
08-localization.skill.md
09-theme.skill.md
10-offline.skill.md
11-testing.skill.md
12-security.skill.md





# Prompt Execution Rules

Before generating code:

1. Review PROJECT_CONTEXT.md
2. Review PROJECT_GLOSSARY.md
3. Review applicable instruction files
4. Review applicable agents
5. Reuse existing code whenever possible
6. Never violate the documented architecture
7. Generate only the files required
8. Prefer extending the platform over creating new patterns