# Configuration Engine

Single source of runtime metadata. Downloads, validates, versions, and activates configuration.

## Responsibility

- Configuration download from backend
- Schema validation
- Version management
- Offline cache
- Configuration activation
- Delta updates

## Rules

- Configuration is the single source of truth for runtime behaviour.
- Must support offline operation with cached configuration.
- Invalid configuration must never be activated.
- Configuration changes must be atomic.
