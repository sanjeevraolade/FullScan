---
applyTo:
  - "mobile/src/store/**"
  - "mobile/src/state/**"
  - "mobile/src/runtime/context/**"
---

# State Management Instructions

These instructions apply to all application state implementations.

Refer to:

- docs/04-Architecture/03-Application-Architecture.md
- docs/05-Runtime/01-Verification-Runtime-Engine.md

---

# State Philosophy

Every piece of state should have a clear owner.

Avoid duplicated state.

Prefer one source of truth.

---

# State Categories

UI State

Examples:

- Modal Open
- Selected Tab
- Search Text

↓

Component State

---

Business State

Examples:

- Assignment
- Workflow
- Attachments

↓

Runtime Context

---

Global State

Examples:

- Logged In User
- Configuration
- Theme
- Language

↓

Zustand Store

---

# State Framework

Use:

- Zustand

Redux Saga handles side effects.

Avoid introducing additional state libraries.

---

# Runtime Context

Runtime Context owns:

- Current Assignment
- Current Workflow
- Runtime Variables
- Attachments
- Form Values

Do not duplicate Runtime Context inside stores.

---

# Store Design

Keep stores:

- Small
- Focused
- Feature-oriented

Avoid one large global store.

---

# Selectors

Prefer selectors.

Avoid reading entire store objects.

Select only required values.

---

# Mutability

Treat state as immutable.

Avoid mutating existing objects.

Return updated copies.

---

# Async

Business side effects belong to:

Redux Saga

Not inside components.

---

# Component State

Use component state only for temporary UI concerns.

Never store business entities in component state.

---

# Persistence

Persist only required data.

Examples:

- Authentication
- Theme
- Language
- Configuration

Avoid persisting temporary UI state.

---

# Testing

Test:

- Store updates
- Selectors
- Runtime Context
- Side effects

---

# Before Writing Code

Verify:

✓ Correct owner of state

✓ No duplicated state

✓ Runtime Context respected

✓ Zustand used appropriately

✓ Side effects delegated

---

# Guiding Principle

State should exist in the smallest scope that can responsibly own it.