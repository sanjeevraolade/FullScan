---
applyTo: "server/**"
---

# Server API Instructions

Node.js + Express REST API for verification case management and evidence storage.

## Key Constraints
- Validate ALL inputs with zod or express-validator — never trust client data.
- GPS coordinates submitted with evidence must be validated against assignment geo-fence server-side.
- File uploads (photos) must be validated for type (image/*), size (<10MB), and integrity (hash check).
- JWT auth middleware on all routes except `/api/v1/auth/login`.
- Role-based access: `field_executive`, `admin`, `employer` — check role in middleware.

## Structure
```
server/src/
  controllers/   # Route handlers, thin — delegate to services
  services/      # Business logic
  middleware/    # Auth, validation, error handler, file upload
  routes/        # Express Router definitions
  models/        # Database schemas/types
  db/            # SQLite connection, migrations
  utils/         # Helpers (geo-fence, hash, token)
  types/         # Shared TypeScript interfaces
```

## Screen Configuration (Server-Driven UI)
- Server provides JSON configuration for each mobile screen
- Endpoint: `GET /api/v1/ui-config/:screenId` — returns field layout for dynamic rendering
- Admin can configure which fields appear on cards/lists (e.g., add a 4th field to AssignmentCard)
- Config stored in `ui_configs` table with versioning
- Mobile app downloads all configs after successful login via `GET /api/v1/ui-config`
- Config changes take effect on next login (no app update required)

## API Design
- Prefix: `/api/v1/`
- Resources: `assignments`, `verifications`, `evidence`, `users`, `auth`
- Standard responses: `{ success: boolean, data?: T, error?: string }`
- Pagination: `?page=1&limit=20`

## Testing
- Unit test services with Jest or Vitest
- Integration test routes with supertest
- Seed test data in a separate SQLite file
