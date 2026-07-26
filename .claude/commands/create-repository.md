---
description: Scaffold a repository that hides API/DTO details and returns Domain Models
argument-hint: <repository-name> — e.g. "AssignmentRepository"
---

Create the **$ARGUMENTS** repository for the FullScan Mobile Platform under `src/repositories/`.

Load `fullscan-architecture` first; this is `integration-engineer` subagent territory for anything non-trivial.

## Before creating a new repository

Check whether an existing repository can be extended instead. Avoid duplicate repositories for the same domain entity.

## Principles

Repositories hide API implementation details, return **Domain Models only** (never DTOs), perform mapping, coordinate data retrieval, and are independently testable. They never contain UI, workflow, or validation logic.

## Responsibility chain

```
Call API → Map DTO → Return Domain Model → Handle Errors
```

## Generate

`Repository.ts`, `Repository.interface.ts`, `Mapper.ts` (mapping lives here, not inline in business code), tests, `index.ts`.

## Errors & offline

Return typed domain errors, not raw HTTP errors. Decide explicitly whether this repository reads local cache, reads the remote API, or coordinates with the Synchronization Engine — respect Offline First (see `fullscan-synchronization-engine` if it queues writes).

## Logging

Log repository calls, mapping failures, cache misses, and retries — never sensitive business data.

## Tests

Cover repository behavior, mapper correctness, offline paths, and error handling.

## Before finishing, confirm

Domain models returned, DTOs fully hidden · mapping separated into a dedicated mapper · testable · logging in place · offline behavior considered · architecture compliant.
