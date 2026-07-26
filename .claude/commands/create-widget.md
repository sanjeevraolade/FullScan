---
description: Scaffold a reusable FullScan widget registered with the Widget Registry
argument-hint: <widget-name> — e.g. "SignatureCapture"
---

Create the **$ARGUMENTS** widget for the FullScan Runtime Platform under `src/widgets/`.

Load `fullscan-widget-development` first (and `fullscan-attachment-engine` too if this is a camera/evidence widget).

## Before creating a new widget

Can an existing widget be reused or configured differently? Can the Widget Registry already resolve something equivalent? Only build a new widget if the answer is genuinely no — feature-specific widgets should be rare.

## Widget responsibilities

May: display, capture input, trigger events, display validation state, bind to Runtime Context.
Must not: execute workflows, call APIs, synchronize data, navigate, or contain business rules.

## Requirements — every widget must

Register with the Widget Registry (never instantiate directly elsewhere) · support Theme Engine (no hardcoded styling) · support Localization Engine (no hardcoded text) · support accessibility (screen readers, dynamic font, touch targets, keyboard nav where applicable) · bind to Runtime Context without owning business state · be independently testable.

## Generate

```
widgets/$ARGUMENTS/
  $ARGUMENTS.tsx
  $ARGUMENTS.types.ts
  $ARGUMENTS.styles.ts
  $ARGUMENTS.test.tsx
  index.ts
```

Tests should cover rendering, runtime binding, validation display, localization, theme, and accessibility.

## Before finishing, confirm

Registered with the Widget Registry · Runtime-bound, not owning business state · theme-aware · localized · accessible · reusable and stateless where possible · tested · no business logic.
