---
name: fullscan-state-management
description: Load when deciding where a piece of state should live — component state, Runtime Context, or a Zustand store — or when adding a new store slice or side effect. Load before creating a new store or duplicating existing state.
---

# State Management

Applies to `src/store/**`, `src/state/**`, and Runtime Context consumers. Every piece of state has exactly one owner — avoid duplication.

## Ownership by category

| State | Examples | Owner |
|---|---|---|
| UI State | modal open, selected tab, search text | Component state |
| Business State | Assignment, Workflow, Attachments | Runtime Context |
| Global State | logged-in user, configuration, theme, language | Zustand store |

## Framework

Zustand for state, Redux Saga for side effects — don't introduce another state library.

## Runtime Context vs. stores

Runtime Context owns current Assignment, current Workflow, runtime variables, attachments, form values. Never duplicate Runtime Context data inside a Zustand store.

## Store design

Keep stores small, focused, and feature-oriented — avoid one large global store. Prefer selectors that read only what's needed over pulling the entire store object.

## Mutability & async

Treat state as immutable — return updated copies, don't mutate in place. Business side effects belong in Redux Saga, not inside components.

## Component state

Only for temporary UI concerns — never store business entities there.

## Persistence

Persist only what needs to survive a restart: authentication, theme, language, configuration. Don't persist transient UI state.

## Before creating or touching state, verify

Who is the correct owner of this state — component, Runtime Context, or a store? Is it duplicated elsewhere? Is Zustand used appropriately (not for business state)? Are side effects delegated to Redux Saga rather than inlined in a component? If any answer is off, redesign first.
