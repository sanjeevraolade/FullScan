# Prompt Execution Rules

## Purpose

This document defines the mandatory execution rules for all GitHub Copilot prompts used within the FullScan Mobile Platform.

Every prompt in this repository must follow these rules before generating code, documentation, tests, or reviews.

These rules ensure that all generated artifacts remain consistent with the project's architecture, governance, engineering standards, and implementation principles.

---

# Execution Philosophy

GitHub Copilot is a member of the FullScan engineering team.

Before generating any output:

- Understand the problem.
- Understand the existing platform.
- Reuse before creating.
- Follow the documented architecture.
- Protect long-term maintainability.

Never generate code simply because it is requested.

Generate the correct solution.

---

# Step 1 — Understand the Request

Before writing any code, determine:

- What is being requested?
- Why is it needed?
- Which business capability does it support?
- Which architecture components are involved?
- Which Runtime Engines are involved?
- Which existing platform capabilities can be reused?

Never begin implementation without understanding the request.

---

# Step 2 — Review Project Knowledge

Always review the following project knowledge before generating output.

## GitHub Workspace

```
.github/

README.md

PROJECT_CONTEXT.md

PROJECT_GLOSSARY.md

copilot-instructions.md
```

Review all relevant instruction files.

Review all relevant agents.

---

## Project Documentation

Review the applicable documentation under:

```
docs/

01-Vision

02-Business

03-Governance

04-Architecture

05-Runtime

06-Contracts

09-Observability
```

Project documentation is the single source of truth.

Never generate implementations that conflict with documented architecture.

---

# Step 3 — Reuse Before Creating

Always determine whether the requested capability already exists.

Check for:

- Existing Features
- Existing Screens
- Existing Widgets
- Existing Runtime Engines
- Existing APIs
- Existing Repositories
- Existing Hooks
- Existing Components
- Existing Models
- Existing Contracts

Prefer extending existing implementations over creating new ones.

Avoid duplication.

---

# Step 4 — Follow the Architecture

Always respect:

- Clean Architecture
- Runtime Architecture
- Configuration-Driven Platform
- Server-Driven UI
- Offline-First Architecture
- Repository Pattern
- Separation of Concerns

Never bypass Runtime Engines.

Never introduce architectural shortcuts.

---

# Step 5 — Follow Engineering Standards

All generated code must comply with:

- Engineering Principles
- Coding Standards
- Naming Conventions
- Repository Standards
- Definition of Done

Code should always be:

- Readable
- Testable
- Reusable
- Maintainable
- Strongly Typed

---

# Step 6 — Use the Correct Agent

Before implementation, determine which agent owns the responsibility.

Possible agents include:

- Solution Architect
- Runtime Engineer
- Mobile Engineer
- Integration Engineer
- QA Engineer
- Reviewer

Follow the responsibilities defined for the selected agent.

Do not mix responsibilities across agents.

---

# Step 7 — Use the Correct Instructions

Review only the instruction files relevant to the request.

Examples:

Architecture

Runtime

Dynamic Form

Widget

Validation

Configuration

Attachment

Synchronization

Engineering Standards

API

Logging

Testing

Localization

Theme

Security

Avoid applying unrelated instructions.

---

# Step 8 — Follow Platform Principles

Always prefer:

Configuration

↓

Runtime

↓

Reusable Platform Capability

↓

Feature-specific Implementation

If configuration can solve the problem, do not hardcode the solution.

---

# Step 9 — Generate Only What Is Required

Generate only the files required for the requested task.

Avoid generating unnecessary files.

Prefer extending existing implementations whenever possible.

---

# Step 10 — Verify Quality

Before completing the response, verify:

Architecture

✓ Architecture respected

✓ Runtime respected

✓ Configuration-driven

✓ Offline First

Engineering

✓ Strong Typing

✓ Clean Code

✓ Single Responsibility

✓ Reusable

✓ Testable

User Experience

✓ Theme

✓ Localization

✓ Accessibility

Quality

✓ Logging

✓ Error Handling

✓ Security

✓ Documentation considered

---

# Things to Avoid

Never:

- Duplicate existing functionality
- Introduce architectural shortcuts
- Hardcode business rules
- Hardcode validation
- Hardcode workflows
- Hardcode UI text
- Hardcode styles
- Ignore Runtime Engines
- Ignore Offline First
- Ignore engineering standards

---

# Expected Output

Every generated artifact should:

- Align with project architecture.
- Follow repository standards.
- Integrate with the Runtime Platform.
- Be independently testable.
- Support localization.
- Support theming.
- Respect Offline First.
- Follow engineering standards.
- Minimize technical debt.

---

# Guiding Principle

Always build on the existing FullScan platform.

Prefer extending the platform over introducing new patterns.

Every generated implementation should strengthen the architecture, improve maintainability, and preserve consistency across the codebase.

Think like a senior engineer.

Build like a platform engineer.

Deliver like a product team.