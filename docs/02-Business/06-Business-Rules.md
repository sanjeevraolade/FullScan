# Business Rules

**Document ID:** BRD-001
**Document Version:** 1.0
**Status:** Approved
**Owner:** Product Owner
**Reviewed By:** Solution Architect
**Last Updated:** 29-Jun-2026

---

# 1. Purpose

This document defines the business rules governing the FullScan Mobile Platform.

Business Rules are mandatory business policies that determine how field verification activities shall be performed.

These rules are independent of technology and implementation.

The Verification Runtime Engine (VRE) is responsible for enforcing these rules consistently across all verification workflows.

---

# 2. Scope

This document applies to all verification workflows supported by the FullScan Mobile Platform.

It covers:

* Authentication
* Assignment Management
* Verification
* Evidence Collection
* GPS Validation
* Attachments
* Offline Operations
* Synchronization
* Security
* Localization
* Audit

---

# 3. References

| Document            | Purpose                       |
| ------------------- | ----------------------------- |
| Vision.md           | Product Vision                |
| Business Problem    | Defines business problems     |
| Business Goals      | Defines business goals        |
| Business Objectives | Defines measurable objectives |

---

# 4. Rule Classification

Business Rules are classified into the following categories.

| Category        | Prefix |
| --------------- | ------ |
| Authentication  | AUTH   |
| Assignment      | ASN    |
| Verification    | VER    |
| GPS             | GPS    |
| Evidence        | EVD    |
| Attachments     | ATT    |
| Offline         | OFF    |
| Synchronization | SYN    |
| Security        | SEC    |
| Localization    | LOC    |
| Audit           | AUD    |

---

# 5. Business Rules

# Authentication Rules

## BR-001 — Authorized Users Only

Only users created and authorized by the backend administration system may access the application.

Self-registration is not permitted.

---

## BR-002 — Single Device Registration

Each Field Executive may be registered on only one mobile device at any point in time.

Attempts to log in from an unregistered device shall be rejected unless the existing registration is explicitly reset through the backend.

---

## BR-003 — Secure Authentication

Every verification activity shall be performed by an authenticated Field Executive.

Anonymous verification is prohibited.

---

## BR-004 — Biometric Authentication

When enabled, biometric authentication may be used to authenticate the registered user on the registered device.

Biometric credentials shall never be transmitted to backend systems.

---

# Assignment Rules

## BR-005 — Assignment Ownership

Each assignment shall be allocated to one Field Executive.

Only the assigned executive may complete the verification.

---

## BR-006 — Assignment Integrity

Assignment information shall not be modified by the Field Executive.

Only verification results and supporting evidence may be added.

---

## BR-007 — Assignment Completion

An assignment shall remain in progress until all mandatory verification requirements have been completed.

---

# Verification Rules

## BR-008 — Physical Verification

Verification shall be performed at the candidate's physical location.

Remote or phone-based verification shall not satisfy the verification requirement unless explicitly permitted by business policy.

---

## BR-009 — Mandatory Evidence

Every completed verification shall contain sufficient evidence to support the verification outcome.

Evidence requirements are defined through configuration.

---

## BR-010 — Mandatory Verification Outcome

Every assignment shall conclude with a valid verification result.

The result shall be selected from approved business-defined verification outcomes.

---

# Location Rules

## BR-011 — GPS Availability

GPS location shall be available before location-dependent evidence is captured.

---

## BR-012 — Location Validation

Verification activities requiring physical presence shall be performed within the configured geo-fence of the assignment location.

---

## BR-013 — Mock Location Prevention

Verification shall not proceed if mock location activity is detected.

Such events shall be recorded for audit purposes.

---

## BR-014 — Device Integrity

Verification shall not proceed when device integrity checks fail.

Examples include:

* Rooted devices
* Jailbroken devices
* Emulators
* Developer-mode policies as defined by business configuration

---

# Evidence Collection Rules

## BR-015 — Live Camera Capture

Photographic evidence shall be captured using the device camera.

Selecting images from the device gallery is prohibited.

---

## BR-016 — Automatic Metadata Capture

Each captured photograph shall include associated metadata including:

* Timestamp
* Latitude
* Longitude
* GPS Accuracy
* Device Information

Additional metadata may be introduced through future business requirements.

---

## BR-017 — Evidence Authenticity

Captured evidence shall represent the actual verification activity.

Reused or manipulated evidence is not permitted.

---

# Attachment Rules

## BR-018 — Attachment Collection

Verification evidence shall be maintained as a collection of attachments rather than fixed image fields.

---

## BR-019 — Configurable Attachment Types

Attachment requirements shall be configurable by business workflow.

Future attachment types shall be introduced through configuration whenever possible.

---

## BR-020 — Attachment Traceability

Every attachment shall remain associated with its originating assignment throughout its lifecycle.

---

# Offline Rules

## BR-021 — Offline Verification

Field Executives shall be able to continue verification activities without internet connectivity.

---

## BR-022 — Offline Persistence

Verification data shall never be discarded because network connectivity is unavailable.

---

## BR-023 — Automatic Synchronization

Pending offline verification data shall synchronize automatically when connectivity becomes available.

---

# Submission Rules

## BR-024 — Complete Submission

Verification submission shall include all mandatory information required by the business workflow.

Incomplete submissions shall not be accepted.

---

## BR-025 — Submission Integrity

Submitted verification records shall accurately represent the collected evidence.

---

# Configuration Rules

## BR-026 — Server-Driven Configuration

Business workflows, forms, sections, validation rules, and attachment definitions shall be configurable through backend-managed metadata.

---

## BR-027 — Dynamic Business Workflow

Business workflow changes should primarily require configuration changes rather than application redevelopment.

---

# Localization Rules

## BR-028 — Multilingual Support

The application shall support multiple languages.

The initial release shall support:

* English
* Hindi
* Telugu

Future languages shall be introduced without significant application redesign.

---

# Theme Rules

## BR-029 — Consistent User Experience

The application shall provide a consistent user experience across supported themes.

Business functionality shall remain independent of visual themes.

---

# Audit Rules

## BR-030 — Auditability

Every verification activity shall be traceable through appropriate audit information.

Audit records shall support operational review and compliance requirements.

---

# Security Rules

## BR-031 — Secure Communication

Business data shall be transmitted only through approved secure communication mechanisms.

---

## BR-032 — Sensitive Data Protection

Sensitive information shall be protected throughout its lifecycle in accordance with organizational security policies.

---

# Future Business Rules

The platform is expected to support additional business rules including:

* OCR validation
* Face verification
* AI-assisted document validation
* Dynamic risk scoring
* Configurable approval workflows
* Client-specific business policies

These enhancements should integrate through configuration whenever practical.

---

# Rule Ownership

Business Rules are owned by the business domain.

Technical implementation of these rules is owned by the Verification Runtime Engine.

Changes to business rules should not require changes to governance documents.

---

## Traceability

| Artifact               | Reference             |
| ---------------------- | --------------------- |
| Business Goal          | BG-001                |
| Business Objective     | BO-002                |
| Functional Requirement | FR-003                |
| Runtime Module         | Authentication Engine |
| Test Cases             | TC-AUTH-005           |

---

---

# BR-GPS-001

## Rule Name

GPS Availability

---

## Description

Location services must be enabled before evidence collection begins.

---

## Business Rationale

Every verification requires trustworthy location evidence.

---

## Priority

Critical

---

## Rule Statement

GPS shall be available before:

* Photo Capture
* Signature Capture
* Verification Submission

---

## Failure Behaviour

Verification cannot continue.

The user shall receive a localized message explaining the reason.

---

## Traceability

| Artifact               | Reference       |
| ---------------------- | --------------- |
| Business Goal          | BG-002          |
| Business Objective     | BO-004          |
| Functional Requirement | FR-021          |
| Runtime Module         | Location Engine |
| Widget                 | Camera Widget   |
| Test Case              | TC-GPS-001      |

---

---

# BR-GPS-002

## Rule Name

Mock Location Prevention

---

## Description

Verification activities shall not proceed when mock GPS activity is detected.

---

## Business Rationale

Protects against fraudulent verification.

---

## Priority

Critical

---

## Rule Statement

If mock GPS is detected:

* Evidence collection is blocked.
* Submission is blocked.
* Audit event recorded.

---

## User Notification

The application shall display a localized message informing the Field Executive that verification cannot continue due to device location integrity issues.

---

## Audit Requirement

The following information shall be recorded:

* User
* Assignment
* Device
* Timestamp
* GPS Status

---

## Traceability

| Artifact               | Reference           |
| ---------------------- | ------------------- |
| Business Goal          | BG-001              |
| Business Objective     | BO-003              |
| Functional Requirement | FR-022              |
| Runtime Module         | Security Engine     |
| Validation Engine      | Location Validation |
| Test Case              | TC-GPS-008          |

---

---

# BR-EVD-001

## Rule Name

Live Camera Capture

---

## Description

Evidence photographs shall be captured using the device camera.

Gallery selection is prohibited.

---

## Business Rationale

Ensures photographic evidence represents the current verification.

---

## Rule Statement

The application shall not allow image selection from the device gallery.

---

## Traceability

| Artifact               | Reference         |
| ---------------------- | ----------------- |
| Business Goal          | BG-002            |
| Business Objective     | BO-005            |
| Functional Requirement | FR-030            |
| Widget                 | Camera Widget     |
| Runtime Module         | Attachment Engine |
| Test Case              | TC-CAM-001        |

---

# 6. Rule Priority Matrix

| Priority | Meaning                                            |
| -------- | -------------------------------------------------- |
| Critical | System cannot continue without satisfying the rule |
| High     | Rule should always be enforced                     |
| Medium   | Rule enforced where applicable                     |
| Low      | Informational rule                                 |

---

# 7. Rule Lifecycle

Every business rule follows the lifecycle below.

```text
Business Requirement
        │
        ▼
Business Rule
        │
        ▼
Functional Requirement
        │
        ▼
Runtime Validation
        │
        ▼
Implementation
        │
        ▼
Automated Test
```

---

# 8. Rule Ownership

Business Rules are owned by the Product Owner.

Implementation is owned by the Engineering Team.

Validation is owned by Quality Assurance.

Architecture alignment is owned by the Solution Architect.

---

# 9. Future Enhancements

The Business Rule framework is designed to support future capabilities, including:

* AI-assisted validation
* OCR-based document verification
* Face matching
* Dynamic rule configuration
* Client-specific rule sets
* Policy versioning
* Rule inheritance

---

# 10. Business Rule Philosophy

> **Business Rules define the business policy.**

> **The Runtime Engine enforces the business policy.**

> **The application provides the user experience.**

Every implementation in the platform shall be traceable back to one or more Business Rules.
