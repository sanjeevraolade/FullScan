---
applyTo:
  - "mobile/src/widgets/**"
  - "mobile/src/components/widgets/**"
  - "mobile/src/components/dynamic/fields/**"
---

# Widget Instructions

These instructions apply to all widgets developed for the FullScan Mobile Platform.

Refer to:

- docs/05-Runtime/04-Widget-Registry.md
- docs/05-Runtime/03-Dynamic-Form-Engine.md
- docs/06-Contracts/04-Widget-Schema.md

The Widget Architecture is frozen.

Never bypass the Widget Registry.

---

# Widget Philosophy

Widgets are the smallest reusable building blocks of the platform.

A screen is composed of Sections.

A Section is composed of Widgets.

Widgets should never contain business workflow logic.

Widgets display or collect information.

Business behaviour belongs to Runtime Engines.

---

# Widget Principles

Every widget shall be:

- Reusable
- Configuration Driven
- Stateless whenever possible
- Theme Aware
- Localization Aware
- Testable
- Accessible

Widgets should solve one problem only.

---

# Widget Responsibilities

A widget may:

- Display information
- Accept user input
- Trigger widget events
- Bind runtime values
- Display validation errors

A widget must NOT:

- Execute workflows
- Navigate
- Upload data
- Call APIs
- Synchronize data
- Perform business validation

---

# Widget Registration

Every widget must register with the Widget Registry.

Never instantiate widgets directly.

Always resolve through:

Widget Type

↓

Widget Registry

↓

Registered Component

↓

Runtime Renderer

---

# Widget Categories

Widgets belong to one of the following categories.

## Display Widgets

Examples:

- Label
- Text
- Badge
- Divider
- Icon
- Image

---

## Input Widgets

Examples:

- Text Input
- Number Input
- Email
- Phone
- Text Area

---

## Selection Widgets

Examples:

- Checkbox
- Radio
- Switch
- Dropdown
- Multi Select

---

## Date Widgets

Examples:

- Date Picker
- Time Picker
- Date Time Picker

---

## Verification Widgets

Examples:

- Camera
- Attachment
- GPS
- Signature

---

## Layout Widgets

Examples:

- Card
- Section
- Accordion
- Grid

---

# Widget Lifecycle

Every widget should support:

Initialize

↓

Bind

↓

Render

↓

Validate

↓

Save

↓

Dispose

Avoid side effects during rendering.

---

# Runtime Binding

Widgets bind to Runtime Context.

Example bindings:

assignment.candidate.name

assignment.address

attachments.candidatePhoto

runtime.location.latitude

Widgets should never own business state.

---

# Widget Configuration

Widget behaviour comes from configuration.

Never hardcode:

- Labels
- Visibility
- Required state
- Order
- Default values

Read everything from configuration.

---

# Validation

Validation belongs to the Validation Engine.

Widgets should:

Display validation state.

Request validation.

Display validation messages.

Widgets should never implement business rules.

---

# Theme Support

Every widget must consume Theme Engine.

Never hardcode:

- Colors
- Fonts
- Spacing
- Radius

Use design tokens only.

---

# Localization

Every visible string must use localization keys.

Never hardcode:

- Labels
- Buttons
- Help Text
- Errors

Use Localization Engine.

---

# Gluestack UI

Mandatory.

Always use Gluestack UI components whenever available.

Avoid raw React Native components.

Use:

- Box
- Text
- Input
- Button
- Card
- VStack
- HStack
- Badge
- Icon
- Modal

---

# Camera Widgets

Camera widgets must:

- Use Vision Camera
- Disable Gallery
- Capture GPS
- Generate Watermark
- Store metadata
- Support Offline

Watermark is mandatory.

---

# Attachment Widgets

Attachments represent business evidence.

Support:

- Capture
- Preview
- Delete
- Retry Upload
- Upload Status

Future document types should require configuration only.

---

# Error Handling

Widget failures should not crash screen rendering.

Log the error.

Display graceful fallback UI.

Continue rendering remaining widgets.

---

# Accessibility

Widgets should support:

- Screen Readers
- Dynamic Font Sizes
- Touch Accessibility
- Focus Navigation

Accessibility should be considered during implementation.

---

# Performance

Avoid:

- Unnecessary re-renders
- Heavy computations
- Duplicate parsing

Prefer:

- Memoization
- Lazy rendering
- Stable props

---

# Testing

Every widget should include tests for:

- Rendering
- Configuration
- Runtime Binding
- Validation
- Theme
- Localization
- Accessibility

Mock runtime dependencies.

---

# Folder Structure

Widgets should follow this structure.

widgets/

    Camera/

        CameraWidget.tsx

        CameraWidget.types.ts

        CameraWidget.styles.ts

        CameraWidget.test.tsx

        index.ts

Follow a consistent folder structure for every widget.

---

# Before Writing Code

Always verify:

✓ Is the widget reusable?

✓ Is it configuration driven?

✓ Does it use Runtime Context?

✓ Does it use Theme Engine?

✓ Does it use Localization Engine?

✓ Does it avoid business logic?

✓ Is it registered in the Widget Registry?

✓ Is it independently testable?

If any answer is "No", redesign before implementation.

---

# Guiding Principle

Widgets are reusable platform components.

A widget should be generic enough to be reused across multiple workflows without modification.

Never create feature-specific widgets unless absolutely necessary.

Extend the platform rather than duplicating functionality.