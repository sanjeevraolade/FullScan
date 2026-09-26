# Localization

## Purpose

Contains language resources used throughout the application.

## Supported Languages

- English
- Hindi
- Telugu

## Rules

- Never hardcode user-visible strings.
- Every string should be localized.

## Localization Engine (minimal, "Hello Runtime" pass)

`localization-engine.ts` wraps `i18next` with the `en/`, `hi/`, `te/` resource bundles below (each a
`common` namespace). `initialize(language?)` calls `i18next.init(...)`; `resolve(key)` calls `i18next.t(key)`
and falls back to the raw key when a translation is missing, so a missing key degrades visibly instead of
crashing. Widgets resolve strings via `react-i18next`'s `useTranslation()` against this same global
instance — no explicit `I18nextProvider` is required for that to work.

Not implemented yet: downloading localization resources from the backend Configuration Package
(`docs/06-Contracts/01-Configuration-Schema.md` §15) and a `store/localization` Zustand slice for
reactive language switching in the UI — deferred until there's a mounted UI to subscribe to it.
