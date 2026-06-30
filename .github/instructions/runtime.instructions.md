---
applyTo:
  - "mobile/src/runtime/**"
  - "mobile/src/engines/**"
  - "mobile/src/core/runtime/**"
---

# Runtime Engine Instructions

These instructions apply to all Runtime Engine implementations.

Refer to:

- docs/05-Runtime/
- docs/06-Contracts/

The Runtime Architecture is frozen.

Do not redesign it.

---

# Runtime Philosophy

The Runtime Layer is the heart of FullScan.

It orchestrates application execution through multiple specialized runtime engines.

Business workflows execute through runtime engines rather than directly through screens.

---

# Runtime Components

The Runtime Layer consists of:

- Verification Runtime Engine
- Workflow Engine
- Dynamic Form Engine
- Widget Registry
- Validation Engine
- Configuration Engine
- Attachment Engine
- Synchronization Engine
- Localization Engine
- Theme Engine

Each engine has a single responsibility.

Never merge responsibilities.

---

# Verification Runtime Engine

Acts as the application orchestrator.

Responsible for:

- Application startup
- Runtime initialization
- Runtime context
- Engine coordination
- Workflow startup

Do not place business rules here.

Delegate to specialized engines.

---

# Runtime Context

The Runtime Context stores shared execution state.

Examples:

- Current Assignment
- Current Workflow
- Current User
- Attachments
- Runtime Variables
- Form Values
- GPS Information

Runtime Context is the single source of execution state.

Avoid duplicated state.

---

# Engine Communication

Runtime engines communicate through interfaces.

Avoid direct coupling.

Preferred flow:

Configuration Engine

↓

Workflow Engine

↓

Dynamic Form Engine

↓

Validation Engine

↓

Attachment Engine

↓

Synchronization Engine

---

# Configuration Driven

Runtime behaviour must come from configuration.

Never hardcode:

- Workflow steps
- Screen definitions
- Validation rules
- Widget collections

---

# Application Workflows

Supported examples:

- Welcome
- Onboarding
- Permission Requests
- User Guide
- What's New

Application workflows control application behaviour.

---

# Business Workflows

Supported examples:

- Candidate Verification
- Residence Verification
- Employment Verification

Business workflows control verification processes.

---

# Workflow Execution

Workflow execution should support:

- Start
- Pause
- Resume
- Cancel
- Complete
- Retry

Workflows should remain restartable after application restarts.

---

# State Machine

Workflows should behave as state machines.

Example states:

- Initialized
- Running
- Waiting
- Completed
- Failed
- Cancelled

Avoid boolean flags when state transitions provide clearer semantics.

---

# Offline First

Runtime engines must support offline execution.

Never assume:

- Internet connectivity
- Immediate synchronization
- Server availability

Persist required state locally.

---

# Logging

All runtime engines must use LoggerService.

Never use:

- console.log()
- console.error()

Log meaningful runtime events only.

---

# Error Handling

Runtime engines should:

- Return meaningful errors
- Preserve runtime state
- Recover whenever possible
- Avoid crashing the application

---

# Dependency Rules

Runtime engines may depend on:

- Contracts
- Domain Models
- Platform Services

Runtime engines must not depend on:

- Screen implementations
- UI Components
- Navigation

---

# Performance

Runtime execution should be lightweight.

Avoid:

- Long synchronous operations
- Repeated configuration parsing
- Duplicate validation
- Duplicate object creation

Reuse runtime resources.

---

# Testability

Every runtime engine should be independently testable.

Avoid hidden dependencies.

Use dependency injection where appropriate.

---

# Before Writing Code

Verify:

✓ Is this responsibility owned by the correct runtime engine?

✓ Is configuration driving behaviour?

✓ Is runtime state centralized?

✓ Is the implementation offline-first?

✓ Is the implementation reusable?

If not, redesign before implementation.

---

# Guiding Principle

The Runtime Layer is the execution platform of FullScan.

Every runtime engine should remain small, focused, reusable, independently testable, and configuration-driven.