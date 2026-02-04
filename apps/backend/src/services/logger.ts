import pino from 'pino';

const isProduction = process.env['NODE_ENV'] === 'production';
const logLevel = process.env['LOG_LEVEL'] ?? 'info';

export const serializeError = (error: unknown): string => {
  if (error instanceof Error) {
    const cause = (error as Error & { cause?: unknown }).cause;
    return cause ? `${error.message} (cause: ${String(cause)})` : error.message;
  }
  if (error && typeof error === 'object') {
    const obj = error as Record<string, unknown>;
    if ('message' in obj && typeof obj['message'] === 'string') {
      return obj['message'];
    }
    try {
      return JSON.stringify(error);
    } catch {
      return '[Circular or unserializable object]';
    }
  }
  return String(error);
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
