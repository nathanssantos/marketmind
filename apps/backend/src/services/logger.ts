import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pino from 'pino';

const isProduction = process.env['NODE_ENV'] === 'production';
const isTest = process.env['NODE_ENV'] === 'test' || process.env['VITEST'] === 'true';
const logLevel = process.env['LOG_LEVEL'] ?? 'info';

const MAX_ERROR_LENGTH = 500;

const truncate = (msg: string): string =>
  msg.length <= MAX_ERROR_LENGTH ? msg : `${msg.slice(0, MAX_ERROR_LENGTH)}... [truncated, ${msg.length} chars total]`;

export const serializeError = (error: unknown): string => {
  if (error instanceof Error) {
    const cause = (error as Error & { cause?: unknown }).cause;
    const msg = cause ? `${error.message} (cause: ${String(cause)})` : error.message;
    return truncate(msg);
  }
  if (error && typeof error === 'object') {
    const obj = error as Record<string, unknown>;
    if ('message' in obj && typeof obj['message'] === 'string') {
      return truncate(obj['message']);
    }
    try {
      return truncate(JSON.stringify(error));
    } catch {
      return '[Circular or unserializable object]';
    }
  }
  return truncate(String(error));
};

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = path.join(currentDir, '../../logs');
const ERROR_LOG_FILE = path.join(LOG_DIR, 'error.log');

const ensureLogDir = (): void => {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
};

const createLogger = (): pino.Logger => {
  if (isTest) {
    return pino({ level: 'silent' });
  }

  ensureLogDir();

  const streams: pino.StreamEntry[] = [
    {
      level: logLevel as pino.Level,
      stream: isProduction
        ? process.stdout
        : pino.transport({
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss',
              ignore: 'pid,hostname',
              singleLine: true,
            },
          }),
    },
    {
      level: 'warn' as pino.Level,
      stream: pino.destination({
        dest: ERROR_LOG_FILE,
        sync: false,
        mkdir: true,
      }),
    },
  ];

  return pino(
    {
      level: logLevel,
      formatters: {
        level: (label) => ({ level: label }),
      },
    },
    pino.multistream(streams)
  );
};

export const logger = createLogger();

export default logger;
