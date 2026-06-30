# Localization Schema

**Document ID:** LOC-SCH-001

**Document Version:** 1.0

**Status:** Approved

**Owner:** Solution Architect

---

# 1. Purpose

The Localization Schema defines the structure of language resources used by the Localization Engine.

All user-visible text shall be resolved through localization keys.

---

# 2. Localization Schema

```json
{
  "language": "en",
  "version": "1.0",
  "dictionary": {
    "screen.dashboard.title": "Dashboard",
    "candidate.photo": "Candidate Photo",
    "button.submit": "Submit",
    "validation.photo.required": "Candidate photo is required."
  }
}
```

---

# 3. Supported Languages

Initial Release:

* English (en)
* Hindi (hi)
* Telugu (te)

Future languages may be added by configuration only.

---

# 4. Localization Rules

Every translatable value shall be represented by a localization key.

Examples:

* Screen Titles
* Labels
* Buttons
* Placeholders
* Validation Messages
* Dialog Messages
* Toast Messages

---

# 5. Runtime Behaviour

Language changes shall:

* Reload dictionaries.
* Preserve workflow state.
* Preserve form values.
* Re-render visible widgets.

---

# 6. Fallback Strategy

If a key is missing:

1. Use default language.
2. Log missing key.
3. Continue rendering.

---

# 7. Guiding Philosophy

> Localization is configuration, not code. The schema enables multilingual runtime interfaces while keeping business logic language-independent.
