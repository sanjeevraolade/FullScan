# Geo Engine

GPS coordination, geofencing, and location validation.

## Responsibility

- Location acquisition
- Geofence validation (assignment location matching)
- Mock location detection
- Location accuracy assessment
- Continuous tracking during verification

## Rules

- GPS coordinates must be validated server-side against assignment location.
- Mock location must be detected and rejected.
- Location permission is mandatory — block usage if denied.
