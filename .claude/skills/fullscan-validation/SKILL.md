---
name: fullscan-validation
description: Load when implementing any business, field, workflow, GPS, attachment, or security validation. Load before writing a validation check anywhere outside src/runtime/validation/ — that check almost certainly belongs in the Validation Engine instead.
---

# Validation Engine

Applies to `src/runtime/validation/**`. The Validation Engine is the single authority for business rule validation across the platform. Business validation must never live inside screens, widgets, navigation, or API services. Frozen architecture.

## Validation flow — stops on first blocking failure

```
Field → Section → Screen → Workflow → Submission
```

## Categories

Field (required, min/max length, pattern, numeric range) · Location (GPS enabled, GPS accuracy, geo-fence, mock location) · Attachment (required, watermark present, file size/format, capture completed) · Security (registered device, root/jailbreak detection, biometric verification) · Workflow (previous step completed, mandatory section complete, required evidence collected).

## Configuration-driven

Required fields, mandatory documents, validation messages, workflow rules — all come from configuration, never hardcoded.

## Results contract — never return localized text directly

A validator returns a structured result: success flag, error code, **message key** (not resolved text — the Localization Engine resolves it), severity, target field, optional suggested action. Severities: Info, Warning, Error, Blocking — only Blocking prevents workflow progression.

Example message keys: `validation.photo.required`, `validation.gps.accuracy`, `validation.mockLocation`.

## Validator identity

Each validator has a unique, discoverable identifier (`required`, `gpsAccuracy`, `geoFence`, `mockLocation`, `attachmentRequired`) so it can be reused and referenced from configuration.

## Offline First

Validation runs locally whenever possible — the app must keep validating business rules while offline. Avoid server-side-only validation unless truly unavoidable.

## Error handling

Validation failures are expected business outcomes, not exceptions — never throw for an ordinary failed validation. Reserve exceptions for genuinely unexpected technical failures.

## Runtime integration

Interacts with Runtime Context, Workflow Engine, Dynamic Form Engine, Attachment Engine, Configuration Engine. No dependency on UI components.

## Logging

Log validation started/passed/failed/duration via `LoggerService` — never log sensitive user data.

## Folder pattern

```
validators/Required/
  RequiredValidator.ts
  RequiredValidator.test.ts
  index.ts
```
Keep each validator small and focused; test success, failure, boundary values, and missing/invalid configuration with a mocked Runtime Context.

## Before writing validation code, verify

Is this in the Validation Engine, not scattered in a screen/widget? Is it configuration-driven and reusable? Is it offline-capable? Does it return a structured result with a message key rather than resolved text? Is it independently testable? If any answer is "no," redesign first.
