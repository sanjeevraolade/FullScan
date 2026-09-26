---
name: fullscan-theme-engine
description: Load when styling any component or widget, adding a color/spacing/typography value, or working on light/dark/system theme support. Load before writing any inline style or hardcoded color/spacing value.
---

# Theme Engine

Applies to `src/theme/**` and all styled components/widgets/features. Frozen architecture. The Theme Engine is the single source of visual identity — no component defines its own design language.

## UI framework

**Gluestack UI** for everything (`Box`, `VStack`, `HStack`, `Text`, `Input`, `Button`, `Card`, `Badge`, `Modal`, `Alert`, `Avatar`, `Spinner`, `Icon`...). Avoid raw React Native primitives unless there's genuinely no Gluestack equivalent.

## What the Theme Engine owns

Color palette, typography, spacing, border radius, elevation, shadows, component variants; icons and animations are planned future scope.

## Never hardcode

Colors, font sizes/families, spacing, margins, padding, border radius/width, elevation, shadows, opacity, animation duration. Always resolve through theme tokens.

## Supported themes

Light, Dark, System Default now; customer themes / high-contrast / accessibility themes are architected for but not yet built — don't build in assumptions that would block them.

## Component rules

Every component consumes theme tokens, supports both light and dark, and prefers a reusable variant (Primary Button, Secondary Button, Danger Button, Success Badge, Warning Badge, Information Card...) over one-off component-specific styling.

## Runtime theme switching

Changing the active theme must not require an app restart — the UI updates automatically.

## Accessibility

Dynamic font sizes, high contrast, sufficient color contrast, and touch-target sizing are theme-level responsibilities, not optional per-component afterthoughts — accessibility requirements take precedence over visual preference.

## Icons & images

One centralized icon library — don't mix icon sets. Prefer vector assets that inherit theme colors over baked-in colored raster images.

## Performance

Avoid recreating style objects during render, avoid inline style objects, avoid duplicate style definitions — prefer theme tokens and memoized styles.

## Folder pattern

```
theme/
  ThemeProvider.tsx
  ThemeEngine.ts
  colors.ts
  typography.ts
  spacing.ts
  radius.ts
  elevation.ts
  shadows.ts
  variants/
  hooks/
```

Component structure: imports → theme hook → props → business logic → render → export. Keep styling and business logic separate.

## Before writing UI code, verify

Does the component use Gluestack UI? Are all visual properties theme tokens, with zero hardcoded colors/spacing/typography? Does it support light and dark, and runtime theme switching without a restart? Is accessibility considered? If any answer is "no," redesign first.

**One design system. One Theme Engine. One visual language.**
