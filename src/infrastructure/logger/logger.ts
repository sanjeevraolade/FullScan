import type { ILogger } from './logger.interface';
import type { LogContext, LogLevel } from './logger.types';

const LOG_PREFIX = '[FullScan]';

const MILLISECOND_DIGITS = 3;

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

/**
 * Local-time stamp for a log line: `YYYY-MM-DD HH:mm:ss.SSS`.
 *
 * Deliberately built from the local-time getters rather than `toISOString()` —
 * a Field Executive reading logs off a device is comparing them against the
 * clock in front of them (and against capture timestamps on evidence), not
 * against UTC.
 */
const formatTimestamp = (date: Date): string => {
  const pad = (value: number, length = 2): string => String(value).padStart(length, '0');

  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  const milliseconds = pad(date.getMilliseconds(), MILLISECOND_DIGITS);

  return `${day} ${time}.${milliseconds}`;
};

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

    const prefixedMessage = `${LOG_PREFIX} ${formatTimestamp(new Date())} ${message}`;
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
