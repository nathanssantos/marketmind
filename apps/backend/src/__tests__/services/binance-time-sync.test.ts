import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetServerTime = vi.fn();

vi.mock('binance', () => ({
  USDMClient: class MockUSDMClient {
    getServerTime(...args: unknown[]): unknown {
      return mockGetServerTime(...args);
    }
    setTimeOffset(): void {}
  },
}));

vi.mock('../../services/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), trace: vi.fn() },
  serializeError: (e: unknown) => e,
}));

import {
  applyBinanceTimeOffset,
  getBinanceTimeOffset,
  refreshBinanceTimeOffset,
  startBinanceTimeSync,
  stopBinanceTimeSync,
} from '../../services/binance-time-sync';

describe('binance-time-sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stopBinanceTimeSync();
  });

  afterEach(() => {
    stopBinanceTimeSync();
    vi.useRealTimers();
  });

  it('computes a negative offset when the local clock is AHEAD of Binance', async () => {
    // Local clock reads ~1000ms ahead of server time — the exact -1021
    // scenario. Date.now() pinned so the drift math is deterministic.
    const localNow = 1_780_000_001_000;
    vi.spyOn(Date, 'now').mockReturnValue(localNow);
    // Server is 1000ms behind local.
    mockGetServerTime.mockResolvedValue(localNow - 1000);

    await startBinanceTimeSync();

    // offset = serverTime - end + avgDrift; with zero measured latency
    // (Date.now constant) avgDrift = 0 → offset ≈ -1000. Adding it to
    // Date.now() yields a timestamp aligned with the server.
    expect(getBinanceTimeOffset()).toBe(-1000);
  });

  it('computes a positive offset when the local clock is BEHIND Binance', async () => {
    const localNow = 1_780_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(localNow);
    mockGetServerTime.mockResolvedValue(localNow + 1500);

    await startBinanceTimeSync();

    expect(getBinanceTimeOffset()).toBe(1500);
  });

  it('stamps the current offset onto a client via setTimeOffset', async () => {
    const localNow = 1_780_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(localNow);
    mockGetServerTime.mockResolvedValue(localNow - 800);
    await startBinanceTimeSync();

    const client = { setTimeOffset: vi.fn(), getTimeOffset: () => 0 };
    applyBinanceTimeOffset(client);

    expect(client.setTimeOffset).toHaveBeenCalledWith(-800);
    // getTimeOffset is overridden to read the LIVE offset, not the seeded snapshot.
    expect(client.getTimeOffset()).toBe(-800);
  });

  it('keeps the last known offset when a refresh fails (no reset to 0)', async () => {
    const localNow = 1_780_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(localNow);
    mockGetServerTime.mockResolvedValueOnce(localNow - 1200);
    await startBinanceTimeSync();
    expect(getBinanceTimeOffset()).toBe(-1200);

    // Simulate the periodic refresh hitting a transient /time outage.
    mockGetServerTime.mockRejectedValueOnce(new Error('network down'));
    // Re-arm a fresh sync run (stop first so startBinanceTimeSync isn't a no-op).
    stopBinanceTimeSync();
    await startBinanceTimeSync();

    // The failed fetch must not wipe the previously-good offset.
    expect(getBinanceTimeOffset()).toBe(-1200);
  });

  it('is idempotent — a second start() does not double-arm', async () => {
    const localNow = 1_780_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(localNow);
    mockGetServerTime.mockResolvedValue(localNow);

    await startBinanceTimeSync();
    await startBinanceTimeSync();

    // Only the first start performs the bootstrap fetch.
    expect(mockGetServerTime).toHaveBeenCalledTimes(1);
  });

  it('refreshBinanceTimeOffset dedupes concurrent re-syncs into one /time fetch', async () => {
    const localNow = 1_780_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(localNow);
    // Slow fetch so the three calls overlap in-flight.
    let resolveFetch: (v: number) => void = () => {};
    mockGetServerTime.mockReturnValue(new Promise<number>((r) => { resolveFetch = r; }));

    const a = refreshBinanceTimeOffset();
    const b = refreshBinanceTimeOffset();
    const c = refreshBinanceTimeOffset();
    resolveFetch(localNow - 700);
    await Promise.all([a, b, c]);

    // A burst of -1021s must collapse into a single server-time fetch.
    expect(mockGetServerTime).toHaveBeenCalledTimes(1);
    expect(getBinanceTimeOffset()).toBe(-700);
  });
});
