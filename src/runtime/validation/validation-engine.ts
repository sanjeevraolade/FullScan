import { LoggerService } from '@/infrastructure/logger';

import { VALIDATION_ENGINE_SKELETON_MESSAGE } from './validation-engine.constants';
import type { IValidationEngine } from './validation-engine.interface';

export class ValidationEngine implements IValidationEngine {
  initialize(): void {
    LoggerService.info(VALIDATION_ENGINE_SKELETON_MESSAGE);
  }

  dispose(): void {
    // No state to release yet — skeleton only.
  }
}
