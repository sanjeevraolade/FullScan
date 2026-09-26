# Screen Schema

**Document ID:** SCN-001

**Document Version:** 1.0

**Status:** Approved

**Owner:** Solution Architect

**Last Updated:** 29-Jun-2026

---

# 1. Purpose

The Screen Schema defines the JSON contract used to describe runtime screens.

A screen is a composition of sections, layouts, and widgets. The Dynamic Form Engine consumes this schema to construct user interfaces at runtime.

---

# 2. Design Principles

* Screens are configuration-driven.
* Screens contain no business logic.
* Layout is declarative.
* Widgets are reusable.
* Navigation belongs to the Workflow Engine.

---

# 3. Screen Hierarchy

```text
Screen
│
├── Metadata
├── Header
├── Sections[]
│    ├── Layout
│    └── Widgets[]
└── Footer
```

---

# 4. Screen Schema

```json
{
  "screenId": "candidate-verification",
  "version": 1,
  "titleKey": "screen.candidateVerification",
  "workflowId": "candidateVerification",
  "layout": "scroll",
  "visible": true,
  "sections": [],
  "actions": []
}
```

---

# 5. Screen Properties

| Property   | Required | Description              |
| ---------- | -------- | ------------------------ |
| screenId   | Yes      | Unique screen identifier |
| version    | Yes      | Screen version           |
| titleKey   | Yes      | Localization key         |
| workflowId | Yes      | Associated workflow      |
| layout     | Yes      | Layout type              |
| visible    | Yes      | Visibility flag          |
| sections   | Yes      | Collection of sections   |
| actions    | No       | Screen actions           |

---

# 6. Section Schema

```json
{
  "sectionId": "candidate",
  "titleKey": "section.candidate",
  "layout": "vertical",
  "order": 1,
  "visible": true,
  "widgets": []
}
```

---

# 7. Supported Layouts

* scroll
* vertical
* horizontal
* grid
* card
* accordion
* tabs

Future layouts may be introduced without changing the schema.

---

# 8. Screen Actions

Supported actions include:

* submit
* cancel
* save
* next
* previous
* capture
* refresh

---

# 9. Runtime Rules

* Screen IDs shall be unique.
* Widget order shall be deterministic.
* Empty sections are permitted.
* Layout defaults to `vertical` if omitted.
* Unknown properties shall be ignored for forward compatibility.

---

# 10. Versioning

Screen definitions are independently versioned and must remain backward compatible within the same major schema version.

---

# 11. Guiding Philosophy

> A screen is a declarative description of a user experience—not an implementation. The Dynamic Form Engine transforms this metadata into a functional interface.
