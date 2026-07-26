import { LoggerService } from '@/infrastructure/logger';

import { WORKFLOW_ENGINE_SKELETON_MESSAGE } from './workflow-engine.constants';
import type { IWorkflowEngine } from './workflow-engine.interface';

export class WorkflowEngine implements IWorkflowEngine {
  initialize(): void {
    LoggerService.info(WORKFLOW_ENGINE_SKELETON_MESSAGE);
  }

  dispose(): void {
    // No state to release yet — skeleton only.
  }
}
