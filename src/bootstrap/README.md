# Bootstrap

## Purpose

Responsible for initializing the application before it becomes available to the user.

## Responsibilities

- Execute startup pipeline.
- Initialize platform services.
- Handle startup failures.
- Control splash screen lifecycle.
- Prepare the application for execution.

## Startup Order

```text
Logger
    ↓
Storage
    ↓
Configuration
    ↓
Theme
    ↓
Localization
    ↓
Runtime
    ↓
Application Ready
```

## Does NOT Own

- Business logic
- Navigation
- Feature implementation