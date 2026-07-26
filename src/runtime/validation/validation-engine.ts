import type { ScreenDefinition } from '@/contracts';
import { LoggerService } from '@/infrastructure/logger';

import { VALIDATION_ENGINE_READY_MESSAGE, VALIDATION_REQUIRED_MESSAGE_KEY } from './validation-engine.constants';
import type { IValidationEngine } from './validation-engine.interface';

export class ValidationEngine implements IValidationEngine {
  initialize(): void {
    LoggerService.info(VALIDATION_ENGINE_READY_MESSAGE);
  }

  dispose(): void {
    // No persistent state to release — validateScreen is a pure function of its arguments.
  }

  validateScreen(screen: ScreenDefinition, values: Readonly<Record<string, string>>): Record<string, string> {
    const errors: Record<string, string> = {};

    for (const section of screen.sections) {
      for (const widget of section.widgets) {
        if (!widget.required) {
          continue;
        }
        const value = values[widget.widgetId] ?? '';
        if (value.trim().length === 0) {
          errors[widget.widgetId] = VALIDATION_REQUIRED_MESSAGE_KEY;
        }
      }
    }

    return errors;
  }
}
