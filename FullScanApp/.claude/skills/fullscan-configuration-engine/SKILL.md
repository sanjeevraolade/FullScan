---
name: fullscan-configuration-engine
description: Load when implementing configuration download, versioning, caching, activation, or rollback — the Configuration Engine. Load before any code that reads runtime config directly rather than going through this engine.
---

# Configuration Engine

Applies to `src/runtime/configuration/**`. Configuration is the single source of truth for runtime behavior — business behavior should evolve through configuration rather than source code changes. Frozen architecture.

## Responsibilities

Downloading configuration · validation · versioning · local storage · activation · rollback · cache · distribution to consumers. **Not** responsible for rendering UI or executing workflows.

## What must be configuration-driven wherever technically possible

Screens, layouts, sections, widgets, workflow definitions, validation rules, attachment types, themes, localization resources, feature flags (future).

## Lifecycle

```
App Startup → Download → Schema Validation → Compatibility Validation → Cache → Activation → Runtime Distribution → Execution
```
Never activate invalid configuration.

## Versioning

Every package carries: configuration version, schema version, minimum app version, checksum, generated timestamp. Validate compatibility before activation.

## Validation before activation

Check JSON structure, required properties, duplicate IDs, missing references, invalid widget types, invalid workflow references, invalid localization keys. Invalid configuration never reaches runtime.

## Local storage & offline

The cache survives app restart, supports offline execution, and preserves the previous valid configuration for rollback. If the backend is unavailable, keep using the last valid configuration and continue running — never block business workflows just because a config refresh failed.

## Distribution

Runtime Engine, Workflow Engine, Dynamic Form Engine, Widget Registry, Validation Engine, Theme Engine, Localization Engine all consume configuration **through this engine** — never load it directly themselves.

## Atomic updates

Either the whole package activates, or the previous package stays active — no partially-activated, inconsistent runtime state.

## Error handling

On validation failure: log it, keep the current active configuration, reject the invalid package, notify the Runtime Engine. Never crash the app over a bad configuration payload.

## Security

Treat configuration packages as trusted runtime metadata — validate version, integrity, schema, compatibility. Architecture should be able to add digital signatures / encryption / remote revocation later without a redesign.

## Performance

Parse once, cache the parsed result, avoid repeated JSON parsing or unnecessary object creation.

## Dependency rules

May depend on: storage, networking, logger, contracts. Must not depend on: UI components, screens, widgets, navigation.

## Folder pattern

```
configuration/
  ConfigurationEngine.ts
  ConfigurationRepository.ts
  ConfigurationDownloader.ts
  ConfigurationValidator.ts
  ConfigurationCache.ts
  ConfigurationVersionManager.ts
  ConfigurationLoader.ts
```

## Before writing config-related code, verify

Is this behavior configuration-driven rather than hardcoded? Is configuration validated and version-checked before activation? Is offline support maintained? Is activation atomic with rollback available? If any answer is "no," redesign first.
