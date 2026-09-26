# Attachment Schema

**Document ID:** ATT-SCH-001

**Document Version:** 1.0

**Status:** Approved

**Owner:** Solution Architect

---

# 1. Purpose

The Attachment Schema defines the metadata contract for all evidence collected during field verification.

Attachments are business evidence rather than simple files. Every attachment contains metadata required for validation, traceability, synchronization, and future AI processing.

---

# 2. Attachment Schema

```json
{
  "attachmentId": "uuid",
  "assignmentId": "A10234",
  "workflowId": "candidateVerification",
  "documentType": "CandidatePhoto",
  "fileName": "candidate.jpg",
  "localPath": "",
  "remoteUrl": "",
  "latitude": 17.4321,
  "longitude": 78.4421,
  "gpsAccuracy": 4.5,
  "captureDateTime": "2026-06-29T10:25:00Z",
  "deviceId": "device123",
  "userId": "user001",
  "watermarked": true,
  "uploaded": false,
  "checksum": "sha256"
}
```

---

# 3. Supported Document Types

Current:

* CandidatePhoto

Future:

* AadhaarFront
* AadhaarBack
* PANCard
* Passport
* DrivingLicense
* ResidenceProof
* EmploymentProof
* Other

Document types are configuration-driven.

---

# 4. Watermark Rules

Every captured image shall contain a permanent watermark.

Mandatory watermark fields:

* Latitude
* Longitude
* Capture Date
* Capture Time

Future configurable fields:

* Assignment Number
* Executive ID
* Employer Name
* Verification Type

---

# 5. Attachment States

```text
Created
 ↓
Captured
 ↓
Validated
 ↓
Queued
 ↓
Uploading
 ↓
Uploaded
```

Failure states:

* ValidationFailed
* UploadFailed
* Deleted

---

# 6. Offline Behaviour

Attachments shall:

* Persist locally.
* Survive application restart.
* Retain metadata.
* Retry upload automatically.
* Preserve upload status.

---

# 7. Guiding Philosophy

> Every attachment is trusted verification evidence. The schema guarantees that every image is traceable, watermarked, and independently synchronized throughout its lifecycle.
