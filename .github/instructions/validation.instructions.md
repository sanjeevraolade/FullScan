---
applyTo:
  - "mobile/src/runtime/validation/**"
  - "mobile/src/validation/**"
  - "mobile/src/validators/**"
---

# Validation Instructions

These instructions apply to the Validation Engine and all validation implementations within the FullScan Mobile Platform.

Refer to:

- docs/05-Runtime/05-Validation-Engine.md
- docs/06-Contracts/05-Validation-Schema.md
- docs/02-Business/06-Business-Rules.md
- docs/02-Business/07-Functional-Requirements.md

The Validation Engine architecture is frozen.

---

# Validation Philosophy

Validation is a Runtime responsibility.

Business validation must never be implemented inside:

- Screens
- Widgets
- Navigation
- API Services

The Validation Engine is the single authority responsible for validating business rules.

---

# Validation Principles

Every validation should be:

- Configuration Driven
- Reusable
- Stateless
- Testable
- Offline Capable
- Independent

Business rules should be expressed through configuration whenever possible.

---

# Validation Responsibilities

The Validation Engine is responsible for:

- Field Validation
- Section Validation
- Screen Validation
- Workflow Validation
- Business Rule Validation
- Attachment Validation
- GPS Validation
- Security Validation

It evaluates whether the current workflow may proceed.

---

# Validation Flow

Validation executes in the following order.

Field

↓

Section

↓

Screen

↓

Workflow

↓

Submission

If a blocking validation fails, execution stops immediately.

---

# Validation Categories

## Field Validation

Examples:

- Required
- Min Length
- Max Length
- Pattern
- Numeric Range

---

## Location Validation

Examples:

- GPS Enabled
- GPS Accuracy
- Geo-fence
- Mock Location

---

## Attachment Validation

Examples:

- Attachment Required
- Watermark Present
- File Size
- File Format
- Capture Completed

---

## Security Validation

Examples:

- Registered Device
- Root Detection
- Jailbreak Detection
- Biometric Verification

---

## Workflow Validation

Examples:

- Previous Step Completed
- Mandatory Section Complete
- Required Evidence Collected

---

# Configuration Driven

Validation rules must come from configuration whenever possible.

Never hardcode:

- Required fields
- Mandatory documents
- Validation messages
- Workflow rules

Read rules from runtime configuration.

---

# Localization

Validation messages must use localization keys.

Never hardcode error messages.

Examples:

validation.photo.required

validation.gps.accuracy

validation.mockLocation

The Localization Engine resolves user-facing text.

---

# Theme

The Validation Engine does not apply styling.

Widgets are responsible for presenting validation results using Theme Engine design tokens.

---

# Runtime Integration

Validation Engine interacts with:

- Runtime Context
- Workflow Engine
- Dynamic Form Engine
- Attachment Engine
- Configuration Engine

Avoid dependencies on UI components.

---

# Validation Results

Every validator should return a consistent result.

Example:

Success

Error Code

Message Key

Severity

Target Field

Suggested Action (optional)

Never return localized text directly.

---

# Error Severity

Supported severities:

- Info
- Warning
- Error
- Blocking

Blocking validations prevent workflow progression.

---

# Validation Registration

Each validator should have a unique identifier.

Examples:

required

gpsAccuracy

geoFence

mockLocation

attachmentRequired

Validators should be discoverable and reusable.

---

# Offline First

Validation should execute locally whenever possible.

Avoid server-side validation unless absolutely required.

The application must continue validating business rules while offline.

---

# Logging

Validation events should be logged through LoggerService.

Log:

- Validation Started
- Validation Passed
- Validation Failed
- Validation Duration

Never log sensitive user information.

---

# Error Handling

Validation failures are expected business outcomes.

Do not throw exceptions for ordinary validation failures.

Return structured validation results instead.

Reserve exceptions for unexpected technical failures.

---

# Performance

Avoid:

- Duplicate validation
- Repeated configuration parsing
- Expensive computations

Reuse validation definitions where possible.

---

# Testability

Every validator should be independently testable.

Test:

- Success cases
- Failure cases
- Boundary values
- Invalid configuration
- Missing configuration

Use mock Runtime Context during testing.

---

# Folder Structure

validators/

    Required/

        RequiredValidator.ts

        RequiredValidator.test.ts

        index.ts

Keep validators small and focused.

---

# Before Writing Code

Always verify:

✓ Is this validation implemented in the Validation Engine?

✓ Is it configuration driven?

✓ Is it reusable?

✓ Is it offline capable?

✓ Does it return structured results?

✓ Does it use localization keys?

✓ Is it independently testable?

If any answer is "No", redesign before implementation.

---

# Guiding Principle

The Validation Engine is the guardian of business correctness.

Every validation rule should be reusable, configuration-driven, independently testable, and executed consistently regardless of where it is invoked.