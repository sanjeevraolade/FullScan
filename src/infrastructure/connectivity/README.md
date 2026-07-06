# Connectivity Service

Network state monitoring and reachability detection.

## Responsibility

- Online/offline state detection
- Connection type identification (WiFi, cellular)
- Reachability checks
- Connectivity event broadcasting

## Rules

- Must emit events for connectivity changes.
- Must not block UI when offline.
- Offline state must be transparent to business workflows.
