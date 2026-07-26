---
name: fullscan-synchronization-engine
description: Load when implementing upload queues, retry logic, background sync, or any code that sends locally-collected business data to the backend. Load before writing an upload call anywhere outside the Synchronization Engine — direct uploads from UI/widgets are a hard architecture violation here.
---

# Synchronization Engine

Applies to `src/runtime/synchronization/**` and queue services. Frozen architecture.

## Philosophy

The Synchronization Engine is the **only** component allowed to upload business data to the backend. No UI component, widget, screen, or other Runtime Engine may upload directly.

## Responsibilities

Upload queue, retry logic, queue scheduling, conflict detection, upload state, background synchronization, recovery after app restart, network awareness. **Not** responsible for validation, workflow execution, UI rendering, or attachment creation.

## Flow — never bypass the queue

```
Business Workflow → Runtime Context → Attachment Engine → Synchronization Queue → Synchronization Engine → Backend REST APIs
```

## Queue item shape

Queue ID, Assignment ID, Workflow ID, Entity Type, Entity Identifier, Payload Reference, Retry Count, Status, Created Time, Last Attempt Time.

## Queue states

`Pending → Ready → Uploading → Uploaded`, with failure paths `Retry / Failed / Cancelled`. The queue must survive an app restart.

## Retry policy

Exponential backoff (attempt 1 → 2 → 3 → manual review once max retries are exceeded), with a configurable retry count.

## Network awareness

React automatically to internet available/lost, app resume, and app startup — avoid unnecessary polling.

## Ordering & idempotency

Respect dependency order (e.g. assignment updates → attachments → verification results → workflow completion). Uploads should be idempotent where the backend supports it — a retried upload must not create duplicate business records.

## Conflict resolution

Detect and report conflicts; strategy (retry / merge / server-wins / client-wins) should be configuration-driven where possible.

## Security

HTTPS only, validate server responses, protect evidence in transit. Architecture should support future payload encryption / digital signatures without a redesign.

## Error handling

Recover from network failure, timeout, server error, auth failure, partial upload — never silently discard business evidence.

## Logging

Log queue created / upload started / upload completed / retry scheduled / upload failed / queue cleared via `LoggerService`. Never log sensitive payload data.

## Folder pattern

```
synchronization/
  SynchronizationEngine.ts
  SynchronizationQueue.ts
  SynchronizationScheduler.ts
  SynchronizationWorker.ts
  RetryPolicy.ts
  QueueRepository.ts
  UploadManager.ts
```

## Before writing sync code, verify

Does the upload go through the Synchronization Engine (not directly from UI)? Is Offline First preserved — data persisted locally before any upload attempt? Is retry with backoff implemented? Does the queue survive app restart? Is ordering maintained where dependencies exist? If any answer is "no," redesign first.
