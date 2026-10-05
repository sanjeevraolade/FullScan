# API Reference

Base URL: `http://localhost:3000/api/v1`

## Response Format

All endpoints return:
```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "meta": { "page": 1, "limit": 20, "total": 100 }
}
```

## UI Configuration (Server-Driven UI)

### GET `/ui-config`
Download all screen configurations. Called by mobile app after successful login. **Auth required.**

Response:
```json
{
  "success": true,
  "data": [
    {
      "screenId": "assignment-list",
      "version": 1,
      "title": "Assignment List",
      "components": [
        {
          "type": "card",
          "fields": [
            { "key": "candidateName", "label": "Candidate Name", "type": "text", "visible": true, "order": 1 },
            { "key": "address", "label": "Address", "type": "text", "visible": true, "order": 2 },
            { "key": "status", "label": "Status", "type": "status", "visible": true, "order": 3 },
            { "key": "assignedDate", "label": "Assigned Date", "type": "date", "visible": true, "order": 4 }
          ]
        }
      ],
      "updatedAt": "2026-06-27T10:00:00"
    }
  ]
}
```

### GET `/ui-config/:screenId`
Download config for a specific screen. **Auth required.**

### PUT `/ui-config/:screenId`
Update screen configuration. **Auth required. Role: admin.**

Request body:
```json
{
  "title": "Assignment List",
  "components": [
    {
      "type": "card",
      "fields": [
        { "key": "candidateName", "label": "Candidate Name", "type": "text", "visible": true, "order": 1 },
        { "key": "address", "label": "Address", "type": "text", "visible": true, "order": 2 },
        { "key": "status", "label": "Status", "type": "status", "visible": true, "order": 3 },
        { "key": "assignedDate", "label": "Assigned Date", "type": "date", "visible": true, "order": 4 },
        { "key": "priority", "label": "Priority", "type": "badge", "visible": true, "order": 5 }
      ]
    }
  ]
}
```

Increments version automatically. Mobile picks up changes on next login.

---

## Authentication

### POST `/auth/login`
Login with email and password. Returns JWT access + refresh tokens.

### POST `/auth/refresh`
Exchange refresh token for new access token.

### POST `/auth/logout`
Revoke the bearer's mobile session on the server. **Auth required.** No body → `{ signedOut: true }`.
The token is then refused on every mobile route; device binding is unchanged. Contract:
[`docs/api-contracts/mobile-logout.md`](../../docs/api-contracts/mobile-logout.md).

---

## Users

### GET `/users/me`
Get current user profile. **Auth required.**

### PUT `/users/me`
Update current user profile. **Auth required.**

---

## Assignments

### GET `/assignments`
List assignments for current user (filtered by role). **Auth required.** Supports pagination.

### GET `/assignments/:id`
Get assignment details including candidate location. **Auth required.**

### POST `/assignments`
Create new assignment. **Auth required. Role: admin, employer.**

### PUT `/assignments/:id/status`
Update assignment status (e.g., `in_progress`, `completed`). **Auth required.**

---

## Evidence

### POST `/evidence`
Upload verification evidence. **Auth required. Role: field_executive.**

Multipart form-data:
- `photo` (file): JPEG/PNG, max 10MB
- `assignment_id` (string): UUID of the assignment
- `latitude` (number): GPS latitude at capture
- `longitude` (number): GPS longitude at capture
- `photo_hash` (string): SHA-256 hash of the photo file
- `captured_at` (string): ISO 8601 timestamp from device

Server validates:
- Photo hash matches uploaded file
- GPS coordinates within geo-fence of assignment location
- Timestamp within 5 minutes of server time

### GET `/evidence/:assignmentId`
List evidence for an assignment. **Auth required.**

---

## Verifications

### GET `/verifications`
List verification reports. **Auth required.** Supports pagination and filters.

### GET `/verifications/:id`
Get verification report with evidence. **Auth required.**

### POST `/verifications`
Submit completed verification report. **Auth required. Role: field_executive.**

---

## Error Codes

| Code | Meaning |
|------|---------|
| 400 | Validation error — check `error` field for details |
| 401 | Unauthorized — missing or invalid token |
| 403 | Forbidden — insufficient role |
| 404 | Resource not found |
| 409 | Conflict — duplicate or state violation |
| 413 | File too large (>10MB) |
| 422 | Evidence validation failed (hash mismatch, geo-fence violation, timestamp skew) |
| 429 | Rate limited — too many requests |
| 500 | Internal server error |
