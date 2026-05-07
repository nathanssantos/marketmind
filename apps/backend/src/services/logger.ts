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
    const causeStr = cause instanceof Error
      ? cause.message
      : typeof cause === 'string'
        ? cause
        : cause !== null && cause !== undefined
          ? JSON.stringify(cause)
          : '';
    const msg = causeStr ? `${causeStr} | ${error.message}` : error.message;
    return truncate(msg);
  }
  if (error && typeof error === 'object') {
    const obj = error as Record<string, unknown>;
    // Try common error-message field names in priority order:
    //   - `message`        (most JS errors)
    //   - `msg`            (Binance API responses, some legacy SDKs)
    //   - `error.message`  (axios-style nested)
    //   - `error_message`  (snake_case APIs)
    // This matters for catch blocks that don't get a thrown `Error`
    // — e.g. the Binance SDK wraps API errors in a plain object
    // `{ code: -2019, msg: "Margin is insufficient." }`. Without this
    // check, the caller falls through to JSON.stringify which produces
    // `{"code":-2019,"msg":"Margin is insufficient."}` — readable but
    // not as nice as just the message.
    for (const key of ['message', 'msg', 'error_message'] as const) {
      const v = obj[key];
      if (typeof v === 'string') return truncate(v);
    }
    if (obj['error'] && typeof obj['error'] === 'object') {
      const nested = (obj['error'] as Record<string, unknown>)['message'];
      if (typeof nested === 'string') return truncate(nested);
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
      level: 'warn',
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
