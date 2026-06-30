---
applyTo: "mobile/**"
---

# Architecture Instructions

These instructions define the architectural rules for the FullScan Mobile Platform.

The architecture is considered **frozen**. Every implementation must follow these principles and the project documentation.

Refer to:

- docs/03-Governance/
- docs/04-Architecture/
- docs/05-Runtime/
- docs/06-Contracts/

Do not invent new architecture.

---

# Architecture Philosophy

FullScan is **NOT** a traditional React Native application.

It is a **Configuration-Driven Runtime Platform** built around:

- Server-Driven UI
- Offline-First Design
- Runtime Engines
- Dynamic Forms
- Configuration-Driven Workflows

The mobile application executes runtime metadata received from the backend.

Business behaviour should evolve through configuration rather than source code changes.

---

# Core Architectural Principles

Every implementation shall follow these principles.

- Runtime First
- Server-Driven UI
- Configuration Before Code
- Offline First
- Clean Architecture
- SOLID Principles
- Separation of Concerns
- Reusable Components
- Extensible Design
- Testability

---

# Layered Architecture

The application follows a layered architecture.

```
Presentation

↓

Runtime

↓

Domain

↓

Application Services

↓

Infrastructure

↓

Platform Services
```

Dependencies flow downward only.

Lower layers must never depend on higher layers.

---

# Runtime Architecture

The Runtime Layer is the heart of the platform.

The Runtime consists of:

- Verification Runtime Engine
- Workflow Engine
- Dynamic Form Engine
- Widget Registry
- Validation Engine
- Configuration Engine
- Attachment Engine
- Synchronization Engine
- Localization Engine
- Theme Engine

These runtime engines collaborate to execute configurable business workflows.

---

# Runtime Responsibilities

## Verification Runtime Engine

Application orchestrator.

Coordinates every runtime engine.

Never bypass it for business execution.

---

## Workflow Engine

Controls workflow execution.

Responsible for:

- Application Workflows
- Business Workflows
- Navigation decisions
- Runtime state transitions

Screens must never decide workflow progression.

---

## Dynamic Form Engine

Responsible for:

- Dynamic screen generation
- Dynamic layout generation
- Widget composition
- Runtime binding

Business screens should not manually construct configurable forms.

---

## Widget Registry

The Widget Registry owns widget discovery.

Never implement widget-specific switch statements throughout the application.

New widgets should register themselves.

Follow the Open/Closed Principle.

---

## Validation Engine

Responsible for all validation.

Never implement business validation inside screens.

Validation should be configuration-driven whenever possible.

---

## Configuration Engine

Single source of runtime metadata.

Responsible for:

- Configuration download
- Versioning
- Validation
- Offline cache
- Configuration activation

---

## Attachment Engine

Owns the lifecycle of verification evidence.

Responsible for:

- Capture
- Metadata
- Watermark
- Upload status
- Storage

---

## Synchronization Engine

Responsible for:

- Offline Queue
- Retry Logic
- Upload Scheduling
- Conflict Resolution

UI components must never upload data directly.

---

## Localization Engine

Provides runtime language resolution.

All user-visible text must use localization keys.

Supported languages:

- English
- Hindi
- Telugu

---

## Theme Engine

Provides centralized styling.

Responsible for:

- Colors
- Typography
- Spacing
- Component Variants

No hardcoded visual styling.

---

# Server-Driven UI

Server-Driven UI is mandatory.

Backend configuration controls:

- Screens
- Sections
- Widgets
- Layouts
- Validation
- Attachment Types
- Workflow Definitions

Avoid hardcoded business screens.

---

# Configuration-Driven Development

Configuration always takes precedence over hardcoded implementation.

Examples of configuration-driven behaviour:

- Screen Layout
- Widget Visibility
- Mandatory Fields
- Validation Rules
- Workflow Steps
- Attachment Types
- Theme
- Localization

---

# Dynamic Forms

All configurable forms shall be rendered by the Dynamic Form Engine.

Avoid creating feature-specific forms unless explicitly required.

Forms should be assembled from reusable widgets.

---

# Workflow Categories

The Workflow Engine supports two categories.

## Application Workflows

Examples:

- Welcome
- Onboarding
- Permission Requests
- User Guide
- What's New

These workflows manage application behaviour.

---

## Business Workflows

Examples:

- Candidate Verification
- Residence Verification
- Employment Verification

Business workflows execute verification activities.

---

# Runtime Context

Business state belongs to the Runtime Context.

Widgets do not own business state.

Screens do not own business state.

The Runtime Context stores:

- Assignment
- User
- Workflow
- Attachments
- GPS
- Runtime Variables
- Form Values

---

# Offline First

Offline support is mandatory.

Features should continue functioning without internet whenever technically possible.

Business evidence must always be stored locally before synchronization.

Never assume network availability.

---

# Business Logic

Business logic belongs in:

- Runtime Engines
- Domain Services
- Validation Engine
- Workflow Engine

Business logic must never reside in:

- Screens
- Widgets
- Navigation
- UI Components

---

# Navigation

Navigation is workflow-driven.

Avoid embedding business decisions inside navigation code.

Navigation should react to workflow state rather than controlling it.

---

# Platform Services

Platform services include:

- Camera
- GPS
- Biometrics
- Permissions
- Storage
- Notifications
- Logging

Access these services through abstraction layers.

Do not directly couple business logic to native APIs.

---

# Dependency Rules

Allowed dependency direction:

```
Screens
    ↓
Runtime
    ↓
Domain
    ↓
Services
    ↓
Infrastructure
```

Never reverse this dependency flow.

---

# Reusability

Before creating a new component ask:

- Can an existing widget be reused?
- Can configuration solve this?
- Can the Runtime Engine handle this?
- Can the Widget Registry support this?

Prefer extending the platform instead of creating feature-specific implementations.

---

# Extension Strategy

The platform is designed for extension.

Future additions should require:

- New configuration
- New widgets
- New workflows

Avoid modifying existing runtime engines whenever possible.

Follow the Open/Closed Principle.

---

# Error Handling

Errors should be:

- Centralized
- Logged
- Localized
- User-friendly

Avoid exposing technical implementation details to end users.

---

# Security

Architecture must support:

- Device Registration
- Mock Location Detection
- Root/Jailbreak Detection
- Secure Storage
- HTTPS Communication

Never compromise architectural boundaries for convenience.

---

# Documentation

When introducing new architectural capabilities:

- Update Runtime documentation if required.
- Update Contracts if required.
- Update Architecture if required.

Architecture documentation is the source of truth.

---

# Before Generating Code

Always verify:

- Does this follow the Runtime Architecture?
- Is it configuration-driven?
- Is it reusable?
- Does it support Offline First?
- Does it use runtime engines correctly?
- Does it avoid business logic in the UI?
- Does it respect dependency direction?

If the answer to any mandatory rule is **No**, redesign before implementation.

---

# Guiding Philosophy

FullScan is a configurable Runtime Platform.

Every implementation should strengthen the platform rather than solving only the immediate feature.

When multiple implementation approaches exist:

1. Prefer the documented architecture.
2. Prefer configuration over hardcoding.
3. Prefer runtime behaviour over compile-time behaviour.
4. Prefer reusable platform capabilities.
5. Protect architectural consistency.
6. Optimize for long-term maintainability.