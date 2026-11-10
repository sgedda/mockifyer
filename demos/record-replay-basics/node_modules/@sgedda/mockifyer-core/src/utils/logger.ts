/**
 * Logger utility for Mockifyer
 * Supports configurable log levels to control verbosity
 */

export type LogLevel = 'none' | 'error' | 'warn' | 'info' | 'debug';

/**
 * Log levels hierarchy (higher number = more verbose)
 */
const LOG_LEVELS: Record<LogLevel, number> = {
  none: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

let currentLogLevel: LogLevel = 'info'; // Default to 'info' level

/**
 * Set the current log level
 */
export function setLogLevel(level: LogLevel): void {
  currentLogLevel = level;
}

/**
 * Get the current log level
 */
export function getLogLevel(): LogLevel {
  return currentLogLevel;
}

/**
 * Check if a log level should be output
 */
function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] <= LOG_LEVELS[currentLogLevel];
}

/**
 * Logger class that respects log level configuration
 */
export const logger = {
  /**
   * Log an error (always logged, even if level is 'none')
   */
  error: (...args: any[]): void => {
    // Errors are always logged - they're critical
    console.error(...args);
  },

  /**
   * Log a warning
   */
  warn: (...args: any[]): void => {
    if (shouldLog('warn')) {
      console.warn(...args);
    }
  },

  /**
   * Log an info message
   */
  info: (...args: any[]): void => {
    if (shouldLog('info')) {
      console.log(...args);
    }
  },

  /**
   * Log a debug message
   */
  debug: (...args: any[]): void => {
    if (shouldLog('debug')) {
      console.log(...args);
    }
  },

  /**
   * Log a message (alias for info)
   */
  log: (...args: any[]): void => {
    if (shouldLog('info')) {
      console.log(...args);
    }
  },
};
