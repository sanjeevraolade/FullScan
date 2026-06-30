---
name: evidence-verification
description: "Implement server-side evidence integrity verification for FullScanField API. Use for: SHA-256 hash comparison, timestamp validation, file type checking, evidence immutability, and upload integrity checks."
---

# Evidence Verification (Server-Side)

## When to Use
- Verifying uploaded photo hash matches client-submitted hash
- Validating evidence timestamp against server time
- Checking file type and size constraints
- Ensuring evidence immutability after storage
- Building the evidence integrity chain

## Verification Chain

```
[Receive Upload] → [Check file type/size] → [Compute SHA-256 of received file]
                                                        ↓
                                              [Compare with submitted hash]
                                                        ↓ (mismatch = reject)
                                              [Validate timestamp skew]
                                                        ↓ (>5min = reject)
                                              [Validate geo-fence]
                                                        ↓
                                              [Store immutably + record hash in DB]
```

## Implementation

### 1. Hash verification
```typescript
import crypto from 'node:crypto';
import fs from 'node:fs';

function computeFileHash(filePath: string): string {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function verifyEvidenceHash(uploadedFilePath: string, submittedHash: string): void {
  const computedHash = computeFileHash(uploadedFilePath);

  if (computedHash !== submittedHash) {
    throw new AppError(
      422,
      'Evidence integrity check failed: photo hash does not match',
    );
  }
}
```

### 2. Timestamp validation
```typescript
const MAX_TIMESTAMP_SKEW_MS = 5 * 60 * 1000; // 5 minutes

function validateTimestamp(capturedAt: string): void {
  const captureTime = new Date(capturedAt).getTime();
  const serverTime = Date.now();
  const skew = Math.abs(serverTime - captureTime);

  if (skew > MAX_TIMESTAMP_SKEW_MS) {
    throw new AppError(
      422,
      `Evidence timestamp skew too large: ${Math.round(skew / 1000)}s ` +
      `(max allowed: ${MAX_TIMESTAMP_SKEW_MS / 1000}s)`,
    );
  }
}
```

### 3. File validation (multer + magic bytes)
```typescript
import multer from 'multer';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const upload = multer({
  dest: process.env.UPLOAD_DIR || './uploads',
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError(413, `File type not allowed: ${file.mimetype}`));
    }
  },
});
```

### 4. Full evidence verification service
```typescript
interface EvidenceUpload {
  file: Express.Multer.File;
  assignmentId: string;
  latitude: number;
  longitude: number;
  photoHash: string;
  capturedAt: string;
}

function verifyEvidence(upload: EvidenceUpload, assignment: Assignment): void {
  // 1. Verify hash integrity
  verifyEvidenceHash(upload.file.path, upload.photoHash);

  // 2. Validate timestamp
  validateTimestamp(upload.capturedAt);

  // 3. Validate geo-fence (uses geo-fence-validation skill)
  validateGeoFence(
    { latitude: upload.latitude, longitude: upload.longitude },
    { latitude: assignment.latitude, longitude: assignment.longitude },
  );
}
```

### 5. Evidence storage (immutable)
```sql
CREATE TABLE evidence (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL REFERENCES assignments(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  file_path TEXT NOT NULL,
  photo_hash TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  captured_at TEXT NOT NULL,
  verified_at TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now'))
  -- No updated_at: evidence is immutable once verified
);
```

## Key Rules
- ALWAYS re-hash the uploaded file server-side — never trust client hash alone
- REJECT if hash doesn't match (HTTP 422) — evidence was tampered
- REJECT if timestamp skew > 5 minutes — possible replay attack
- Evidence records are IMMUTABLE — no UPDATE allowed after creation
- Store the verified hash in the database for future audit queries
- File storage path must be outside web root — serve via authenticated endpoint only
- NEVER delete evidence files — soft-delete the record if needed
