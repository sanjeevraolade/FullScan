---
applyTo:
  - "mobile/src/components/dynamic/**"
  - "mobile/src/runtime/forms/**"
  - "mobile/src/widgets/**"
---

# Dynamic Form Engine Instructions

These instructions apply to all Dynamic Form Engine implementations.

Refer to:

- docs/05-Runtime/03-Dynamic-Form-Engine.md
- docs/06-Contracts/03-Screen-Schema.md
- docs/06-Contracts/04-Widget-Schema.md
- docs/06-Contracts/05-Validation-Schema.md

The Dynamic Form Engine architecture is frozen.

---

# Philosophy

The Dynamic Form Engine is responsible for generating business screens at runtime.

Business forms must never be manually implemented when they can be generated from configuration.

Configuration is the source of truth.

---

# Responsibilities

The Dynamic Form Engine is responsible for:

- Parsing screen configuration
- Rendering layouts
- Creating sections
- Resolving widgets
- Data binding
- Validation binding
- Theme integration
- Localization integration

---

# Never Hardcode

Never hardcode:

- Forms
- Business screens
- Widget ordering
- Labels
- Mandatory fields
- Validation rules

Always read configuration.

---

# Screen Rendering Pipeline

The rendering flow should be:

Configuration

↓

Screen Schema

↓

Section Renderer

↓

Widget Resolver

↓

Widget Registry

↓

Runtime Widget

↓

Rendered Screen

---

# Widget Resolution

Never instantiate widgets directly.

Always resolve widgets through the Widget Registry.

Example:

Widget Type

↓

Widget Registry

↓

Registered Component

↓

Rendered Widget

---

# Runtime Binding

Widgets bind to Runtime Context.

Examples:

assignment.candidate.name

attachments.candidatePhoto

runtime.location.latitude

Avoid local business state inside widgets.

---

# Layout Rendering

Supported layouts include:

- Vertical
- Horizontal
- Scroll
- Card
- Grid
- Accordion
- Tabs

Layout behaviour should remain extensible.

---

# Widget Lifecycle

Each widget should support:

- Initialize
- Render
- Validate
- Save
- Dispose

Avoid side effects during rendering.

---

# Validation

Validation belongs to the Validation Engine.

The Dynamic Form Engine should request validation.

It should not implement business validation.

---

# Localization

Every visible string must use localization keys.

Never hardcode:

- Labels
- Buttons
- Help Text
- Errors

Resolve text through the Localization Engine.

---

# Theme

Every widget must consume the Theme Engine.

Never hardcode:

- Colors
- Typography
- Spacing
- Radius

Use design tokens.

---

# Gluestack UI

Use Gluestack UI components.

Avoid raw React Native components whenever a Gluestack equivalent exists.

---

# Attachments

Attachment widgets should support:

- Camera Capture
- GPS
- Watermark
- Offline Storage
- Upload Status

Gallery selection is prohibited.

---

# Performance

Avoid unnecessary widget recreation.

Reuse:

- Widget definitions
- Parsed configuration
- Runtime bindings

Prefer lazy rendering where appropriate.

---

# Error Handling

Invalid configuration should:

- Log the error
- Skip the invalid widget
- Continue rendering remaining content

The application should degrade gracefully.

---

# Extensibility

Support future widget types without modifying existing rendering logic.

Register new widgets through the Widget Registry.

Follow the Open/Closed Principle.

---

# Testing

Test:

- Configuration parsing
- Widget rendering
- Dynamic layouts
- Binding
- Validation integration
- Localization
- Theme support

Mock runtime dependencies.

---

# Before Writing Code

Verify:

✓ Is the screen generated from configuration?

✓ Is every widget resolved through the Widget Registry?

✓ Is localization supported?

✓ Is theming supported?

✓ Is validation delegated?

✓ Is runtime binding correct?

✓ Is the implementation reusable?

If any answer is "No", redesign before implementation.

---

# Guiding Principle

The Dynamic Form Engine transforms configuration into a fully functional user interface.

It should remain generic, reusable, extensible, configuration-driven, and independent of business-specific implementations.