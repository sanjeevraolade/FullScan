# Create Feature Prompt

> Follow **00-prompt-execution-rules.md** before executing this prompt.

## Purpose

...

Create a new enterprise-grade feature for the FullScan Mobile Platform.

The generated implementation must fully comply with the project's documented architecture, runtime model, governance, coding standards, contracts, and engineering principles.

This prompt is intended to generate a complete feature rather than a single screen or component.

---

# Before Starting

Review the following in order:

## GitHub Workspace

- README.md
- PROJECT_CONTEXT.md
- PROJECT_GLOSSARY.md
- copilot-instructions.md

Review all applicable instruction files.

Review all applicable agents.

---

## Project Documentation

Read:

- Vision
- Business
- Governance
- Architecture
- Runtime
- Contracts

The documentation is the source of truth.

---

# Understand the Feature

Before generating code determine:

- Business purpose
- User Persona
- Workflow
- Runtime Engine involvement
- Required APIs
- Required Widgets
- Required Validation
- Required Attachments
- Localization requirements
- Theme requirements
- Offline behavior

Never begin implementation without understanding these.

---

# Architecture Validation

Determine whether:

The feature already exists.

The Runtime Platform already supports it.

Existing widgets can be reused.

Existing workflows can be reused.

Configuration can solve the requirement.

Never duplicate functionality.

---

# Generate Feature

A complete feature may contain:

Feature Folder

↓

Navigation Registration

↓

Feature Entry Screen

↓

Reusable Components

↓

Widgets

↓

Hooks

↓

Store

↓

Saga

↓

Repository

↓

API Client

↓

DTOs

↓

Domain Models

↓

Mappers

↓

Validation

↓

Localization

↓

Theme

↓

Tests

↓

Documentation

Only generate what is actually required.

---

# Runtime Integration

Always integrate with:

- Runtime Engine
- Workflow Engine
- Validation Engine
- Configuration Engine
- Synchronization Engine

Never bypass Runtime.

---

# UI

Always:

Use Gluestack UI.

Support Localization.

Support Themes.

Support Accessibility.

Support Offline First.

Avoid raw React Native components whenever an equivalent Gluestack component exists.

---

# State

Determine:

UI State

↓

Component

Business State

↓

Runtime Context

Global State

↓

Zustand

Do not duplicate state.

---

# API

Use:

Repository

↓

Mapper

↓

API

Never expose DTOs to UI.

---

# Validation

Use Validation Engine.

Never implement business validation inside UI.

---

# Attachments

If attachments are required:

Use Attachment Engine.

Generate watermark.

Capture GPS.

Store metadata.

Queue synchronization.

Never upload directly.

---

# Localization

Every string must use localization keys.

Never hardcode text.

---

# Theme

Every visual property must use Theme Engine.

Never hardcode colors or spacing.

---

# Testing

Generate:

- Unit Tests
- Component Tests
- Integration Tests (if required)

Test:

- Happy Path
- Edge Cases
- Offline
- Errors

---

# Documentation

If reusable functionality is introduced:

Recommend documentation updates.

---

# Deliverables

Generate only the required files.

Maintain repository standards.

---

# Completion Checklist

✓ Architecture followed

✓ Runtime respected

✓ Configuration-driven

✓ Offline First

✓ Localization

✓ Theme

✓ Accessibility

✓ Tests

✓ Documentation considered

✓ No architectural violations