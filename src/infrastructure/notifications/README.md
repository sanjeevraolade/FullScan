# Notifications Service

Push notifications and local notification management.

## Responsibility

- Push notification registration
- Notification handling (foreground/background)
- Local notification scheduling
- Notification payload parsing
- Deep link extraction from notifications

## Rules

- Must handle notification permissions gracefully.
- Must not block app functionality if notifications are denied.
