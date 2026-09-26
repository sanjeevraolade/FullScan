import { LoggerService } from './logger';

/** 2026-09-05 14:03:07.042 local time — pinned so log prefixes are assertable. */
const FIXED_NOW = new Date(2026, 8, 5, 14, 3, 7, 42);
const EXPECTED_STAMP = '2026-09-05 14:03:07.042';

describe('LoggerService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('writes info messages through console.info with the FullScan prefix and timestamp', () => {
    const spy = jest.spyOn(console, 'info').mockImplementation(() => undefined);

    LoggerService.info('Runtime initialized');

    expect(spy).toHaveBeenCalledWith(`[FullScan] ${EXPECTED_STAMP} Runtime initialized`);
  });

  it('writes warn messages together with the provided context', () => {
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const context = { screenId: 'runtime-preview' };

    LoggerService.warn('Widget type unresolved', context);

    expect(spy).toHaveBeenCalledWith(`[FullScan] ${EXPECTED_STAMP} Widget type unresolved`, context);
  });

  it('writes error messages through console.error', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    LoggerService.error('Configuration failed to load');

    expect(spy).toHaveBeenCalledWith(`[FullScan] ${EXPECTED_STAMP} Configuration failed to load`);
  });

  it('stamps each message with the time it was written, not the time the logger was created', () => {
    const spy = jest.spyOn(console, 'info').mockImplementation(() => undefined);

    LoggerService.info('first');
    jest.setSystemTime(new Date(2026, 8, 5, 14, 3, 8, 5));
    LoggerService.info('second');

    expect(spy).toHaveBeenNthCalledWith(1, `[FullScan] ${EXPECTED_STAMP} first`);
    expect(spy).toHaveBeenNthCalledWith(2, '[FullScan] 2026-09-05 14:03:08.005 second');
  });

  it('zero-pads single-digit date and time parts', () => {
    const spy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    jest.setSystemTime(new Date(2026, 0, 2, 3, 4, 5, 6));

    LoggerService.info('padded');

    expect(spy).toHaveBeenCalledWith('[FullScan] 2026-01-02 03:04:05.006 padded');
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

      expect(spy).toHaveBeenCalledWith(`[FullScan] ${EXPECTED_STAMP} logging again`);
    });
  });
});
