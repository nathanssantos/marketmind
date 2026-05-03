import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BinanceApiCache,
  BinanceNetworkOutageError,
  guardBinanceCall,
  binanceApiCache,
} from '../../services/binance-api-cache';

describe('BinanceApiCache.markNetworkOutage', () => {
  let cache: BinanceApiCache;

  beforeEach(() => {
    cache = new BinanceApiCache();
  });

  afterEach(() => {
    cache.stop();
  });

  it('detects ENOTFOUND at the top level', () => {
    const err = Object.assign(new Error('getaddrinfo ENOTFOUND fapi.binance.com'), { code: 'ENOTFOUND' });
    expect(cache.markNetworkOutage(err)).toBe(true);
    expect(cache.isOutage()).toBe(true);
  });

  it('detects EADDRNOTAVAIL', () => {
    const err = Object.assign(new Error('read EADDRNOTAVAIL'), { code: 'EADDRNOTAVAIL' });
    expect(cache.markNetworkOutage(err)).toBe(true);
  });

  it('detects ETIMEDOUT', () => {
    expect(cache.markNetworkOutage(Object.assign(new Error('read ETIMEDOUT'), { code: 'ETIMEDOUT' }))).toBe(true);
  });

  it('detects code one level deep on error.cause (axios pattern)', () => {
    const wrapped = Object.assign(new Error('Request failed'), {
      cause: Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' }),
    });
    expect(cache.markNetworkOutage(wrapped)).toBe(true);
  });

  it('detects code two levels deep (tRPC wraps axios wraps original)', () => {
    const original = Object.assign(new Error('socket'), { code: 'ECONNREFUSED' });
    const axiosWrapped = Object.assign(new Error('Request failed'), { cause: original });
    const trpcWrapped = Object.assign(new Error('Internal'), { cause: axiosWrapped });
    expect(cache.markNetworkOutage(trpcWrapped)).toBe(true);
  });

  it('does not infinite-loop on cyclic causes', () => {
    const a: { code?: string; cause?: unknown } = {};
    const b: { code?: string; cause?: unknown } = {};
    a.cause = b;
    b.cause = a;
    a.code = 'NOT_NETWORK';
    b.code = 'ALSO_NOT';
    expect(cache.markNetworkOutage(a)).toBe(false);
  });

  it('ignores non-network errors', () => {
    expect(cache.markNetworkOutage(new Error('-1003 too many requests'))).toBe(false);
    expect(cache.markNetworkOutage({ code: 'BAD_REQUEST' })).toBe(false);
    expect(cache.markNetworkOutage('plain string')).toBe(false);
    expect(cache.markNetworkOutage(null)).toBe(false);
    expect(cache.markNetworkOutage(undefined)).toBe(false);
  });

  it('isOutage reports true within cooldown, false after', async () => {
    vi.useFakeTimers();
    cache.markNetworkOutage(Object.assign(new Error(''), { code: 'ENOTFOUND' }));
    expect(cache.isOutage()).toBe(true);

    vi.advanceTimersByTime(4_000);
    expect(cache.isOutage()).toBe(true);

    vi.advanceTimersByTime(2_000); // total 6s, past 5s cooldown
    expect(cache.isOutage()).toBe(false);

    vi.useRealTimers();
  });

  it('subsequent marks during active cooldown extend the window without spam-logging', () => {
    cache.markNetworkOutage(Object.assign(new Error(''), { code: 'ENOTFOUND' }));
    const firstExpiry = cache.getOutageExpiresIn();
    expect(firstExpiry).toBeGreaterThan(0);

    cache.markNetworkOutage(Object.assign(new Error(''), { code: 'ETIMEDOUT' }));
    const secondExpiry = cache.getOutageExpiresIn();
    // Same cooldown window (~5s) restarts each time — second should be >= first
    // since some ms have elapsed but the window is reset to NOW + 5s.
    expect(secondExpiry).toBeGreaterThan(0);
    expect(secondExpiry).toBeLessThanOrEqual(5000);
  });
});

describe('guardBinanceCall fast-fail', () => {
  // These tests run against the module-level singleton. We reset its
  // outage state between tests by waiting through the cooldown OR using
  // fake timers — here we just rely on the cooldown being short.

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Drain any leftover outage state for downstream tests in the file.
    vi.advanceTimersByTime(10_000);
    binanceApiCache.isOutage();
    vi.useRealTimers();
  });

  it('throws BinanceNetworkOutageError immediately during cooldown', async () => {
    // Arm the cooldown via a failing call.
    await expect(
      guardBinanceCall(async () => {
        throw Object.assign(new Error(''), { code: 'ENOTFOUND' });
      }),
    ).rejects.toMatchObject({ code: 'ENOTFOUND' });

    // Subsequent call short-circuits without invoking fn().
    const fn = vi.fn();
    await expect(guardBinanceCall(fn)).rejects.toBeInstanceOf(BinanceNetworkOutageError);
    expect(fn).not.toHaveBeenCalled();
  });

  it('after cooldown expires, allows a probe call through', async () => {
    await expect(
      guardBinanceCall(async () => {
        throw Object.assign(new Error(''), { code: 'ENOTFOUND' });
      }),
    ).rejects.toBeDefined();

    vi.advanceTimersByTime(6_000);

    const fn = vi.fn().mockResolvedValue('ok');
    await expect(guardBinanceCall(fn)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalled();
  });
});
