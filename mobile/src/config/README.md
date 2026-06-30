# Config

Application-level configuration and environment settings.

## Responsibility

- Environment variables (dev, staging, production)
- API base URLs
- Feature flags
- Build-time constants
- App-wide default settings

## Rules

- No business logic.
- No runtime state.
- Values must be environment-driven.
- Sensitive values must never be committed to source control.
