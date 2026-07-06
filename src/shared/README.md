# Shared

Reusable UI components, layouts, formatters, and assets used across modules.

## Structure

| Directory      | Purpose                                              |
|----------------|------------------------------------------------------|
| `animations/`  | Shared animation definitions and presets             |
| `assets/`      | Static assets (images, fonts, icons)                 |
| `components/`  | Reusable UI components (built with @gluestack-ui)    |
| `formatters/`  | Data display formatters (date, currency, number)     |
| `icons/`       | Icon components and icon sets                        |
| `layouts/`     | Reusable layout components (containers, grids)       |
| `validators/`  | Shared UI validation display utilities               |

## Rules

- All components use `@gluestack-ui/themed` — never raw RN primitives.
- No inline styles — all styles through theme tokens.
- Every component must support light and dark themes.
- Components must be reusable and feature-agnostic.
