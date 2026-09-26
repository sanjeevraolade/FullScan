# Theme

## Purpose

Defines the visual design system of the application.

## Responsibilities

- Colors
- Typography
- Spacing
- Elevation
- Component styling

Never hardcode visual values outside the Theme layer.

## Theme Engine (minimal, "Hello Runtime" pass)

- `theme-engine.ts` — resolves `light` / `dark` / `system` mode (via `Appearance`) and exposes the active
  `ThemeTokens`. Tokens are sourced from `@gluestack-ui/config`'s default palette, never new hex literals.
- `gluestack-ui.config.ts` — the single import point for the Gluestack config; future customer branding /
  white-label overrides extend this file only.
- `ThemeProvider.tsx` — wraps `GluestackUIProvider` with the active config + resolved color mode. Not yet
  mounted in `App.tsx` — used directly by the runtime pipeline tests until app-shell wiring lands.

Not implemented yet: reading theme configuration from the backend Configuration Package
(`docs/06-Contracts/01-Configuration-Schema.md` §14) and runtime theme switching from a Zustand
`store/theme` slice — deferred until there's a mounted UI to subscribe to it.
