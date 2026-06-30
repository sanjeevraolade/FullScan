# Create Screen Prompt

> Follow **00-prompt-execution-rules.md** before executing this prompt.

## Purpose

Create a new screen for the FullScan Mobile Platform.

Screens are presentation components.

Screens must not own business logic.

---

# Before Starting

Determine:

Is this screen:

- Configuration-driven?
- Runtime-generated?
- Static?
- Workflow Screen?

Prefer Dynamic Form Engine whenever possible.

---

# Screen Responsibilities

A screen should:

Render UI

Display Runtime Data

Capture User Input

Invoke Runtime Actions

Display Validation

Nothing more.

---

# Never Implement

Business Logic

Workflow Execution

Validation Logic

API Calls

Synchronization

Configuration Management

---

# Build

Generate:

Screen

↓

Header

↓

Body

↓

Footer

↓

Widgets

↓

Hooks

↓

Tests

Only generate reusable code.

---

# Runtime

Use Runtime Context.

Avoid duplicated state.

---

# Widgets

Reuse existing widgets.

Create new widgets only when necessary.

---

# Theme

Support:

Light

Dark

Runtime Theme

---

# Localization

Every string must use localization keys.

---

# Accessibility

Mandatory.

---

# Performance

Avoid unnecessary renders.

Use memoization where appropriate.

---

# Deliverables

Generate:

Screen

Types

Styles

Tests

Index

---

# Completion Checklist

✓ Runtime integrated

✓ Theme

✓ Localization

✓ Accessibility

✓ Testable

✓ Reusable

✓ No business logic