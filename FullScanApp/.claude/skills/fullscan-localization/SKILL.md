---
name: fullscan-localization
description: Load when adding any user-visible text — screen titles, button labels, error/validation messages, dialogs, tooltips, help text. Load before hardcoding a string anywhere in a screen, widget, or validator.
---

# Localization

Applies to `src/localization/**` and any user-facing text throughout the app (react-i18next). Mandatory, with no exceptions — every visible string is localized.

## Supported languages

English, Hindi, Telugu today. Future languages should require configuration only, no code changes.

## Never hardcode

Screen titles, button text, dialog text, validation messages, error messages, empty-state messages, loading messages, tooltips, help text.

## Keys — descriptive, namespaced

Good: `assignment.title`, `camera.capture`, `validation.required`. Bad: `title1`, `label2`, `msg`.

## Validation messages specifically

The Validation Engine returns **message keys**, never resolved text (see `fullscan-validation`) — the Localization Engine resolves them at display time. Don't put localized strings inside a validator.

## Runtime language switching

Changing language updates the UI without requiring an app restart.

## Widgets

Every widget uses localization keys — no fixed text baked into a widget's implementation (see `fullscan-widget-development`).

## Formatting

Use localization utilities for dates, times, and numbers — don't hand-roll date/number formatting; currency formatting is planned future scope.

## Accessibility & future RTL

Localized text must work correctly with screen readers. Don't bake in layout assumptions that would break right-to-left language support later.

## Missing keys

Log a warning, fall back to the fallback language, and never crash the app over a missing translation key.

## Before writing UI/validation code, verify

Is there any hardcoded string? Are localization keys used everywhere text appears, including widgets and validation messages? Is runtime language switching still supported? If any answer is "no," redesign first.
