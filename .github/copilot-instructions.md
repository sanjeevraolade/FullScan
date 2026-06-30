---
description: GitHub Copilot instructions for the FullScan project.
applyTo: "**"
---

# GitHub Copilot Instructions

## Project

You are assisting in the development of **FullScan**, an enterprise-grade React Native application used by Field Executives to perform secure physical background verification.

This application is **NOT** a traditional CRUD mobile application.

It is a **configuration-driven, offline-first, Server-Driven UI platform** built around a Runtime Engine.

All implementation must strictly follow the project architecture and documentation.

---

# Architecture First

Always follow the architecture documented under:

```text
docs/
├── 01-Vision/
├── 02-Business/
├── 03-Governance/
├── 04-Architecture/
├── 05-Runtime/
├── 06-Contracts/
└── 09-Observability/
```

Do not invent architecture.

Do not bypass documented runtime components.

When uncertain, prefer the documented architecture over assumptions.

---

# Core Architecture

The application is built around these runtime engines:

* Verification Runtime Engine
* Workflow Engine
* Dynamic Form Engine
* Widget Registry
* Validation Engine
* Configuration Engine
* Attachment Engine
* Synchronization Engine
* Localization Engine
* Theme Engine

Business behaviour belongs inside runtime engines.

Screens should remain thin.

---

# Server-Driven UI (Mandatory)

This application uses **Server-Driven UI**.

Never hardcode:

* Business screens
* Forms
* Layouts
* Widget collections
* Validation rules
* Attachment types

Instead:

Backend Configuration

↓

Configuration Engine

↓

Dynamic Form Engine

↓

Widget Registry

↓

Rendered Screen

The backend controls the user interface.

---

# Dynamic Form Engine (Mandatory)

All configurable screens must be rendered through the Dynamic Form Engine.

Never build business forms directly inside screen components.

The engine is responsible for:

* Screen rendering
* Layout rendering
* Widget rendering
* Runtime binding
* Validation binding
* Theme binding
* Localization binding

---

# Widget Registry (Mandatory)

Widgets must be registered with the Widget Registry.

Never create widget-specific switch statements throughout the application.

New widgets must register themselves rather than modifying existing rendering logic.

Follow the Open/Closed Principle.

---

# Runtime Context

Application state is managed through the Runtime Context.

Widgets do not own business state.

Business state belongs to runtime services.

---

# Offline First

The application is offline-first.

Every feature must continue working without internet whenever technically possible.

All business evidence must be stored locally before synchronization.

Never assume network availability.

---

# Synchronization

Synchronization is handled exclusively by the Synchronization Engine.

Business workflows must never upload data directly.

Instead:

Business Logic

↓

Synchronization Queue

↓

Synchronization Engine

↓

REST API

---

# Attachment Rules

Attachments are business evidence.

Gallery selection is prohibited.

Only live camera capture is allowed.

Every attachment must:

* Capture GPS coordinates
* Capture timestamp
* Capture device information
* Generate watermark
* Store metadata
* Support offline upload

Watermark is mandatory.

Minimum watermark:

* Latitude
* Longitude
* Capture Date
* Capture Time

---

# Validation

Never implement business validation inside UI components.

Always delegate validation to the Validation Engine.

Validation rules are configuration-driven.

---

# Localization (Mandatory)

Every user-visible string must use localization keys.

Never hardcode:

* Labels
* Buttons
* Messages
* Errors
* Placeholders
* Dialogs

Supported languages:

* English
* Hindi
* Telugu

Future languages must work without code changes.

---

# Theme (Mandatory)

All styling must use the Theme Engine.

Never hardcode:

* Colors
* Typography
* Spacing
* Border Radius

Support:

* Light Theme
* Dark Theme
* System Theme

---

# UI Framework

Mandatory:

* Gluestack UI

Never use raw React Native components when a Gluestack equivalent exists.

Examples:

Use:

* Box
* Text
* Button
* Input
* VStack
* HStack
* Card
* Badge
* Modal

Avoid:

* View
* Text
* TouchableOpacity

unless no Gluestack component exists.

---

# Styling

Never use inline styles.

Never duplicate styles.

Keep all styling inside:

```text
src/theme/
```

Every component must support theming.

---

# Navigation

Use React Navigation.

Navigation decisions belong to the Workflow Engine.

Avoid business logic inside navigation.

---

# State Management

Use Zustand for application state.

Use Redux Saga for side effects.

Keep stores small and feature-focused.

Avoid global mutable state.

---

# API Communication

Use Axios.

Never call APIs directly from screens.

Use services and repositories.

Handle errors centrally.

---

# Logging

Use the centralized Logger Service.

Never use console.log().

Never log:

* Passwords
* Tokens
* Aadhaar Numbers
* PAN Numbers
* Personal Information

Use structured logging.

---

# Security

Follow secure-by-design principles.

Always validate:

* Device registration
* Mock location
* Root/Jailbreak detection
* GPS
* Permissions

Protect sensitive information.

---

# Code Quality

Write clean, readable, maintainable code.

Prefer composition over inheritance.

Prefer interfaces over concrete implementations.

Keep classes focused.

Follow SOLID principles.

---

# Testing

Every feature should include:

* Unit Tests
* Component Tests
* Mock Runtime Tests

Business logic should be independently testable.

---

# Folder Structure

Respect the existing project structure.

Do not introduce new architectural layers without approval.

Keep features modular.

---

# Naming

Follow project naming conventions.

Use descriptive names.

Avoid abbreviations unless they are established project terminology.

---

# Documentation

When generating new features:

* Update documentation if required.
* Maintain traceability.
* Respect architecture decisions.

---

# Before Generating Code

Always ask yourself:

* Does this follow the Runtime Architecture?
* Is this configuration-driven?
* Is this offline-first?
* Is localization supported?
* Is theming supported?
* Does it use the Validation Engine?
* Does it use the Synchronization Engine?
* Is it reusable?
* Can this be generated dynamically?
* Does this violate any architecture principle?

If the answer is "No" to any mandatory rule, redesign before generating code.

---

# Guiding Philosophy

FullScan is **not** a collection of screens.

It is a configurable runtime platform.

Every implementation should strengthen the platform rather than solving only the immediate feature.

When multiple implementation options exist:

1. Prefer the documented architecture.
2. Prefer configuration over hardcoding.
3. Prefer runtime execution over compile-time behavior.
4. Prefer reusable platform capabilities over feature-specific solutions.
5. Prefer long-term maintainability over short-term convenience.

The goal is to build a scalable enterprise platform that can evolve through configuration while maintaining architectural consistency.
