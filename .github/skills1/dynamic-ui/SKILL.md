---
name: dynamic-ui
description: "Implement server-driven UI rendering for FullScanField mobile. Use for: downloading screen configs from server, dynamic component rendering from JSON, field type renderers, config caching in SQLite, and admin field customization."
---

# Server-Driven Dynamic UI

## When to Use
- Rendering screens from JSON configuration
- Building dynamic card/list/form components
- Downloading and caching UI configs after login
- Adding new field type renderers
- Implementing config versioning and refresh

## Architecture

```
[Login Success] → [GET /api/v1/ui-config] → [Cache in SQLite] → [Render Screens]
                                                                        ↓
                                                              [DynamicRenderer]
                                                                        ↓
                                                    [DynamicCard | DynamicList | DynamicForm]
                                                                        ↓
                                                              [Field Renderers]
```

## Config Types

```typescript
interface ScreenConfig {
  screenId: string;
  version: number;
  title: string;
  components: ComponentConfig[];
  updatedAt: string;
}

interface ComponentConfig {
  type: 'card' | 'list' | 'form' | 'detail' | 'header';
  fields: FieldConfig[];
}

interface FieldConfig {
  key: string;          // Maps to data property (e.g., "candidateName")
  label: string;        // Display label
  type: 'text' | 'date' | 'location' | 'status' | 'image' | 'badge';
  visible: boolean;
  order: number;
}
```

## Component Structure

```
mobile/src/components/dynamic/
├── DynamicRenderer.tsx        # Top-level: maps ScreenConfig → components
├── DynamicCard.tsx            # Renders a card with configurable fields
├── DynamicList.tsx            # Renders a scrollable list of DynamicCards
├── DynamicForm.tsx            # Renders a form with configurable inputs
├── DynamicDetail.tsx          # Renders detail view with labeled fields
└── fields/
    ├── TextField.tsx          # Renders text values
    ├── DateField.tsx          # Formats and renders dates
    ├── LocationField.tsx      # Shows GPS coords / map link
    ├── StatusField.tsx        # Colored status badge
    ├── ImageField.tsx         # Thumbnail with tap-to-expand
    └── BadgeField.tsx         # Colored badge (priority, urgency, etc.)
```

## Implementation Steps

### 1. Config download service
```typescript
// Called immediately after successful login
async function downloadUiConfigs(): Promise<ScreenConfig[]> {
  const response = await apiClient.get('/api/v1/ui-config');
  const configs = response.data.data as ScreenConfig[];
  await cacheConfigsToSQLite(configs);
  return configs;
}
```

### 2. SQLite cache
```sql
CREATE TABLE ui_config_cache (
  screen_id TEXT PRIMARY KEY,
  version INTEGER NOT NULL,
  config_json TEXT NOT NULL,
  downloaded_at TEXT DEFAULT (datetime('now'))
);
```

### 3. DynamicRenderer
```typescript
interface DynamicRendererProps {
  screenId: string;
  data: Record<string, unknown>[];  // Array of data items
}

// Loads config from cache, renders components based on config.components[].type
// Each component receives its FieldConfig[] and the data to display
```

### 4. Field renderer registry
```typescript
const FIELD_RENDERERS: Record<FieldConfig['type'], React.ComponentType<FieldProps>> = {
  text: TextField,
  date: DateField,
  location: LocationField,
  status: StatusField,
  image: ImageField,
  badge: BadgeField,
};
```

### 5. Rendering a configurable card
- Sort fields by `order`
- Filter by `visible: true`
- Map each field to its renderer via the registry
- Pass `data[field.key]` as the value

## Key Rules
- ALWAYS use cached config for rendering (never block on network)
- ALWAYS refresh config on login (replace cache if version is newer)
- NEVER hardcode field lists in card/list components — use config
- Field renderers must handle `null`/`undefined` values gracefully
- Unknown field types should render as plain text (fallback)
- All styles via theme system — field renderers use `useTheme()`
