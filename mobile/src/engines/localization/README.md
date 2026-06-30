# Localization Engine

Runtime language resolution for all user-visible text.

## Responsibility

- Language selection
- String key resolution
- Fallback language handling
- Dynamic string interpolation
- Right-to-left layout support (future)

## Supported Languages

- English (en)
- Hindi (hi)
- Telugu (te)

## Rules

- All user-visible text must use localization keys.
- Never hardcode display strings.
- Language resources are loaded through this centralized engine.
