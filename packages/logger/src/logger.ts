import pino from 'pino';
import { colorize } from './formatters/colors';

export interface Logger {
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
  debug(message: string, data?: Record<string, unknown>): void;
}

export interface LoggerOptions {
  prefix?: string;
  silent?: boolean;
  adapter?: 'pino' | 'console';
  pinoInstance?: pino.Logger;
}

const isProduction = process.env['NODE_ENV'] === 'production';
const logLevel = process.env['LOG_LEVEL'] ?? 'info';

let sharedPinoInstance: pino.Logger | null = null;

const getSharedPino = (): pino.Logger => {
  if (!sharedPinoInstance) {
    sharedPinoInstance = pino({
      level: logLevel,
      transport: isProduction
        ? undefined
        : {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss',
              ignore: 'pid,hostname',
              singleLine: true,
            },
          },
      formatters: {
        level: (label) => ({ level: label }),
      },
    });
  }
  return sharedPinoInstance;
};

const createPinoLogger = (prefix: string, pinoInstance?: pino.Logger): Logger => {
  const pLog = pinoInstance ?? getSharedPino();

  return {
    info(message: string, data?: Record<string, unknown>): void {
      if (data) {
        pLog.info(data, `[${prefix}] ${message}`);
      } else {
        pLog.info(`[${prefix}] ${message}`);
      }
    },
    warn(message: string, data?: Record<string, unknown>): void {
      if (data) {
        pLog.warn(data, `[${prefix}] ${message}`);
      } else {
        pLog.warn(`[${prefix}] ${message}`);
      }
    },
    error(message: string, data?: Record<string, unknown>): void {
      if (data) {
        pLog.error(data, `[${prefix}] ${message}`);
      } else {
        pLog.error(`[${prefix}] ${message}`);
      }
    },
    debug(message: string, data?: Record<string, unknown>): void {
      if (data) {
        pLog.debug(data, `[${prefix}] ${message}`);
      } else {
        pLog.debug(`[${prefix}] ${message}`);
      }
    },
  };
};

const getTimestamp = (): string => {
  const now = new Date();
  return now.toLocaleTimeString('en-US', { hour12: false });
};

const createConsoleLogger = (prefix: string): Logger => ({
  info(message: string, data?: Record<string, unknown>): void {
    const dataStr = data ? ` ${JSON.stringify(data)}` : '';
    console.log(`${colorize(getTimestamp(), 'gray')} ${colorize(`[${prefix}]`, 'cyan')} ${message}${dataStr}`);
  },
  warn(message: string, data?: Record<string, unknown>): void {
    const dataStr = data ? ` ${JSON.stringify(data)}` : '';
    console.warn(`${colorize(getTimestamp(), 'gray')} ${colorize(`[${prefix}]`, 'yellow')} ${message}${dataStr}`);
  },
  error(message: string, data?: Record<string, unknown>): void {
    const dataStr = data ? ` ${JSON.stringify(data)}` : '';
    console.error(`${colorize(getTimestamp(), 'gray')} ${colorize(`[${prefix}]`, 'red')} ${message}${dataStr}`);
  },
  debug(message: string, data?: Record<string, unknown>): void {
    const dataStr = data ? ` ${JSON.stringify(data)}` : '';
    console.log(`${colorize(getTimestamp(), 'gray')} ${colorize(`[${prefix}]`, 'magenta')} ${message}${dataStr}`);
  },
});

const createSilentLogger = (): Logger => ({
  info(): void {},
  warn(): void {},
  error(): void {},
  debug(): void {},
});

export const createLogger = (prefix: string, options: LoggerOptions = {}): Logger => {
  const { silent = false, adapter = 'pino', pinoInstance } = options;

  if (silent) return createSilentLogger();

  if (adapter === 'console') return createConsoleLogger(prefix);

  return createPinoLogger(prefix, pinoInstance);
};

export const serializeError = (error: unknown): string => {
  if (error instanceof Error) {
    const cause = (error as Error & { cause?: unknown }).cause;
    return cause ? `${error.message} (cause: ${String(cause)})` : error.message;
  }
  return String(error);
};

export { pino };
