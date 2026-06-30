# Tests

Test suites organized by type and scope.

## Structure

| Directory      | Type                | Responsibility                              |
|----------------|---------------------|---------------------------------------------|
| `e2e/`         | End-to-End (Detox)  | Full user flow tests on device/simulator    |
| `engine/`      | Engine Tests        | Unit tests for runtime engines              |
| `integration/` | Integration Tests   | Cross-module and service integration tests  |
| `runtime/`     | Runtime Tests       | Verification Runtime Engine tests           |
| `snapshot/`    | Snapshot Tests      | UI component snapshot regression tests      |
| `unit/`        | Unit Tests          | Isolated unit tests for logic               |
| `widget/`      | Widget Tests        | Widget rendering and behaviour tests        |
| `workflow/`    | Workflow Tests      | Workflow engine state machine tests         |

## Rules

- All code must be independently testable.
- Business logic tests live alongside engine tests.
- UI snapshot tests validate visual regression.
- E2E tests use Detox for device-level validation.
