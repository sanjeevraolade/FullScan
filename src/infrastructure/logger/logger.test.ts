import { LoggerService } from './logger';

describe('LoggerService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('writes info messages through console.info with the FullScan prefix', () => {
    const spy = jest.spyOn(console, 'info').mockImplementation(() => undefined);

    LoggerService.info('Runtime initialized');

    expect(spy).toHaveBeenCalledWith('[FullScan] Runtime initialized');
  });

  it('writes warn messages together with the provided context', () => {
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const context = { screenId: 'runtime-preview' };

    LoggerService.warn('Widget type unresolved', context);

    expect(spy).toHaveBeenCalledWith('[FullScan] Widget type unresolved', context);
  });

  it('writes error messages through console.error', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    LoggerService.error('Configuration failed to load');

    expect(spy).toHaveBeenCalledWith('[FullScan] Configuration failed to load');
  });

  describe('setEnabled', () => {
    afterEach(() => {
      LoggerService.setEnabled(true);
    });

    it('defaults to enabled', () => {
      expect(LoggerService.isEnabled()).toBe(true);
    });

    it('suppresses info/warn/error once disabled', () => {
      const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

      LoggerService.setEnabled(false);
      LoggerService.info('should not log');
      LoggerService.warn('should not log');
      LoggerService.error('should not log');

      expect(LoggerService.isEnabled()).toBe(false);
      expect(infoSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('resumes logging once re-enabled', () => {
      const spy = jest.spyOn(console, 'info').mockImplementation(() => undefined);

      LoggerService.setEnabled(false);
      LoggerService.setEnabled(true);
      LoggerService.info('logging again');

      expect(spy).toHaveBeenCalledWith('[FullScan] logging again');
    });
  });
});
