# Validation Schema

**Document ID:** VAL-001

**Document Version:** 1.0

**Status:** Approved

**Owner:** Solution Architect

**Last Updated:** 29-Jun-2026

---

# 1. Purpose

The Validation Schema defines the metadata contract for runtime validation rules.

Validation definitions are interpreted by the Validation Engine and applied consistently across widgets, forms, workflows, and attachments.

---

# 2. Validation Schema

```json
{
  "validationId": "candidatePhotoRequired",
  "type": "required",
  "target": "attachments.candidatePhoto",
  "messageKey": "validation.photo.required",
  "severity": "error",
  "parameters": {}
}
```

---

# 3. Common Properties

| Property     | Description                   |
| ------------ | ----------------------------- |
| validationId | Unique identifier             |
| type         | Validation type               |
| target       | Runtime binding               |
| messageKey   | Localization key              |
| severity     | error / warning / info        |
| parameters   | Validator-specific properties |

---

# 4. Supported Validation Types

### Field Validation

* required
* minLength
* maxLength
* regex
* min
* max

### Location Validation

* gpsAvailable
* gpsAccuracy
* geoFence
* mockLocation

### Attachment Validation

* attachmentRequired
* watermarkRequired
* imageSize
* imageFormat

### Security Validation

* authenticated
* registeredDevice
* biometricVerified

### Workflow Validation

* previousStepCompleted
* mandatorySectionCompleted
* workflowState

---

# 5. Example Rules

### Mandatory Photo

```json
{
  "type": "attachmentRequired",
  "target": "attachments.candidatePhoto"
}
```

### GPS Accuracy

```json
{
  "type": "gpsAccuracy",
  "parameters": {
    "maximumMeters": 20
  }
}
```

### Mock Location

```json
{
  "type": "mockLocation",
  "parameters": {
    "allow": false
  }
}
```

---

# 6. Execution Order

Validation executes in the following sequence:

```text
Field
   ↓
Section
   ↓
Form
   ↓
Workflow
   ↓
Submission
```

Execution stops immediately when a blocking validation fails.

---

# 7. Validation Results

Every validator returns:

```json
{
  "success": false,
  "code": "GPS_ACCURACY",
  "messageKey": "validation.gps.accuracy",
  "severity": "error"
}
```

The Localization Engine resolves `messageKey` into the user's selected language.

---

# 8. Offline Behaviour

All validation rules defined by this schema shall execute locally without requiring network connectivity, unless explicitly marked as a server-side validation.

---

# 9. Extensibility

The schema is designed to support future validators, including:

* OCR Validation
* Face Match
* Duplicate Image Detection
* AI Quality Score
* Fraud Detection
* Customer-specific Validators

New validation types may be added without changing existing contracts.

---

# 10. Guiding Philosophy

> Validation rules are configuration, not application code. The Validation Schema allows business policies to evolve independently while ensuring consistent enforcement across every dynamically generated screen and workflow.
