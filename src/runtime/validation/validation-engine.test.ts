import { LoggerService } from '@/infrastructure/logger';

import { VALIDATION_ENGINE_READY_MESSAGE } from './validation-engine.constants';
import { ValidationEngine } from './validation-engine';

describe('ValidationEngine', () => {
  it('initializes and disposes without throwing', () => {
    const engine = new ValidationEngine();

    expect(() => engine.initialize()).not.toThrow();
    expect(() => engine.dispose()).not.toThrow();
  });

  it('logs readiness, noting only required-field checks are implemented', () => {
    const spy = jest.spyOn(LoggerService, 'info').mockImplementation(() => undefined);

    new ValidationEngine().initialize();

    expect(spy).toHaveBeenCalledWith(VALIDATION_ENGINE_READY_MESSAGE);

    spy.mockRestore();
  });
});
