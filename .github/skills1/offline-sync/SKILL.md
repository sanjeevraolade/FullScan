---
name: offline-sync
description: "Implement offline-first sync queue patterns for FullScanField mobile. Use for: queuing API calls offline, syncing evidence uploads, conflict resolution, retry logic, connectivity detection, and SQLite sync queue operations."
---

# Offline Sync Queue

## When to Use
- Implementing offline evidence submission
- Building sync queue for pending uploads
- Adding connectivity detection and auto-retry
- Handling sync conflicts or failures
- Displaying sync status to user

## Architecture

```
[Evidence Capture] → [Local SQLite Queue] → [Connectivity Check] → [API Upload] → [Mark Synced]
                                                     ↓ (offline)
                                              [Retry on reconnect]
```

## Sync Queue Schema

```sql
CREATE TABLE sync_queue (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,          -- 'evidence_upload' | 'verification_submit' | 'status_update'
  payload TEXT NOT NULL,       -- JSON serialized request body
  file_path TEXT,              -- Local file URI for photo uploads
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | syncing | synced | failed
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  error_message TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  synced_at TEXT
);
```

## Implementation Steps

### 1. Queue an operation (when offline or always-queue strategy)
```typescript
interface QueueItem {
  id: string;
  type: 'evidence_upload' | 'verification_submit' | 'status_update';
  payload: Record<string, unknown>;
  filePath?: string;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  retryCount: number;
  createdAt: string;
}
```

### 2. Connectivity monitoring
- Use `@react-native-community/netinfo` to detect online/offline
- Listen for connectivity changes
- Trigger sync when transitioning offline → online

### 3. Sync processor (FIFO order)
- Process queue items oldest-first
- Set status to `syncing` before attempt
- On success: mark `synced`, record `synced_at`
- On failure: increment `retry_count`, set `failed` if max retries exceeded
- On network error: revert to `pending`, wait for next connectivity event

### 4. Conflict resolution
- Server returns 409 if evidence already submitted → mark as synced (idempotent)
- Server returns 422 if assignment already completed → mark as failed, notify user
- Always include `idempotency_key` (the queue item `id`) in upload requests

## Key Rules
- NEVER block the user waiting for sync — UI is always optimistic
- ALWAYS persist queue to SQLite before attempting network call
- ALWAYS process queue in FIFO order (created_at ASC)
- NEVER delete failed items — keep for audit/retry
- Show sync status badge on screens: pending count + last sync time
