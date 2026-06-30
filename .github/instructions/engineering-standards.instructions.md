---
applyTo:
  - "mobile/src/**"
---

# Engineering Standards Instructions

These instructions define the engineering and coding standards for the FullScan Mobile Platform.

Refer to:

- docs/03-Governance/02-Engineering-Principles.md
- docs/03-Governance/03-Coding-Standards.md
- docs/03-Governance/04-Naming-Conventions.md
- docs/03-Governance/05-Repository-Standards.md

These standards are mandatory for every implementation.

---

# Engineering Philosophy

Every piece of code should be:

- Readable
- Maintainable
- Testable
- Reusable
- Predictable
- Extensible
- Consistent

Code is written once but read many times.

Always optimize for readability over cleverness.

---

# General Principles

Follow:

- SOLID
- Clean Code
- Clean Architecture
- DRY (Don't Repeat Yourself)
- KISS (Keep It Simple)
- YAGNI (You Aren't Gonna Need It)
- Separation of Concerns
- Composition over Inheritance

---

# Single Responsibility

Every class, component, hook, service, and function should have one clearly defined responsibility.

Avoid "God Objects".

Avoid utility classes that perform unrelated operations.

---

# Prefer Composition

Prefer composing small reusable components.

Avoid deep inheritance hierarchies.

Example:

GOOD

CameraWidget

↓

CameraToolbar

↓

CameraPreview

↓

CaptureButton

Instead of one 1500-line component.

---

# File Size

Recommended guidelines:

Component

≈ 300 lines or less

Hook

≈ 200 lines or less

Service

≈ 300 lines or less

Validator

≈ 100 lines or less

Repository

≈ 250 lines or less

If a file becomes difficult to understand, split it into smaller responsibilities.

These are guidelines—not strict limits.

---

# Function Size

Functions should perform one task.

Prefer:

20–40 lines.

If a function requires scrolling, consider extracting smaller functions.

---

# Function Naming

Use descriptive verb-based names.

Examples:

calculateDistance()

validateAttachment()

capturePhoto()

downloadConfiguration()

queueSynchronization()

Avoid:

process()

execute()

handle()

doWork()

run()

unless additional context makes the purpose obvious.

---

# Variable Naming

Names should explain intent.

GOOD

candidateAddress

gpsAccuracy

attachmentMetadata

workflowContext

BAD

obj

tmp

data

value

list

Avoid abbreviations.

---

# Boolean Naming

Use positive boolean names.

GOOD

isValid

hasPermission

canSynchronize

shouldRetry

BAD

invalid

noPermission

flag

check

---

# Constants

Avoid magic values.

Never write:

```typescript
if (status === 3)
```

Prefer:

```typescript
WorkflowStatus.Completed
```

Store reusable values in constants or enums.

---

# Enumerations

Use enums or constant objects for fixed values.

Examples:

WorkflowStatus

AttachmentStatus

ValidationSeverity

ThemeMode

Never compare magic strings throughout the code.

---

# TypeScript

Always enable strict typing.

Avoid:

any

unknown (unless justified)

type assertions without validation

Prefer:

Interfaces

Generics

Discriminated Unions

Strong typing

---

# Interfaces

Prefer interfaces for contracts.

Example:

AttachmentRepository

Logger

CameraService

SynchronizationService

Depend on abstractions rather than implementations.

---

# React Components

Components should focus on rendering.

Avoid:

Business Logic

API Calls

Synchronization

Workflow Execution

Heavy calculations

Delegate responsibilities.

---

# Hooks

Custom hooks should encapsulate reusable behaviour.

Examples:

useCamera()

useLocation()

useConfiguration()

useRuntime()

useSynchronization()

Avoid feature-specific hooks when a reusable hook can be created.

---

# State Management

State should exist at the appropriate level.

UI State

↓

Component

Business State

↓

Runtime Context

Global Application State

↓

Store

Avoid duplicated state.

---

# Async Code

Prefer:

async / await

Avoid nested Promise chains.

Handle every asynchronous error.

Never ignore rejected promises.

---

# Error Handling

Every error should be handled intentionally.

Never:

```typescript
catch (e) {}
```

Never swallow exceptions.

Log unexpected errors.

Return meaningful results for expected business failures.

---

# Logging

Use LoggerService.

Never use:

console.log()

console.warn()

console.error()

Use structured logging.

Do not log sensitive information.

---

# Imports

Maintain consistent import ordering.

Recommended order:

1. React
2. Third-party Libraries
3. Internal Modules
4. Types
5. Styles

Avoid circular dependencies.

---

# Dependency Injection

Prefer constructor or provider injection.

Avoid creating service instances inside components.

Example:

GOOD

Runtime receives ConfigurationService.

BAD

new ConfigurationService()

inside a Widget.

---

# Comments

Write comments that explain WHY.

Avoid comments explaining WHAT.

Bad

// Increment counter

counter++

Good

// Increment retry count to support exponential backoff.

retryCount++

Prefer self-documenting code.

---

# Formatting

Keep formatting consistent.

Prefer early returns.

Reduce nested conditionals.

Extract complex expressions into well-named variables.

---

# Null Safety

Use:

Optional Chaining

Nullish Coalescing

Guard Clauses

Avoid repeated null checks.

---

# Immutability

Prefer immutable data.

Avoid modifying shared state directly.

Return new objects where appropriate.

---

# Reusability

Before writing new code ask:

Can an existing widget solve this?

Can an existing hook solve this?

Can an existing service solve this?

Can configuration solve this?

Avoid duplication.

---

# Performance

Avoid:

Unnecessary renders

Duplicate parsing

Repeated API calls

Expensive calculations inside render()

Prefer:

Memoization

Lazy Loading

Caching

Stable References

---

# Folder Structure

Follow the established repository structure.

Every feature should remain consistent.

Avoid introducing new architectural layers.

---

# File Structure

Prefer:

Imports

↓

Constants

↓

Types

↓

Component / Class

↓

Private Helpers

↓

Exports

Keep files organized consistently.

---

# Testing

Every implementation should be testable.

Include:

Unit Tests

Component Tests

Integration Tests (when appropriate)

Mock external dependencies.

---

# Accessibility

Every UI component should support:

Accessibility Labels

Dynamic Font Sizes

Screen Readers

Keyboard Navigation (where applicable)

Accessibility is mandatory.

---

# Documentation

Update documentation whenever:

Public API changes

Architecture changes

Contracts change

Behaviour changes

Keep documentation synchronized with implementation.

---

# AI Generation Rules

When generating a new feature, always generate all required artifacts.

Example:

CandidateCard/

CandidateCard.tsx

CandidateCard.types.ts

CandidateCard.styles.ts

CandidateCard.test.tsx

index.ts

Do not generate only a single component file.

Maintain consistent project structure.

---

# Before Writing Code

Always verify:

✓ Is the implementation readable?

✓ Is the implementation reusable?

✓ Is the implementation testable?

✓ Is strong typing used?

✓ Are naming conventions followed?

✓ Is business logic separated from UI?

✓ Is logging implemented correctly?

✓ Is documentation impacted?

✓ Is the code consistent with existing architecture?

If any answer is "No", redesign before implementation.

---

# Code Review Checklist

Every implementation should satisfy the following before completion.

Architecture

✓ Follows Runtime Architecture

✓ Respects dependency direction

✓ Uses Runtime Engines correctly

Code Quality

✓ Single Responsibility

✓ Strong Typing

✓ No Dead Code

✓ No Duplication

✓ No Magic Values

Performance

✓ Efficient Rendering

✓ No unnecessary allocations

✓ Proper memoization where appropriate

Security

✓ No sensitive logging

✓ Secure storage used correctly

✓ Input validation implemented

Testing

✓ Tests included

✓ Edge cases covered

Maintainability

✓ Readable

✓ Modular

✓ Consistent

✓ Self-documenting

---

# Guiding Principle

Write code that another engineer can confidently understand, extend, test, and maintain years from now.

Every implementation should strengthen the FullScan platform by favoring clarity, consistency, reusability, and long-term maintainability over short-term convenience.