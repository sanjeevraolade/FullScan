# Attachment Engine

**Document ID:** ATT-001

**Document Version:** 1.0

**Status:** Approved

**Owner:** Solution Architect

**Reviewed By:** Technical Architect

**Last Updated:** 29-Jun-2026

---

# 1. Purpose

The Attachment Engine manages the complete lifecycle of verification evidence collected during a field verification.

It provides a centralized platform service responsible for capturing, processing, storing, validating, watermarking, tracking, and synchronizing attachments.

The Attachment Engine abstracts attachment management from screens, widgets, and business workflows, ensuring that all evidence is handled consistently across the application.

---

# 2. Scope

The Attachment Engine manages:

* Camera Capture
* Attachment Metadata
* Watermark Generation
* Image Processing
* Local Storage
* Upload Status
* Attachment Validation
* Attachment Lifecycle
* Offline Queue Integration
* Synchronization Integration

---

# 3. References

| Document                    | Purpose               |
| --------------------------- | --------------------- |
| Verification Runtime Engine | Runtime Orchestration |
| Dynamic Form Engine         | Attachment Widget     |
| Validation Engine           | Attachment Validation |
| Synchronization Engine      | Upload Processing     |

---

# 4. Attachment Philosophy

Attachments are **business evidence**, not merely image files.

Every attachment is associated with:

* Assignment
* Workflow
* Document Type
* Location
* Time
* Device
* User

The Attachment Engine guarantees that every attachment remains traceable throughout its lifecycle.

---

# 5. Attachment Lifecycle

```text
Capture Request
      │
      ▼
Open Camera
      │
      ▼
Capture Image
      │
      ▼
Capture GPS Metadata
      │
      ▼
Generate Watermark
      │
      ▼
Persist Attachment
      │
      ▼
Validate
      │
      ▼
Queue Upload
      │
      ▼
Synchronize
      │
      ▼
Completed
```

---

# 6. Attachment Model

Every attachment contains:

* Attachment ID
* Assignment ID
* Workflow ID
* Document Type
* Local File Path
* Remote URL
* Latitude
* Longitude
* GPS Accuracy
* Altitude
* Capture Date
* Capture Time
* Device ID
* User ID
* Upload Status
* Retry Count
* Checksum
* File Size
* MIME Type

The data model shall support future metadata without redesign.

---

# 7. Supported Attachment Types

Current:

* Candidate Photo

Future:

* Aadhaar Front
* Aadhaar Back
* PAN Card
* Passport
* Driving License
* Residence Proof
* Employment Proof
* Customer-specific Documents

The supported document types are configuration driven.

---

# 8. Camera Integration

The Attachment Engine shall:

* Launch device camera.
* Disable gallery selection.
* Capture only live photographs.
* Associate capture with the active assignment.
* Return attachment metadata to the Runtime Engine.

---

# 9. GPS Integration

Immediately after capture, the engine records:

* Latitude
* Longitude
* Accuracy
* Altitude
* Timestamp

If GPS validation fails, the attachment shall not be accepted unless explicitly permitted by business rules.

---

# 10. Watermark Generation

Before persistence, the engine shall generate a permanent watermark.

Minimum watermark:

* Latitude
* Longitude
* Capture Date
* Capture Time

Future configurable fields:

* Assignment Number
* Employer
* Executive ID
* Verification Type

The original unwatermarked image shall not be uploaded.

---

# 11. Image Processing

The engine may perform:

* Resize
* Compression
* Rotation correction
* Metadata injection
* Watermark rendering
* Thumbnail generation (future)

Processing rules shall be configurable.

---

# 12. Attachment Validation

Before storage:

* Image exists.
* Watermark generated.
* GPS available.
* Assignment mapped.
* Document type valid.
* File size within limits.

Validation is delegated to the Validation Engine.

---

# 13. Storage Strategy

Attachments are stored locally with metadata.

Only references are exposed to the Runtime Context.

The Attachment Engine manages file paths internally.

---

# 14. Upload States

Each attachment progresses through:

```text
Created
   │
   ▼
Validated
   │
   ▼
Queued
   │
   ▼
Uploading
   │
   ▼
Uploaded
```

Exceptional states:

* Failed
* Cancelled
* Deleted

---

# 15. Offline Behaviour

Attachments shall:

* Capture offline.
* Persist locally.
* Survive application restart.
* Retry automatically.
* Synchronize when connectivity returns.

---

# 16. Security

The Attachment Engine shall:

* Prevent gallery uploads.
* Preserve attachment integrity.
* Maintain audit information.
* Protect local storage.
* Verify attachment ownership.

Future releases may encrypt attachments at rest.

---

# 17. Extension Points

Future capabilities include:

* OCR Processing
* Face Matching
* Image Quality Assessment
* Duplicate Detection
* Video Capture
* Audio Attachments
* Digital Signatures

---

# 18. Design Principles

* Evidence before media.
* Watermark before storage.
* Offline before upload.
* Metadata first.
* Immutable capture.
* Configuration driven.

---

# 19. Guiding Philosophy

> Every attachment is legally significant business evidence.

> The Attachment Engine guarantees that evidence is authentic, traceable, watermarked, securely managed, and reliably synchronized throughout its lifecycle.
