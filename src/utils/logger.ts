import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

const LOG_LEVEL_NAMES: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.ERROR]: 'ERROR',
};

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, error?: Error, context?: Record<string, unknown>): void;
}

/**
 * Create a console logger
 */
export function createConsoleLogger(minLevel: LogLevel = LogLevel.INFO): Logger {
  const log = (level: LogLevel, message: string, context?: Record<string, unknown>, error?: Error) => {
    if (level < minLevel) return;

    const timestamp = new Date().toISOString();
    const levelName = LOG_LEVEL_NAMES[level];

    let output = `[${timestamp}] ${levelName}: ${message}`;

    if (context && Object.keys(context).length > 0) {
      output += ` ${JSON.stringify(context)}`;
    }

    if (error) {
      output += `\n  Error: ${error.name}: ${error.message}`;
      if (error.stack && level === LogLevel.DEBUG) {
        output += `\n  Stack: ${error.stack}`;
      }
    }

    if (level >= LogLevel.ERROR) {
      console.error(output);
    } else if (level >= LogLevel.WARN) {
      console.warn(output);
    } else {
      console.log(output);
    }
  };

  return {
    debug: (message, context) => log(LogLevel.DEBUG, message, context),
    info: (message, context) => log(LogLevel.INFO, message, context),
    warn: (message, context) => log(LogLevel.WARN, message, context),
    error: (message, error, context) => log(LogLevel.ERROR, message, context, error),
  };
}

/**
 * Create a file logger
 */
export function createFileLogger(filePath: string, minLevel: LogLevel = LogLevel.INFO): Logger {
  // Ensure directory exists
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  // Track if we've reported a file write error to avoid flooding stderr
  let hasReportedError = false;

  const log = (level: LogLevel, message: string, context?: Record<string, unknown>, error?: Error) => {
    if (level < minLevel) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
    };

    if (context && Object.keys(context).length > 0) {
      entry.context = context;
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    try {
      appendFileSync(filePath, JSON.stringify(entry) + '\n');
    } catch (writeError) {
      // Report the first failure to stderr with error details
      if (!hasReportedError) {
        hasReportedError = true;
        console.error(`Failed to write to log file: ${filePath}`, writeError);
      }
      // Continue silently after first report to avoid flooding stderr
    }
  };

  return {
    debug: (message, context) => log(LogLevel.DEBUG, message, context),
    info: (message, context) => log(LogLevel.INFO, message, context),
    warn: (message, context) => log(LogLevel.WARN, message, context),
    error: (message, error, context) => log(LogLevel.ERROR, message, context, error),
  };
}

/**
 * Create a combined logger (console + file)
 */
export function createCombinedLogger(
  filePath: string,
  consoleLevel: LogLevel = LogLevel.WARN,
  fileLevel: LogLevel = LogLevel.DEBUG
): Logger {
  const consoleLogger = createConsoleLogger(consoleLevel);
  const fileLogger = createFileLogger(filePath, fileLevel);

  return {
    debug: (message, context) => {
      consoleLogger.debug(message, context);
      fileLogger.debug(message, context);
    },
    info: (message, context) => {
      consoleLogger.info(message, context);
      fileLogger.info(message, context);
    },
    warn: (message, context) => {
      consoleLogger.warn(message, context);
      fileLogger.warn(message, context);
    },
    error: (message, error, context) => {
      consoleLogger.error(message, error, context);
      fileLogger.error(message, error, context);
    },
  };
}

/**
 * No-op logger for testing
 */
export function createNullLogger(): Logger {
  return {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  };
}

/**
 * Check if an environment variable is explicitly enabled
 * Returns true only for "1", "true", or "on" (case-insensitive)
 */
function isEnvTrue(envVar: string | undefined): boolean {
  if (!envVar) return false;
  const normalized = envVar.toLowerCase().trim();
  return normalized === '1' || normalized === 'true' || normalized === 'on';
}

// Default logger instance (can be replaced)
let defaultLogger: Logger = createConsoleLogger(
  isEnvTrue(process.env.DEBUG) ? LogLevel.DEBUG : LogLevel.WARN
);

export function getLogger(): Logger {
  return defaultLogger;
}

export function setLogger(logger: Logger): void {
  defaultLogger = logger;
}
