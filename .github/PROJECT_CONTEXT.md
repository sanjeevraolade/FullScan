# FullScan Project Context

> Enterprise Field Verification Platform

Version: 1.0

Status: Active Development

---

# Purpose

This document provides the overall context of the FullScan platform.

It is intended for:

- Developers
- Architects
- QA Engineers
- GitHub Copilot
- AI Agents

This document should be read before contributing to the project.

---

# What is FullScan?

FullScan is an enterprise-grade mobile platform used by Field Executives to perform secure physical background verification of candidates.

The application replaces traditional paper-based and manually managed verification processes with a secure, configurable, offline-first mobile platform.

The primary objective is to ensure that every verification is completed only at the candidate's physical location while collecting trustworthy digital evidence.

---

# Business Problem

Traditional verification processes suffer from:

- Fake field visits
- Phone-based verification
- Fake photographs
- Incorrect GPS information
- Manual paperwork
- Delayed reporting
- Poor auditability

FullScan eliminates these problems using:

- GPS Validation
- Camera-only Evidence Capture
- Watermarked Images
- Device Validation
- Mock Location Detection
- Offline Data Collection
- Secure Synchronization

---

# Vision

Build a configurable enterprise platform capable of executing multiple verification workflows without requiring frequent mobile application updates.

The platform should evolve through configuration instead of source code changes.

---

# Product Philosophy

FullScan is NOT a traditional React Native application.

It is a Runtime Platform.

Business behaviour is driven by configuration rather than hardcoded implementation.

The mobile application acts as a runtime capable of executing configurable workflows received from the backend.

---

# Platform Goals

The platform should be:

- Secure
- Offline First
- Server Driven
- Configuration Driven
- Modular
- Extensible
- Scalable
- Testable
- Maintainable

---

# Core Principles

The following principles are considered non-negotiable.

- Runtime First
- Server Driven UI
- Configuration Before Code
- Offline First
- Widget Based UI
- Dynamic Forms
- Centralized Validation
- Reusable Components
- Clean Architecture
- SOLID Principles

---

# Runtime Architecture

The platform is built around multiple runtime engines.

```
                     Backend
                        │
                        ▼
             Configuration Package
                        │
                        ▼
        Verification Runtime Engine
                        │
      ┌─────────────────┼─────────────────┐
      ▼                 ▼                 ▼
Workflow Engine   Dynamic Form Engine  Validation Engine
      │                 │                 │
      └────────────┬────┴─────────────────┘
                   ▼
            Widget Registry
                   │
                   ▼
        React Native + Gluestack UI
```

---

# Runtime Engines

The platform consists of the following runtime components.

## Verification Runtime Engine

Coordinates the complete application runtime.

---

## Workflow Engine

Executes configurable application and business workflows.

---

## Dynamic Form Engine

Builds complete screens from backend configuration.

No business screen should be manually constructed when configuration can be used.

---

## Widget Registry

Resolves runtime widgets.

Every widget is reusable.

Every screen is composed of widgets.

---

## Validation Engine

Executes all business validation.

Validation must never be implemented directly inside UI components.

---

## Configuration Engine

Downloads and manages runtime configuration.

Acts as the single source of runtime metadata.

---

## Attachment Engine

Manages all verification evidence.

Attachments are business evidence—not merely image files.

---

## Synchronization Engine

Uploads locally collected evidence once connectivity is available.

Supports Offline First operation.

---

## Localization Engine

Provides multilingual support.

Initial languages:

- English
- Hindi
- Telugu

---

## Theme Engine

Provides centralized runtime styling.

Supports:

- Light Theme
- Dark Theme
- System Theme

---

# Server Driven UI

The application uses Server Driven UI.

The backend defines:

- Screens
- Layouts
- Widgets
- Validation Rules
- Workflow Steps
- Attachment Types

The mobile application renders these definitions at runtime.

Avoid hardcoded business screens whenever possible.

---

# Dynamic Forms

Forms are configuration driven.

Widgets are created dynamically.

Future employers should be able to modify forms without requiring a mobile application release.

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

---

## Business Workflows

Examples:

- Candidate Verification
- Residence Verification
- Employment Verification
- Customer-specific Verification

---

# Offline First

Offline support is mandatory.

The application should continue functioning without internet whenever technically possible.

Business evidence must never be lost because of network failures.

Synchronization occurs later.

---

# Attachments

Attachments are one of the most important concepts in FullScan.

Each attachment represents business evidence.

Current release:

- Candidate Photo

Future:

- Aadhaar
- PAN
- Passport
- Driving License
- Residence Proof
- Employment Proof

Every attachment must:

- Be captured using Camera only
- Capture GPS
- Capture Timestamp
- Generate Watermark
- Associate with Assignment
- Support Offline Upload

---

# Watermark

Every captured image must contain a permanent watermark.

Minimum fields:

- Latitude
- Longitude
- Capture Date
- Capture Time

Additional watermark information may be introduced through configuration.

---

# Technology Stack

Framework:

- React Native

Language:

- TypeScript

UI:

- Gluestack UI

Navigation:

- React Navigation

State:

- Zustand

Side Effects:

- Redux Saga

Storage:

- MMKV

Networking:

- Axios

Localization:

- react-i18next

Camera:

- Vision Camera

Testing:

- Jest
- React Native Testing Library
- Detox

---

# Project Documentation

The project documentation is organized as follows.

```
docs/

01-Vision
02-Business
03-Governance
04-Architecture
05-Runtime
06-Contracts
09-Observability
```

Every implementation must align with these documents.

---

# Development Rules

Every implementation should satisfy the following.

✓ Offline First

✓ Configuration Driven

✓ Runtime Based

✓ Localized

✓ Theme Aware

✓ Testable

✓ Reusable

✓ Secure

✓ Documented

---

# Things to Avoid

Never:

- Hardcode business screens
- Hardcode workflows
- Hardcode forms
- Hardcode validation
- Hardcode attachment types
- Hardcode localization strings
- Hardcode theme values
- Upload directly from UI
- Implement business logic inside screens
- Bypass runtime engines

---

# GitHub Copilot

GitHub Copilot is considered part of the development team.

Generated code must comply with:

- Architecture Principles
- Engineering Principles
- Coding Standards
- Runtime Architecture
- Configuration Contracts

If multiple implementation approaches exist:

Prefer:

Configuration

↓

Runtime

↓

Reusable Platform

↓

Feature-specific Implementation

---

# Current Project Phase

Current Phase:

**Phase 2 — GitHub Copilot Workspace**

The architecture has been completed.

The current objective is to prepare GitHub Copilot with sufficient architectural knowledge before implementation begins.

---

# Next Milestone

Build the Platform Foundation.

Recommended order:

1. Project Bootstrap
2. Logging
3. Configuration Engine
4. Theme Engine
5. Localization Engine
6. Widget Registry
7. Dynamic Form Engine
8. Validation Engine
9. Workflow Engine
10. Runtime Engine
11. Synchronization Engine
12. Attachment Engine

Business features will be implemented only after the platform foundation is complete.

---

# Guiding Philosophy

> FullScan is not a collection of mobile screens.

It is a configurable Runtime Platform capable of executing dynamic business workflows.

Every design decision should strengthen the platform rather than solving only the immediate feature.

When in doubt:

- Prefer configuration over hardcoding.
- Prefer runtime behaviour over compile-time behaviour.
- Prefer reusable platform capabilities over feature-specific implementations.
- Protect architectural consistency.
- Build for long-term maintainability.