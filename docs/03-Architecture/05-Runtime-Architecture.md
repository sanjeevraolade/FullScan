# Runtime Architecture

**Document ID:** ARD-005

**Document Version:** 1.0

**Status:** Approved

**Owner:** Solution Architect

**Reviewed By:** Technical Architect

**Last Updated:** 29-Jun-2026

---

# 1. Purpose

This document defines the Runtime Architecture of the FullScan Mobile Platform.

The Runtime Architecture is responsible for executing configurable business workflows, rendering server-driven user interfaces, validating business rules, coordinating platform services, and orchestrating verification activities.

Unlike traditional mobile applications where workflows are hardcoded, FullScan executes business processes through a configurable runtime engine.

The Runtime Architecture is the core differentiator of the platform.

---

# 2. Scope

The Runtime Architecture includes:

* Verification Runtime Engine (VRE)
* Workflow Engine
* Dynamic Form Engine
* Widget Registry
* Validation Engine
* Configuration Engine
* Attachment Engine
* Localization Engine
* Theme Engine
* Synchronization Engine
* Runtime Context
* Runtime Events

---

# 3. References

| Document                 | Purpose                    |
| ------------------------ | -------------------------- |
| Architecture             | Overall Architecture       |
| Solution Architecture    | End-to-End Solution        |
| Application Architecture | Logical Application Design |
| Mobile Architecture      | Mobile Implementation      |
| Functional Requirements  | Functional Behaviour       |

---

# 4. Runtime Vision

The Runtime Engine shall execute configurable business workflows without requiring application code changes.

Business workflows, forms, validation rules, widgets, document types, themes, localization resources, and workflow behaviour shall be controlled primarily through backend-managed configuration.

The mobile application becomes a runtime host rather than a collection of hardcoded screens.

---

# 5. Runtime Architecture Overview

```text
                    Runtime Configuration
                           │
                           ▼
                Verification Runtime Engine
                           │
      ┌────────────────────┼────────────────────┐
      │                    │                    │
      ▼                    ▼                    ▼
 Workflow Engine     Dynamic Form Engine   Validation Engine
      │                    │                    │
      └──────────────┬─────┴──────────────┬─────┘
                     ▼                    ▼
              Widget Registry      Runtime Context
                     │                    │
      ┌──────────────┼────────────────────┼─────────────┐
      ▼              ▼                    ▼             ▼
 Attachment     Localization         Theme Engine   Sync Engine
   Engine          Engine
                     │
                     ▼
             Platform Services
```

---

# 6. Verification Runtime Engine (VRE)

The Verification Runtime Engine is the central orchestration component of the application.

Responsibilities include:

* Runtime initialization
* Configuration loading
* Workflow execution
* Widget rendering
* Validation orchestration
* Runtime state management
* Event dispatching
* Platform service coordination

The VRE shall not contain business-specific workflows.

---

# 7. Workflow Engine

The Workflow Engine executes business workflows received from backend configuration.

Responsibilities:

* Execute workflow steps
* Determine next action
* Handle conditional navigation
* Resume interrupted workflows
* Support future branching workflows

Example workflow:

```text
Assignment
      ↓
Navigate
      ↓
Location Validation
      ↓
Candidate Verification
      ↓
Photo Capture
      ↓
Review
      ↓
Submit
```

---

# 8. Dynamic Form Engine

The Dynamic Form Engine generates application screens from server-provided JSON configuration.

Responsibilities:

* Read screen definitions
* Generate forms
* Render sections
* Render fields
* Bind data
* Execute field validation
* Apply conditional visibility
* Apply mandatory rules

The engine shall support:

* Text
* Numbers
* Dates
* Pickers
* Switches
* Images
* Attachments
* Maps
* Signatures
* Custom widgets

No screen-specific rendering logic shall exist outside the engine.

---

# 9. Widget Registry

The Widget Registry maintains all supported runtime widgets.

Responsibilities:

* Widget registration
* Widget discovery
* Widget instantiation
* Widget lifecycle
* Widget versioning
* Future plugin registration

Example registry:

```text
Text Widget
Number Widget
Date Widget
Location Widget
Camera Widget
Attachment Widget
Signature Widget
Map Widget
Dropdown Widget
Timeline Widget
```

Every runtime widget shall implement a common widget contract.

---

# 10. Validation Engine

The Validation Engine evaluates business rules before allowing workflow progression.

Validation categories include:

* Mandatory fields
* Data format
* GPS availability
* GPS accuracy
* Geo-fence validation
* Mock location detection
* Device integrity
* Required attachments
* Watermark verification
* Business-specific rules

Validation rules shall be configuration driven whenever practical.

---

# 11. Configuration Engine

The Configuration Engine loads runtime metadata from the backend.

Configuration includes:

* Workflows
* Screen Definitions
* Forms
* Widgets
* Validation Rules
* Attachment Types
* Localization Resources
* Theme Definitions
* Watermark Settings

Configuration shall be cached for offline execution.

---

# 12. Attachment Engine

The Attachment Engine manages all verification evidence.

Responsibilities:

* Capture attachments
* Associate with assignment
* Store metadata
* Generate watermarked images
* Track upload status
* Queue offline uploads
* Retry synchronization

The engine stores attachments as a collection rather than fixed image fields.

---

# 13. Localization Engine

Responsibilities:

* Load language resources
* Resolve translation keys
* Switch language dynamically
* Provide localized validation messages
* Localize runtime-generated forms

Initial languages:

* English
* Hindi
* Telugu

---

# 14. Theme Engine

Responsibilities:

* Load design tokens
* Apply Light Theme
* Apply Dark Theme
* Apply System Theme
* Provide consistent styling for runtime-generated widgets

No runtime component shall contain hardcoded colors or typography.

---

# 15. Synchronization Engine

Responsible for:

* Offline queue management
* Retry strategy
* Conflict handling
* Attachment uploads
* Verification submission
* Background synchronization

Synchronization shall be transparent to business workflows.

---

# 16. Runtime Context

The Runtime Context contains shared execution state.

Examples:

* Authenticated User
* Active Assignment
* Workflow State
* Form Data
* Attachments
* GPS Information
* Theme
* Language
* Connectivity Status

The Runtime Context is the single source of truth during workflow execution.

---

# 17. Runtime Event Model

Major runtime events include:

* Application Started
* User Authenticated
* Configuration Loaded
* Assignment Opened
* Workflow Started
* Field Updated
* Validation Completed
* Attachment Captured
* Synchronization Started
* Synchronization Completed
* Verification Submitted

Runtime components communicate through events rather than direct dependencies wherever practical.

---

# 18. Runtime Principles

The Runtime Architecture follows these principles:

* Runtime before hardcoding
* Configuration before implementation
* Widgets before screens
* Validation before submission
* Offline before online
* Platform before feature
* Events before tight coupling

---

# 19. Traceability

The Runtime Architecture implements:

* Business Rules
* Functional Requirements
* Non-Functional Requirements

It serves as the execution layer that transforms business requirements into user interactions and platform operations.

---

# 20. Ownership

| Role                | Responsibility         |
| ------------------- | ---------------------- |
| Solution Architect  | Runtime Design         |
| Technical Architect | Runtime Framework      |
| Engineering Team    | Runtime Implementation |
| QA Team             | Runtime Validation     |

---

# 21. Future Evolution

The Runtime Architecture is designed to support:

* Plugin-based widgets
* AI-assisted validation
* OCR document processing
* Face recognition
* Dynamic workflow branching
* Customer-specific runtime extensions
* Versioned runtime configurations
* Hot-swappable business rules

These capabilities shall be introduced through extension points without changing the core runtime engine.

---

# 22. Guiding Philosophy

> The Runtime Engine is the heart of the FullScan Mobile Platform.

> The mobile application is not a collection of hardcoded screens; it is a runtime host that executes configurable business workflows.

> By separating business configuration from application implementation, the platform achieves flexibility, maintainability, and long-term scalability while minimizing the need for application releases when business processes evolve.

The Runtime Architecture is the foundation upon which the Dynamic Form Engine, Server-Driven UI, Validation Engine, and future platform capabilities are built.
