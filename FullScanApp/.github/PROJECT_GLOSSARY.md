# FullScan Project Glossary

> Standard terminology used throughout the FullScan Mobile Platform.

Version: 1.0

---

# Purpose

This glossary defines the official terminology used across the FullScan project.

It provides a shared vocabulary for:

- Developers
- Architects
- QA Engineers
- Product Owners
- GitHub Copilot
- AI Agents

Every document, source file, and discussion should use these terms consistently.

---

# A

## API Contract

The formal agreement between the Backend Verification System and the Mobile Runtime Platform.

Defines:

- Request models
- Response models
- Error models
- Versioning
- Behaviour

---

## Application Workflow

A workflow that controls application behaviour rather than business verification.

Examples:

- Welcome
- Onboarding
- User Guide
- Permission Requests
- What's New

---

## Assignment

A verification request assigned to a Field Executive.

An Assignment contains:

- Candidate Information
- Employer Information
- Address
- Verification Type
- Instructions
- Attachments
- Workflow State

Assignments are the primary business entity within FullScan.

---

## Attachment

A piece of business evidence collected during verification.

Examples:

- Candidate Photo
- Aadhaar
- PAN Card
- Passport
- Residence Proof

Attachments are managed by the Attachment Engine.

Attachments are **not** simple image files.

They include metadata such as:

- GPS
- Timestamp
- Device ID
- Upload Status
- Watermark

---

## Attachment Type

The category of evidence being collected.

Examples:

- CandidatePhoto
- AadhaarFront
- AadhaarBack
- PANCard
- Passport

Attachment types are configuration-driven.

---

# B

## Backend Verification System

The enterprise backend responsible for:

- User Management
- Assignment Management
- Runtime Configuration
- Workflow Configuration
- Evidence Storage
- Reporting

The mobile application consumes its APIs.

---

## Business Rule

A rule that governs verification behaviour.

Examples:

- Candidate Photo is mandatory.
- GPS must be enabled.
- Mock location is prohibited.

Business rules are configuration-driven whenever possible.

---

## Business Workflow

A workflow that performs verification activities.

Examples:

- Candidate Verification
- Residence Verification
- Employment Verification

Business Workflows are executed by the Workflow Engine.

---

# C

## Configuration Package

The complete runtime configuration downloaded from the backend.

Contains:

- Screens
- Workflows
- Widgets
- Validation Rules
- Themes
- Localization
- Attachment Definitions

---

## Configuration Engine

Runtime component responsible for:

- Downloading configuration
- Versioning
- Validation
- Offline cache
- Distribution

Acts as the single source of runtime metadata.

---

## Copilot Workspace

The collection of GitHub Copilot instructions, prompts, agents, and skills that guide AI-assisted development.

Located under:

```
.github/
```

---

# D

## Dynamic Form Engine

The runtime component responsible for generating user interfaces from configuration.

Responsible for:

- Screen Rendering
- Layout Rendering
- Widget Rendering
- Runtime Binding

No configurable business screen should be manually coded.

---

# E

## Employer

The organization requesting a background verification.

Examples:

- ABC Technologies
- XYZ Bank

Employers may define different workflows and configuration.

---

## Evidence

Trusted digital information collected during verification.

Evidence includes:

- Photos
- Documents
- GPS
- Timestamps
- Device Information

Evidence is uploaded to the backend after validation.

---

# F

## Field Executive

The mobile application user responsible for conducting physical verification.

Also referred to as:

- Verification Executive
- Investigator
- Field Officer

---

# G

## Geo-fence

A geographical boundary around the candidate's location.

Used to ensure verification is performed at the correct location.

---

## Gluestack UI

The official UI component library used throughout the project.

All UI components should use Gluestack whenever an equivalent component exists.

---

# L

## Localization

The ability to support multiple languages.

Initial languages:

- English
- Hindi
- Telugu

All user-visible text must use localization keys.

---

# M

## Mock Location

A falsified GPS location generated using developer tools or fake GPS applications.

Mock locations are considered fraudulent.

Detection blocks verification submission.

---

# O

## Offline First

A core architectural principle.

The application must continue functioning without internet whenever technically possible.

Synchronization occurs later.

---

# P

## Platform

FullScan is considered a Runtime Platform rather than a traditional mobile application.

Business behaviour is configuration-driven.

---

# R

## Runtime Context

The shared execution state used by runtime engines.

Contains:

- Current Assignment
- Workflow State
- User Information
- Attachments
- GPS
- Form Values

---

## Runtime Engine

The central orchestrator of the platform.

Coordinates:

- Workflow Engine
- Dynamic Form Engine
- Validation Engine
- Synchronization Engine
- Attachment Engine

---

# S

## Screen

A runtime-generated user interface.

Screens are produced by the Dynamic Form Engine using backend configuration.

Business screens should not be hardcoded.

---

## Server-Driven UI

An architectural pattern where the backend defines:

- Screens
- Widgets
- Layouts
- Validation
- Navigation

The mobile application renders the configuration dynamically.

---

## Synchronization

The process of uploading locally collected business evidence to the backend.

Managed exclusively by the Synchronization Engine.

---

## Synchronization Queue

A persistent queue containing pending uploads.

Ensures reliable offline operation.

---

# T

## Theme

A collection of design tokens defining:

- Colors
- Typography
- Spacing
- Component Styles

Managed by the Theme Engine.

---

## Theme Engine

Runtime component responsible for applying visual styling.

Supports:

- Light Theme
- Dark Theme
- System Theme

---

# U

## User Guide

An application workflow providing guided assistance to users.

Future enhancement.

---

# V

## Validation

The process of verifying business rules before allowing workflow progression.

Validation is centralized in the Validation Engine.

---

## Validation Engine

Runtime component responsible for evaluating:

- Field Rules
- Workflow Rules
- GPS Rules
- Security Rules
- Attachment Rules

Validation should never be implemented directly inside screens.

---

## Verification

The business process of confirming candidate information through a physical field visit.

---

## Verification Runtime Engine

The highest-level runtime component responsible for orchestrating the entire application.

Coordinates all runtime engines.

---

# W

## Watermark

Information permanently embedded onto captured images.

Mandatory fields:

- Latitude
- Longitude
- Capture Date
- Capture Time

Future watermark fields may be introduced through configuration.

---

## Widget

The smallest reusable UI building block within the platform.

Examples:

- Text Input
- Camera
- Dropdown
- Button
- GPS
- Attachment

Every widget is registered through the Widget Registry.

---

## Widget Registry

Runtime component responsible for discovering and resolving widgets.

The Dynamic Form Engine requests widgets from the Widget Registry during rendering.

---

## Workflow

A configurable sequence of runtime nodes executed by the Workflow Engine.

A workflow may represent:

- Business Verification
- Application Behaviour

---

## Workflow Engine

Runtime component responsible for executing configurable workflows.

Supports:

- Application Workflows
- Business Workflows

---

# Guiding Principle

> Every contributor should use the terminology defined in this glossary consistently.

A shared vocabulary reduces ambiguity, improves documentation quality, and enables developers, architects, QA engineers, and AI tools such as GitHub Copilot to communicate using the same language throughout the FullScan project.