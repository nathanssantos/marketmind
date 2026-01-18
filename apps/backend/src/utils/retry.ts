import { AUTO_TRADING_RETRY } from '../constants';
import { logger } from '../services/logger';

export interface RetryOptions {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  retryableErrors?: string[];
  nonRetryableErrors?: string[];
  onRetry?: (attempt: number, error: Error, delayMs: number) => void;
  timeoutMs?: number;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'onRetry' | 'retryableErrors' | 'nonRetryableErrors' | 'timeoutMs'>> = {
  maxRetries: AUTO_TRADING_RETRY.MAX_RETRIES,
  initialDelayMs: AUTO_TRADING_RETRY.INITIAL_DELAY_MS,
  maxDelayMs: AUTO_TRADING_RETRY.MAX_DELAY_MS,
  backoffMultiplier: AUTO_TRADING_RETRY.BACKOFF_MULTIPLIER,
};

const BINANCE_RETRYABLE_ERRORS = [
  '-1001',
  '-1003',
  '-1015',
  '-1021',
  'ETIMEDOUT',
  'ECONNRESET',
  'ECONNREFUSED',
  'ENOTFOUND',
  'EAI_AGAIN',
  'socket hang up',
  'network error',
  'timeout',
  'Too Many Requests',
  'Service Unavailable',
  'Bad Gateway',
];

const BINANCE_NON_RETRYABLE_ERRORS = [
  '-2010',
  '-2011',
  '-2014',
  '-2015',
  '-1121',
  '-1100',
  '-1102',
  '-1104',
  '-4003',
  '-4015',
  '-4016',
  'Insufficient balance',
  'Order would immediately trigger',
  'Invalid symbol',
  'Invalid quantity',
  'Invalid price',
];

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableError = (
  error: Error,
  retryablePatterns: string[] = BINANCE_RETRYABLE_ERRORS,
  nonRetryablePatterns: string[] = BINANCE_NON_RETRYABLE_ERRORS
): boolean => {
  const cause = 'cause' in error ? String(error.cause) : '';
  const errorString = error.message + cause;

  for (const pattern of nonRetryablePatterns) {
    if (errorString.includes(pattern)) return false;
  }

  for (const pattern of retryablePatterns) {
    if (errorString.includes(pattern)) return true;
  }

  if (error.name === 'AbortError') return true;
  if (errorString.includes('fetch failed')) return true;

  return false;
};

export const withRetry = async <T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> => {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const { maxRetries, initialDelayMs, maxDelayMs, backoffMultiplier, onRetry } = config;
  const retryablePatterns = options.retryableErrors ?? BINANCE_RETRYABLE_ERRORS;
  const nonRetryablePatterns = options.nonRetryableErrors ?? BINANCE_NON_RETRYABLE_ERRORS;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt > maxRetries) {
        logger.error({
          attempt,
          maxRetries,
          error: lastError.message,
        }, 'Max retries exceeded');
        throw lastError;
      }

      if (!isRetryableError(lastError, retryablePatterns, nonRetryablePatterns)) {
        logger.debug({
          attempt,
          error: lastError.message,
        }, 'Non-retryable error, failing immediately');
        throw lastError;
      }

      const delayMs = Math.min(
        initialDelayMs * Math.pow(backoffMultiplier, attempt - 1),
        maxDelayMs
      );

      if (onRetry) {
        onRetry(attempt, lastError, delayMs);
      } else {
        logger.warn({
          attempt,
          maxRetries,
          delayMs,
          error: lastError.message,
        }, 'Retryable error, waiting before retry');
      }

      await sleep(delayMs);
    }
  }

  throw lastError ?? new Error('Retry failed with unknown error');
};

export const withRetryFetch = async (
  url: string,
  fetchOptions: RequestInit = {},
  retryOptions: Partial<RetryOptions> = {}
): Promise<Response> => {
  const timeoutMs = retryOptions.timeoutMs ?? AUTO_TRADING_RETRY.FETCH_TIMEOUT_MS;

  return withRetry(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      if (!response.ok && response.status >= 500) {
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }

      return response;
    } finally {
      clearTimeout(timeout);
    }
  }, retryOptions);
};

export { BINANCE_NON_RETRYABLE_ERRORS, BINANCE_RETRYABLE_ERRORS };

