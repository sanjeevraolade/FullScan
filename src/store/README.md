# Store

Global state management using Zustand and Redux/Redux-Saga.

## Structure

| Directory          | State Slice            | Responsibility                        |
|--------------------|------------------------|---------------------------------------|
| `assignments/`     | Assignments State      | Assignment list, current assignment   |
| `authentication/`  | Auth State             | Token, user session, auth status      |
| `configuration/`   | Configuration State    | Runtime config, feature flags         |
| `localization/`    | Localization State     | Current language, loaded resources    |
| `session/`         | Session State          | App session, device registration      |
| `sync/`            | Sync State             | Queue status, pending uploads         |
| `theme/`           | Theme State            | Active theme, user preference         |
| `workflow/`        | Workflow State         | Active workflow, step, runtime vars   |

## Rules

- Feature state remains isolated.
- Business state belongs to the Runtime Context.
- State changes are unidirectional.
- Async operations use Redux-Saga.
