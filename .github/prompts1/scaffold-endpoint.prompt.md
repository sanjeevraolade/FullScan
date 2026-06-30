---
description: "Scaffold a new API endpoint with route, controller, service, validation, and test"
---

# Scaffold Endpoint

Create a new REST API endpoint for the FullScanField server.

## Input
- **Resource name**: ${input:resource:Resource name (e.g., assignments, evidence)}
- **HTTP method**: ${input:method:HTTP method (GET, POST, PUT, DELETE)}
- **Path**: ${input:path:Route path (e.g., /:id/verify)}
- **Auth required**: ${input:auth:Requires authentication? (yes/no)}

## Generate

1. `server/src/routes/${resource}.routes.ts` — Express router with the new route (or add to existing)
2. `server/src/controllers/${resource}.controller.ts` — thin handler that delegates to service
3. `server/src/services/${resource}.service.ts` — business logic method
4. `server/src/db/${resource}.dao.ts` — data access method with parameterized query
5. Zod validation schema for request body/params (co-located with route)
6. `server/tests/integration/${resource}.test.ts` — supertest integration test

## Conventions
- Response format: `{ success: boolean, data?: T, error?: string }`
- Auth middleware applied if required
- Input validation via zod middleware
- Follow existing patterns in the codebase
