import type { ILogger } from './logger.interface';
import type { LogContext, LogLevel } from './logger.types';

const LOG_PREFIX = '[FullScan]';

class LoggerServiceImpl implements ILogger {
  private enabled = true;

  info(message: string, context?: LogContext): void {
    this.write('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.write('warn', message, context);
  }

  error(message: string, context?: LogContext): void {
    this.write('error', message, context);
  }

  /**
   * Global on/off switch — call with `false` (e.g. from a debug menu or a
   * remote-config flag) to silence every LoggerService call at runtime
   * without touching call sites.
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  private write(level: LogLevel, message: string, context?: LogContext): void {
    if (!this.enabled) {
      return;
    }

    const prefixedMessage = `${LOG_PREFIX} ${message}`;
    if (context) {
      // eslint-disable-next-line no-console -- LoggerService is the sanctioned console sink
      console[level](prefixedMessage, context);
    } else {
      // eslint-disable-next-line no-console -- LoggerService is the sanctioned console sink
      console[level](prefixedMessage);
    }
  }
}

export const LoggerService: ILogger = new LoggerServiceImpl();
