# Localization

Language resource files for all supported locales.

## Structure

| Directory | Language |
|-----------|----------|
| `en/`     | English  |
| `hi/`     | Hindi    |
| `te/`     | Telugu   |

## Rules

- Every user-visible string must have a localization key.
- Fallback language is English.
- Resources are organized by feature/module namespace.
- Language files are loaded through the Localization Engine.
