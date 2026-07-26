---
name: fullscan-navigation
description: Load when adding a screen route, wiring navigation parameters, or deciding whether a screen transition is workflow-driven. Load before putting business-flow logic inside a navigator or screen.
---

# Navigation

Applies to `src/navigation/**`. Navigation moves between screens — it never contains business logic. Business flow decisions belong to the Workflow Engine (`fullscan-runtime-engine`).

## Framework

React Navigation only — Native Stack, Drawer, Modal now; Bottom Tabs planned. Don't introduce another navigation library.

## Principles

Typed, predictable, centralized, testable. Avoid navigation logic scattered across feature files.

## Typed navigation

Always define navigation parameter types — never `any`/`unknown` for route params.

## Workflow-driven navigation

The Workflow Engine decides next screen, previous screen, completion, and cancellation. Screens never decide business workflow progression themselves — they render and delegate.

## Route registration

Register every screen centrally with constants — avoid dynamic/magic string route names scattered through the codebase.

## Screen responsibilities

Screens render UI, invoke the Runtime Engine, and display state. They must not execute workflows, perform validation, call APIs, or synchronize data.

## Parameters

Pass identifiers (`assignmentId`, `workflowId`), not full business objects — let the destination screen fetch/read what it needs from Runtime Context.

## Back navigation

Respect Workflow Engine rules — don't let a user bypass a mandatory workflow step via the back button.

## Deep linking

Design navigation so future deep-link support isn't blocked by today's assumptions.

## Error handling

Handle invalid routes, missing parameters, and unknown screens with a user-friendly error screen, not a crash.

## Before writing navigation code, verify

Is there any business logic in the navigation code? Does the Workflow Engine control progression rather than the screen deciding for itself? Is navigation strongly typed with minimal (ID-based) parameters? If any answer is "no," redesign first.
