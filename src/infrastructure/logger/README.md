# Logger Service

Structured logging for debugging, audit, and observability.

## Responsibility

- Log level management (debug, info, warn, error)
- Structured log formatting
- Log persistence for offline debugging
- Crash context capture
- Sensitive data redaction

## Rules

- Never log sensitive user data (passwords, tokens, PII).
- Logs must be structured (key-value pairs).
- Must support remote log shipping when online.
