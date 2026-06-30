---
name: geo-fence-validation
description: "Implement server-side geo-fence validation for FullScanField API. Use for: validating GPS coordinates against assignment location, configurable radius checks, distance calculation, geo-fence violation handling, and audit logging of location discrepancies."
---

# Geo-fence Validation

## When to Use
- Validating evidence GPS against assignment location on server
- Implementing configurable geo-fence radius
- Handling geo-fence violations (reject or flag)
- Logging location discrepancies for audit trail
- Calculating distance between coordinates

## Why Server-Side
Client GPS can be spoofed. Server-side validation is the authoritative check. Client-side pre-checks are UX only — never trust them for security.

## Architecture

```
[Evidence Upload] → [Extract GPS from request] → [Load assignment location from DB]
                                                          ↓
                                                 [Calculate distance]
                                                          ↓
                                          [Distance ≤ radius?] → YES → [Accept]
                                                          ↓ NO
                                                 [Reject with 422 + log violation]
```

## Implementation

### Distance calculation using geolib
```typescript
import { getDistance } from 'geolib';

interface GeoPoint {
  latitude: number;
  longitude: number;
}

interface GeoFenceResult {
  isWithin: boolean;
  distanceMeters: number;
  radiusMeters: number;
}

function validateGeoFence(
  evidenceLocation: GeoPoint,
  assignmentLocation: GeoPoint,
  radiusMeters?: number,
): GeoFenceResult {
  const radius = radiusMeters ?? parseInt(process.env.GEO_FENCE_RADIUS_METERS || '200', 10);
  const distance = getDistance(evidenceLocation, assignmentLocation);

  return {
    isWithin: distance <= radius,
    distanceMeters: distance,
    radiusMeters: radius,
  };
}
```

### Validation in evidence service
```typescript
function validateEvidenceLocation(
  submittedLat: number,
  submittedLng: number,
  assignment: Assignment,
): void {
  const result = validateGeoFence(
    { latitude: submittedLat, longitude: submittedLng },
    { latitude: assignment.latitude, longitude: assignment.longitude },
    assignment.geoFenceRadius,  // Per-assignment override or default
  );

  if (!result.isWithin) {
    // Log violation for audit
    logGeoFenceViolation({
      assignmentId: assignment.id,
      submittedLocation: { lat: submittedLat, lng: submittedLng },
      expectedLocation: { lat: assignment.latitude, lng: assignment.longitude },
      distanceMeters: result.distanceMeters,
      radiusMeters: result.radiusMeters,
    });

    throw new AppError(
      422,
      `Evidence location is ${result.distanceMeters}m from assignment ` +
      `(allowed: ${result.radiusMeters}m)`,
    );
  }
}
```

### Geo-fence violations table (audit)
```sql
CREATE TABLE geo_fence_violations (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL REFERENCES assignments(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  submitted_lat REAL NOT NULL,
  submitted_lng REAL NOT NULL,
  expected_lat REAL NOT NULL,
  expected_lng REAL NOT NULL,
  distance_meters REAL NOT NULL,
  radius_meters REAL NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
```

## Key Rules
- ALWAYS validate geo-fence server-side — client checks are for UX only
- NEVER trust client-submitted GPS without server validation
- Use HTTP 422 for geo-fence violations (not 400 — it's semantically valid but unprocessable)
- Log ALL violations for audit trail (even if you later add a manual override)
- Allow per-assignment radius override (some locations need tighter/looser fence)
- Default radius: 200 meters (configurable via `GEO_FENCE_RADIUS_METERS` env var)
