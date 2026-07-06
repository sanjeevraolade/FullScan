# Theme Engine

Centralized styling — colors, typography, spacing, and component variants.

## Responsibility

- Design token management
- Light/Dark/System theme support
- Color palette
- Typography scale
- Spacing scale
- Component variant definitions

## Supported Themes

- Light Theme
- Dark Theme
- System Theme (follows OS preference)

## Rules

- No hardcoded visual styling anywhere in the app.
- All components consume theme values through this engine.
- Every style must support both light and dark themes.
