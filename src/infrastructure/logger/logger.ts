import type { ILogger } from './logger.interface';
import type { LogContext, LogLevel } from './logger.types';

const LOG_PREFIX = '[FullScan]';

/**
 * THE RELEASE SWITCH for execution-flow logging.
 *
 * Every function/method/component in the app emits an entry (and, where it
 * branches or awaits, an exit) log so the whole execution flow can be read off
 * the console during development — see `fullscan-engineering-standards`.
 *
 * That instrumentation is development-only. Flip this to `false` before a
 * release build and every call site in the codebase goes silent with no other
 * edit; `setEnabled()` still overrides it at runtime for a debug menu.
 */
const IS_LOGGING_ENABLED = true;

class LoggerServiceImpl implements ILogger {
  private enabled = IS_LOGGING_ENABLED;

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
