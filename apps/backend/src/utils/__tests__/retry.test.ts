import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  withRetry,
  withRetrySafe,
  BINANCE_RETRYABLE_ERRORS,
  BINANCE_NON_RETRYABLE_ERRORS,
} from '../retry';

vi.mock('../../constants', () => ({
  AUTO_TRADING_RETRY: {
    MAX_RETRIES: 3,
    INITIAL_DELAY_MS: 10,
    MAX_DELAY_MS: 100,
    BACKOFF_MULTIPLIER: 2,
    FETCH_TIMEOUT_MS: 30000,
  },
}));

vi.mock('../../services/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    trace: vi.fn(),
  },
}));

describe('retry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('withRetry', () => {
    it('should return result on first success', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      const result = await withRetry(fn, { maxRetries: 3, initialDelayMs: 10, maxDelayMs: 100 });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable errors and succeed', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('ETIMEDOUT'))
        .mockResolvedValue('success');

      const result = await withRetry(fn, {
        maxRetries: 3,
        initialDelayMs: 1,
        maxDelayMs: 10,
      });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should throw immediately on non-retryable errors', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Insufficient balance'));

      await expect(withRetry(fn, {
        maxRetries: 3,
        initialDelayMs: 1,
        maxDelayMs: 10,
      })).rejects.toThrow('Insufficient balance');

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should throw after max retries exceeded', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('ETIMEDOUT'));

      await expect(withRetry(fn, {
        maxRetries: 2,
        initialDelayMs: 1,
        maxDelayMs: 10,
      })).rejects.toThrow('ETIMEDOUT');

      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should call onRetry callback when provided', async () => {
      const onRetry = vi.fn();
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockResolvedValue('ok');

      await withRetry(fn, {
        maxRetries: 3,
        initialDelayMs: 1,
        maxDelayMs: 10,
        onRetry,
      });

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error), expect.any(Number));
    });

    it('should apply exponential backoff with max delay cap', async () => {
      const onRetry = vi.fn();
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('ETIMEDOUT'))
        .mockRejectedValueOnce(new Error('ETIMEDOUT'))
        .mockResolvedValue('ok');

      await withRetry(fn, {
        maxRetries: 3,
        initialDelayMs: 10,
        maxDelayMs: 15,
        backoffMultiplier: 2,
        onRetry,
      });

      const firstDelay = onRetry.mock.calls[0]![2];
      const secondDelay = onRetry.mock.calls[1]![2];

      expect(firstDelay).toBe(10);
      expect(secondDelay).toBe(15);
    });

    it('should handle non-Error thrown values', async () => {
      const fn = vi.fn().mockRejectedValue('string error');

      await expect(withRetry(fn, {
        maxRetries: 0,
        initialDelayMs: 1,
        maxDelayMs: 10,
      })).rejects.toThrow('string error');
    });

    it('should retry on AbortError', async () => {
      const abortError = new Error('aborted');
      abortError.name = 'AbortError';
      const fn = vi.fn()
        .mockRejectedValueOnce(abortError)
        .mockResolvedValue('ok');

      const result = await withRetry(fn, {
        maxRetries: 3,
        initialDelayMs: 1,
        maxDelayMs: 10,
      });

      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should retry on fetch failed error', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('fetch failed'))
        .mockResolvedValue('ok');

      const result = await withRetry(fn, {
        maxRetries: 3,
        initialDelayMs: 1,
        maxDelayMs: 10,
      });

      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should not retry on unknown errors that are not retryable', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('some unknown error'));

      await expect(withRetry(fn, {
        maxRetries: 3,
        initialDelayMs: 1,
        maxDelayMs: 10,
      })).rejects.toThrow('some unknown error');

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should use custom retryableErrors patterns', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('CUSTOM_RETRYABLE'))
        .mockResolvedValue('ok');

      const result = await withRetry(fn, {
        maxRetries: 3,
        initialDelayMs: 1,
        maxDelayMs: 10,
        retryableErrors: ['CUSTOM_RETRYABLE'],
      });

      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should use custom nonRetryableErrors patterns', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('CUSTOM_NON_RETRYABLE'));

      await expect(withRetry(fn, {
        maxRetries: 3,
        initialDelayMs: 1,
        maxDelayMs: 10,
        nonRetryableErrors: ['CUSTOM_NON_RETRYABLE'],
        retryableErrors: ['CUSTOM_NON_RETRYABLE'],
      })).rejects.toThrow('CUSTOM_NON_RETRYABLE');

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should check error.cause for retryable patterns', async () => {
      const error = new Error('request failed');
      (error as unknown as Record<string, unknown>).cause = 'ECONNRESET';

      const fn = vi.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('ok');

      const result = await withRetry(fn, {
        maxRetries: 3,
        initialDelayMs: 1,
        maxDelayMs: 10,
      });

      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('withRetrySafe', () => {
    it('should return success result on success', async () => {
      const fn = vi.fn().mockResolvedValue('data');
      const result = await withRetrySafe(fn, {
        maxRetries: 1,
        initialDelayMs: 1,
        maxDelayMs: 10,
      });

      expect(result).toEqual({ success: true, result: 'data' });
    });

    it('should return failure result on non-retryable error', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Insufficient balance'));
      const result = await withRetrySafe(fn, {
        maxRetries: 1,
        initialDelayMs: 1,
        maxDelayMs: 10,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.lastError.message).toBe('Insufficient balance');
      }
    });

    it('should return failure result after max retries', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('ETIMEDOUT'));
      const result = await withRetrySafe(fn, {
        maxRetries: 1,
        initialDelayMs: 1,
        maxDelayMs: 10,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.lastError.message).toBe('ETIMEDOUT');
      }
    });

    it('should wrap non-Error thrown values', async () => {
      const fn = vi.fn().mockRejectedValue('raw string');
      const result = await withRetrySafe(fn, {
        maxRetries: 0,
        initialDelayMs: 1,
        maxDelayMs: 10,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.lastError).toBeInstanceOf(Error);
      }
    });
  });

  describe('exported constants', () => {
    it('should export BINANCE_RETRYABLE_ERRORS', () => {
      expect(BINANCE_RETRYABLE_ERRORS).toContain('ETIMEDOUT');
      expect(BINANCE_RETRYABLE_ERRORS).toContain('ECONNRESET');
      expect(BINANCE_RETRYABLE_ERRORS).toContain('-1001');
      expect(BINANCE_RETRYABLE_ERRORS).toContain('timeout');
    });

    it('should export BINANCE_NON_RETRYABLE_ERRORS', () => {
      expect(BINANCE_NON_RETRYABLE_ERRORS).toContain('-2010');
      expect(BINANCE_NON_RETRYABLE_ERRORS).toContain('Insufficient balance');
      expect(BINANCE_NON_RETRYABLE_ERRORS).toContain('Invalid symbol');
    });
  });
});
