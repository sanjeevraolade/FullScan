---
description: Scaffold a new Runtime Engine under src/runtime/ (rare — most needs are met by the existing ten engines)
argument-hint: <engine-name> — e.g. "NotificationEngine"
---

Create the **$ARGUMENTS** Runtime Engine for the FullScan Runtime Platform.

Load `fullscan-runtime-engine` and `fullscan-architecture` first. The Runtime architecture is frozen — this command should be rare in practice.

## Before creating a new engine

The ten existing engines (Verification Runtime, Workflow, Dynamic Form, Widget Registry, Validation, Configuration, Attachment, Synchronization, Localization, Theme) already cover most platform responsibilities. Confirm: does one of them already own this responsibility? Could it be extended instead of adding a new engine? Only proceed if this is genuinely a new, single, non-overlapping responsibility — if unsure, use the `solution-architect` subagent to validate first.

## Every Runtime Engine must

Have exactly one responsibility · be configuration-driven · be independently testable (dependency injection, no hidden dependencies) · support Offline First · be reusable and loosely coupled · hide its implementation details from consumers.

## Generate

```
runtime/<domain>/
  <Engine>.ts
  <Engine>.interface.ts
  <Engine>.types.ts
  <Engine>.constants.ts
  <Engine>.test.ts
  index.ts
```

## Dependencies

May depend on: contracts, Logger, Configuration Engine, Runtime Context. Must not depend on: UI, screens, widgets, navigation.

## Logging & errors

Use `LoggerService` (never `console.log`) for initialize/execute/complete/error events. Return structured errors for invalid configuration, missing runtime data, or unexpected failures — avoid uncaught exceptions.

## Tests

Cover initialization, execution, error handling, edge cases, and invalid configuration.

## Before finishing, confirm

Single responsibility, not overlapping an existing engine · Runtime Context respected, not duplicated · configuration-driven · offline-first · logger integrated · strongly typed · independently testable.
