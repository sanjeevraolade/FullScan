import { LoggerService } from '@/infrastructure/logger';

import { VALIDATION_ENGINE_SKELETON_MESSAGE } from './validation-engine.constants';
import { ValidationEngine } from './validation-engine';

describe('ValidationEngine (skeleton)', () => {
  it('initializes and disposes without throwing', () => {
    const engine = new ValidationEngine();

    expect(() => engine.initialize()).not.toThrow();
    expect(() => engine.dispose()).not.toThrow();
  });

  it('logs that it is a skeleton with no business logic yet', () => {
    const spy = jest.spyOn(LoggerService, 'info').mockImplementation(() => undefined);

    new ValidationEngine().initialize();

    expect(spy).toHaveBeenCalledWith(VALIDATION_ENGINE_SKELETON_MESSAGE);

    spy.mockRestore();
  });
});
