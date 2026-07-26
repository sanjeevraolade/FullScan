import { LoggerService } from '@/infrastructure/logger';

import { WORKFLOW_ENGINE_SKELETON_MESSAGE } from './workflow-engine.constants';
import { WorkflowEngine } from './workflow-engine';

describe('WorkflowEngine (skeleton)', () => {
  it('initializes and disposes without throwing', () => {
    const engine = new WorkflowEngine();

    expect(() => engine.initialize()).not.toThrow();
    expect(() => engine.dispose()).not.toThrow();
  });

  it('logs that it is a skeleton with no business logic yet', () => {
    const spy = jest.spyOn(LoggerService, 'info').mockImplementation(() => undefined);

    new WorkflowEngine().initialize();

    expect(spy).toHaveBeenCalledWith(WORKFLOW_ENGINE_SKELETON_MESSAGE);

    spy.mockRestore();
  });
});
