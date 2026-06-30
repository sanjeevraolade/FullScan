---
name: ui-config-management
description: "Manage server-driven UI configurations for FullScanField API. Use for: CRUD operations on screen configs, field customization by admins, config versioning, bulk config download endpoint, and JSON schema validation."
---

# UI Config Management (Server-Side)

## When to Use
- Creating or updating screen configurations
- Adding/removing fields from cards, lists, or forms
- Implementing the bulk config download endpoint (post-login)
- Validating config JSON structure
- Managing config versions

## Architecture

```
[Admin Dashboard / API] → [PUT /api/v1/ui-config/:screenId] → [Validate JSON] → [Increment Version] → [Store]
                                                                                                            ↓
[Mobile App Login] → [GET /api/v1/ui-config] → [Return all configs] → [Mobile caches in SQLite]
```

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/v1/ui-config` | All roles | Download all screen configs (post-login) |
| `GET` | `/api/v1/ui-config/:screenId` | All roles | Download single screen config |
| `PUT` | `/api/v1/ui-config/:screenId` | Admin only | Update screen config (auto-increments version) |

## Config Schema

```typescript
interface ScreenConfig {
  screenId: string;       // Unique screen identifier
  version: number;        // Auto-incremented on each update
  title: string;          // Human-readable screen title
  components: ComponentConfig[];
  updatedAt: string;
}

interface ComponentConfig {
  type: 'card' | 'list' | 'form' | 'detail' | 'header';
  fields: FieldConfig[];
}

interface FieldConfig {
  key: string;            // Maps to data model property
  label: string;          // Display label (can be localized)
  type: 'text' | 'date' | 'location' | 'status' | 'image' | 'badge';
  visible: boolean;       // Toggle field visibility without removing
  order: number;          // Display sort order (ascending)
}
```

## Common Operations

### Adding a field to AssignmentCard
```json
// PUT /api/v1/ui-config/assignment-list
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

### Hiding a field (without removing)
Set `"visible": false` — mobile renderer skips it, but config preserved for re-enabling.

### Reordering fields
Change `"order"` values — mobile renderer sorts by order ascending.

## Validation Rules (Zod)

```typescript
const fieldConfigSchema = z.object({
  key: z.string().min(1).max(50),
  label: z.string().min(1).max(100),
  type: z.enum(['text', 'date', 'location', 'status', 'image', 'badge']),
  visible: z.boolean(),
  order: z.number().int().min(0),
});

const componentConfigSchema = z.object({
  type: z.enum(['card', 'list', 'form', 'detail', 'header']),
  fields: z.array(fieldConfigSchema).min(1),
});

const updateConfigSchema = z.object({
  title: z.string().min(1).max(100),
  components: z.array(componentConfigSchema).min(1),
});
```

## Database

```sql
CREATE TABLE ui_configs (
  id TEXT PRIMARY KEY,
  screen_id TEXT NOT NULL UNIQUE,
  version INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  config_json TEXT NOT NULL,       -- JSON string of ComponentConfig[]
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

## Key Rules
- Version auto-increments on every PUT — never let client set version
- Validate JSON structure with zod before storing
- Mobile downloads ALL configs in one request after login (minimize round-trips)
- Config changes take effect on next login (mobile caches locally)
- NEVER delete a screen config — update it or set all fields to `visible: false`
- `key` must correspond to an actual field in the data model returned by the API
- PUT endpoint restricted to `admin` role only
