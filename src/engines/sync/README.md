# Synchronization Engine

Offline queue, retry logic, upload scheduling, and conflict resolution.

## Responsibility

- Offline queue management
- Retry logic with exponential backoff
- Upload scheduling (priority-based)
- Conflict resolution
- Background synchronization
- Sync status tracking

## Rules

- UI components must never upload data directly.
- Business evidence must always be stored locally before synchronization.
- Never assume network availability.
- Sync must be transparent to business workflows.
