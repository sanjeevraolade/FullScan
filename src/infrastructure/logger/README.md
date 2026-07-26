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

Never pass tokens, passwords, biometric data, or PII (Aadhaar/PAN numbers included) as `context`.
