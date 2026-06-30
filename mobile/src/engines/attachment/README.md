# Attachment Engine

Owns the lifecycle of verification evidence (photos, documents, signatures).

## Responsibility

- Evidence capture coordination
- Metadata embedding (GPS, timestamp, device info)
- Watermark generation
- Upload status tracking
- Local storage management
- Hash computation for tamper-proofing

## Rules

- All attachments must include embedded GPS coordinates and timestamp.
- Captures must be tamper-proof (hash + metadata).
- Attachments are stored locally before synchronization.
- UI components must never upload data directly — always through this engine.
