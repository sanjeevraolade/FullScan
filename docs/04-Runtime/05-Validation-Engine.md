# Validation Engine

**Document ID:** VLE-001

**Document Version:** 1.0

**Status:** Approved

**Owner:** Solution Architect

**Reviewed By:** Technical Architect

**Last Updated:** 29-Jun-2026

---

# 1. Purpose

The Validation Engine is responsible for evaluating all validation rules executed within the FullScan Mobile Platform.

Rather than embedding validation inside screens or widgets, all business, workflow, security, location, and attachment validations are delegated to a centralized Validation Engine.

This architecture guarantees consistency, reusability, auditability, and configurability across the application.

---

# 2. Scope

The Validation Engine is responsible for:

* Field Validation
* Form Validation
* Workflow Validation
* Business Rule Validation
* Security Validation
* GPS Validation
* Geo-fence Validation
* Device Validation
* Attachment Validation
* Cross-field Validation
* Runtime Validation
* Validation Reporting

---

# 3. References

| Document                    | Purpose               |
| --------------------------- | --------------------- |
| Verification Runtime Engine | Runtime Orchestration |
| Workflow Engine             | Workflow Execution    |
| Dynamic Form Engine         | Form Rendering        |
| Widget Registry             | Widget Interaction    |
| Configuration Engine        | Validation Metadata   |

---

# 4. Validation Philosophy

Validation is a business capability—not a UI responsibility.

Widgets collect data.

The Validation Engine decides whether the data is valid.

No screen, widget, or service shall implement business validation independently.

---

# 5. Validation Pipeline

```text
User Input
      │
      ▼
Dynamic Form Engine
      │
      ▼
Validation Engine
      │
 ┌────┼─────────────────────────────────────┐
 ▼    ▼         ▼          ▼               ▼
Field Form    Business   Security      Workflow
      │
      ▼
Validation Result
      │
      ▼
Runtime Engine
```

---

# 6. Validation Categories

## Field Validation

* Required
* Minimum Length
* Maximum Length
* Pattern
* Numeric Range
* Date Range

---

## Form Validation

* Mandatory Sections
* Required Attachments
* Duplicate Fields
* Invalid Combinations

---

## Workflow Validation

* Step Completion
* Required Previous Step
* Workflow State
* Exit Conditions

---

## Location Validation

* GPS Enabled
* GPS Accuracy
* Latitude
* Longitude
* Geo-fence
* Mock Location
* Speed Threshold (future)

---

## Device Validation

* Device Registration
* Root Detection
* Jailbreak Detection
* Emulator Detection
* Developer Mode

---

## Attachment Validation

* Mandatory Attachments
* Image Exists
* Watermark Exists
* Watermark Integrity
* Image Size
* Image Format

---

## Security Validation

* Authentication
* Authorization
* Session Validity
* Biometric Status

---

# 7. Validation Rules

Validation rules are configuration driven.

Example:

```json
{
  "field":"candidateName",
  "required":true,
  "minLength":3,
  "maxLength":100
}
```

---

# 8. Camera Validation

The Camera Widget shall not submit an image unless:

* Camera capture is live
* Gallery selection is disabled
* GPS captured successfully
* Watermark successfully generated
* Assignment ID associated
* Timestamp recorded

---

# 9. Watermark Validation

Every attachment shall contain:

* Latitude
* Longitude
* Capture Date
* Capture Time

Future watermark elements shall be configurable.

Validation fails if watermark generation fails.

---

# 10. Attachment Validation

Each attachment shall validate:

* Attachment Type
* Required Status
* Assignment Mapping
* Upload Status
* GPS Metadata
* Device ID
* Capture Timestamp

---

# 11. Cross-Field Validation

Examples:

* Verification Result requires Notes.
* Candidate Unavailable requires Reason.
* Photo Capture required before Submit.
* GPS Validation required before Camera.

Cross-field rules are configuration driven.

---

# 12. Validation Results

Every validation returns:

* Success / Failure
* Validation Code
* Localized Message Key
* Severity
* Recoverable Flag

---

# 13. Validation Events

Events include:

* ValidationStarted
* ValidationPassed
* ValidationFailed
* ValidationCompleted

---

# 14. Offline Behaviour

Validation shall execute completely offline.

No business validation shall require internet connectivity unless explicitly configured.

---

# 15. Extension Points

Future validators:

* OCR Validation
* Face Match Validation
* AI Quality Assessment
* Duplicate Image Detection
* Fraud Scoring

---

# 16. Design Principles

* Validation before submission
* Configuration before code
* Reusable validators
* Stateless execution
* Localized messages
* Offline-first

---

# 17. Guiding Philosophy

> Validation protects business integrity.

> Every business rule, security policy, and workflow constraint is enforced consistently through a centralized Validation Engine rather than scattered across screens and widgets.
