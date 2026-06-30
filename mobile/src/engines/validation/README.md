# Validation Engine

Configuration-driven validation for all user input and business data.

## Responsibility

- Field-level validation
- Form-level validation
- Cross-field validation
- Async validation (e.g., server-side checks)
- Validation rule parsing from configuration
- Localized error messages

## Rules

- Never implement business validation inside screens or widgets.
- Validation rules are configuration-driven.
- All validation errors must be localized.
- Validation must support offline execution.
