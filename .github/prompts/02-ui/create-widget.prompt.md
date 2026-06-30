# Create Widget Prompt

> Follow **00-prompt-execution-rules.md** before executing this prompt.

## Purpose

Create a reusable widget for the FullScan Runtime Platform.

Widgets are reusable platform components.

Do not create feature-specific widgets unless absolutely necessary.

---

# Before Starting

Determine:

Can an existing widget be reused?

Can configuration solve this?

Can Widget Registry resolve an existing widget?

Only create a new widget if required.

---

# Widget Responsibilities

Widgets may:

Display

Capture Input

Trigger Events

Display Validation

Bind Runtime Values

Widgets must not:

Execute Workflows

Call APIs

Synchronize

Navigate

Contain Business Rules

---

# Widget Requirements

Every widget must:

Register with Widget Registry

Support Theme

Support Localization

Support Accessibility

Support Runtime Binding

Be independently testable

---

# Widget Structure

Generate:

Widget.tsx

Widget.types.ts

Widget.styles.ts

Widget.test.tsx

index.ts

Maintain consistent folder structure.

---

# Runtime

Bind to Runtime Context.

Do not own business state.

---

# Theme

Consume Theme Engine.

No hardcoded styles.

---

# Localization

No hardcoded text.

Use localization keys.

---

# Validation

Use Validation Engine.

Display validation.

Do not implement validation logic.

---

# Accessibility

Support:

Screen Readers

Dynamic Font

Touch Targets

Keyboard Navigation where applicable

---

# Performance

Avoid unnecessary renders.

Use memoization.

Avoid inline objects.

---

# Testing

Generate:

Rendering

Runtime Binding

Validation

Localization

Theme

Accessibility

---

# Completion Checklist

✓ Widget Registry

✓ Runtime Binding

✓ Theme

✓ Localization

✓ Accessibility

✓ Reusable

✓ Stateless where possible

✓ Tests

✓ No business logic