# Widget Registry

**Document ID:** WRG-001

**Document Version:** 1.0

**Status:** Approved

**Owner:** Solution Architect

**Reviewed By:** Technical Architect

**Last Updated:** 29-Jun-2026

---

# 1. Purpose

The Widget Registry is responsible for discovering, registering, resolving, and managing all runtime widgets used by the Dynamic Form Engine.

Rather than hardcoding UI components inside screens, the Dynamic Form Engine requests widgets from the Widget Registry based on backend configuration.

The Widget Registry enables the platform to support configurable user interfaces, reusable widgets, future widget plugins, and customer-specific extensions without modifying the rendering engine.

---

# 2. Scope

The Widget Registry is responsible for:

* Widget Registration
* Widget Discovery
* Widget Resolution
* Widget Lifecycle
* Widget Metadata
* Widget Validation Contracts
* Widget Versioning
* Widget Extensions
* Widget Dependency Management

---

# 3. References

| Document            | Purpose               |
| ------------------- | --------------------- |
| Dynamic Form Engine | Runtime Rendering     |
| Runtime Engine      | Runtime Orchestration |
| Validation Engine   | Widget Validation     |
| Theme Engine        | Widget Styling        |
| Localization Engine | Widget Localization   |

---

# 4. Widget Philosophy

Every visual element rendered by the Dynamic Form Engine is a widget.

Screens do **not** know how widgets are implemented.

Instead:

```text
Screen JSON
      │
      ▼
Dynamic Form Engine
      │
      ▼
Widget Registry
      │
      ▼
Concrete Widget
      │
      ▼
Gluestack UI
```

This architecture eliminates screen-specific rendering logic.

---

# 5. Responsibilities

The Widget Registry shall:

* Register widgets
* Resolve widgets
* Create widget instances
* Validate widget metadata
* Provide widget definitions
* Support widget versioning
* Support runtime widget discovery
* Support plugin widgets
* Support customer-specific widgets

The registry shall never contain business logic.

---

# 6. Widget Lifecycle

```text
Application Start
        │
        ▼
Register Widgets
        │
        ▼
Load Screen JSON
        │
        ▼
Resolve Widget
        │
        ▼
Create Widget Instance
        │
        ▼
Bind Runtime Context
        │
        ▼
Render
        │
        ▼
Update
        │
        ▼
Dispose
```

---

# 7. Widget Categories

The platform supports multiple widget categories.

## Display Widgets

* Label
* Text
* Badge
* Divider
* Icon
* Card

---

## Input Widgets

* Text Input
* Number Input
* Email
* Phone
* Password
* Text Area

---

## Selection Widgets

* Dropdown
* Radio
* Checkbox
* Multi Select
* Switch

---

## Date & Time Widgets

* Date Picker
* Time Picker
* Date Time Picker

---

## Verification Widgets

* Camera
* Attachment
* Signature
* GPS
* Location Status
* Geo Fence Status

---

## Navigation Widgets

* Button
* Stepper
* Wizard
* Timeline

---

## Layout Widgets

* Section
* Row
* Column
* Grid
* Accordion
* Tabs
* Scroll Container

---

## Future Widgets

* OCR
* Face Match
* Barcode
* QR Code
* NFC
* Video Capture
* Audio Recording
* AI Assistant

---

# 8. Widget Contract

Every widget shall implement a common contract.

Example responsibilities:

* Initialize
* Bind data
* Validate input
* Render
* Update
* Dispose

The contract guarantees that the Dynamic Form Engine can interact with every widget consistently.

---

# 9. Widget Metadata

Each widget exposes metadata including:

* Widget Identifier
* Widget Type
* Display Name
* Category
* Version
* Supported Properties
* Supported Events
* Validation Capabilities
* Offline Support
* Accessibility Support

Metadata is used by the Dynamic Form Engine during rendering.

---

# 10. Widget Resolution

Widget resolution follows this sequence.

```text
Widget Type
      │
      ▼
Registry Lookup
      │
      ▼
Widget Metadata
      │
      ▼
Widget Factory
      │
      ▼
Widget Instance
```

If a widget cannot be resolved, the engine shall render a configurable fallback component and log the error.

---

# 11. Widget Factory

The Widget Registry delegates object creation to a Widget Factory.

Responsibilities include:

* Instantiate widget
* Inject dependencies
* Bind runtime context
* Apply localization
* Apply theme
* Return widget instance

The Widget Factory centralizes object creation and keeps the registry lightweight.

---

# 12. Widget Properties

Widgets may support properties such as:

* id
* type
* labelKey
* value
* placeholderKey
* required
* visible
* enabled
* readOnly
* defaultValue
* validationRules
* styleClass
* icon
* order

Properties are defined through backend configuration.

---

# 13. Widget Events

Widgets publish standardized events.

Examples:

* OnLoad
* OnChange
* OnFocus
* OnBlur
* OnClick
* OnCapture
* OnValidate
* OnError
* OnComplete

The Runtime Event Bus distributes these events.

---

# 14. Runtime Context Binding

Widgets bind to runtime context rather than owning business state.

Examples:

* Current Assignment
* Candidate
* GPS
* Attachments
* Current Workflow
* Logged-in User

Widgets remain stateless whenever practical.

---

# 15. Validation Integration

Widgets do not implement business validation.

Instead they delegate validation to the Validation Engine.

Example:

```text
Widget
   │
   ▼
Validation Engine
   │
   ▼
Validation Result
   │
   ▼
Widget UI Update
```

This keeps validation logic centralized.

---

# 16. Localization Integration

Widgets never contain hardcoded text.

Instead they resolve:

* Labels
* Placeholders
* Tooltips
* Validation Messages
* Help Text

through the Localization Engine.

---

# 17. Theme Integration

Widgets consume design tokens from the Theme Engine.

The registry shall not expose implementation-specific styling.

Widgets automatically adapt to:

* Light Theme
* Dark Theme
* System Theme

without code changes.

---

# 18. Offline Behaviour

Widgets shall function correctly during offline execution where applicable.

Examples:

* Text Input
* Camera
* Attachment
* GPS
* Signature

Widgets that require connectivity shall gracefully disable unavailable capabilities.

---

# 19. Versioning

The registry supports widget versioning.

Example:

```text
Camera Widget
Version 1

↓

Camera Widget
Version 2
```

This allows gradual evolution while preserving backward compatibility with existing screen configurations.

---

# 20. Extension Model

The Widget Registry is extensible.

New widgets are introduced by registration rather than modification.

Example registration:

```text
Register(
    widgetType,
    widgetFactory
)
```

This follows the Open/Closed Principle:

* Open for extension.
* Closed for modification.

---

# 21. Error Handling

The registry shall gracefully handle:

* Unknown widget types
* Invalid widget metadata
* Version mismatches
* Dependency failures
* Rendering failures

Fallback widgets may be displayed to avoid breaking the entire screen.

---

# 22. Security

Widgets handling sensitive information shall comply with platform security requirements.

Examples:

* Camera Widget
* Attachment Widget
* Signature Widget
* Password Widget

Security controls include:

* Secure storage integration
* Permission validation
* Input sanitization
* Audit event generation where applicable

---

# 23. Traceability

The Widget Registry supports:

* Dynamic Form Engine
* Verification Runtime Engine
* Functional Requirements
* Non-Functional Requirements
* Server-Driven UI

It provides the reusable building blocks used by every dynamically generated screen.

---

# 24. Ownership

| Role                | Responsibility      |
| ------------------- | ------------------- |
| Solution Architect  | Widget Architecture |
| Technical Architect | Registry Design     |
| Engineering Team    | Widget Development  |
| QA Team             | Widget Validation   |

---

# 25. Guiding Philosophy

> A screen is not the fundamental building block of the FullScan Mobile Platform.

> A widget is.

> By making widgets the smallest reusable unit of user interaction, the platform gains configurability, consistency, testability, and extensibility.

The Widget Registry serves as the central catalogue of these building blocks, allowing the Dynamic Form Engine to construct complete user experiences from configuration rather than hardcoded implementations.
