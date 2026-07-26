---
name: fullscan-attachment-engine
description: Load when implementing camera capture, evidence/document handling, watermarking, or attachment metadata/lifecycle. Load before writing any code that captures or stores a photo/document — attachments are business evidence, not plain image files.
---

# Attachment Engine

Applies to `src/runtime/attachments/**`, camera/attachment widgets, and attachment models. Frozen architecture.

## Philosophy

Attachments are **business evidence**, not image files. Every attachment must be traceable, secure, and independently synchronizable. Never treat them as ordinary files.

## Responsibilities

Attachment creation, camera capture, metadata collection, watermark generation, local persistence, upload state management, lifecycle, runtime binding. **Not** responsible for synchronization (see `fullscan-synchronization-engine`), workflow execution, business validation, or UI navigation.

## Attachment types

Current release: Candidate Photo. Planned: Aadhaar Front/Back, PAN, Passport, Driving License, Residence Proof, Employment Proof, other supporting documents. **Never hardcode document types** — they're configuration-driven so new ones don't require an app release.

## Camera only — no exceptions

Gallery picker, file picker, and image import are prohibited for business evidence. Every capture must be fresh, live camera output.

## Mandatory metadata (every attachment)

Attachment ID, Assignment ID, Workflow ID, User ID, Device ID, Document Type, Capture Timestamp, Latitude, Longitude, GPS Accuracy, Upload Status, Checksum.

## Watermark — mandatory

Minimum fields burned into the image: **Latitude, Longitude, Capture Date, Capture Time**. Future configurable additions: Assignment Number, Employer Name, Executive ID, Verification Type. Never upload an image without a watermark unless configuration explicitly allows it.

## Lifecycle (must persist across app restarts)

```
Created → Camera Opened → Captured → Metadata Generated → Watermark Applied
  → Validated → Stored Locally → Queued → Uploading → Uploaded
```
Failure states: Capture Failed, Validation Failed, Upload Failed.

## Runtime integration

Talks to Workflow Engine, Validation Engine, Synchronization Engine, Configuration Engine, Runtime Context — never depends on UI components directly. Attachment state lives in Runtime Context; widgets display it, they don't own it.

## Offline First

Attachments persist locally, survive app restart, preserve metadata and upload state, and retry upload automatically. Never lose collected evidence — this is a hard requirement, not a nice-to-have.

## Storage

Use application-controlled local storage that survives restarts — don't rely on temporary cache folders, and don't expose raw file paths outside the engine.

## Security

Protect local storage, metadata, and GPS info. Architecture should support future encryption-at-rest, digital signatures, and integrity verification without a redesign.

## Logging

Log camera opened / capture started / capture completed / metadata generated / watermark applied / attachment stored / upload queued via `LoggerService`. Never log image content or personal information.

## Error handling

Recover gracefully from camera failure, permission denial, storage failure, watermark/metadata failure — never lose evidence that was already captured.

## Folder pattern

```
attachments/
  AttachmentEngine.ts
  AttachmentRepository.ts
  AttachmentStorage.ts
  AttachmentMetadata.ts
  WatermarkService.ts
  CameraService.ts
  AttachmentLifecycle.ts
  AttachmentMapper.ts
```

## Before writing attachment code, verify

Is this treated as business evidence, not a plain file? Is camera-only enforced? Is mandatory metadata collected and the watermark applied? Is offline storage implemented? Is upload delegated to the Synchronization Engine and validation to the Validation Engine (not reimplemented here)? If any answer is "no," redesign first.
