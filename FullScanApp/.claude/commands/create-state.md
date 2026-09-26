---
description: Scaffold a Zustand store slice for app-wide state (session, theme, configuration, localization — never business entities)
argument-hint: <store-name> — e.g. "sessionStore"
---

Create the **$ARGUMENTS** store for the FullScan Mobile Platform under `src/store/`.

Load `fullscan-state-management` first.

## Before creating a new store

Confirm this is genuinely **app-wide state** (session, theme, configuration, localization) and not business state (which belongs in Runtime Context — see `fullscan-runtime-engine`) or temporary UI state (which belongs in component state). If it's business state, stop and route it through Runtime Context instead of creating a store.

## Principles

Zustand for state, Redux Saga for side effects — don't add another state library. Keep the store small and feature-focused, not a dumping ground. Treat state as immutable: return updated copies rather than mutating in place. Prefer selectors over reading the entire store object.

## Generate

```
store/$ARGUMENTS/
  $ARGUMENTS.ts          # store definition
  $ARGUMENTS.types.ts
  $ARGUMENTS.selectors.ts
  $ARGUMENTS.saga.ts      # only if side effects are needed
  $ARGUMENTS.test.ts
  index.ts
```

## Persistence

Persist only what needs to survive a restart (auth, theme, language, configuration) — never persist transient UI state, and never store business entities here at all.

## Tests

Cover store updates, selectors, and any side effects handled by the saga.

## Before finishing, confirm

This is app-wide state, not business state or UI state · no duplication with Runtime Context · store stays small and focused · side effects delegated to Redux Saga, not inlined in components · tested.
