# Dynamic Form Engine

**Document ID:** DFE-001

**Document Version:** 1.0

**Status:** Approved

**Owner:** Solution Architect

**Reviewed By:** Technical Architect

**Last Updated:** 29-Jun-2026

---

# 1. Purpose

The Dynamic Form Engine (DFE) is responsible for rendering configurable business screens at runtime using metadata received from the backend.

Unlike traditional mobile applications where every screen is manually developed, the Dynamic Form Engine constructs the user interface dynamically from configuration.

The engine enables the FullScan Mobile Platform to introduce new verification workflows, modify existing screens, add fields, change layouts, update validations, and introduce new attachment types without requiring application redevelopment.

The Dynamic Form Engine is one of the core architectural components of the FullScan platform.

---

# 2. Scope

The Dynamic Form Engine is responsible for:

* Dynamic Screen Generation
* Dynamic Layout Rendering
* Dynamic Form Rendering
* Dynamic Widget Rendering
* Dynamic Field Binding
* Dynamic Validation Integration
* Conditional Visibility
* Conditional Enablement
* Runtime Navigation Integration
* Runtime Localization
* Runtime Theme Integration
* Attachment Rendering
* Runtime State Binding

---

# 3. References

| Document                    | Purpose               |
| --------------------------- | --------------------- |
| Verification Runtime Engine | Runtime Orchestration |
| Workflow Engine             | Workflow Execution    |
| Widget Registry             | Widget Discovery      |
| Validation Engine           | Validation Rules      |
| Configuration Engine        | Metadata Source       |
| Localization Engine         | Language Resources    |
| Theme Engine                | Runtime Styling       |

---

# 4. Design Philosophy

The application shall **not** contain hardcoded business screens wherever configuration can be used.

Instead:

```text
Backend Configuration
        │
        ▼
Configuration Engine
        │
        ▼
Dynamic Form Engine
        │
        ▼
Widget Registry
        │
        ▼
Gluestack Components
        │
        ▼
Rendered Screen
```

The engine interprets configuration and produces the user interface at runtime.

---

# 5. Architectural Goals

The Dynamic Form Engine shall:

* Eliminate hardcoded forms.
* Eliminate hardcoded field layouts.
* Eliminate screen-specific business logic.
* Support employer-specific workflows.
* Support customer-specific forms.
* Support runtime configuration.
* Support future widget plugins.
* Support offline execution.
* Support localization.
* Support themes.

---

# 6. Responsibilities

The Dynamic Form Engine is responsible for:

### Screen Construction

* Build complete screens.
* Build sections.
* Build cards.
* Build forms.
* Build lists.

---

### Widget Rendering

Instantiate widgets from configuration.

Example widgets include:

* Label
* Text Input
* Number Input
* Date Picker
* Dropdown
* Radio Button
* Checkbox
* Switch
* Camera
* Attachment
* Map
* GPS
* Timeline
* Signature
* Button
* Divider

---

### Layout Management

Render layouts including:

* Vertical
* Horizontal
* Grid
* Card
* Accordion
* Tab
* Scroll
* Sectioned Layout

---

### Runtime Binding

Bind widgets to:

* Runtime Context
* Assignment Data
* Candidate Data
* Form State
* Attachment Collection

---

# 7. Rendering Pipeline

```text
JSON Configuration
        │
        ▼
Screen Definition
        │
        ▼
Layout Parser
        │
        ▼
Widget Resolver
        │
        ▼
Validation Binding
        │
        ▼
Localization Binding
        │
        ▼
Theme Binding
        │
        ▼
Runtime Renderer
        │
        ▼
Gluestack UI Components
```

The renderer is the only component aware of React Native and Gluestack UI.

---

# 8. Screen Definition

Each screen is defined by metadata.

Example:

```json
{
  "screenId": "candidate-verification",
  "titleKey": "verification.candidate.title",
  "layout": "scroll",
  "sections": []
}
```

Every screen contains:

* Screen Identifier
* Title
* Layout
* Sections
* Navigation Rules
* Validation Rules

---

# 9. Section Definition

A screen contains one or more sections.

Example:

```json
{
  "titleKey": "candidate.details",
  "widgets": []
}
```

Sections support:

* Visibility
* Ordering
* Expand / Collapse
* Conditional Rendering

---

# 10. Widget Definition

Each widget contains:

* Widget Type
* Identifier
* Label Key
* Value Binding
* Validation Rules
* Visibility Rules
* Enable Rules
* Theme Properties

Example:

```json
{
  "type": "camera",
  "field": "candidatePhoto",
  "attachmentType": "CandidatePhoto",
  "required": true
}
```

Widgets are resolved using the Widget Registry.

---

# 11. Supported Widget Types

Initial widget catalogue:

* Text
* Number
* Email
* Phone
* Date
* Time
* Dropdown
* Multi Select
* Checkbox
* Radio
* Switch
* Label
* Divider
* Camera
* Attachment
* GPS
* Map
* Signature
* Timeline
* Button

The architecture shall allow additional widget types without modifying the engine.

---

# 12. Attachment Support

The Dynamic Form Engine shall support configurable attachment widgets.

Example:

```json
{
  "type": "attachment",
  "documentType": "PAN_CARD",
  "required": false
}
```

Supported document types include:

* Candidate Photo
* Aadhaar Front
* Aadhaar Back
* PAN Card
* Passport
* Driving License
* Residence Proof
* Employment Proof
* Other Documents

The list is provided by backend configuration.

---

# 13. Camera Widget Behaviour

The Camera Widget shall:

* Open device camera only.
* Disable gallery selection.
* Capture GPS coordinates.
* Capture timestamp.
* Generate watermark.
* Store only the watermarked image.
* Associate the attachment with the active assignment.

Mandatory watermark:

* Latitude
* Longitude
* Capture Date
* Capture Time

Future watermark fields shall be configurable.

---

# 14. Validation Integration

The Dynamic Form Engine delegates validation to the Validation Engine.

Validation includes:

* Mandatory fields
* Data formats
* GPS availability
* GPS accuracy
* Mock location
* Attachment requirements
* Business rules

Validation is configuration-driven wherever practical.

---

# 15. Localization Integration

The engine never displays hardcoded text.

Instead it resolves:

```text
candidate.name
```

↓

Localization Engine

↓

English

↓

Hindi

↓

Telugu

All runtime-generated widgets are localized.

---

# 16. Theme Integration

The engine never applies hardcoded styling.

Every widget consumes:

* Colors
* Typography
* Spacing
* Border Radius
* Icons

from the Theme Engine.

The renderer maps these values to Gluestack UI components.

---

# 17. Runtime Context Binding

Widgets bind directly to the Runtime Context.

Examples:

* Current Assignment
* Candidate
* Attachments
* GPS
* Logged-in User
* Workflow State

No widget manages business state independently.

---

# 18. Offline Behaviour

The Dynamic Form Engine shall:

* Load cached configurations.
* Render forms offline.
* Capture attachments offline.
* Persist form state.
* Restore interrupted forms.
* Resume workflow execution.

The user experience remains consistent regardless of connectivity.

---

# 19. Extension Points

The engine supports future enhancements through extension points.

Examples:

* OCR Widget
* Face Match Widget
* QR Scanner Widget
* Barcode Widget
* NFC Widget
* Video Capture Widget
* AI Assistant Widget
* Digital Signature Widget
* Customer-specific widgets

New widgets register with the Widget Registry without modifying the engine.

---

# 20. Example End-to-End Flow

```text
User Opens Assignment
        │
        ▼
Workflow Engine requests Screen
        │
        ▼
Configuration Engine loads JSON
        │
        ▼
Dynamic Form Engine parses JSON
        │
        ▼
Widget Registry resolves widgets
        │
        ▼
Validation rules are bound
        │
        ▼
Localization applied
        │
        ▼
Theme applied
        │
        ▼
Screen rendered
        │
        ▼
User interacts
        │
        ▼
Runtime Context updated
```

---

# 21. Design Principles

The Dynamic Form Engine follows these principles:

* Configuration before hardcoding
* Widgets before screens
* Layout before implementation
* Runtime before compilation
* Reuse before duplication
* Localization by default
* Theme by default
* Offline by default
* Extension before modification

---

# 22. Traceability

The Dynamic Form Engine implements:

* Server-Driven UI
* Functional Requirements
* Non-Functional Requirements
* Verification Runtime Engine
* Workflow Engine

It is responsible for converting business configuration into executable user interfaces.

---

# 23. Ownership

| Role                | Responsibility         |
| ------------------- | ---------------------- |
| Solution Architect  | Engine Design          |
| Technical Architect | Runtime Implementation |
| Engineering Team    | Development            |
| QA Team             | Runtime Validation     |

---

# 24. Guiding Philosophy

> The Dynamic Form Engine is not merely a form renderer.

> It is the runtime user interface platform of the FullScan Mobile Application.

> It transforms backend-defined business configuration into fully functional, localized, themed, validated, offline-capable user experiences without requiring application changes.

By separating screen definition, layout, widgets, validation, localization, and styling from application code, the Dynamic Form Engine enables the platform to evolve continuously while maintaining a stable, maintainable, and extensible mobile architecture.


# One architectural improvement I strongly recommend

I would introduce a Rendering Pipeline as a first-class concept in the implementation.

Instead of the Dynamic Form Engine doing everything itself:

Dynamic Form Engine
        │
        ▼
Rendering Pipeline
        │
        ├── Screen Parser
        ├── Layout Parser
        ├── Widget Resolver
        ├── Validation Binder
        ├── Localization Binder
        ├── Theme Binder
        └── React Native Renderer