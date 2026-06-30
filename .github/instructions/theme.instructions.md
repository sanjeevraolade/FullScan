---
applyTo:
  - "mobile/src/theme/**"
  - "mobile/src/components/**"
  - "mobile/src/widgets/**"
  - "mobile/src/features/**"
---

# Theme Instructions

These instructions apply to all theming and styling implementations within the FullScan Mobile Platform.

Refer to:

- docs/05-Runtime/10-Theme-Engine.md
- docs/06-Contracts/07-Theme-Schema.md
- docs/04-Architecture/04-Mobile-Architecture.md

The Theme Engine architecture is frozen.

---

# Theme Philosophy

The Theme Engine is responsible for the application's visual appearance.

The application must support a consistent visual identity through centralized design tokens.

Styling must never be hardcoded.

Every UI component must obtain its visual properties from the Theme Engine.

---

# Design Principles

Every UI should be:

- Consistent
- Accessible
- Responsive
- Reusable
- Theme Aware
- Maintainable

Visual consistency is more important than individual component customization.

---

# UI Framework

The official UI framework is:

- Gluestack UI

Always use Gluestack UI components whenever an equivalent component exists.

Examples:

- Box
- VStack
- HStack
- Text
- Input
- Button
- Card
- Badge
- Modal
- Alert
- Avatar
- Spinner
- Icon

Avoid raw React Native components unless no Gluestack equivalent exists.

---

# Theme Engine

The Theme Engine is responsible for:

- Color Palette
- Typography
- Spacing
- Border Radius
- Elevation
- Shadows
- Component Variants
- Icons (Future)
- Animations (Future)

All visual styling should originate from the Theme Engine.

---

# Design Tokens

Use design tokens for every visual property.

Examples:

Colors

Typography

Spacing

Border Radius

Elevation

Opacity

Icon Size

Animation Duration

Never hardcode design values.

---

# Never Hardcode

Never hardcode:

Colors

Font Sizes

Font Families

Spacing

Margins

Padding

Border Radius

Border Width

Elevation

Shadows

Opacity

Animation Duration

Always use theme tokens.

---

# Supported Themes

Current themes:

- Light
- Dark
- System Default

Future themes may include:

- Customer Themes
- High Contrast
- Accessibility Themes

The architecture should support future theme expansion.

---

# Component Styling

Every component should:

- Consume theme tokens
- Support light mode
- Support dark mode
- Avoid custom styling when theme variants exist

Prefer reusable theme variants.

---

# Widget Styling

Widgets must never define their own design language.

Widgets consume the Theme Engine.

Visual consistency across widgets is mandatory.

---

# Runtime Theme Switching

Theme changes should be supported at runtime.

Changing the theme should not require restarting the application.

UI should automatically update when the active theme changes.

---

# Theme Variants

Prefer reusable variants.

Examples:

Primary Button

Secondary Button

Danger Button

Outlined Button

Success Badge

Warning Badge

Information Card

Avoid component-specific styling.

---

# Responsive Design

Support:

- Phones
- Tablets (Future)

Avoid hardcoded screen dimensions.

Use responsive layout utilities.

---

# Accessibility

The Theme Engine should support:

- Dynamic Font Sizes
- High Contrast
- Sufficient Color Contrast
- Touch Target Guidelines

Accessibility requirements take precedence over visual preferences.

---

# Icons

Use a centralized icon library.

Avoid mixing multiple icon libraries throughout the project.

Icons should support theming automatically.

---

# Images

Avoid embedding colors inside image assets whenever possible.

Prefer vector assets that can inherit theme colors.

---

# Animations

Animations should be:

- Purposeful
- Lightweight
- Consistent

Avoid excessive animations.

Future animation tokens should be controlled by the Theme Engine.

---

# Performance

Avoid:

- Recreating styles during render
- Inline style objects
- Duplicate style definitions

Prefer:

- Theme tokens
- Memoized styles
- Reusable component variants

---

# Folder Structure

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

Every theme module should have a single responsibility.

---

# Component Structure

Every component should follow:

Imports

↓

Theme Hook

↓

Props

↓

Business Logic

↓

Render

↓

Export

Keep styling separate from business logic.

---

# Testing

Test:

- Light Theme
- Dark Theme
- Runtime Theme Switching
- Component Variants
- Accessibility

Verify visual consistency across supported themes.

---

# Before Writing Code

Always verify:

✓ Does the component use Gluestack UI?

✓ Are theme tokens used?

✓ Are colors hardcoded?

✓ Does it support Light Theme?

✓ Does it support Dark Theme?

✓ Does it support runtime theme switching?

✓ Is styling reusable?

✓ Is accessibility considered?

If any answer is "No", redesign before implementation.

---

# Things to Avoid

Avoid:

- Inline styles
- Magic colors
- Hardcoded spacing
- Hardcoded typography
- Component-specific themes
- Multiple design systems
- Mixing UI frameworks

One design system.

One Theme Engine.

One visual language.

---

# Guiding Principle

The Theme Engine is the single source of truth for the visual identity of the FullScan platform.

Every UI element should inherit its appearance from centralized design tokens, ensuring consistency, accessibility, maintainability, and support for future customization without requiring changes to individual components.

The goal is to build a visually consistent enterprise platform where themes can evolve independently of application logic.