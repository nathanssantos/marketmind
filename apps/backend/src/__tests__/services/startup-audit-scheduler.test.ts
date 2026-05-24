import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../db', () => ({
  db: { select: vi.fn() },
}));
vi.mock('../../services/binance-futures-client', () => ({
  createBinanceFuturesClient: vi.fn(),
  isPaperWallet: vi.fn(),
  getPositions: vi.fn(),
  getOpenOrders: vi.fn(),
  getOpenAlgoOrders: vi.fn(),
  getAccountInfo: vi.fn(),
}));
vi.mock('../../services/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
  },
}));

import { startPeriodicAuditScheduler } from '../../services/startup-audit';

describe('startPeriodicAuditScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('does not fire the runner before the first interval elapses', async () => {
    const runner = vi.fn().mockResolvedValue([]);
    const scheduler = startPeriodicAuditScheduler({
      intervalMs: 1000,
      runner,
    });

    await vi.advanceTimersByTimeAsync(999);
    expect(runner).not.toHaveBeenCalled();

    scheduler.stop();
  });

  it('fires the runner on each interval tick', async () => {
    const runner = vi.fn().mockResolvedValue([]);
    const scheduler = startPeriodicAuditScheduler({
      intervalMs: 1000,
      runner,
    });

    await vi.advanceTimersByTimeAsync(1000);
    expect(runner).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(runner).toHaveBeenCalledTimes(2);

    scheduler.stop();
  });

  it('passes scope options (feesCap, feesDays, feesRateMs) through to runStartupAudit', async () => {
    const runner = vi.fn().mockResolvedValue([]);
    const scheduler = startPeriodicAuditScheduler({
      intervalMs: 1000,
      feesCap: 1000,
      feesDays: 90,
      feesRateMs: 150,
      runner,
    });

    await vi.advanceTimersByTimeAsync(1000);
    expect(runner).toHaveBeenCalledWith({ feesCap: 1000, feesDays: 90, feesRateMs: 150 });

    scheduler.stop();
  });

  it('survives a single failing tick — keeps firing on subsequent intervals', async () => {
    // Regression: a network blip or a transient Binance 500 used to be
    // able to wedge the scheduler if the rejection wasn't caught. Each
    // tick must be self-contained so a one-off failure doesn't kill
    // the whole weekly reconciliation loop.
    const runner = vi
      .fn()
      .mockRejectedValueOnce(new Error('transient binance outage'))
      .mockResolvedValue([]);
    const scheduler = startPeriodicAuditScheduler({
      intervalMs: 1000,
      runner,
    });

    await vi.advanceTimersByTimeAsync(1000);
    expect(runner).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(runner).toHaveBeenCalledTimes(2);

    scheduler.stop();
  });

  it('stop() halts the loop', async () => {
    const runner = vi.fn().mockResolvedValue([]);
    const scheduler = startPeriodicAuditScheduler({
      intervalMs: 1000,
      runner,
    });

    await vi.advanceTimersByTimeAsync(1000);
    expect(runner).toHaveBeenCalledTimes(1);

    scheduler.stop();

    await vi.advanceTimersByTimeAsync(5000);
    expect(runner).toHaveBeenCalledTimes(1);
  });
});
