# Coding Standards

**Document Version:** 1.0

**Status:** Approved

---

# Purpose

This document defines the coding standards for the FullScan Mobile Platform.

The objective is to ensure that every engineer and every AI-assisted development tool produces code that is:

* Consistent
* Readable
* Maintainable
* Testable
* Extensible
* Secure

Coding standards apply equally to manually written code and AI-generated code.

---

# 1. General Principles

Code should always prioritize:

* Readability over cleverness.
* Simplicity over complexity.
* Maintainability over shortcuts.
* Consistency over personal preference.
* Explicit behavior over implicit behavior.

Every piece of code should be understandable by another developer without additional explanation.

---

# 2. TypeScript Standards

The application shall use **TypeScript** exclusively.

Requirements:

* Use strict typing.
* Avoid the `any` type.
* Prefer interfaces over type aliases for business models.
* Prefer enums or readonly constants for fixed values.
* Enable strict compiler options.

Example:

✅ Preferred

```typescript
interface Assignment {
    id: string;
    candidateName: string;
}
```

❌ Avoid

```typescript
const assignment: any = {};
```

---

# 3. File Naming

Use consistent naming conventions.

| Artifact   | Naming Convention              |
| ---------- | ------------------------------ |
| Screen     | `AssignmentDetailsScreen.tsx`  |
| Widget     | `CameraWidget.tsx`             |
| Component  | `StatusBadge.tsx`              |
| Hook       | `useLocation.ts`               |
| Repository | `AssignmentRepository.ts`      |
| Service    | `LocationService.ts`           |
| Interface  | `IAssignmentRepository.ts`     |
| Store      | `assignment.store.ts`          |
| Validator  | `LocationValidator.ts`         |
| Test       | `AssignmentRepository.test.ts` |

---

# 4. Folder Ownership

Each folder has a single responsibility.

* `runtime/` → Runtime Engine
* `widgets/` → Reusable UI Widgets
* `engines/` → Platform Engines
* `modules/` → Business Features
* `infrastructure/` → Native & External Integrations
* `shared/` → Shared UI and Utilities
* `theme/` → Design System
* `localization/` → Translation Resources

Business modules must never contain runtime or infrastructure code.

---

# 5. Screen Standards

Screens are responsible only for:

* Rendering UI
* Receiving user input
* Dispatching actions

Screens must never:

* Call REST APIs directly.
* Access native modules.
* Implement business rules.
* Perform validation logic.
* Read configuration directly.

Preferred flow:

```
Screen
    ↓
ViewModel / Hook
    ↓
Use Case
    ↓
Repository
    ↓
Infrastructure
```

---

# 6. Component Standards

Components should be:

* Small
* Reusable
* Stateless whenever possible
* Focused on a single responsibility

Guidelines:

* Prefer composition over inheritance.
* Avoid deeply nested components.
* Maximum recommended file size: **300 lines**.
* Split components when responsibilities grow.

---

# 7. Widget Standards

Widgets are reusable runtime components.

Widgets must:

* Render themselves.
* Validate their own data.
* Serialize their own value.
* Support localization.
* Support theming.
* Support accessibility.

Widgets must never contain business-specific workflows.

---

# 8. State Management

Use **Zustand** for global application state.

Global state includes:

* Session
* Assignments
* Theme
* Language
* Configuration
* Workflow
* Offline Queue

Do not store local component state in Zustand.

Use `useState` for local UI state.

---

# 9. API Standards

Screens and widgets must never call Axios directly.

Required flow:

```
Screen
    ↓
Use Case
    ↓
Repository
    ↓
API Client
    ↓
Network
```

All HTTP communication must go through the API layer.

---

# 10. Native Module Standards

Native APIs must be accessed only through Infrastructure Services.

Examples:

* Camera
* GPS
* Biometrics
* File System
* Notifications
* Permissions

Direct native calls from business modules are prohibited.

---

# 11. Logging Standards

Never use:

```typescript
console.log()
console.warn()
console.error()
```

Always use the centralized Logger.

Preferred methods:

* `Logger.debug()`
* `Logger.info()`
* `Logger.warn()`
* `Logger.error()`
* `Logger.audit()`
* `Logger.security()`
* `Logger.network()`

Sensitive information must never be written to logs.

---

# 12. Error Handling

Errors must never be silently ignored.

Use typed application errors.

Examples:

* ValidationError
* NetworkError
* AuthenticationError
* PermissionError
* CameraError
* SyncError

Display localized user-friendly messages.

Log technical details separately.

---

# 13. Localization Standards

Localization is mandatory.

Requirements:

* No hardcoded user-visible strings.
* Every string must use translation keys.
* Validation messages must be localized.
* Alerts must be localized.
* Button labels must be localized.
* Screen titles must be localized.

Example:

❌

```tsx
<Text>Login</Text>
```

✅

```tsx
<Text>{t("auth.login")}</Text>
```

---

# 14. Theme Standards

Do not use:

* Hardcoded colors
* Hardcoded spacing
* Hardcoded typography

Use centralized design tokens only.

Example:

```typescript
theme.colors.primary
theme.spacing.md
theme.typography.body
```

Inline styling is prohibited except for temporary debugging.

---

# 15. Server-Driven UI Standards

Business screens must use the Runtime Engine.

Do not hardcode:

* Forms
* Sections
* Field visibility
* Ordering
* Labels
* Validation rules

The Runtime Engine is responsible for rendering configurable business screens.

---

# 16. Offline Standards

Every write operation must:

1. Persist locally.
2. Enter the synchronization queue.
3. Synchronize automatically.
4. Update local cache.

Business modules should never implement synchronization logic.

---

# 17. Security Standards

Never store:

* Passwords
* Authentication credentials
* Personally identifiable information
* Sensitive secrets

Use platform secure storage where required.

Validate all external input.

Sanitize all data before persistence or transmission.

---

# 18. Testing Standards

Every feature should include appropriate tests.

Minimum expectations:

* Unit Tests for utilities and services.
* Component Tests for reusable UI.
* Integration Tests for repositories.
* Runtime Tests for engines.
* End-to-End Tests for business workflows.

---

# 19. Documentation Standards

Public classes, interfaces, and complex business logic should include meaningful documentation.

Every new feature should update:

* Architecture documentation (if applicable).
* API documentation (if applicable).
* User documentation (if applicable).
* Localization resources.
* Test documentation.

---

# 20. GitHub Copilot Standards

GitHub Copilot shall be treated as a development assistant.

AI-generated code must:

* Follow Architecture Principles.
* Follow Engineering Principles.
* Follow these Coding Standards.
* Include appropriate tests.
* Include localization support.
* Support theming.
* Respect Runtime Engine boundaries.

AI-generated code shall always be reviewed before acceptance.

---

# Prohibited Practices

The following are prohibited:

* Hardcoded business rules.
* Hardcoded strings.
* Hardcoded colors.
* Inline business logic in UI.
* Direct Axios usage in screens.
* Direct native module usage in business modules.
* Duplicate implementations.
* Large monolithic components.
* Silent exception handling.
* Console logging.
* Circular dependencies.

---

# Definition of Clean Code

Code is considered clean when it is:

* Easy to understand.
* Easy to test.
* Easy to modify.
* Easy to extend.
* Properly documented.
* Consistent with project architecture.
* Independent of implementation details where possible.

---

# Coding Philosophy

> **Write code for the next developer, not just for the compiler.**

> **Small components. Clear responsibilities. Consistent architecture.**

> **If a solution violates the architecture, redesign the solution—not the architecture.**
