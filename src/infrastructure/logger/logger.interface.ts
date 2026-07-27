import type { LogContext } from './logger.types';

export interface ILogger {
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  setEnabled(enabled: boolean): void;
  isEnabled(): boolean;
}
