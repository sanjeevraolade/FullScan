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

`Logger.info() / .warn() / .error()` — never `console.log`. Never log tokens, passwords, or personal data.

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
