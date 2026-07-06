# GPS Service

Location acquisition abstraction.

## Responsibility

- Current location retrieval
- Continuous location tracking
- Location accuracy configuration
- Permission state management

## Rules

- All screens require location permission — block usage if denied.
- Location data feeds into the Geo Engine for validation.
- Must detect and report mock locations.
