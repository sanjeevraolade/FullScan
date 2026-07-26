---
name: fullscan-architecture
description: Load when making a structural decision in the FullScan app — adding a top-level src/ folder, deciding which layer owns a piece of code, resolving a dependency-direction question, or evaluating whether something should be configuration vs. hardcoded. Also load before any cross-cutting design decision.
---

# FullScan Architecture

FullScan is **not** a traditional React Native app. It is a configuration-driven, offline-first, server-driven-UI Runtime Platform. See `/CLAUDE.md` for the always-loaded summary; this skill has the full detail.

## Core principles (non-negotiable)

Runtime First · Server-Driven UI · Configuration Before Code · Offline First · Clean Architecture · SOLID · Separation of Concerns · Reusable Components · Extensible Design (Open/Closed) · Testability.

## Layered architecture — dependencies flow downward only

```
Presentation → Runtime → Domain → Application Services → Infrastructure → Platform Services
```

Equivalently, in repo terms: `Application → Bootstrap → Navigation → Runtime → Features → Repositories → Infrastructure`. A lower layer must never import from a higher one.

## Repository structure (frozen)

```
src/
  app/            composition: providers, navigation, runtime wiring, application shell — no business logic
  bootstrap/      startup sequencing before the app becomes available
  contracts/      shared contracts/interfaces only, no implementation
  core/           constants/, errors/, events/, types/, utils/ — reusable, never business logic
  domain/         business entities and rules, independent of UI/infrastructure
  features/       business functionality, consumes the Runtime (authentication, verification, reports, dashboard, settings...)
  hooks/          reusable cross-feature hooks
  infrastructure/ device/platform capability implementations (storage, camera, networking, GPS, logger, permissions, notifications, biometrics, encryption) — no business logic
  localization/   i18n resources
  navigation/     screen registration and typed routes
  repositories/   hide data access, return Domain Models, never expose DTOs
  runtime/        the platform core: configuration/, engine/, registry/, renderer/, validation/, workflow/
  shared/         reusable UI components, formatters, validators, layouts, icons, animations
  store/          app-wide state only: session, theme, configuration, localization — never business entities
  theme/          design tokens
  widgets/        reusable runtime-rendered building blocks
```

Do not introduce new top-level folders without a real architectural reason — this structure is frozen. Every feature should follow the same internal layout as its siblings.

## Server-Driven UI

The backend configuration controls screens, sections, widgets, layouts, validation, attachment types, and workflow definitions. Avoid hardcoded business screens — render through the Dynamic Form Engine whenever the content is configurable.

## Runtime Context

Business execution state (current Assignment, Workflow, User, Attachments, GPS, form values, runtime variables) lives in one place: the Runtime Context. Screens and widgets never own business state — see `fullscan-runtime-engine`.

## Business logic placement

Belongs in: Runtime Engines, Domain Services, Validation Engine, Workflow Engine.
Must never live in: Screens, Widgets, Navigation, UI Components.

## Dependency rules

```
Screens → Runtime → Domain → Services → Infrastructure
```
Never reversed. Platform services (camera, GPS, biometrics, permissions, storage, notifications, logging) are accessed through abstraction layers — business logic never couples directly to native APIs.

## Reusability check before creating anything new

Can an existing widget be reused? Can configuration solve this? Can a Runtime Engine handle it? Can the Widget Registry support it? Prefer extending the platform over a feature-specific implementation.

## Before generating code, verify

Does this follow the Runtime Architecture? Is it configuration-driven? Is it reusable? Does it support Offline First? Does it use Runtime Engines correctly, avoiding business logic in the UI? Does it respect the dependency direction? If any answer is "no," redesign before implementing.
