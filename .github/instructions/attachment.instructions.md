---
applyTo:
  - "mobile/src/runtime/attachments/**"
  - "mobile/src/services/attachment/**"
  - "mobile/src/widgets/Camera/**"
  - "mobile/src/widgets/Attachment/**"
  - "mobile/src/models/attachment/**"
---

# Attachment Engine Instructions

These instructions apply to the Attachment Engine and all attachment-related implementations.

Refer to:

- docs/05-Runtime/07-Attachment-Engine.md
- docs/06-Contracts/06-Attachment-Schema.md
- docs/02-Business/07-Functional-Requirements.md

The Attachment Engine architecture is frozen.

---

# Attachment Philosophy

Attachments are **Business Evidence**.

They are not simply image files.

Every attachment represents evidence collected during a physical verification and must be traceable, secure, and independently synchronized.

Attachments are first-class business entities.

---

# Responsibilities

The Attachment Engine is responsible for:

- Attachment creation
- Camera capture
- Metadata collection
- Watermark generation
- Local persistence
- Upload state management
- Attachment lifecycle
- Runtime binding

The Attachment Engine is NOT responsible for:

- Synchronization
- Workflow execution
- Business validation
- UI navigation

---

# Attachment Types

Current release:

- Candidate Photo

Future releases may introduce:

- Aadhaar Front
- Aadhaar Back
- PAN Card
- Passport
- Driving License
- Residence Proof
- Employment Proof
- Other Supporting Documents

Never hardcode document types.

Document types must be configuration-driven.

---

# Camera Only

Attachments must always be captured using the device camera.

Gallery selection is prohibited.

Never provide:

- Gallery Picker
- File Picker
- Image Import

The application must always capture fresh evidence.

---

# Mandatory Metadata

Every attachment shall contain:

- Attachment ID
- Assignment ID
- Workflow ID
- User ID
- Device ID
- Document Type
- Capture Timestamp
- Latitude
- Longitude
- GPS Accuracy
- Upload Status
- Checksum

Metadata is mandatory.

---

# Watermark

Every captured image shall contain a permanent watermark.

Mandatory watermark fields:

- Latitude
- Longitude
- Capture Date
- Capture Time

Future configurable fields may include:

- Assignment Number
- Employer Name
- Executive ID
- Verification Type

Never upload images without watermark unless explicitly allowed by configuration.

---

# Attachment Lifecycle

Attachments progress through the following lifecycle.

Created

↓

Camera Opened

↓

Captured

↓

Metadata Generated

↓

Watermark Applied

↓

Validated

↓

Stored Locally

↓

Queued

↓

Uploading

↓

Uploaded

Failure states include:

- Capture Failed
- Validation Failed
- Upload Failed

The lifecycle must be persisted across application restarts.

---

# Runtime Integration

The Attachment Engine integrates with:

- Workflow Engine
- Validation Engine
- Synchronization Engine
- Configuration Engine
- Runtime Context

Avoid dependencies on UI components.

---

# Runtime Context

Attachment state belongs to the Runtime Context.

Widgets display attachment state.

Widgets do not own attachment state.

---

# Offline First

Offline support is mandatory.

Attachments shall:

- Persist locally
- Survive application restart
- Preserve metadata
- Preserve upload state
- Retry upload automatically

Never lose collected evidence.

---

# File Storage

Store attachments locally using application-controlled storage.

Avoid exposing file paths.

Do not rely on temporary cache folders.

Storage should survive application restarts.

---

# Image Processing

Image processing may include:

- Watermark generation
- Compression
- Rotation correction
- Thumbnail generation (Future)

Image processing should preserve evidence quality.

---

# Security

Attachments are sensitive business evidence.

Protect:

- Local storage
- Metadata
- GPS information

Future enhancements may include:

- Encryption at Rest
- Digital Signatures
- Evidence Integrity Verification

---

# Validation

Attachment validation is performed by the Validation Engine.

Examples:

- Required Attachment
- Watermark Present
- GPS Available
- Capture Successful
- Supported Format

The Attachment Engine should not implement business validation.

---

# Logging

Use LoggerService.

Log:

- Camera Opened
- Capture Started
- Capture Completed
- Metadata Generated
- Watermark Applied
- Attachment Stored
- Upload Queued

Never log image content or sensitive personal information.

---

# Error Handling

Recover gracefully from:

- Camera failure
- Permission denial
- Storage failure
- Watermark generation failure
- Metadata failure

Do not lose already captured evidence.

---

# Performance

Avoid:

- Duplicate image processing
- Repeated metadata generation
- Excessive memory allocation

Release image resources as soon as processing completes.

Support future large-document uploads efficiently.

---

# Testability

Every attachment component should be independently testable.

Test:

- Camera capture
- Metadata generation
- Watermark generation
- Offline persistence
- Upload state
- Error recovery

Mock camera and file system dependencies.

---

# Folder Structure

attachments/

    AttachmentEngine.ts

    AttachmentRepository.ts

    AttachmentStorage.ts

    AttachmentMetadata.ts

    WatermarkService.ts

    CameraService.ts

    AttachmentLifecycle.ts

    AttachmentMapper.ts

Each class should have a single responsibility.

---

# Before Writing Code

Always verify:

✓ Is this Business Evidence?

✓ Is camera-only enforced?

✓ Is mandatory metadata collected?

✓ Is watermark applied?

✓ Is offline storage implemented?

✓ Is upload delegated to the Synchronization Engine?

✓ Is validation delegated to the Validation Engine?

✓ Is the implementation independently testable?

If any answer is "No", redesign before implementation.

---

# Guiding Principle

Attachments are trusted business evidence.

The Attachment Engine shall ensure that every piece of evidence is securely captured, fully traceable, enriched with mandatory metadata, watermarked, stored reliably for offline operation, and prepared for synchronization without compromising integrity or user experience.

Never treat attachments as ordinary image files.