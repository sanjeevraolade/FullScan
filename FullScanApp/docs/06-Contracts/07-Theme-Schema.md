# Theme Schema

**Document ID:** THM-SCH-001

**Document Version:** 1.0

**Status:** Approved

**Owner:** Solution Architect

---

# 1. Purpose

The Theme Schema defines the runtime design tokens consumed by the Theme Engine.

The backend may deliver theme definitions that customize colors, typography, spacing, icons, and component variants without changing application code.

---

# 2. Theme Schema

```json
{
  "themeId": "default",
  "mode": "light",
  "tokens": {
    "primary": "#2563EB",
    "secondary": "#64748B",
    "background": "#FFFFFF",
    "surface": "#F8FAFC",
    "textPrimary": "#0F172A",
    "textSecondary": "#475569",
    "error": "#DC2626",
    "success": "#16A34A",
    "warning": "#D97706"
  }
}
```

---

# 3. Typography

Theme packages define:

* Font Family
* Font Sizes
* Font Weights
* Line Heights

---

# 4. Spacing

Spacing tokens:

* xs
* sm
* md
* lg
* xl

---

# 5. Component Variants

Examples:

* Primary Button
* Secondary Button
* Filled Input
* Outlined Input
* Error Badge
* Information Card

---

# 6. Theme Modes

Supported modes:

* Light
* Dark
* System

Future:

* High Contrast
* Customer Branding
* White-label Themes

---

# 7. Offline Behaviour

Themes are cached locally and remain available while offline.

---

# 8. Guiding Philosophy

> Themes define visual language through design tokens, allowing consistent branding and runtime customization without modifying application code.
