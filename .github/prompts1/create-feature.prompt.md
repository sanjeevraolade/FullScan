---
description: "Create an end-to-end feature spanning mobile screen and API endpoint with tests"
---

# Create Feature

Build a complete feature across mobile and server.

## Input
- **Feature name**: ${input:feature:Feature name (e.g., submit-verification, view-assignment)}
- **Description**: ${input:description:What should this feature do?}

## Generate

### Server
1. Route, controller, service, DAO for the new endpoint(s)
2. Zod validation schemas
3. Integration tests with supertest

### Mobile
1. Screen component with navigation integration
2. Service/hook for API communication
3. Offline support if the feature involves data submission
4. Component tests

### Both
- TypeScript types shared between mobile and server for the API contract
- Consider offline-first: what happens if the user has no network?
- Ensure GPS/evidence requirements are met if applicable

## Checklist
- [ ] Server endpoint has auth middleware
- [ ] Input validation on API
- [ ] Mobile screen handles loading/error states
- [ ] Works offline (queue if needed)
- [ ] Tests cover happy path and errors
