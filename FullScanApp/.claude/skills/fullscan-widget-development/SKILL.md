---
name: fullscan-widget-development
description: Load when creating or modifying anything under src/widgets/ — reusable runtime-rendered UI building blocks (text, camera, gps, signature, dropdown, timeline, etc.). Load before adding a new widget type or touching widget registration.
---

# Widget Development

Applies to `src/widgets/**`. Widgets are the smallest reusable building blocks of the platform: a screen is composed of Sections, a Section is composed of Widgets. This architecture is frozen — never bypass the Widget Registry. See `fullscan-dynamic-form` for how widgets get rendered and `fullscan-theme-engine`/`fullscan-localization` for styling/text rules.

## Philosophy

Widgets display or collect information. They never contain business workflow logic — that belongs to Runtime Engines.

## Every widget must be

Reusable · configuration-driven · stateless whenever possible · theme-aware · localization-aware · testable · accessible · solving exactly one problem.

## A widget may

Display information, accept input, trigger widget events, bind Runtime values, display validation errors (received from the Validation Engine, not computed itself).

## A widget must NOT

Execute workflows · navigate · upload data · call APIs · synchronize data · perform business validation.

## Registration — never instantiate directly

```
Widget Type → Widget Registry → Registered Component → Runtime Renderer
```
New widgets register themselves rather than adding a case to some central switch statement (Open/Closed Principle).

## Widget categories

Display (Label, Text, Badge, Divider, Icon, Image) · Input (Text, Number, Email, Phone, TextArea) · Selection (Checkbox, Radio, Switch, Dropdown, Multi-select) · Date (Date/Time/DateTime picker) · Verification (Camera, Attachment, GPS, Signature) · Layout (Card, Section, Accordion, Grid).

## Lifecycle

`Initialize → Bind → Render → Validate → Save → Dispose`. No side effects during rendering.

## Runtime binding

Widgets bind to Runtime Context paths, e.g. `assignment.candidate.name`, `attachments.candidatePhoto`, `runtime.location.latitude`. Widgets never own business state themselves.

## Configuration-driven — never hardcode

Labels, visibility, required state, order, default values — all come from configuration, not the widget implementation.

## UI framework

Gluestack UI only (`Box`, `Text`, `Input`, `Button`, `Card`, `VStack`, `HStack`, `Badge`, `Icon`, `Modal`...) — avoid raw React Native primitives unless there's no Gluestack equivalent.

## Camera / Attachment widgets specifically

Must use Vision Camera, disable gallery selection entirely, capture GPS, generate a watermark, store metadata, and support offline capture — watermark is mandatory, not optional. See `fullscan-attachment-engine` for the full evidence lifecycle.

## Error handling

A widget failure must not crash the whole screen: log the error, show a graceful fallback, and continue rendering the remaining widgets.

## Folder structure

```
widgets/Camera/
  CameraWidget.tsx
  CameraWidget.types.ts
  CameraWidget.styles.ts
  CameraWidget.test.tsx
  index.ts
```

## Testing

Cover rendering, configuration, runtime binding, validation display, theme, localization, and accessibility — mock runtime dependencies.

## Before writing a widget, verify

Is it reusable across workflows, not feature-specific? Is it configuration-driven? Does it use Runtime Context, Theme Engine, Localization Engine? Does it avoid business logic? Is it registered in the Widget Registry? Is it independently testable? If any answer is "no," redesign first.
