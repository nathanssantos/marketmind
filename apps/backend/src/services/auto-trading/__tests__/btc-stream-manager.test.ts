import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MarketType } from '@marketmind/types';

vi.mock('../../../utils/kline-calculator', () => ({
  calculateRequiredKlines: vi.fn(() => 500),
}));

vi.mock('../../kline-maintenance', () => ({
  getKlineMaintenance: vi.fn(() => ({
    forceCheckSymbol: vi.fn(),
  })),
}));

vi.mock('../../kline-prefetch', () => ({
  prefetchKlines: vi.fn(),
}));

vi.mock('../../../utils/errors', () => ({
  serializeError: vi.fn((e: unknown) => String(e)),
}));

vi.mock('../utils', () => ({
  log: vi.fn(),
}));

const mockBinanceSubscribe = vi.fn();
const mockBinanceUnsubscribe = vi.fn();
const mockFuturesSubscribe = vi.fn();
const mockFuturesUnsubscribe = vi.fn();

vi.mock('../../binance-kline-stream', () => ({
  binanceKlineStreamService: {
    subscribe: mockBinanceSubscribe,
    unsubscribe: mockBinanceUnsubscribe,
  },
  binanceFuturesKlineStreamService: {
    subscribe: mockFuturesSubscribe,
    unsubscribe: mockFuturesUnsubscribe,
  },
}));

import { BtcStreamManager } from '../btc-stream-manager';
import type { ActiveWatcher, BtcStreamManagerDeps } from '../types';
import { prefetchKlines } from '../../kline-prefetch';

const createDeps = (overrides: Partial<BtcStreamManagerDeps> = {}): BtcStreamManagerDeps => ({
  getCachedConfig: vi.fn().mockResolvedValue({ useBtcCorrelationFilter: true }),
  getActiveWatchers: vi.fn(() => new Map()),
  ...overrides,
});

const createWatcher = (overrides: Partial<ActiveWatcher> = {}): ActiveWatcher => ({
  walletId: 'w1',
  userId: 'u1',
  symbol: 'ETHUSDT',
  interval: '1h',
  marketType: 'FUTURES' as MarketType,
  exchange: 'BINANCE',
  enabledStrategies: [],
  lastProcessedTime: Date.now(),
  intervalId: setInterval(() => {}, 999999),
  isManual: false,
  ...overrides,
});

describe('BtcStreamManager', () => {
  let manager: BtcStreamManager;
  let deps: BtcStreamManagerDeps;

  beforeEach(() => {
    vi.clearAllMocks();
    deps = createDeps();
    manager = new BtcStreamManager(deps);
  });

  describe('ensureBtcKlineStream', () => {
    it('should skip if BTC correlation filter is disabled', async () => {
      deps = createDeps({
        getCachedConfig: vi.fn().mockResolvedValue({ useBtcCorrelationFilter: false }),
      });
      manager = new BtcStreamManager(deps);

      await manager.ensureBtcKlineStream('w1', 'u1', '1h', 'FUTURES');

      expect(prefetchKlines).not.toHaveBeenCalled();
      expect(mockFuturesSubscribe).not.toHaveBeenCalled();
    });

    it('should skip if config is null', async () => {
      deps = createDeps({ getCachedConfig: vi.fn().mockResolvedValue(null) });
      manager = new BtcStreamManager(deps);

      await manager.ensureBtcKlineStream('w1', 'u1', '1h', 'FUTURES');
      expect(prefetchKlines).not.toHaveBeenCalled();
    });

    it('should skip if already subscribed to this stream', async () => {
      await manager.ensureBtcKlineStream('w1', 'u1', '1h', 'FUTURES');
      vi.clearAllMocks();

      await manager.ensureBtcKlineStream('w1', 'u1', '1h', 'FUTURES');
      expect(prefetchKlines).not.toHaveBeenCalled();
    });

    it('should skip if existing BTC watcher exists for interval', async () => {
      const watchers = new Map<string, ActiveWatcher>();
      watchers.set('key', createWatcher({ symbol: 'BTCUSDT', interval: '1h', marketType: 'FUTURES' }));
      deps = createDeps({ getActiveWatchers: vi.fn(() => watchers) });
      manager = new BtcStreamManager(deps);

      await manager.ensureBtcKlineStream('w1', 'u1', '1h', 'FUTURES');
      expect(prefetchKlines).not.toHaveBeenCalled();
    });

    it('should subscribe to FUTURES stream', async () => {
      await manager.ensureBtcKlineStream('w1', 'u1', '1h', 'FUTURES');

      expect(prefetchKlines).toHaveBeenCalledWith(
        expect.objectContaining({ symbol: 'BTCUSDT', interval: '1h', marketType: 'FUTURES' })
      );
      expect(mockFuturesSubscribe).toHaveBeenCalledWith('BTCUSDT', '1h');
      expect(manager.isStreamSubscribed('BTCUSDT', '1h', 'FUTURES')).toBe(true);
    });

    it('should subscribe to SPOT stream', async () => {
      await manager.ensureBtcKlineStream('w1', 'u1', '1h', 'SPOT');

      expect(mockBinanceSubscribe).toHaveBeenCalledWith('BTCUSDT', '1h');
      expect(manager.isStreamSubscribed('BTCUSDT', '1h', 'SPOT')).toBe(true);
    });

    it('should handle maintenance check failure gracefully', async () => {
      const { getKlineMaintenance } = await import('../../kline-maintenance');
      vi.mocked(getKlineMaintenance).mockReturnValue({
        forceCheckSymbol: vi.fn().mockRejectedValue(new Error('maintenance failed')),
      } as never);

      await expect(manager.ensureBtcKlineStream('w1', 'u1', '1h', 'FUTURES')).resolves.not.toThrow();
      expect(mockFuturesSubscribe).toHaveBeenCalled();
    });
  });

  describe('cleanupBtcKlineStreamIfNeeded', () => {
    it('should skip if not subscribed', async () => {
      await manager.cleanupBtcKlineStreamIfNeeded('1h', 'FUTURES');
      expect(mockFuturesUnsubscribe).not.toHaveBeenCalled();
    });

    it('should not unsubscribe if active watchers exist for interval', async () => {
      await manager.ensureBtcKlineStream('w1', 'u1', '1h', 'FUTURES');

      const watchers = new Map<string, ActiveWatcher>();
      watchers.set('key', createWatcher({ symbol: 'ETHUSDT', interval: '1h', marketType: 'FUTURES' }));
      deps = createDeps({ getActiveWatchers: vi.fn(() => watchers) });
      (manager as any).deps = deps;

      await manager.cleanupBtcKlineStreamIfNeeded('1h', 'FUTURES');
      expect(mockFuturesUnsubscribe).not.toHaveBeenCalled();
    });

    it('should unsubscribe FUTURES stream when no more watchers', async () => {
      await manager.ensureBtcKlineStream('w1', 'u1', '1h', 'FUTURES');
      vi.clearAllMocks();

      await manager.cleanupBtcKlineStreamIfNeeded('1h', 'FUTURES');

      expect(mockFuturesUnsubscribe).toHaveBeenCalledWith('BTCUSDT', '1h');
      expect(manager.isStreamSubscribed('BTCUSDT', '1h', 'FUTURES')).toBe(false);
    });

    it('should unsubscribe SPOT stream when no more watchers', async () => {
      await manager.ensureBtcKlineStream('w1', 'u1', '1h', 'SPOT');
      vi.clearAllMocks();

      await manager.cleanupBtcKlineStreamIfNeeded('1h', 'SPOT');

      expect(mockBinanceUnsubscribe).toHaveBeenCalledWith('BTCUSDT', '1h');
    });
  });

  describe('isStreamSubscribed', () => {
    it('should return false for non-subscribed stream', () => {
      expect(manager.isStreamSubscribed('BTCUSDT', '1h', 'FUTURES')).toBe(false);
    });

    it('should return true for subscribed stream', async () => {
      await manager.ensureBtcKlineStream('w1', 'u1', '1h', 'FUTURES');
      expect(manager.isStreamSubscribed('BTCUSDT', '1h', 'FUTURES')).toBe(true);
    });
  });
});
