import { describe, expect, it, vi } from 'vitest';
import { withRetry } from '../../utils/retry';

const opts = { maxRetries: 2, initialDelayMs: 1, maxDelayMs: 2 };

describe('withRetry classification', () => {
  it('retries a retryable error then succeeds', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('ETIMEDOUT'))
      .mockResolvedValueOnce('ok');
    await expect(withRetry(fn, opts)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry a non-retryable error (Invalid symbol / -1121)', async () => {
    const fn = vi.fn().mockRejectedValue(Object.assign(new Error('Invalid symbol'), { code: -1121 }));
    await expect(withRetry(fn, opts)).rejects.toBeDefined();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('code-aware: a retryable code with no matching message text is still retried', async () => {
    // -1021 carried only on the SDK `code` field — the old message+cause
    // string match would have missed it and treated it as non-retryable.
    const fn = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('request failed'), { code: -1021 }))
      .mockResolvedValueOnce('recovered');
    await expect(withRetry(fn, opts)).resolves.toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('code-aware: a non-retryable code (-2011) with vague message is not retried', async () => {
    const fn = vi.fn().mockRejectedValue(Object.assign(new Error('failed'), { code: -2011 }));
    await expect(withRetry(fn, opts)).rejects.toBeDefined();
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
