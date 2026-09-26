# Configuration Schema

**Document ID:** CON-001

**Document Version:** 1.0

**Status:** Approved

**Owner:** Solution Architect

**Reviewed By:** Technical Architect

**Last Updated:** 29-Jun-2026

---

# 1. Purpose

This document defines the configuration schema used by the FullScan Mobile Platform.

The Configuration Schema is the contract between the Backend Verification System and the Mobile Runtime Engine.

It specifies how runtime metadata is represented, versioned, validated, and consumed by the mobile application.

All runtime behavior—including screens, workflows, widgets, validation rules, themes, localization, and attachment types—is driven by this schema.

---

# 2. Scope

The Configuration Schema defines:

* Configuration Package
* Screen Definitions
* Workflow Definitions
* Widget Definitions
* Validation Definitions
* Theme Definitions
* Localization Resources
* Attachment Types
* Feature Flags (Future)
* Version Information

---

# 3. Design Principles

The configuration shall follow these principles:

* Configuration before implementation.
* Immutable configuration packages.
* Version-controlled metadata.
* Backward compatibility.
* Offline cacheable.
* Human readable.
* JSON Schema compliant.
* Extensible without breaking existing clients.

---

# 4. Configuration Package

The backend delivers a **Configuration Package**.

Example:

```json
{
  "configurationVersion": "1.0.0",
  "minimumAppVersion": "1.0.0",
  "generatedOn": "2026-06-29T10:30:00Z",
  "screens": [],
  "workflows": [],
  "widgets": [],
  "validations": [],
  "attachments": [],
  "themes": [],
  "localization": []
}
```

The package represents the complete runtime configuration.

---

# 5. Configuration Metadata

Every package contains:

| Property             | Description                           |
| -------------------- | ------------------------------------- |
| configurationVersion | Configuration version                 |
| minimumAppVersion    | Minimum supported application version |
| generatedOn          | UTC generation timestamp              |
| checksum             | Package checksum                      |
| schemaVersion        | JSON Schema version                   |
| customerId           | Customer identifier                   |
| environment          | DEV / QA / UAT / PROD                 |

---

# 6. Configuration Hierarchy

```text
Configuration Package
│
├── Screens
├── Workflows
├── Widgets
├── Validations
├── Attachments
├── Themes
├── Localization
└── Metadata
```

Every runtime engine consumes one or more sections of this package.

---

# 7. Screen Definition

Each screen describes the user interface to render.

Example:

```json
{
  "screenId": "candidateVerification",
  "titleKey": "screen.candidateVerification",
  "workflowId": "candidateVerification",
  "layout": "scroll",
  "sections": []
}
```

Properties:

* screenId
* titleKey
* workflowId
* layout
* version
* visible
* sections

---

# 8. Section Definition

A screen contains one or more sections.

```json
{
  "sectionId": "candidateDetails",
  "titleKey": "section.candidate",
  "order": 1,
  "visible": true,
  "widgets": []
}
```

---

# 9. Widget Definition

Widgets are rendered dynamically.

Example:

```json
{
  "widgetId": "candidatePhoto",
  "type": "camera",
  "labelKey": "candidate.photo",
  "required": true,
  "binding": "attachments.candidatePhoto"
}
```

Common properties:

* widgetId
* type
* labelKey
* binding
* required
* visible
* enabled
* order

Widget-specific properties may be added without changing the schema.

---

# 10. Validation Definition

Validation rules are configuration driven.

Example:

```json
{
  "validationId": "photoRequired",
  "type": "required",
  "field": "candidatePhoto",
  "messageKey": "validation.photo.required"
}
```

Supported validation types:

* Required
* Pattern
* Range
* GPS
* GeoFence
* MockLocation
* Attachment
* BusinessRule

---

# 11. Workflow Definition

Workflows define business execution.

Example:

```json
{
  "workflowId": "candidateVerification",
  "steps": [
    "locationValidation",
    "candidatePhoto",
    "review",
    "submit"
  ]
}
```

The Workflow Engine interprets this definition at runtime.

---

# 12. Attachment Definition

Supported attachment types are configuration driven.

Example:

```json
{
  "documentType": "CandidatePhoto",
  "required": true,
  "multiple": false,
  "watermark": true
}
```

Future document types require only configuration updates.

---

# 13. Watermark Configuration

The watermark applied to every captured image is configurable.

Example:

```json
{
  "watermark": {
    "enabled": true,
    "fields": [
      "latitude",
      "longitude",
      "captureDate",
      "captureTime"
    ],
    "position": "bottom",
    "fontSize": 12
  }
}
```

Future fields such as Assignment Number or Employer Name may be added through configuration.

---

# 14. Theme Definition

Theme packages define runtime styling.

Example:

```json
{
  "themeId": "default",
  "mode": "light",
  "tokens": {
    "primary": "#0066CC",
    "background": "#FFFFFF"
  }
}
```

The Theme Engine maps tokens to Gluestack UI.

---

# 15. Localization Definition

Language resources are configuration driven.

Example:

```json
{
  "language": "te",
  "dictionary": {
    "candidate.photo": "అభ్యర్థి ఫోటో",
    "submit": "సమర్పించండి"
  }
}
```

Initial supported languages:

* English
* Hindi
* Telugu

---

# 16. Versioning

Each configuration package shall contain:

* configurationVersion
* schemaVersion
* compatibilityVersion
* checksum

The mobile application activates only compatible packages.

---

# 17. Validation

Before activation, the Configuration Engine validates:

* JSON syntax
* Schema compliance
* Duplicate identifiers
* Missing widget references
* Missing localization keys
* Invalid workflow references
* Circular navigation

Invalid configuration packages shall never be activated.

---

# 18. Offline Support

The active configuration package shall be cached locally.

When offline:

* Existing configuration remains active.
* Runtime execution continues.
* No configuration changes occur until connectivity returns.

---

# 19. Backward Compatibility

The schema shall support additive evolution.

Rules:

* Existing properties shall not change semantics.
* New optional properties may be added.
* Deprecated properties shall remain supported for one compatibility cycle.
* Required property changes require a major schema version.

---

# 20. Future Extensions

The schema is designed to support future runtime capabilities, including:

* OCR widgets
* Face recognition widgets
* AI-assisted validation
* Dynamic reports
* Customer branding
* White-label themes
* Plugin widgets
* Feature flags

These additions shall be introduced through new schema elements without breaking existing configurations.

---

# 21. JSON Schema Standard

The official schema standard for the FullScan platform shall be:

* JSON Schema Draft 2020-12

Benefits:

* Cross-platform compatibility
* Strong validation
* Automatic code generation
* IDE support
* Type generation
* API documentation generation

---

# 22. Traceability

The Configuration Schema supports:

* Configuration Engine
* Dynamic Form Engine
* Workflow Engine
* Widget Registry
* Validation Engine
* Theme Engine
* Localization Engine

It defines the runtime contract consumed by every major runtime subsystem.

---

# 23. Ownership

| Role               | Responsibility            |
| ------------------ | ------------------------- |
| Solution Architect | Schema Design             |
| Backend Team       | Configuration Generation  |
| Mobile Team        | Configuration Consumption |
| QA Team            | Schema Validation         |

---

# 24. Guiding Philosophy

> The Configuration Schema is the foundation of the FullScan Runtime Platform.

> It transforms the mobile application from a collection of hardcoded screens into a configurable execution engine.

> By treating configuration as a versioned, validated, and backward-compatible contract, the platform enables backend and mobile teams to evolve independently while maintaining a stable, secure, and extensible runtime architecture.
