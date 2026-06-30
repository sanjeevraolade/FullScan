# Errors

Centralized error types and error hierarchy.

## Responsibility

- Base error classes
- Domain-specific error types
- Error codes
- Error serialization

## Rules

- All errors must extend a base application error.
- Errors must be localizable.
- Technical details must never be exposed to end users.
