# Events

Domain event definitions and event bus infrastructure.

## Responsibility

- Event type definitions
- Event bus interface
- Event emitter/subscriber patterns
- Runtime event catalog

## Rules

- Events are immutable once created.
- Event handlers must not throw — failures are logged.
- Events enable decoupled module communication.
