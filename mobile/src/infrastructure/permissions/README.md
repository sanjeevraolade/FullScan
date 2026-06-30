# Permissions Service

Runtime permission management for device capabilities.

## Responsibility

- Permission status checking
- Permission request coordination
- Permission rationale presentation
- Settings redirection for denied permissions

## Rules

- All screens require location permission.
- Must handle "never ask again" state gracefully.
- Permission state changes must be broadcast to interested parties.
