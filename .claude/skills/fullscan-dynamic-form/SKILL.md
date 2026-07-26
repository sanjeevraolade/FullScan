---
name: fullscan-dynamic-form
description: Load when implementing screen/layout/form rendering from configuration — the Dynamic Form Engine, screen composition, or widget resolution pipeline. Load before manually building a business screen instead of generating it from config.
---

# Dynamic Form Engine

Applies to `src/runtime/renderer/**` and related screen-generation code. Responsible for turning backend screen configuration into a fully rendered, functional screen. Frozen architecture. See `fullscan-widget-development` for widget rules and `fullscan-validation` for how validation plugs in.

## Philosophy

Business forms must never be manually implemented when they can be generated from configuration. Configuration is the source of truth — never hardcode forms, business screens, widget ordering, labels, mandatory fields, or validation rules.

## Responsibilities

Parsing screen configuration · rendering layouts · creating sections · resolving widgets · data binding · validation binding · theme integration · localization integration.

## Rendering pipeline

```
Configuration → Screen Schema → Section Renderer → Widget Resolver → Widget Registry → Runtime Widget → Rendered Screen
```

Widgets are always resolved through the Widget Registry (`Widget Type → Widget Registry → Registered Component → Rendered Widget`) — never instantiated directly.

## Supported layouts

Vertical, Horizontal, Scroll, Card, Grid, Accordion, Tabs — keep layout handling extensible for future types.

## Runtime binding

Widgets bind to Runtime Context paths (`assignment.candidate.name`, `attachments.candidatePhoto`, `runtime.location.latitude`). Avoid local business state inside widgets.

## Validation & localization & theme

The engine *requests* validation from the Validation Engine — it never implements business validation itself. Every visible string resolves through the Localization Engine (never hardcoded). Every widget consumes the Theme Engine (never hardcoded colors/typography/spacing). Use Gluestack UI components.

## Attachments

Attachment widgets rendered here must support camera capture, GPS, watermark, offline storage, and upload status — gallery selection is prohibited (see `fullscan-attachment-engine`).

## Error handling

Invalid configuration for one widget should log the error, skip that widget, and continue rendering the rest of the screen — degrade gracefully, don't fail the whole screen.

## Performance

Avoid unnecessary widget recreation; reuse widget definitions, parsed configuration, and runtime bindings. Prefer lazy rendering where it matters.

## Extensibility

New widget types register through the Widget Registry without modifying existing rendering logic (Open/Closed Principle).

## Before writing rendering code, verify

Is the screen generated from configuration rather than hand-built? Is every widget resolved through the Widget Registry? Is localization and theming supported? Is validation delegated, not implemented locally? Is runtime binding correct? If any answer is "no," redesign first.
