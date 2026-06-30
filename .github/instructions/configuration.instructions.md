---
applyTo:
  - "mobile/src/runtime/configuration/**"
  - "mobile/src/config/**"
  - "mobile/src/services/configuration/**"
  - "mobile/src/models/configuration/**"
---

# Configuration Engine Instructions

These instructions apply to the Configuration Engine and all runtime configuration components.

Refer to:

- docs/05-Runtime/06-Configuration-Engine.md
- docs/06-Contracts/01-Configuration-Schema.md
- docs/06-Contracts/
- docs/04-Architecture/

The Configuration Engine architecture is frozen.

---

# Configuration Philosophy

Configuration is the single source of truth for runtime behaviour.

Business behaviour should evolve through configuration rather than source code modifications.

If a business requirement can be represented as configuration, prefer configuration over implementation.

---

# Responsibilities

The Configuration Engine is responsible for:

- Downloading runtime configuration
- Configuration validation
- Configuration versioning
- Local configuration storage
- Configuration activation
- Configuration rollback
- Configuration cache
- Configuration distribution

The Configuration Engine is NOT responsible for rendering UI or executing workflows.

---

# Configuration Driven Platform

The following must be configuration-driven whenever technically possible:

- Screens
- Layouts
- Sections
- Widgets
- Workflow Definitions
- Validation Rules
- Attachment Types
- Themes
- Localization Resources
- Feature Flags (Future)

Avoid hardcoding business behaviour.

---

# Configuration Package

The backend delivers a complete configuration package.

The package may contain:

- Metadata
- Screens
- Workflows
- Widgets
- Validation
- Attachments
- Themes
- Localization

Treat the package as an immutable runtime artifact.

---

# Configuration Lifecycle

The configuration lifecycle is:

Application Startup

↓

Configuration Download

↓

Schema Validation

↓

Compatibility Validation

↓

Cache

↓

Activation

↓

Runtime Distribution

↓

Execution

Never activate invalid configuration.

---

# Versioning

Every configuration package shall contain:

- Configuration Version
- Schema Version
- Minimum App Version
- Checksum
- Generated Timestamp

The Configuration Engine must validate compatibility before activation.

---

# Validation

Validate configuration before activation.

Examples:

- JSON Structure
- Required Properties
- Duplicate IDs
- Missing References
- Invalid Widget Types
- Invalid Workflow References
- Invalid Localization Keys

Never allow invalid configuration into runtime.

---

# Local Storage

Configuration shall be cached locally.

The cache should:

- Survive application restart
- Support offline execution
- Preserve previous valid configuration
- Support rollback

Configuration storage should be version-aware.

---

# Offline First

Offline support is mandatory.

If the backend is unavailable:

- Use the last valid configuration
- Continue application execution
- Never block business workflows solely because configuration cannot be refreshed

---

# Configuration Distribution

The Configuration Engine provides configuration to:

- Runtime Engine
- Workflow Engine
- Dynamic Form Engine
- Widget Registry
- Validation Engine
- Theme Engine
- Localization Engine

Consumers should never load configuration directly.

Always request configuration through the Configuration Engine.

---

# Configuration Updates

Configuration updates should be atomic.

Do not partially activate configuration.

Either:

- Entire package is activated

or

- Previous package remains active

Avoid inconsistent runtime states.

---

# Error Handling

If configuration validation fails:

- Log the failure
- Preserve the current active configuration
- Reject the invalid package
- Notify the Runtime Engine

Never crash the application because of configuration errors.

---

# Security

Configuration packages should be treated as trusted runtime metadata.

Validate:

- Version
- Integrity
- Schema
- Compatibility

Future enhancements may include:

- Digital Signatures
- Configuration Encryption
- Remote Revocation

The architecture should support these capabilities.

---

# Logging

Log significant configuration events.

Examples:

- Configuration Download Started
- Configuration Download Completed
- Configuration Validation Passed
- Configuration Validation Failed
- Configuration Activated
- Configuration Rollback

Do not log sensitive configuration values.

---

# Performance

Configuration should be parsed once.

Avoid repeated JSON parsing.

Cache parsed configuration where appropriate.

Avoid unnecessary object creation.

---

# Testability

The Configuration Engine should be independently testable.

Test:

- Valid Configuration
- Invalid Configuration
- Version Mismatch
- Schema Failure
- Offline Cache
- Rollback
- Upgrade

Mock backend responses during testing.

---

# Dependency Rules

The Configuration Engine may depend on:

- Storage
- Networking
- Logger
- Contracts

The Configuration Engine must not depend on:

- UI Components
- Screens
- Widgets
- Navigation

---

# Extension Strategy

Future runtime capabilities should be introduced by extending configuration.

Examples:

- New Widget Types
- New Validation Rules
- New Workflow Nodes
- New Attachment Types
- New Themes
- New Languages

Avoid changing the Configuration Engine for ordinary business requirements.

---

# Folder Structure

configuration/

    ConfigurationEngine.ts

    ConfigurationRepository.ts

    ConfigurationDownloader.ts

    ConfigurationValidator.ts

    ConfigurationCache.ts

    ConfigurationVersionManager.ts

    ConfigurationLoader.ts

Each class should have a single responsibility.

---

# Before Writing Code

Always verify:

✓ Is this behaviour configuration-driven?

✓ Is configuration validated?

✓ Is version compatibility checked?

✓ Is offline support maintained?

✓ Is configuration cached?

✓ Is activation atomic?

✓ Is rollback supported?

✓ Is the implementation independently testable?

If any answer is "No", redesign before implementation.

---

# Guiding Principle

The Configuration Engine is the foundation of the FullScan Runtime Platform.

Every runtime capability should consume configuration through this engine rather than embedding business behaviour in application code.

Protect the integrity, consistency, and reliability of runtime configuration at all times.