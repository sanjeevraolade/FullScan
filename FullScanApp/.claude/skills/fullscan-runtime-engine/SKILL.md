---
name: fullscan-runtime-engine
description: Load when implementing or modifying anything under src/runtime/ — the Verification Runtime Engine, Runtime Context, engine coordination, or workflow state-machine execution. Load before deciding which engine owns a piece of runtime behavior.
---

# Runtime Engine

Applies to `src/runtime/**`. The Runtime Layer is the heart of FullScan — it orchestrates execution through ten specialized engines. Business workflows execute through Runtime Engines, never directly through screens. This architecture is frozen — do not redesign it; see `fullscan-architecture` for the full platform structure.

## The ten engines — each owns exactly one responsibility, never merge them

**Verification Runtime Engine** — application orchestrator: startup, runtime initialization, runtime context init, engine coordination. No business rules here — delegate.
**Workflow Engine** — workflow execution, state, navigation *decisions* for both Application Workflows (welcome, onboarding, permissions, what's-new) and Business Workflows (candidate/residence/employment verification).
**Dynamic Form Engine** — see `fullscan-dynamic-form`.
**Widget Registry** — see `fullscan-widget-development`.
**Validation Engine** — see `fullscan-validation`.
**Configuration Engine** — see `fullscan-configuration-engine`.
**Attachment Engine** — see `fullscan-attachment-engine`.
**Synchronization Engine** — see `fullscan-synchronization-engine`.
**Localization Engine** — see `fullscan-localization`.
**Theme Engine** — see `fullscan-theme-engine`.

## Engine communication

Engines communicate through interfaces, not direct coupling. Preferred flow: `Configuration Engine → Workflow Engine → Dynamic Form Engine → Validation Engine → Attachment Engine → Synchronization Engine`.

## Runtime Context

The single source of shared execution state: current Assignment, current Workflow, current User, Attachments, Runtime Variables, Form Values, GPS. Never duplicate this state in a store or component — read/write through Runtime Context.

## Workflow execution as a state machine

Support start / pause / resume / cancel / complete / retry, and design as an explicit state machine (`Initialized → Running → Waiting → Completed → Failed → Cancelled`) rather than boolean flags. Workflows must remain restartable after an app restart — persist required state locally (Offline First).

## Dependency rules

Runtime engines may depend on: contracts, domain models, platform services (via abstraction). They must **not** depend on screen implementations, UI components, or navigation.

## Logging & errors

Use `LoggerService` — never `console.log`. Log meaningful runtime events only. On failure: return meaningful errors, preserve runtime state, recover where possible, never crash the app.

## Performance & testability

Avoid long synchronous operations, repeated configuration parsing, duplicate validation/object creation. Every engine should be independently testable via dependency injection, without hidden dependencies.

## Before writing runtime code, verify

Is this responsibility owned by the correct engine? Is configuration driving the behavior? Is runtime state centralized (not duplicated)? Is it offline-first? Is it reusable? If any answer is "no," redesign first.
