import pino from 'pino';

const isProduction = process.env['NODE_ENV'] === 'production';
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

export const logger = pino({
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

export default logger;
