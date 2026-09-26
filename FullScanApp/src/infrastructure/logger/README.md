# Logger

`LoggerService` is the only sanctioned entry point to `console` in the app. No other file should call
`console.log`/`console.info`/`console.warn`/`console.error` directly.

## Usage

```ts
import { LoggerService } from '@/infrastructure/logger';

LoggerService.info('Configuration loaded', { screenCount: 3 });
LoggerService.warn('Widget type unresolved', { type: 'unknownWidget' });
LoggerService.error('Configuration failed to load');
```

## Output format

Every line is stamped with the local date and time it was written:

```
[FullScan] 2026-09-05 14:03:07.042 Configuration loaded { screenCount: 3 }
```

The stamp is `YYYY-MM-DD HH:mm:ss.SSS` in the **device's local time zone**, not UTC — logs are read
against the clock the Field Executive is looking at and against the timestamps watermarked onto
captured evidence.

Never pass tokens, passwords, biometric data, or PII (Aadhaar/PAN numbers included) as `context`.
