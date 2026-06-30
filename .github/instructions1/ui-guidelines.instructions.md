---
applyTo: "mobile/src/components/**"
---

# UI Guidelines

## Component Library (STRICT)
- **MUST use `@gluestack-ui/themed`** for ALL UI components
- **NEVER use raw React Native primitives** (`View`, `Text`, `TouchableOpacity`, `TextInput`) — use gluestack equivalents: `Box`, `Text`, `Button`, `Input`, `Pressable`
- Layout: use `Box`, `VStack`, `HStack`, `Center`, `Divider` from gluestack-ui
- Forms: use `Input`, `Select`, `Checkbox`, `Switch`, `FormControl` from gluestack-ui
- Feedback: use `Toast`, `Alert`, `Modal`, `ActionSheet` from gluestack-ui
- Data display: use `Badge`, `Avatar`, `Card` from gluestack-ui
- Wrap app with `GluestackUIProvider` using custom theme config from `src/theme/gluestack.config.ts`
- Refer to: https://github.com/gluestack/gluestack-ui

## Styling Rules (STRICT)
- **NEVER use inline styles** — no `style={{ ... }}` in JSX
- **ALL styles in a centralized theme system** — `src/theme/` directory
- **Every style MUST support themes** (light/dark) — use gluestack-ui's theme tokens + `useTheme()` hook
- Component-specific styles live in `src/theme/components/<ComponentName>.styles.ts`
- Shared styles (spacing, typography, shadows) in `src/theme/common.ts`
- Prefer gluestack-ui's `sx` prop with theme tokens over custom StyleSheet

## Theme Architecture
```
mobile/src/theme/
├── index.ts              # ThemeProvider, useTheme hook export
├── colors.ts             # Light/dark color palettes
├── spacing.ts            # Spacing scale: 4, 8, 12, 16, 24, 32, 48
├── typography.ts         # Font sizes, weights, line heights
├── shadows.ts            # Elevation/shadow definitions
├── common.ts             # Shared layout styles
└── components/           # Per-component style factories
    ├── AssignmentCard.styles.ts
    ├── EvidenceCard.styles.ts
    └── ...
```

### Style Factory Pattern
```typescript
// src/theme/components/AssignmentCard.styles.ts
import { createStyles } from '../index';

export const useAssignmentCardStyles = createStyles((theme) => ({
  container: { backgroundColor: theme.colors.surface, padding: theme.spacing.md },
  title: { ...theme.typography.heading, color: theme.colors.textPrimary },
}));
```

## Component Structure
- One component per file, named same as file in PascalCase
- Props interface exported above component: `export interface ButtonProps { ... }`
- Default export for the component
- Use gluestack-ui components with theme tokens — NEVER `StyleSheet.create()` in component files
- For custom styling beyond gluestack tokens, use `useXxxStyles()` hook from theme

## Layout
- Use `flexbox` for all layouts
- Consistent spacing via theme scale: `theme.spacing.xs/sm/md/lg/xl`
- Use `SafeAreaView` as root of every screen
- Support both portrait and landscape where practical

## Colors & Theming
- All colors defined in `src/theme/colors.ts` with light/dark variants
- Use semantic color names: `primary`, `danger`, `textPrimary`, `background`, `surface`
- Access colors ONLY via `useTheme()` hook — never import color constants directly
- Never hardcode hex values anywhere in components

## Typography
- Define text presets in `src/theme/typography.ts`: `heading`, `body`, `caption`, `label`
- Use a `Text` wrapper component that applies theme typography
- Consistent font sizes: 12, 14, 16, 18, 24, 32

## Accessibility
- All touchable elements need `accessibilityLabel`
- Images need `accessibilityLabel` describing content
- Minimum touch target: 44x44 points
- Support dynamic font sizes (`allowFontScaling`)

## Evidence-Specific Components
- `EvidenceCard`: displays photo thumbnail + GPS + timestamp + status
- `WatermarkedImage`: renders photo with GPS/time overlay
- `GeoFenceMap`: shows assignment location with radius circle
- `SyncStatusBadge`: shows pending/synced/failed state
