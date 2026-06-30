---
description: "Scaffold a new service class for mobile or server with typed interface"
---

# Scaffold Service

Create a new service for either the mobile app or the server.

## Input
- **Package**: ${input:package:Which package? (mobile/server)}
- **Service name**: ${input:serviceName:Service name (e.g., LocationService, AssignmentService)}
- **Description**: ${input:description:What does this service do?}

## Generate

1. `${package}/src/services/${serviceName}.ts` — service with:
   - TypeScript interface defining public methods
   - Implementation class or module
   - Typed return values (no `any`)
   - Error handling returning `Result<T, AppError>` pattern

2. `${package}/src/services/${serviceName}.test.ts` — tests with:
   - Mock dependencies
   - Happy path and error cases
   - Edge cases relevant to the service

## Conventions
- Services contain business logic; controllers/screens are thin
- Dependencies injected or imported, never instantiated internally
- All async methods properly typed with Promise
- Follow existing service patterns in the codebase
