---
description: "Generate tests for FullScanField with proper native module mocks and domain-specific fixtures"
---

# Generate Tests

Create tests for existing code in the FullScanField project.

## Input
- **File to test**: ${input:file:Path to the file to test}
- **Test type**: ${input:type:unit, integration, or both}

## Rules

### Mobile Tests (Jest + @testing-library/react-native)
- Mock native modules: camera, GPS, keychain, biometrics, SQLite
- Use `renderHook` for custom hooks
- Screen tests: mock navigation, verify renders and interactions
- Service tests: mock API client, test all code paths

### Server Tests (Vitest + supertest)
- Integration tests use supertest with full middleware chain
- Unit tests mock DAOs for service testing
- Use in-memory SQLite for integration tests
- Generate auth tokens via test helper

### Fixtures
- Test GPS coordinates: inside and outside geo-fence
- Test images: small valid JPEG (base64 fixture or fixture file)
- Test users: one per role (`field_executive`, `admin`, `employer`)
- Test assignments: with known location for geo-fence tests

### Coverage
- Happy path for every public method
- Error/edge cases: invalid input, unauthorized, not found, offline
- Boundary conditions: geo-fence edge, max file size, expired token
