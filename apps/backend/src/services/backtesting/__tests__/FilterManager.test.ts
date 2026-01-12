import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Kline } from '@marketmind/types';

vi.mock('@marketmind/indicators', () => ({
  calculateEMA: vi.fn(() => [50000, 50100, 50200, 50300, 50400]),
}));

vi.mock('../../../utils/filters', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../utils/filters')>();
  return {
    ...original,
    ADX_FILTER: { MIN_KLINES_REQUIRED: 30 },
    checkAdxCondition: vi.fn(() => ({ isAllowed: true, reason: 'ADX passed' })),
    STOCHASTIC_FILTER: { PERIOD: 14, LOOKBACK_BUFFER: 3 },
    checkStochasticCondition: vi.fn(() => ({ isAllowed: true, reason: 'Stochastic passed' })),
    checkTrendCondition: vi.fn(() => ({ isAllowed: true, ema21: 50000, price: 51000, isBullish: true, isBearish: false, reason: 'Trend passed' })),
  };
});

import { FilterManager, type FilterConfig } from '../FilterManager';
import { calculateEMA } from '@marketmind/indicators';
import { checkAdxCondition, checkStochasticCondition, checkTrendCondition } from '../../../utils/filters';

const createMockKlines = (count: number): Kline[] => {
  return Array(count).fill(null).map((_, i) => ({
    openTime: Date.now() + i * 3600000,
    closeTime: Date.now() + (i + 1) * 3600000,
    open: String(50000 + i * 100),
    high: String(50500 + i * 100),
    low: String(49500 + i * 100),
    close: String(50100 + i * 100),
    volume: '1000',
    quoteVolume: '50000000',
    trades: 1000,
    takerBuyBaseVolume: '500',
    takerBuyQuoteVolume: '25000000',
  }));
};

describe('FilterManager', () => {
  let manager: FilterManager;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(calculateEMA).mockReturnValue([50000, 50100, 50200, 50300, 50400]);
    vi.mocked(checkAdxCondition).mockReturnValue({ isAllowed: true, adx: 25, plusDI: 30, minusDI: 15, isBullish: true, isBearish: false, isStrongTrend: true, reason: 'ADX passed' });
    vi.mocked(checkStochasticCondition).mockReturnValue({ isAllowed: true, currentK: 50, currentD: 48, isOversold: false, isOverbought: false, reason: 'Stochastic passed' });
    vi.mocked(checkTrendCondition).mockReturnValue({ isAllowed: true, ema21: 50000, price: 51000, isBullish: true, isBearish: false, reason: 'Trend passed' });
    manager = new FilterManager({});
  });

  describe('constructor', () => {
    it('should create with default config', () => {
      const fm = new FilterManager({});
      expect(fm).toBeDefined();
      expect(fm.stats.skippedTrend).toBe(0);
    });

    it('should create with custom config', () => {
      const config: FilterConfig = {
        onlyLong: true,
        onlyWithTrend: true,
        trendFilterPeriod: 100,
        useCooldown: true,
        cooldownMinutes: 30,
      };
      const fm = new FilterManager(config);
      expect(fm).toBeDefined();
    });
  });

  describe('initialize', () => {
    it('should calculate EMA trend for klines', async () => {
      const klines = createMockKlines(250);
      await manager.initialize(klines, '2024-01-01', '2024-12-31', 'BTCUSDT');

      expect(calculateEMA).toHaveBeenCalled();
      expect(manager.getEmaTrend()).toHaveLength(5);
    });

    it('should use custom trend period', async () => {
      const customManager = new FilterManager({ trendFilterPeriod: 100 });
      const klines = createMockKlines(150);

      await customManager.initialize(klines, '2024-01-01', '2024-12-31', 'BTCUSDT');

      expect(calculateEMA).toHaveBeenCalledWith(klines, 100);
    });
  });

  describe('checkMaxPositions', () => {
    it('should allow when below max positions', () => {
      const openPositions = [
        { exitTime: Date.now() + 3600000, positionValue: 1000 },
        { exitTime: Date.now() + 7200000, positionValue: 1000 },
      ];

      const result = manager.checkMaxPositions(openPositions, Date.now());

      expect(result).toBe(true);
    });

    it('should block when at max positions', () => {
      const customManager = new FilterManager({ maxConcurrentPositions: 2 });
      const openPositions = [
        { exitTime: Date.now() + 3600000, positionValue: 1000 },
        { exitTime: Date.now() + 7200000, positionValue: 1000 },
      ];

      const result = customManager.checkMaxPositions(openPositions, Date.now());

      expect(result).toBe(false);
      expect(customManager.stats.skippedMaxPositions).toBe(1);
    });

    it('should not count closed positions', () => {
      const customManager = new FilterManager({ maxConcurrentPositions: 2 });
      const now = Date.now();
      const openPositions = [
        { exitTime: now - 3600000, positionValue: 1000 },
        { exitTime: now + 3600000, positionValue: 1000 },
      ];

      const result = customManager.checkMaxPositions(openPositions, now);

      expect(result).toBe(true);
    });
  });

  describe('checkDailyLossLimit', () => {
    it('should allow when no daily loss limit configured', () => {
      const result = manager.checkDailyLossLimit(Date.now());
      expect(result).toBe(true);
    });

    it('should allow when daily loss limit not reached', () => {
      const customManager = new FilterManager({ dailyLossLimit: 5 });

      const result = customManager.checkDailyLossLimit(Date.now());

      expect(result).toBe(true);
    });

    it('should block when daily loss limit reached', () => {
      const customManager = new FilterManager({ dailyLossLimit: 5 });
      const now = Date.now();

      customManager.checkDailyLossLimit(now);
      customManager.updateDailyPnl(-600, 10000);

      const result = customManager.checkDailyLossLimit(now);

      expect(result).toBe(false);
      expect(customManager.stats.skippedDailyLossLimit).toBe(1);
    });

    it('should reset daily loss on new day', () => {
      const customManager = new FilterManager({ dailyLossLimit: 5 });
      const yesterday = Date.now() - 24 * 60 * 60 * 1000;
      const today = Date.now();

      customManager.checkDailyLossLimit(yesterday);
      customManager.updateDailyPnl(-600, 10000);

      const result = customManager.checkDailyLossLimit(today);

      expect(result).toBe(true);
    });
  });

  describe('updateDailyPnl', () => {
    it('should track cumulative PnL', () => {
      const customManager = new FilterManager({ dailyLossLimit: 10 });
      customManager.checkDailyLossLimit(Date.now());

      customManager.updateDailyPnl(-200, 10000);
      expect(customManager.checkDailyLossLimit(Date.now())).toBe(true);

      customManager.updateDailyPnl(-200, 10000);
      expect(customManager.checkDailyLossLimit(Date.now())).toBe(true);

      customManager.updateDailyPnl(-700, 10000);
      expect(customManager.checkDailyLossLimit(Date.now())).toBe(false);
    });
  });

  describe('checkCooldown', () => {
    it('should allow when cooldown disabled', () => {
      const result = manager.checkCooldown('setup1', 'BTCUSDT', '1h', Date.now());
      expect(result).toBe(true);
    });

    it('should allow first trade for setup', () => {
      const customManager = new FilterManager({ useCooldown: true, cooldownMinutes: 15 });

      const result = customManager.checkCooldown('setup1', 'BTCUSDT', '1h', Date.now());

      expect(result).toBe(true);
    });

    it('should block trade during cooldown', () => {
      const customManager = new FilterManager({ useCooldown: true, cooldownMinutes: 15 });
      const now = Date.now();

      customManager.updateCooldown('setup1', 'BTCUSDT', '1h', now);

      const result = customManager.checkCooldown('setup1', 'BTCUSDT', '1h', now + 5 * 60 * 1000);

      expect(result).toBe(false);
      expect(customManager.stats.skippedCooldown).toBe(1);
    });

    it('should allow trade after cooldown expires', () => {
      const customManager = new FilterManager({ useCooldown: true, cooldownMinutes: 15 });
      const now = Date.now();

      customManager.updateCooldown('setup1', 'BTCUSDT', '1h', now);

      const result = customManager.checkCooldown('setup1', 'BTCUSDT', '1h', now + 20 * 60 * 1000);

      expect(result).toBe(true);
    });

    it('should track cooldown per setup/symbol/interval combination', () => {
      const customManager = new FilterManager({ useCooldown: true, cooldownMinutes: 15 });
      const now = Date.now();

      customManager.updateCooldown('setup1', 'BTCUSDT', '1h', now);

      expect(customManager.checkCooldown('setup2', 'BTCUSDT', '1h', now + 60000)).toBe(true);
      expect(customManager.checkCooldown('setup1', 'ETHUSDT', '1h', now + 60000)).toBe(true);
      expect(customManager.checkCooldown('setup1', 'BTCUSDT', '4h', now + 60000)).toBe(true);
    });
  });

  describe('checkDirection', () => {
    it('should allow all directions when onlyLong is false', () => {
      expect(manager.checkDirection('LONG')).toBe(true);
      expect(manager.checkDirection('SHORT')).toBe(true);
    });

    it('should block SHORT when onlyLong is true', () => {
      const customManager = new FilterManager({ onlyLong: true });

      expect(customManager.checkDirection('LONG')).toBe(true);
      expect(customManager.checkDirection('SHORT')).toBe(false);
    });
  });

  describe('checkStochasticFilter', () => {
    it('should allow when stochastic filter disabled', () => {
      const klines = createMockKlines(50);
      const result = manager.checkStochasticFilter(klines, 30, 'LONG', 0);
      expect(result).toBe(true);
      expect(checkStochasticCondition).not.toHaveBeenCalled();
    });

    it('should call stochastic condition check when enabled', () => {
      const customManager = new FilterManager({ useStochasticFilter: true });
      const klines = createMockKlines(50);

      const result = customManager.checkStochasticFilter(klines, 30, 'LONG', 0);

      expect(result).toBe(true);
      expect(checkStochasticCondition).toHaveBeenCalled();
    });

    it('should block when stochastic condition fails', () => {
      vi.mocked(checkStochasticCondition).mockReturnValue({ isAllowed: false, currentK: 85, currentD: 82, isOversold: false, isOverbought: true, reason: 'LONG blocked: K is overbought' });
      const customManager = new FilterManager({ useStochasticFilter: true });
      const klines = createMockKlines(50);

      const result = customManager.checkStochasticFilter(klines, 30, 'LONG', 0);

      expect(result).toBe(false);
      expect(customManager.stats.skippedStochastic).toBe(1);
    });

    it('should allow when insufficient klines', () => {
      const customManager = new FilterManager({ useStochasticFilter: true });
      const klines = createMockKlines(10);

      const result = customManager.checkStochasticFilter(klines, 5, 'LONG', 0);

      expect(result).toBe(true);
    });
  });

  describe('checkAdxFilter', () => {
    it('should allow when ADX filter disabled', () => {
      const klines = createMockKlines(50);
      const result = manager.checkAdxFilter(klines, 35, 'LONG', 0);
      expect(result).toBe(true);
      expect(checkAdxCondition).not.toHaveBeenCalled();
    });

    it('should call ADX condition check when enabled', () => {
      const customManager = new FilterManager({ useAdxFilter: true });
      const klines = createMockKlines(50);

      const result = customManager.checkAdxFilter(klines, 35, 'LONG', 0);

      expect(result).toBe(true);
      expect(checkAdxCondition).toHaveBeenCalled();
    });

    it('should block when ADX condition fails', () => {
      vi.mocked(checkAdxCondition).mockReturnValue({ isAllowed: false, adx: 15, plusDI: 20, minusDI: 25, isBullish: false, isBearish: true, isStrongTrend: false, reason: 'ADX too low' });
      const customManager = new FilterManager({ useAdxFilter: true });
      const klines = createMockKlines(50);

      const result = customManager.checkAdxFilter(klines, 35, 'LONG', 0);

      expect(result).toBe(false);
      expect(customManager.stats.skippedAdx).toBe(1);
    });
  });

  describe('checkTrendFilter', () => {
    it('should allow when trend filter disabled', () => {
      const klines = createMockKlines(250);

      const result = manager.checkTrendFilter(klines, 2, 'LONG', false, 0);

      expect(result).toBe(true);
      expect(checkTrendCondition).not.toHaveBeenCalled();
    });

    it('should allow LONG when price above EMA', () => {
      vi.mocked(checkTrendCondition).mockReturnValue({ isAllowed: true, ema21: 50000, price: 51000, isBullish: true, isBearish: false, reason: 'LONG allowed: price above EMA21' });
      const klines = createMockKlines(250);

      const result = manager.checkTrendFilter(klines, 2, 'LONG', true, 0);

      expect(result).toBe(true);
      expect(checkTrendCondition).toHaveBeenCalledWith(expect.any(Array), 'LONG');
    });

    it('should block LONG when price below EMA', () => {
      vi.mocked(checkTrendCondition).mockReturnValue({ isAllowed: false, ema21: 50000, price: 49000, isBullish: false, isBearish: true, reason: 'LONG blocked: price below EMA21' });
      const klines = createMockKlines(250);

      const result = manager.checkTrendFilter(klines, 2, 'LONG', true, 0);

      expect(result).toBe(false);
      expect(manager.stats.skippedTrend).toBe(1);
    });

    it('should allow SHORT when price below EMA', () => {
      vi.mocked(checkTrendCondition).mockReturnValue({ isAllowed: true, ema21: 50000, price: 49000, isBullish: false, isBearish: true, reason: 'SHORT allowed: price below EMA21' });
      const klines = createMockKlines(250);

      const result = manager.checkTrendFilter(klines, 2, 'SHORT', true, 0);

      expect(result).toBe(true);
    });

    it('should block SHORT when price above EMA', () => {
      vi.mocked(checkTrendCondition).mockReturnValue({ isAllowed: false, ema21: 50000, price: 51000, isBullish: true, isBearish: false, reason: 'SHORT blocked: price above EMA21' });
      const klines = createMockKlines(250);

      const result = manager.checkTrendFilter(klines, 2, 'SHORT', true, 0);

      expect(result).toBe(false);
      expect(manager.stats.skippedTrend).toBe(1);
    });

    it('should pass when klines too short', () => {
      const klines = createMockKlines(1);

      const result = manager.checkTrendFilter(klines, 0, 'LONG', true, 0);

      expect(result).toBe(true);
    });
  });

  describe('checkMaxExposure', () => {
    it('should allow when within max exposure', () => {
      const result = manager.checkMaxExposure(5000, 1000, 10000);
      expect(result).toBe(true);
    });

    it('should block when exceeds max exposure', () => {
      const result = manager.checkMaxExposure(8000, 3000, 10000);
      expect(result).toBe(false);
      expect(manager.stats.skippedMaxExposure).toBe(1);
    });

    it('should use custom max exposure', () => {
      const customManager = new FilterManager({ maxTotalExposure: 0.5 });

      const result = customManager.checkMaxExposure(4000, 2000, 10000);

      expect(result).toBe(false);
      expect(customManager.stats.skippedMaxExposure).toBe(1);
    });
  });

  describe('increment methods', () => {
    it('should increment klineNotFound', () => {
      manager.incrementKlineNotFound();
      expect(manager.stats.skippedKlineNotFound).toBe(1);
    });

    it('should increment minNotional', () => {
      manager.incrementMinNotional();
      expect(manager.stats.skippedMinNotional).toBe(1);
    });

    it('should increment minProfit', () => {
      manager.incrementMinProfit();
      expect(manager.stats.skippedMinProfit).toBe(1);
    });

    it('should increment riskReward', () => {
      manager.incrementRiskReward();
      expect(manager.stats.skippedRiskReward).toBe(1);
    });

    it('should increment limitExpired', () => {
      manager.incrementLimitExpired();
      expect(manager.stats.skippedLimitExpired).toBe(1);
    });
  });

  describe('getSkipStats', () => {
    it('should return copy of stats', () => {
      manager.incrementKlineNotFound();
      manager.incrementMinNotional();

      const stats = manager.getSkipStats();

      expect(stats.skippedKlineNotFound).toBe(1);
      expect(stats.skippedMinNotional).toBe(1);

      manager.incrementKlineNotFound();
      expect(stats.skippedKlineNotFound).toBe(1);
    });
  });

  describe('getTotalSkipped', () => {
    it('should return sum of all skipped counts', () => {
      manager.incrementKlineNotFound();
      manager.incrementKlineNotFound();
      manager.incrementMinNotional();
      manager.incrementRiskReward();

      const total = manager.getTotalSkipped();

      expect(total).toBe(4);
    });

    it('should return 0 when no skips', () => {
      expect(manager.getTotalSkipped()).toBe(0);
    });
  });
});
