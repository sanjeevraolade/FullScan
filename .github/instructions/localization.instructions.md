---
applyTo:
  - "mobile/src/localization/**"
  - "mobile/src/i18n/**"
  - "mobile/src/features/**"
  - "mobile/src/widgets/**"
---

# Localization Instructions

These instructions apply to all localization implementations.

Refer to:

- docs/05-Runtime/09-Localization-Engine.md
- docs/06-Contracts/08-Localization-Schema.md

Localization is mandatory.

---

# Localization Philosophy

Every user-visible string must be localized.

There are no exceptions.

Never hardcode text.

---

# Supported Languages

Current:

- English
- Hindi
- Telugu

Future languages should require configuration only.

---

# Localization Engine

The Localization Engine resolves:

- Labels
- Buttons
- Errors
- Dialogs
- Tooltips
- Help Text
- Validation Messages

---

# Keys

Use descriptive keys.

GOOD

assignment.title

camera.capture

validation.required

BAD

title1

label2

msg

---

# Never Hardcode

Never hardcode:

Screen Titles

Button Text

Dialog Text

Validation Messages

Error Messages

Empty State Messages

Loading Messages

Tooltips

Help Text

---

# Runtime Language

Language changes should update the UI without restarting the application.

Support runtime language switching.

---

# Configuration

Localization resources should support backend updates.

Future enhancements may allow downloading new language packs.

---

# Widgets

Every widget must use localization keys.

Widgets must not contain fixed text.

---

# Validation

Validation Engine returns message keys.

Localization Engine resolves messages.

Avoid localized text inside validators.

---

# Formatting

Use localization utilities for:

- Dates
- Times
- Numbers
- Currency (Future)

Avoid manual formatting.

---

# Accessibility

Localized text should work correctly with screen readers.

Support right-to-left languages in the future.

Do not hardcode layout assumptions.

---

# Testing

Test:

- All supported languages
- Runtime language switching
- Missing translation keys
- Fallback language

---

# Missing Keys

Missing keys should:

- Log a warning
- Use fallback language
- Never crash the application

---

# Before Writing Code

Verify:

✓ No hardcoded strings

✓ Localization keys used

✓ Runtime language switching supported

✓ Validation uses message keys

✓ Widgets are localized

---

# Guiding Principle

Localization is a platform capability.

Every feature should automatically support multiple languages without requiring feature-specific implementation.