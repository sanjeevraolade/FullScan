# FullScan Mobile Platform

> Enterprise-grade, Offline-First, Server-Driven React Native Platform for Physical Background Verification

---

# Overview

FullScan is a secure, enterprise-grade React Native mobile application used by **Field Executives** to perform **physical background verification** of candidates on behalf of organizations.

Unlike traditional mobile applications, FullScan is built as a **Configuration-Driven Runtime Platform**, enabling business workflows, screens, forms, validation rules, and UI components to be controlled through backend configuration rather than hardcoded application logic.

The application ensures that every verification is performed **only at the candidate's physical location**, reducing fraud and improving trust in the verification process.

---

# Vision

Build the industry's most flexible, secure, configurable, and scalable field verification platform using:

- Runtime Architecture
- Server-Driven UI
- Offline-First Design
- Dynamic Forms
- Configuration-Driven Workflows
- Enterprise-grade Engineering Practices

---

# Key Features

- Secure Authentication
- Single Device Login
- Assignment Dashboard
- Dynamic Verification Forms
- Camera-only Evidence Capture
- Mandatory GPS Validation
- Watermarked Photos
- Mock Location Detection
- Offline Data Collection
- Automatic Synchronization
- Localization
- Theme Support
- Dynamic Runtime Configuration

---

# Core Architectural Principles

The platform is built around the following principles.

- Runtime First
- Server-Driven UI
- Offline First
- Configuration over Hardcoding
- Reusable Platform Components
- Separation of Business Logic and UI
- Enterprise-grade Maintainability
- Extensibility by Design

---

# High-Level Architecture

```text
                Backend Verification System
                           │
                           ▼
                Configuration Package
                           │
                           ▼
              Verification Runtime Engine
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
 Workflow Engine   Dynamic Form Engine   Validation Engine
        │                  │                  │
        └──────────────┬───┴──────────────────┘
                       ▼
                Widget Registry
                       │
                       ▼
             React Native + Gluestack UI
```

---

# Runtime Engines

The application consists of the following runtime engines.

| Engine | Responsibility |
|---------|----------------|
| Verification Runtime Engine | Runtime orchestration |
| Workflow Engine | Workflow execution |
| Dynamic Form Engine | Dynamic screen generation |
| Widget Registry | Widget discovery and rendering |
| Validation Engine | Business validation |
| Configuration Engine | Runtime configuration |
| Attachment Engine | Evidence management |
| Synchronization Engine | Offline synchronization |
| Localization Engine | Multilingual support |
| Theme Engine | Runtime styling |

---

# Technology Stack

| Category | Technology |
|-----------|------------|
| Framework | React Native 0.83+ |
| Language | TypeScript |
| UI | Gluestack UI |
| Navigation | React Navigation |
| State | Zustand |
| Side Effects | Redux Saga |
| Storage | MMKV |
| Networking | Axios |
| Forms | React Hook Form |
| Validation | Zod |
| Localization | react-i18next |
| Camera | Vision Camera |
| Location | react-native-geolocation-service |
| Biometrics | react-native-biometrics |
| Notifications | Firebase FCM |
| Crash Reporting | Firebase Crashlytics (Future) |

---

# Repository Structure

```text
docs/
.github/
mobile/
mock-server/
```

---

# Documentation Structure

## Vision

Defines the long-term vision and goals of the platform.

```
docs/01-Vision/
```

---

## Business

Contains business requirements and functional documentation.

```
docs/02-Business/
```

---

## Governance

Engineering standards, coding conventions, repository standards, and project governance.

```
docs/03-Governance/
```

---

## Architecture

Overall solution architecture.

```
docs/04-Architecture/
```

---

## Runtime

Detailed documentation for all Runtime Engines.

```
docs/05-Runtime/
```

---

## Contracts

Configuration schemas and API contracts between Backend and Mobile.

```
docs/06-Contracts/
```

---

## Observability

Logging strategy.

```
docs/09-Observability/
```

---

# Development Principles

Every implementation must follow the documented architecture.

Developers should prefer:

- Configuration over Hardcoding
- Composition over Inheritance
- Runtime Execution over Screen-specific Logic
- Reusable Components over Duplication
- Offline-first Design
- Clean Architecture
- SOLID Principles

---

# GitHub Copilot

This repository is optimized for GitHub Copilot.

Before generating code, Copilot should always reference:

```
.github/
```

including:

- copilot-instructions.md
- instructions/
- agents/
- prompts/
- skills/

These documents define the engineering standards and architectural rules for the project.

---

# Development Workflow

```
Requirements
      │
      ▼
Architecture
      │
      ▼
Runtime
      │
      ▼
Contracts
      │
      ▼
GitHub Copilot Workspace
      │
      ▼
Implementation
      │
      ▼
Testing
      │
      ▼
Release
```

---

# Implementation Order

The platform should be implemented in the following order.

## Phase 1

Platform Foundation

- Logging
- Configuration Engine
- Theme Engine
- Localization Engine

---

## Phase 2

Runtime Platform

- Widget Registry
- Dynamic Form Engine
- Validation Engine
- Workflow Engine
- Runtime Engine

---

## Phase 3

Platform Services

- Attachment Engine
- Synchronization Engine

---

## Phase 4

Business Features

- Login
- Dashboard
- Assignment Details
- Verification
- Camera
- Submission

---

# Current Project Status

| Area | Status |
|-------|--------|
| Vision | ✅ Complete |
| Business | ✅ Complete |
| Governance | ✅ Complete |
| Architecture | ✅ Complete |
| Runtime | ✅ Complete |
| Contracts | ✅ Complete |
| Observability | ✅ Complete |
| GitHub Copilot Workspace | 🚧 In Progress |
| Platform Development | ⏳ Pending |

---

# Contribution Guidelines

Before implementing a new feature:

1. Review the relevant architecture documentation.
2. Follow repository standards.
3. Follow coding standards.
4. Respect runtime architecture.
5. Ensure localization support.
6. Ensure theme support.
7. Ensure offline support.
8. Write unit tests.
9. Update documentation if required.

---

# Project Philosophy

> FullScan is **not** a collection of React Native screens.

It is a **Configuration-Driven Runtime Platform** designed to execute configurable business workflows through Server-Driven UI while remaining offline-first, secure, scalable, and maintainable.

Every implementation should strengthen the platform rather than solving only the immediate feature.

---

# License

Internal Enterprise Project.

Confidential and Proprietary.