---
name: evidence-capture
description: "Implement tamper-proof evidence capture for FullScanField mobile. Use for: photo capture with watermark, GPS coordinate embedding, SHA-256 hashing, timestamp validation, camera permissions, and evidence metadata assembly."
---

# Evidence Capture

## When to Use
- Implementing photo capture with GPS watermark
- Adding SHA-256 hash computation for tamper-proofing
- Building evidence metadata assembly
- Handling camera/GPS permissions
- Validating geo-fence before capture

## Evidence Capture Flow

```
[Check GPS Active] → [Verify Geo-fence] → [Open Camera] → [Capture Photo]
        ↓                                                        ↓
  [Block if denied]                                    [Apply Watermark]
                                                             ↓
                                                    [Compute SHA-256 Hash]
                                                             ↓
                                                    [Store in SQLite + Queue]
```

## Evidence Metadata Structure

```typescript
interface EvidenceMetadata {
  id: string;                    // UUID generated on device
  assignmentId: string;
  photoUri: string;              // Local file URI
  photoHash: string;             // SHA-256 hex string
  latitude: number;
  longitude: number;
  accuracy: number;              // GPS accuracy in meters
  capturedAt: string;            // ISO 8601 from device
  deviceId: string;              // Unique device identifier
  watermarkApplied: boolean;
}
```

## Implementation Steps

### 1. Pre-capture validation
```typescript
// MUST verify BEFORE opening camera:
// 1. Location permission granted
// 2. GPS is active and has fix
// 3. Current location is within geo-fence of assignment
// 4. Camera permission granted
```

### 2. Geo-fence check (client-side pre-check)
```typescript
import { getDistance } from 'geolib';

function isWithinGeoFence(
  currentLat: number,
  currentLng: number,
  assignmentLat: number,
  assignmentLng: number,
  radiusMeters: number = 200,
): boolean {
  const distance = getDistance(
    { latitude: currentLat, longitude: currentLng },
    { latitude: assignmentLat, longitude: assignmentLng },
  );
  return distance <= radiusMeters;
}
```

### 3. Photo capture with watermark
- Use `react-native-vision-camera` for capture
- Use `@shopify/react-native-skia` to overlay watermark containing:
  - GPS coordinates (lat, lng)
  - Timestamp (formatted: `YYYY-MM-DD HH:mm:ss`)
  - Case ID / Assignment ID
  - Accuracy indicator
- Watermark must be burned into the image file (not a separate overlay)

### 4. Hash computation (immediately after capture)
```typescript
import QuickCrypto from 'react-native-quick-crypto';
import RNFS from 'react-native-fs';

async function computePhotoHash(fileUri: string): Promise<string> {
  const fileBuffer = await RNFS.readFile(fileUri, 'base64');
  const hash = QuickCrypto.createHash('sha256');
  hash.update(Buffer.from(fileBuffer, 'base64'));
  return hash.digest('hex');
}
```

### 5. Store locally + queue for upload
- Save metadata to local SQLite `evidence_drafts` table
- Add upload job to `sync_queue`
- Display in UI immediately (optimistic)

## Key Rules
- NEVER allow evidence capture without GPS fix
- NEVER allow capture outside geo-fence (show error with distance)
- ALWAYS hash the photo IMMEDIATELY after capture, before any other operation
- ALWAYS embed watermark into the image pixel data (not metadata-only)
- NEVER modify the photo after hashing — hash must match what gets uploaded
- GPS coordinates in watermark must match the metadata sent to server
- Store the hash locally; server will re-hash and compare
