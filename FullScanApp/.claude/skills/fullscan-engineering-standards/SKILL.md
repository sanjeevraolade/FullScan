---
name: fullscan-engineering-standards
description: Load when writing or reviewing any TypeScript/React Native code in this repo — naming, file structure, TypeScript strictness, error handling, logging, imports, and the code-review checklist. Load for any non-trivial code-writing task if not already loaded.
---

# FullScan Engineering Standards

Mandatory for every file in this repo. See `/CLAUDE.md` for the condensed version.

## General rules

Follow the documented architecture (`fullscan-architecture`) · reuse before creating · keep code simple and readable · write production-quality code · generate only the files required · keep business logic out of the UI · prefer composition over inheritance. Never introduce architectural shortcuts, duplicate functionality, hardcode business rules, or ignore Runtime Engines / Offline First.

## TypeScript

Compiler: `strict`, `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess` — never disabled. Prefer `interface` for object contracts, `type` for unions/utility types, `readonly` where mutation isn't intended, generics where useful. Avoid `any`, `unknown` without validation, and type assertions (`as`) unless truly unavoidable.

Null safety: optional chaining + nullish coalescing + guard clauses over nested `if` checks.
```ts
const latitude = location?.latitude ?? 0;   // good
if (location) { if (location.latitude) { ... } }   // avoid
```

## Naming

| Kind | Convention | Examples |
|---|---|---|
| Files | kebab-case | `assignment-card.tsx`, `runtime-engine.ts` |
| Components / Interfaces | PascalCase | `AssignmentCard`, `AssignmentRepository` |
| Hooks | camelCase, `use` prefix | `useCamera()`, `useWorkflow()` |
| Functions | verb-based camelCase | `loadConfiguration()`, `capturePhoto()` — avoid `run()`, `process()`, `handle()` unless context makes intent obvious |
| Variables | descriptive camelCase | `candidatePhoto`, `gpsAccuracy` — avoid `obj`, `temp`, `data`, `value` |
| Constants | UPPER_SNAKE_CASE | `MAX_UPLOAD_SIZE`, `GPS_REQUIRED` |
| Booleans | positive phrasing | `isValid`, `hasPermission`, `canSynchronize` — avoid `invalid`, `flag` |

Avoid the `I` prefix on interfaces unless a project-wide convention already requires it.

## File/function size (guidelines, not hard limits)

Component ≈300 lines, hook ≈200, service ≈300, validator ≈100, repository ≈250. Functions ≈20–40 lines and do one thing. If a file is hard to understand, split it by responsibility.

## Imports

Order: React → third-party → internal aliases (`@/...`) → relative imports → types → styles. No circular dependencies.
```ts
import React from 'react';
import axios from 'axios';
import { Logger } from '@/infrastructure/logger';
import { Assignment } from '../types';
```

## Components & hooks

Functional components only, typed props, single responsibility, `React.memo()` for expensive renders. No business logic, API calls, or workflow execution inside components. Hooks encapsulate reusable behavior (`useCamera`, `useLocation`, `useConfiguration`) and may access Runtime/Stores, but must not call backend APIs directly or contain business rules.

## Async & errors

`async`/`await` over Promise chains. Every rejected promise handled — never `catch (e) {}`. Log unexpected errors, return meaningful results for expected business failures, use typed errors.

## Logging

`LoggerService.info() / .warn() / .error()` — never `console.log`. Never log tokens, passwords, biometric data, or personal data (Aadhaar/PAN included).

Every file that logs declares a module-level `FILE_NAME` constant (the file's own basename, or its path relative to `src/` when the basename alone is ambiguous — e.g. multiple `index.ts` files) and prefixes every log message with it, so a log line always traces back to its source file:
```ts
const FILE_NAME = 'runtime-engine.ts';
// ...
LoggerService.info(`${FILE_NAME}: VerificationRuntimeEngine.initialize: starting`);
LoggerService.warn(`${FILE_NAME}: ConfigurationEngine.getScreen: screen not found`, { screenId });
```
Exception: when a log call passes a shared message constant (e.g. `WORKFLOW_ENGINE_SKELETON_MESSAGE`) that a test asserts verbatim via `toHaveBeenCalledWith(...)`, log the constant unprefixed — don't break the constant's existing contract just to add the prefix.

Every function/method/component in the codebase gets at least one log call tracing that it ran (entry, or entry+exit for anything with a branch or an async step) — including presentational components with no branching logic. This is safe to do liberally because logging is globally toggleable (see below): `LoggerService.setEnabled(false)` silences every call site at runtime with no code changes, so verbosity is never a reason to skip instrumenting a file. The only files that stay uninstrumented are ones with no executable code at all — pure `.types.ts`/`.interface.ts`/`.constants.ts` files and barrel `index.ts` re-exports; there is no function body to log inside.

`LoggerService.setEnabled(enabled: boolean)` / `.isEnabled()` (`src/infrastructure/logger/logger.ts`) is the single global switch — call it once (e.g. from a debug menu, a remote-config flag, or bootstrap) to turn all logging on/off at runtime without touching any call site.

## Performance

Avoid inline styles, duplicate parsing, unnecessary re-renders. Prefer memoization, lazy loading, `FlatList` for large lists, stable references.

## Comments

Explain WHY, not WHAT — code should be self-documenting for the "what."
```ts
// bad:  counter++ // Increment counter
// good: retryCount++ // support exponential backoff on repeated failures
```

## AI generation rules

When generating a feature artifact, generate the full set the pattern calls for (e.g. `Component.tsx`, `.types.ts`, `.styles.ts`, `.test.tsx`, `index.ts`) — not a single orphaned file. But generate hooks/stores/APIs/repositories only when actually required; never pad output with unrequested files.

## Code review checklist

Architecture: Runtime respected, dependency direction respected, Runtime Engines used correctly.
Code quality: single responsibility, strong typing, no dead code, no duplication, no magic values.
Performance: efficient rendering, no unnecessary allocations, memoization where it matters.
Security: no sensitive logging, secure storage used correctly, input validated.
Testing: tests included, edge cases covered.
Maintainability: readable, modular, consistent, self-documenting.
