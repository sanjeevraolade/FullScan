---
applyTo: "mobile/**"
---

# Mobile App Instructions

React Native app for Field Executives performing physical background verification.

## UI Component Library (STRICT)
- **MUST use `@gluestack-ui/themed`** for ALL UI components (buttons, inputs, cards, modals, etc.)
- **NEVER use raw React Native components** (`<View>`, `<Text>`, `<TouchableOpacity>`) when a gluestack-ui equivalent exists
- Import from `@gluestack-ui/themed`: `Box`, `Text`, `Button`, `Input`, `VStack`, `HStack`, `Card`, `Modal`, `Badge`, `Icon`, etc.
- Use gluestack-ui's built-in theming system (`GluestackUIProvider`) integrated with our theme in `src/theme/`
- Refer to: https://github.com/gluestack/gluestack-ui

## Localization (MANDATORY) ##

Localization is mandatory throughout the application.

ALL user-visible text MUST be localized using react-i18next.
English (en), Hindi (hi), and Telugu (te) MUST be supported.
Every newly created screen, component, dialog, alert, validation message, error message, button label, placeholder, tooltip, and menu item MUST include localization keys.
NEVER hardcode user-visible strings in JSX or TypeScript.
If a localization key does not exist, create it before using the text.
Every feature is considered incomplete if localization is missing.

# Incorrect
```tsx
<Text>Login</Text>
<Button>Submit</Button>
Alert.alert("Network Error")
```


# Correct
```tsx
<Text>{t("auth.login")}</Text>
<Button>{t("common.submit")}</Button>
Alert.alert(t("errors.network"))
```

## Key Constraints
- Offline-first: all evidence collection must work without network. Queue API calls and sync when online.
- Location is mandatory: every screen that collects evidence must verify GPS is active and within geo-fence of assignment.
- Photos must embed watermark (GPS coords, timestamp, case ID) before storage or upload.
- Use React Native's Linking/Permissions API to request camera and location — gracefully handle denial.

## Server-Driven UI
The app uses a **server-driven UI** pattern for configurable screens:
- After login success, the app downloads screen configuration JSONs from the server
- Each screen has a corresponding JSON definition that specifies which fields/components to render
- Components are generated at runtime from the JSON schema
- Example: AssignmentCard fields are configurable — admin can add/remove fields shown on cards via JSON config
- Store downloaded configs in SQLite for offline access; refresh on each login

### Config JSON Pattern
```typescript
// Screen config fetched from GET /api/v1/ui-config/:screenId
interface ScreenConfig {
  screenId: string;
  version: number;
  components: ComponentConfig[];
}

interface ComponentConfig {
  type: 'card' | 'list' | 'form' | 'detail';
  fields: FieldConfig[];
}

interface FieldConfig {
  key: string;          // data field to display (e.g., "candidateName")
  label: string;        // display label
  type: 'text' | 'date' | 'location' | 'status' | 'image';
  visible: boolean;     // show/hide
  order: number;        // display order
}
```

### Dynamic Component Renderer
- `src/components/dynamic/DynamicRenderer.tsx` — maps JSON config to React components
- `src/components/dynamic/DynamicCard.tsx` — renders card with configurable fields
- `src/components/dynamic/DynamicList.tsx` — renders list with configurable items
- Field renderers in `src/components/dynamic/fields/` — one per field type

## Styling (STRICT)
- **NEVER use inline styles** — no `style={{ }}` in JSX
- **ALL styles in `src/theme/`** — centralized, themeable
- **Every style must support light/dark themes** via `useTheme()` hook
- See `ui-guidelines.instructions.md` for full theme architecture

## Structure
```
mobile/src/
  components/    # Reusable UI components
  components/dynamic/  # Server-driven UI renderers
  screens/       # One file per screen, named <Feature>Screen.tsx
  navigation/    # Stack/Tab navigators
  services/      # API client, location service, camera service, sync queue
  hooks/         # Custom hooks (useLocation, useCamera, useOfflineQueue)
  utils/         # Helpers (watermark, geo-fence calc, crypto)
  types/         # Shared TypeScript interfaces
  store/         # State management (Context or Zustand)
  theme/         # Centralized styles, colors, typography (ALL styles here)
  config/        # Downloaded screen configs (JSON cache)
```

## Testing
- Unit test all services and utils with Jest
- Mock native modules (camera, GPS) in `__mocks__/`
- Screen tests use @testing-library/react-native
- Test DynamicRenderer with various JSON configs
