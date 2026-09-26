# Widget Schema

**Document ID:** WGT-001

**Document Version:** 1.0

**Status:** Approved

**Owner:** Solution Architect

**Last Updated:** 29-Jun-2026

---

# 1. Purpose

The Widget Schema defines the contract for every runtime widget rendered by the Dynamic Form Engine.

Each widget is a reusable UI component described entirely through metadata.

---

# 2. Widget Schema

```json
{
  "widgetId": "candidatePhoto",
  "type": "camera",
  "labelKey": "candidate.photo",
  "binding": "attachments.candidatePhoto",
  "required": true,
  "visible": true,
  "enabled": true,
  "order": 1,
  "properties": {}
}
```

---

# 3. Common Properties

| Property   | Description                   |
| ---------- | ----------------------------- |
| widgetId   | Unique widget identifier      |
| type       | Widget type                   |
| labelKey   | Localization key              |
| binding    | Runtime data binding          |
| required   | Mandatory flag                |
| visible    | Visibility                    |
| enabled    | Enabled state                 |
| order      | Display order                 |
| properties | Widget-specific configuration |

---

# 4. Supported Widget Types

### Display

* label
* text
* badge
* divider
* icon

### Input

* textInput
* numberInput
* phone
* email
* password
* textArea

### Selection

* dropdown
* radio
* checkbox
* multiSelect
* switch

### Date & Time

* date
* time
* dateTime

### Verification

* camera
* attachment
* gps
* map
* signature

### Layout

* section
* card
* grid
* accordion

---

# 5. Camera Widget Example

```json
{
  "type": "camera",
  "documentType": "CandidatePhoto",
  "required": true,
  "watermark": true,
  "allowGallery": false
}
```

Business rules:

* Camera only
* Gallery disabled
* GPS mandatory
* Watermark mandatory

---

# 6. Attachment Widget Example

```json
{
  "type": "attachment",
  "documentType": "PAN_CARD",
  "multiple": false,
  "required": false
}
```

Document types are supplied by backend configuration.

---

# 7. Widget Events

Standard events:

* onLoad
* onFocus
* onBlur
* onChange
* onCapture
* onValidate
* onComplete

---

# 8. Data Binding

Widgets bind to the Runtime Context using property paths.

Example:

```text
assignment.candidate.name
attachments.candidatePhoto
verification.notes
runtime.gps.latitude
```

---

# 9. Extension Model

Unknown widget types shall be ignored gracefully or replaced with a configurable fallback widget.

New widgets are introduced through registration in the Widget Registry.

---

# 10. Guiding Philosophy

> Widgets are the smallest reusable building blocks of the FullScan Runtime. Every screen is composed of widgets, and every widget is defined through configuration.
