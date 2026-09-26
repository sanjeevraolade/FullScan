---
description: Scaffold a complete FullScan feature (screen, widgets, hooks, store, repository, API, tests) following the Runtime architecture
argument-hint: <feature-name> — e.g. "candidate-verification"
---

Build the **$ARGUMENTS** feature for the FullScan Mobile Platform under `src/features/`.

Relevant skills to load first: `fullscan-architecture`, `fullscan-engineering-standards`, and whichever of `fullscan-dynamic-form` / `fullscan-widget-development` / `fullscan-validation` / `fullscan-state-management` apply to this feature. If it involves attachments or sync, also load `fullscan-attachment-engine` / `fullscan-synchronization-engine`.

## Before generating anything

1. Determine the business purpose, workflow, and which Runtime Engines are involved.
2. Check whether this feature (or parts of it) already exists, and whether existing widgets/workflows/configuration can be reused instead of building new. Never duplicate functionality.
3. If the request would bypass a Runtime Engine or hardcode something that should be configuration-driven, stop and flag the conflict before writing code (see `fullscan-architecture`).

## What a complete feature may include — generate only what's actually needed

Feature folder → navigation registration → entry screen → reusable components → widgets → hooks → Zustand store slice → Redux saga → repository → API client → DTOs → domain models → mappers → validation wiring → localization keys → theme usage → tests → doc updates if reusable capability was introduced.

## Non-negotiables

- Runtime integration: Runtime Engine, Workflow Engine, Validation Engine, Configuration Engine, Synchronization Engine — never bypassed.
- UI: Gluestack UI only, full localization (en/hi/te), theme-aware, accessible, offline-first.
- State: UI state in components, business state in Runtime Context, app-wide state in Zustand — no duplication.
- API access only via Repository → Mapper → API client; never expose DTOs to UI.
- Attachments (if any): Attachment Engine, watermark, GPS, queued via Synchronization Engine — never uploaded directly.
- Tests cover happy path, edge cases, offline behavior, and errors — not just the happy path.

## Before finishing, confirm

Architecture and Runtime respected · configuration-driven where applicable · offline-first · localized · themed · accessible · tested · no architectural violations.
