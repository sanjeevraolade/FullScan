---
applyTo:
  - "mobile/src/runtime/synchronization/**"
  - "mobile/src/services/synchronization/**"
  - "mobile/src/services/queue/**"
---

# Synchronization Engine Instructions

These instructions apply to the Synchronization Engine and all synchronization-related implementations.

Refer to:

- docs/05-Runtime/08-Synchronization-Engine.md
- docs/06-Contracts/09-API-Contracts.md
- docs/02-Business/07-Functional-Requirements.md

The Synchronization Engine architecture is frozen.

---

# Synchronization Philosophy

Synchronization is responsible for transferring locally collected business evidence to the backend.

The Synchronization Engine is the only component allowed to communicate with backend synchronization APIs for business data uploads.

No UI component, Widget, Screen, or Runtime Engine should upload business data directly.

---

# Responsibilities

The Synchronization Engine is responsible for:

- Upload Queue
- Retry Logic
- Queue Scheduling
- Conflict Detection
- Upload State
- Background Synchronization
- Recovery after Application Restart
- Network Awareness

It is NOT responsible for:

- Validation
- Workflow Execution
- UI Rendering
- Attachment Creation

---

# Offline First

Offline operation is mandatory.

The application must remain fully usable without internet connectivity.

Business evidence must always be stored locally before synchronization.

Synchronization occurs only when connectivity is available.

---

# Synchronization Flow

Business Workflow

↓

Runtime Context

↓

Attachment Engine

↓

Synchronization Queue

↓

Synchronization Engine

↓

Backend REST APIs

Never bypass the Synchronization Queue.

---

# Queue Management

The queue is the single source of pending uploads.

Each queue item should contain:

- Queue ID
- Assignment ID
- Workflow ID
- Entity Type
- Entity Identifier
- Payload Reference
- Retry Count
- Status
- Created Time
- Last Attempt Time

---

# Queue States

Every synchronization item shall support:

Pending

↓

Ready

↓

Uploading

↓

Uploaded

Failure states:

Retry

Failed

Cancelled

The queue must survive application restart.

---

# Retry Policy

The Synchronization Engine shall implement retry with exponential backoff.

Examples:

Attempt 1

↓

Attempt 2

↓

Attempt 3

↓

Manual Review (if maximum retries exceeded)

Retry counts should be configurable.

---

# Network Awareness

Synchronization should automatically respond to:

- Internet Available
- Internet Lost
- Application Resume
- Application Startup

Avoid unnecessary polling.

---

# Ordering

Uploads shall preserve business consistency.

Recommended order:

1. Assignment Updates
2. Attachments
3. Verification Results
4. Workflow Completion

Dependencies must be respected.

---

# Idempotency

Synchronization requests should be idempotent whenever supported by the backend.

Repeated uploads should not create duplicate business records.

---

# Error Handling

Recover gracefully from:

- Network Failure
- Timeout
- Server Error
- Authentication Failure
- Partial Upload

Never discard business evidence automatically.

---

# Conflict Resolution

Conflicts should be detected and reported.

Possible strategies:

- Retry
- Merge
- Server Wins
- Client Wins

The chosen strategy should be configuration-driven whenever possible.

---

# Logging

Use LoggerService.

Log:

- Queue Created
- Upload Started
- Upload Completed
- Retry Scheduled
- Upload Failed
- Queue Cleared

Never log sensitive payload data.

---

# Performance

Batch uploads where appropriate.

Avoid duplicate uploads.

Avoid unnecessary network calls.

Support future large attachment uploads efficiently.

---

# Security

Synchronize only through HTTPS.

Validate server responses.

Protect business evidence during transmission.

Future enhancements:

- Payload Encryption
- Digital Signatures
- Integrity Verification

---

# Testability

Test:

- Offline Queue
- Retry Logic
- Background Synchronization
- Conflict Handling
- Network Changes
- Application Restart

Use mock API responses.

---

# Folder Structure

synchronization/

    SynchronizationEngine.ts

    SynchronizationQueue.ts

    SynchronizationScheduler.ts

    SynchronizationWorker.ts

    RetryPolicy.ts

    QueueRepository.ts

    UploadManager.ts

Each class should have a single responsibility.

---

# Before Writing Code

Always verify:

✓ Is the upload going through the Synchronization Engine?

✓ Is Offline First preserved?

✓ Is retry implemented?

✓ Is queue persistence supported?

✓ Is ordering maintained?

✓ Is logging implemented?

✓ Is the implementation independently testable?

If any answer is "No", redesign before implementation.

---

# Guiding Principle

The Synchronization Engine guarantees reliable, secure, and recoverable delivery of business evidence.

No business data should ever be lost because of connectivity issues.