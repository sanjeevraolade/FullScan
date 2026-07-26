# Runtime

## Purpose

The Runtime Platform is responsible for executing configuration-driven behavior.

It is the heart of the FullScan platform.

## Responsibilities

- Configuration
- Rendering
- Validation
- Workflow
- Registry
- Runtime orchestration

## Runtime Flow

```text
Configuration
    ↓
Engine
    ↓
Registry
    ↓
Renderer
    ↓
Validation
    ↓
Workflow
```

Business features consume the Runtime instead of implementing it.