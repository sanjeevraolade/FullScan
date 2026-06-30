---
applyTo:
  - "mobile/src/navigation/**"
  - "mobile/src/app/navigation/**"
  - "mobile/src/features/**"
---

# Navigation Instructions

These instructions apply to all navigation-related implementations.

Refer to:

- docs/04-Architecture/03-Application-Architecture.md
- docs/05-Runtime/02-Workflow-Engine.md

Navigation should support the Runtime Architecture rather than control business logic.

---

# Navigation Philosophy

Navigation is responsible only for moving between screens.

Navigation must never contain business logic.

Business flow decisions belong to the Workflow Engine.

---

# Navigation Framework

Use:

- React Navigation

Supported navigators:

- Native Stack
- Drawer
- Bottom Tabs (Future)
- Modal

Do not introduce additional navigation frameworks.

---

# Navigation Principles

Navigation should be:

- Typed
- Predictable
- Centralized
- Testable

Avoid scattered navigation logic.

---

# Typed Navigation

Always define navigation parameter types.

Never use:

- any
- unknown

Use strongly typed navigation.

---

# Workflow Driven Navigation

The Workflow Engine determines:

- Next Screen
- Previous Screen
- Completion
- Cancellation

Screens should never decide business workflow progression.

---

# Route Registration

Register every screen centrally.

Avoid dynamic string-based route names.

Use constants.

---

# Screen Responsibilities

Screens should:

- Render UI
- Invoke Runtime Engine
- Display state

Screens should NOT:

- Execute workflows
- Perform validation
- Call APIs
- Synchronize data

---

# Deep Linking

Design navigation to support future deep linking.

Do not hardcode assumptions that prevent deep link support.

---

# Parameters

Pass identifiers rather than large business objects.

GOOD

AssignmentId

WorkflowId

BAD

Entire Assignment Object

---

# Back Navigation

Respect Workflow Engine rules.

Prevent users from bypassing mandatory workflow steps.

---

# Error Handling

Handle:

- Invalid routes
- Missing parameters
- Unknown screens

Show user-friendly error screens.

---

# Testing

Test:

- Navigation flow
- Route parameters
- Protected routes
- Workflow transitions

---

# Before Writing Code

Verify:

✓ Navigation contains no business logic

✓ Workflow Engine controls progression

✓ Navigation is strongly typed

✓ Parameters are minimal

✓ Screens remain lightweight

---

# Guiding Principle

Navigation exists to display screens.

The Workflow Engine owns business flow.