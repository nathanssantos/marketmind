import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Kline } from '@marketmind/types';

vi.mock('@marketmind/indicators', () => ({
  calculateEMA: vi.fn(() => [50000, 50100, 50200, 50300, 50400]),
  CHOPPINESS_FILTER: { DEFAULT_PERIOD: 14, HIGH_THRESHOLD: 61.8, LOW_THRESHOLD: 38.2 },
  detectTrendByEMA: vi.fn(() => ({
    direction: 'BULLISH',
    isClearTrend: true,
    strength: 50,
    method: 'ema',
    details: { price: 51000, ema: { value: 50000, period: 21, pricePosition: 'above' } },
  })),
}));

vi.mock('../../../utils/confluence-scoring', () => ({
  calculateConfluenceScore: vi.fn(() => ({
    isAllowed: true,
    totalScore: 75,
    maxPossibleScore: 110,
    scorePercent: 68,
    contributions: [],
    alignmentBonus: 10,
    recommendation: 'MODERATE_ENTRY',
    reason: 'Confluence score 75/110 (68%) - MODERATE_ENTRY',
  })),
}));

vi.mock('../../../utils/filters', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../utils/filters')>();
  return {
    ...original,
    ADX_FILTER: { MIN_KLINES_REQUIRED: 30 },
    checkAdxCondition: vi.fn(() => ({ isAllowed: true, reason: 'ADX passed' })),
    STOCHASTIC_FILTER: { K_PERIOD: 14, K_SMOOTHING: 3, D_PERIOD: 3 },
    checkStochasticCondition: vi.fn(() => ({ isAllowed: true, reason: 'Stochastic passed' })),
    checkStochasticRecoveryCondition: vi.fn(() => ({ isAllowed: true, reason: 'Stochastic Recovery passed' })),
    checkStochasticHtfCondition: vi.fn(() => ({ isAllowed: true, reason: 'LONG allowed (HTF): oversold', currentK: 15, currentD: 18, isOversold: true, isOverbought: false })),
    checkStochasticRecoveryHtfCondition: vi.fn(() => ({ isAllowed: true, reason: 'LONG allowed (HTF): recovering from oversold', currentK: 30, currentD: 28, isOversold: false, isOverbought: false })),
    checkTrendCondition: vi.fn(() => ({ isAllowed: true, ema21: 50000, price: 51000, isBullish: true, isBearish: false, reason: 'Trend passed' })),
    checkMomentumTiming: vi.fn(() => ({ isAllowed: true, rsiValue: 55, rsiPrevValue: 53, rsiMomentum: 'RISING', mfiValue: 60, mfiConfirmation: true, reason: 'Momentum passed' })),
    MOMENTUM_TIMING_FILTER: { MIN_KLINES_REQUIRED: 20, RSI_PERIOD: 14, MFI_PERIOD: 14, RSI_LONG_MIN: 40, RSI_SHORT_MAX: 60, RSI_PULLBACK_LONG_MIN: 30, RSI_PULLBACK_SHORT_MAX: 70, MFI_LONG_MIN: 30, MFI_SHORT_MAX: 70 },
    MTF_FILTER: { EMA_SHORT_PERIOD: 50, EMA_LONG_PERIOD: 200, MIN_KLINES_FOR_EMA200: 250 },
    checkMtfCondition: vi.fn(() => ({ isAllowed: true, htfTrend: 'BULLISH', htfInterval: '4h', ema50: 50000, ema200: 49000, price: 51000, goldenCross: true, deathCross: false, priceAboveEma50: true, priceAboveEma200: true, reason: 'MTF passed' })),
    checkBtcCorrelation: vi.fn(() => ({ isAllowed: true, btcTrend: 'BULLISH', btcStrength: 'STRONG', btcEma21: 50000, btcPrice: 51000, btcMacdHistogram: 100, btcRsi: 55, btcRsiMomentum: 'RISING', isAltcoin: true, correlationScore: 80, reason: 'BTC correlation passed' })),
    checkMarketRegime: vi.fn(() => ({ isAllowed: true, regime: 'TRENDING', adx: 30, plusDI: 25, minusDI: 15, atr: 500, atrPercentile: 50, volatilityLevel: 'NORMAL', recommendedStrategy: 'TREND_FOLLOWING', reason: 'Market regime passed' })),
    checkVolumeCondition: vi.fn(() => ({ isAllowed: true, currentVolume: 1500, averageVolume: 1000, volumeRatio: 1.5, isVolumeSpike: false, obvTrend: 'RISING', reason: 'Volume passed' })),
    checkFundingRate: vi.fn(() => ({ isAllowed: true, currentRate: 0.0001, fundingLevel: 'NORMAL', signal: 'NEUTRAL', nextFundingTime: null, reason: 'Funding rate normal' })),
    checkChoppinessCondition: vi.fn(() => ({ isAllowed: true, choppinessValue: 45, isChoppy: false, isTrending: false, reason: 'Choppiness passed' })),
    checkSessionCondition: vi.fn(() => ({ isAllowed: true, currentHourUtc: 14, isInSession: true, reason: 'Session passed' })),
    checkBollingerSqueezeCondition: vi.fn(() => ({ isAllowed: true, bbWidth: 0.15, isSqueezing: false, reason: 'BB squeeze passed' })),
    checkVwapCondition: vi.fn(() => ({ isAllowed: true, vwap: 50000, currentPrice: 50500, priceVsVwap: 'ABOVE', reason: 'VWAP passed' })),
    checkSupertrendCondition: vi.fn(() => ({ isAllowed: true, trend: 'up', value: 49500, reason: 'Supertrend passed' })),
    getHigherTimeframe: vi.fn((interval: string) => {
      const mapping: Record<string, string> = { '1m': '15m', '5m': '1h', '15m': '4h', '1h': '4h', '4h': '1d', '1d': '1w' };
      return mapping[interval] ?? null;
    }),
  };
});

import { FilterManager, type FilterConfig } from '../FilterManager';
import { calculateEMA } from '@marketmind/indicators';
import {
  checkAdxCondition,
  checkBollingerSqueezeCondition,
  checkBtcCorrelation,
  checkChoppinessCondition,
  checkFundingRate,
  checkMarketRegime,
  checkMomentumTiming,
  checkMtfCondition,
  checkSessionCondition,
  checkStochasticCondition,
  checkStochasticHtfCondition,
  checkStochasticRecoveryHtfCondition,
  checkSupertrendCondition,
  checkTrendCondition,
  checkVolumeCondition,
  checkVwapCondition,
} from '../../../utils/filters';
import { calculateConfluenceScore } from '../../../utils/confluence-scoring';

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
    vi.mocked(checkMomentumTiming).mockReturnValue({ isAllowed: true, rsiValue: 55, rsiPrevValue: 53, rsiMomentum: 'RISING', mfiValue: 60, mfiConfirmation: true, reason: 'Momentum passed' });
    vi.mocked(checkMtfCondition).mockReturnValue({ isAllowed: true, htfTrend: 'BULLISH', htfInterval: '4h', ema50: 50000, ema200: 49000, price: 51000, goldenCross: true, deathCross: false, priceAboveEma50: true, priceAboveEma200: true, reason: 'MTF passed' });
    vi.mocked(checkBtcCorrelation).mockReturnValue({ isAllowed: true, btcTrend: 'BULLISH', btcStrength: 'STRONG', btcEma21: 50000, btcPrice: 51000, btcMacdHistogram: 100, btcRsi: 55, btcRsiMomentum: 'RISING', isAltcoin: true, correlationScore: 80, reason: 'BTC correlation passed' });
    vi.mocked(checkMarketRegime).mockReturnValue({ isAllowed: true, regime: 'TRENDING', adx: 30, plusDI: 25, minusDI: 15, atr: 500, atrPercentile: 50, volatilityLevel: 'NORMAL', recommendedStrategy: 'TREND_FOLLOWING', reason: 'Market regime passed' });
    vi.mocked(checkVolumeCondition).mockReturnValue({ isAllowed: true, currentVolume: 1500, averageVolume: 1000, volumeRatio: 1.5, isVolumeSpike: false, obvTrend: 'RISING', reason: 'Volume passed' });
    vi.mocked(checkFundingRate).mockReturnValue({ isAllowed: true, currentRate: 0.0001, fundingLevel: 'NORMAL', signal: 'NEUTRAL', nextFundingTime: null, reason: 'Funding rate normal' });
    vi.mocked(checkChoppinessCondition).mockReturnValue({ isAllowed: true, choppinessValue: 45, isChoppy: false, isTrending: false, reason: 'Choppiness passed' });
    vi.mocked(checkSessionCondition).mockReturnValue({ isAllowed: true, currentHourUtc: 14, isInSession: true, reason: 'Session passed' });
    vi.mocked(checkBollingerSqueezeCondition).mockReturnValue({ isAllowed: true, bbWidth: 0.15, isSqueezing: false, reason: 'BB squeeze passed' });
    vi.mocked(checkVwapCondition).mockReturnValue({ isAllowed: true, vwap: 50000, currentPrice: 50500, priceVsVwap: 'ABOVE', reason: 'VWAP passed' });
    vi.mocked(checkSupertrendCondition).mockReturnValue({ isAllowed: true, trend: 'up', value: 49500, reason: 'Supertrend passed' });
    vi.mocked(calculateConfluenceScore).mockReturnValue({ isAllowed: true, totalScore: 75, maxPossibleScore: 110, scorePercent: 68, contributions: [], alignmentBonus: 10, recommendation: 'MODERATE_ENTRY', reason: 'Confluence score 75/110 (68%) - MODERATE_ENTRY' });
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
        useTrendFilter: true,
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

    it('should block SHORT when directionMode is long_only', () => {
      const customManager = new FilterManager({ directionMode: 'long_only' });

      expect(customManager.checkDirection('LONG')).toBe(true);
      expect(customManager.checkDirection('SHORT')).toBe(false);
    });

    it('should block LONG when directionMode is short_only', () => {
      const customManager = new FilterManager({ directionMode: 'short_only' });

      expect(customManager.checkDirection('LONG')).toBe(false);
      expect(customManager.checkDirection('SHORT')).toBe(true);
    });

    it('should allow all directions when directionMode is undefined', () => {
      const customManager = new FilterManager({});

      expect(customManager.checkDirection('LONG')).toBe(true);
      expect(customManager.checkDirection('SHORT')).toBe(true);
    });

    it('should prefer directionMode over onlyLong when both set', () => {
      const customManager = new FilterManager({ onlyLong: true, directionMode: 'short_only' });

      expect(customManager.checkDirection('LONG')).toBe(false);
      expect(customManager.checkDirection('SHORT')).toBe(true);
    });
  });

  describe('checkStochasticHtfFilter', () => {
    it('should allow when HTF stochastic filter disabled', () => {
      const htfKlines = createMockKlines(50);
      const result = manager.checkStochasticHtfFilter(htfKlines, Date.now(), 'LONG', 0);
      expect(result).toBe(true);
      expect(checkStochasticHtfCondition).not.toHaveBeenCalled();
    });

    it('should call checkStochasticHtfCondition when enabled', () => {
      const customManager = new FilterManager({ useStochasticHtfFilter: true });
      const htfKlines = createMockKlines(50);

      const result = customManager.checkStochasticHtfFilter(htfKlines, Date.now(), 'LONG', 0);

      expect(result).toBe(true);
      expect(checkStochasticHtfCondition).toHaveBeenCalled();
    });

    it('should block when HTF stochastic condition fails', () => {
      vi.mocked(checkStochasticHtfCondition).mockReturnValue({ isAllowed: false, currentK: 55, currentD: 52, isOversold: false, isOverbought: false, reason: 'LONG blocked (HTF): not oversold' });
      const customManager = new FilterManager({ useStochasticHtfFilter: true });
      const htfKlines = createMockKlines(50);

      const result = customManager.checkStochasticHtfFilter(htfKlines, Date.now(), 'LONG', 0);

      expect(result).toBe(false);
      expect(customManager.stats.skippedStochasticHtf).toBe(1);
    });

    it('should allow when htfKlines is empty', () => {
      const customManager = new FilterManager({ useStochasticHtfFilter: true });

      const result = customManager.checkStochasticHtfFilter([], Date.now(), 'LONG', 0);

      expect(result).toBe(true);
    });
  });

  describe('checkStochasticRecoveryHtfFilter', () => {
    it('should allow when HTF stochastic recovery filter disabled', () => {
      const htfKlines = createMockKlines(50);
      const result = manager.checkStochasticRecoveryHtfFilter(htfKlines, Date.now(), 'LONG', 0);
      expect(result).toBe(true);
      expect(checkStochasticRecoveryHtfCondition).not.toHaveBeenCalled();
    });

    it('should call checkStochasticRecoveryHtfCondition when enabled', () => {
      const customManager = new FilterManager({ useStochasticRecoveryHtfFilter: true });
      const htfKlines = createMockKlines(50);

      const result = customManager.checkStochasticRecoveryHtfFilter(htfKlines, Date.now(), 'LONG', 0);

      expect(result).toBe(true);
      expect(checkStochasticRecoveryHtfCondition).toHaveBeenCalled();
    });

    it('should block when HTF stochastic recovery condition fails', () => {
      vi.mocked(checkStochasticRecoveryHtfCondition).mockReturnValue({ isAllowed: false, currentK: 55, currentD: 52, isOversold: false, isOverbought: false, reason: 'LONG blocked (HTF): already crossed midpoint' });
      const customManager = new FilterManager({ useStochasticRecoveryHtfFilter: true });
      const htfKlines = createMockKlines(50);

      const result = customManager.checkStochasticRecoveryHtfFilter(htfKlines, Date.now(), 'LONG', 0);

      expect(result).toBe(false);
      expect(customManager.stats.skippedStochasticRecoveryHtf).toBe(1);
    });

    it('should allow when htfKlines is empty', () => {
      const customManager = new FilterManager({ useStochasticRecoveryHtfFilter: true });

      const result = customManager.checkStochasticRecoveryHtfFilter([], Date.now(), 'LONG', 0);

      expect(result).toBe(true);
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

  describe('checkMtfFilter', () => {
    it('should pass when MTF filter disabled', () => {
      const klines = createMockKlines(300);
      const result = manager.checkMtfFilter(klines, 'LONG', '4h', 0);

      expect(result).toEqual({ passed: true, result: null });
      expect(checkMtfCondition).not.toHaveBeenCalled();
    });

    it('should pass when htfInterval is null', () => {
      const customManager = new FilterManager({ useMtfFilter: true });
      const klines = createMockKlines(300);
      const result = customManager.checkMtfFilter(klines, 'LONG', null, 0);

      expect(result).toEqual({ passed: true, result: null });
    });

    it('should pass when insufficient htf klines', () => {
      const customManager = new FilterManager({ useMtfFilter: true });
      const klines = createMockKlines(100);
      const result = customManager.checkMtfFilter(klines, 'LONG', '4h', 0);

      expect(result).toEqual({ passed: true, result: null });
    });

    it('should call checkMtfCondition with enough klines', () => {
      const customManager = new FilterManager({ useMtfFilter: true });
      const klines = createMockKlines(300);

      const result = customManager.checkMtfFilter(klines, 'LONG', '4h', 0);

      expect(result.passed).toBe(true);
      expect(result.result).toBeDefined();
      expect(checkMtfCondition).toHaveBeenCalledWith(klines, 'LONG', '4h');
    });

    it('should block when MTF condition fails', () => {
      vi.mocked(checkMtfCondition).mockReturnValue({ isAllowed: false, htfTrend: 'BEARISH', htfInterval: '4h', ema50: 50000, ema200: 51000, price: 49000, goldenCross: false, deathCross: true, priceAboveEma50: false, priceAboveEma200: false, reason: 'HTF bearish' });
      const customManager = new FilterManager({ useMtfFilter: true });
      const klines = createMockKlines(300);

      const result = customManager.checkMtfFilter(klines, 'LONG', '4h', 0);

      expect(result.passed).toBe(false);
      expect(customManager.stats.skippedMtf).toBe(1);
    });
  });

  describe('checkBtcCorrelationFilter', () => {
    it('should pass when BTC correlation filter disabled', () => {
      const klines = createMockKlines(50);
      const result = manager.checkBtcCorrelationFilter(klines, 'LONG', 'ETHUSDT', 0);

      expect(result).toEqual({ passed: true, result: null });
      expect(checkBtcCorrelation).not.toHaveBeenCalled();
    });

    it('should pass when insufficient btc klines', () => {
      const customManager = new FilterManager({ useBtcCorrelationFilter: true });
      const klines = createMockKlines(20);

      const result = customManager.checkBtcCorrelationFilter(klines, 'LONG', 'ETHUSDT', 0);

      expect(result).toEqual({ passed: true, result: null });
    });

    it('should call checkBtcCorrelation with enough klines', () => {
      const customManager = new FilterManager({ useBtcCorrelationFilter: true });
      const klines = createMockKlines(50);

      const result = customManager.checkBtcCorrelationFilter(klines, 'LONG', 'ETHUSDT', 0);

      expect(result.passed).toBe(true);
      expect(result.result).toBeDefined();
      expect(checkBtcCorrelation).toHaveBeenCalledWith(klines, 'LONG', 'ETHUSDT');
    });

    it('should block when BTC correlation fails', () => {
      vi.mocked(checkBtcCorrelation).mockReturnValue({ isAllowed: false, btcTrend: 'BEARISH', btcStrength: 'STRONG', btcEma21: 50000, btcPrice: 48000, btcMacdHistogram: -200, btcRsi: 35, btcRsiMomentum: 'FALLING', isAltcoin: true, correlationScore: 25, reason: 'BTC bearish blocks LONG' });
      const customManager = new FilterManager({ useBtcCorrelationFilter: true });
      const klines = createMockKlines(50);

      const result = customManager.checkBtcCorrelationFilter(klines, 'LONG', 'ETHUSDT', 0);

      expect(result.passed).toBe(false);
      expect(customManager.stats.skippedBtcCorrelation).toBe(1);
    });
  });

  describe('checkMarketRegimeFilter', () => {
    it('should pass when market regime filter disabled', () => {
      const klines = createMockKlines(60);
      const result = manager.checkMarketRegimeFilter(klines, 40, 'SETUP_9_1', 0);

      expect(result).toEqual({ passed: true, result: null });
      expect(checkMarketRegime).not.toHaveBeenCalled();
    });

    it('should pass when setupIndex < 30', () => {
      const customManager = new FilterManager({ useMarketRegimeFilter: true });
      const klines = createMockKlines(60);

      const result = customManager.checkMarketRegimeFilter(klines, 25, 'SETUP_9_1', 0);

      expect(result).toEqual({ passed: true, result: null });
    });

    it('should call checkMarketRegime with enough klines', () => {
      const customManager = new FilterManager({ useMarketRegimeFilter: true });
      const klines = createMockKlines(100);

      const result = customManager.checkMarketRegimeFilter(klines, 40, 'SETUP_9_1', 0);

      expect(result.passed).toBe(true);
      expect(result.result).toBeDefined();
      expect(checkMarketRegime).toHaveBeenCalled();
    });

    it('should block when market regime condition fails', () => {
      vi.mocked(checkMarketRegime).mockReturnValue({ isAllowed: false, regime: 'RANGING', adx: 15, plusDI: 18, minusDI: 20, atr: 300, atrPercentile: 30, volatilityLevel: 'LOW', recommendedStrategy: 'MEAN_REVERSION', reason: 'Ranging market blocks trend strategy' });
      const customManager = new FilterManager({ useMarketRegimeFilter: true });
      const klines = createMockKlines(100);

      const result = customManager.checkMarketRegimeFilter(klines, 40, 'SETUP_9_1', 0);

      expect(result.passed).toBe(false);
      expect(customManager.stats.skippedMarketRegime).toBe(1);
    });
  });

  describe('checkVolumeFilter', () => {
    it('should pass when volume filter disabled', () => {
      const klines = createMockKlines(50);
      const result = manager.checkVolumeFilter(klines, 30, 'LONG', 'SETUP_9_1', 0);

      expect(result).toEqual({ passed: true, result: null });
      expect(checkVolumeCondition).not.toHaveBeenCalled();
    });

    it('should pass when setupIndex < 21', () => {
      const customManager = new FilterManager({ useVolumeFilter: true });
      const klines = createMockKlines(30);

      const result = customManager.checkVolumeFilter(klines, 15, 'LONG', 'SETUP_9_1', 0);

      expect(result).toEqual({ passed: true, result: null });
    });

    it('should call checkVolumeCondition with enough klines', () => {
      const customManager = new FilterManager({ useVolumeFilter: true });
      const klines = createMockKlines(60);

      const result = customManager.checkVolumeFilter(klines, 30, 'LONG', 'SETUP_9_1', 0);

      expect(result.passed).toBe(true);
      expect(result.result).toBeDefined();
      expect(checkVolumeCondition).toHaveBeenCalled();
    });

    it('should block when volume condition fails', () => {
      vi.mocked(checkVolumeCondition).mockReturnValue({ isAllowed: false, currentVolume: 200, averageVolume: 1000, volumeRatio: 0.2, isVolumeSpike: false, obvTrend: 'FALLING', reason: 'Volume too low' });
      const customManager = new FilterManager({ useVolumeFilter: true });
      const klines = createMockKlines(60);

      const result = customManager.checkVolumeFilter(klines, 30, 'LONG', 'SETUP_9_1', 0);

      expect(result.passed).toBe(false);
      expect(customManager.stats.skippedVolume).toBe(1);
    });

    it('should pass volumeFilterConfig to checkVolumeCondition', () => {
      const volumeFilterConfig = { breakoutMultiplier: 2.0, pullbackMultiplier: 0.8, useObv: true };
      const customManager = new FilterManager({ useVolumeFilter: true, volumeFilterConfig });
      const klines = createMockKlines(60);

      customManager.checkVolumeFilter(klines, 30, 'LONG', 'SETUP_9_1', 0);

      expect(checkVolumeCondition).toHaveBeenCalledWith(expect.any(Array), 'LONG', 'SETUP_9_1', volumeFilterConfig);
    });
  });

  describe('checkFundingFilter', () => {
    it('should pass when funding filter disabled', () => {
      const result = manager.checkFundingFilter(0.0001, 'LONG', 0);

      expect(result).toEqual({ passed: true, result: null });
      expect(checkFundingRate).not.toHaveBeenCalled();
    });

    it('should call checkFundingRate when enabled', () => {
      const customManager = new FilterManager({ useFundingFilter: true });

      const result = customManager.checkFundingFilter(0.0001, 'LONG', 0);

      expect(result.passed).toBe(true);
      expect(result.result).toBeDefined();
      expect(checkFundingRate).toHaveBeenCalledWith(0.0001, 'LONG');
    });

    it('should block when funding rate condition fails', () => {
      vi.mocked(checkFundingRate).mockReturnValue({ isAllowed: false, currentRate: 0.002, fundingLevel: 'EXTREME', signal: 'SHORT_CONTRARIAN', nextFundingTime: null, reason: 'LONG blocked: extreme positive funding' });
      const customManager = new FilterManager({ useFundingFilter: true });

      const result = customManager.checkFundingFilter(0.002, 'LONG', 0);

      expect(result.passed).toBe(false);
      expect(customManager.stats.skippedFunding).toBe(1);
    });

    it('should handle null funding rate', () => {
      const customManager = new FilterManager({ useFundingFilter: true });

      customManager.checkFundingFilter(null, 'LONG', 0);

      expect(checkFundingRate).toHaveBeenCalledWith(null, 'LONG');
    });
  });

  describe('checkConfluenceScoring', () => {
    it('should pass when confluence scoring disabled', () => {
      const filterResults = {} as Parameters<typeof calculateConfluenceScore>[0];
      const result = manager.checkConfluenceScoring(filterResults, 0);

      expect(result).toBe(true);
      expect(calculateConfluenceScore).not.toHaveBeenCalled();
    });

    it('should call calculateConfluenceScore when enabled', () => {
      const customManager = new FilterManager({ useConfluenceScoring: true });
      const filterResults = {} as Parameters<typeof calculateConfluenceScore>[0];

      const result = customManager.checkConfluenceScoring(filterResults, 0);

      expect(result).toBe(true);
      expect(calculateConfluenceScore).toHaveBeenCalled();
    });

    it('should block when confluence score is too low', () => {
      vi.mocked(calculateConfluenceScore).mockReturnValue({ isAllowed: false, totalScore: 30, maxPossibleScore: 110, scorePercent: 27, contributions: [], alignmentBonus: 0, recommendation: 'NO_ENTRY', reason: 'Confluence score 30 below minimum 60' });
      const customManager = new FilterManager({ useConfluenceScoring: true });
      const filterResults = {} as Parameters<typeof calculateConfluenceScore>[0];

      const result = customManager.checkConfluenceScoring(filterResults, 0);

      expect(result).toBe(false);
      expect(customManager.stats.skippedConfluence).toBe(1);
    });

    it('should use custom confluenceMinScore', () => {
      const customManager = new FilterManager({ useConfluenceScoring: true, confluenceMinScore: 80 });
      const filterResults = {} as Parameters<typeof calculateConfluenceScore>[0];

      customManager.checkConfluenceScoring(filterResults, 0);

      expect(calculateConfluenceScore).toHaveBeenCalledWith(filterResults, 80);
    });
  });

  describe('getHigherTimeframe', () => {
    it('should return higher timeframe for known intervals', () => {
      expect(manager.getHigherTimeframe('1h')).toBe('4h');
      expect(manager.getHigherTimeframe('4h')).toBe('1d');
      expect(manager.getHigherTimeframe('1d')).toBe('1w');
    });

    it('should return null for unknown intervals', () => {
      expect(manager.getHigherTimeframe('2w')).toBeNull();
    });
  });

  describe('checkPositionConflict', () => {
    it('should allow when no existing position for symbol', () => {
      const result = manager.checkPositionConflict('BTCUSDT', 'LONG', 0);
      expect(result).toBe(true);
    });

    it('should allow when same direction as existing position', () => {
      manager.updatePositionTracking('BTCUSDT', 'LONG', true);

      const result = manager.checkPositionConflict('BTCUSDT', 'LONG', 0);

      expect(result).toBe(true);
    });

    it('should block when opposite direction to existing position', () => {
      manager.updatePositionTracking('BTCUSDT', 'LONG', true);

      const result = manager.checkPositionConflict('BTCUSDT', 'SHORT', 0);

      expect(result).toBe(false);
      expect(manager.stats.skippedPositionConflict).toBe(1);
    });

    it('should allow after position is closed', () => {
      manager.updatePositionTracking('BTCUSDT', 'LONG', true);
      manager.updatePositionTracking('BTCUSDT', 'LONG', false);

      const result = manager.checkPositionConflict('BTCUSDT', 'SHORT', 0);

      expect(result).toBe(true);
    });

    it('should track positions per symbol independently', () => {
      manager.updatePositionTracking('BTCUSDT', 'LONG', true);
      manager.updatePositionTracking('ETHUSDT', 'SHORT', true);

      expect(manager.checkPositionConflict('BTCUSDT', 'LONG', 0)).toBe(true);
      expect(manager.checkPositionConflict('BTCUSDT', 'SHORT', 0)).toBe(false);
      expect(manager.checkPositionConflict('ETHUSDT', 'SHORT', 0)).toBe(true);
      expect(manager.checkPositionConflict('ETHUSDT', 'LONG', 0)).toBe(false);
    });
  });

  describe('checkStrategyPositionLimit', () => {
    it('should allow when maxPerStrategy is undefined', () => {
      const result = manager.checkStrategyPositionLimit('SETUP_9_1', undefined, 0);
      expect(result).toBe(true);
    });

    it('should allow when maxPerStrategy is 0', () => {
      const result = manager.checkStrategyPositionLimit('SETUP_9_1', 0, 0);
      expect(result).toBe(true);
    });

    it('should allow when below max per strategy', () => {
      manager.updateStrategyPositionCount('SETUP_9_1', 1);

      const result = manager.checkStrategyPositionLimit('SETUP_9_1', 3, 0);

      expect(result).toBe(true);
    });

    it('should block when at max per strategy', () => {
      manager.updateStrategyPositionCount('SETUP_9_1', 1);
      manager.updateStrategyPositionCount('SETUP_9_1', 1);
      manager.updateStrategyPositionCount('SETUP_9_1', 1);

      const result = manager.checkStrategyPositionLimit('SETUP_9_1', 3, 0);

      expect(result).toBe(false);
      expect(manager.stats.skippedMaxPositions).toBe(1);
    });

    it('should track counts per strategy independently', () => {
      manager.updateStrategyPositionCount('SETUP_9_1', 1);
      manager.updateStrategyPositionCount('SETUP_9_1', 1);
      manager.updateStrategyPositionCount('SETUP_9_2', 1);

      expect(manager.checkStrategyPositionLimit('SETUP_9_1', 2, 0)).toBe(false);
      expect(manager.checkStrategyPositionLimit('SETUP_9_2', 2, 0)).toBe(true);
    });
  });

  describe('updateStrategyPositionCount', () => {
    it('should not go below zero', () => {
      manager.updateStrategyPositionCount('SETUP_9_1', -5);

      expect(manager.checkStrategyPositionLimit('SETUP_9_1', 1, 0)).toBe(true);
    });

    it('should handle increment and decrement', () => {
      manager.updateStrategyPositionCount('SETUP_9_1', 1);
      manager.updateStrategyPositionCount('SETUP_9_1', 1);
      manager.updateStrategyPositionCount('SETUP_9_1', -1);

      expect(manager.checkStrategyPositionLimit('SETUP_9_1', 1, 0)).toBe(false);
      expect(manager.checkStrategyPositionLimit('SETUP_9_1', 2, 0)).toBe(true);
    });
  });

  describe('incrementPyramidSkipped', () => {
    it('should increment pyramid skipped count', () => {
      manager.incrementPyramidSkipped();
      expect(manager.stats.skippedPyramid).toBe(1);

      manager.incrementPyramidSkipped();
      expect(manager.stats.skippedPyramid).toBe(2);
    });
  });

  describe('incrementPyramidEntries', () => {
    it('should increment pyramid entries count', () => {
      manager.incrementPyramidEntries();
      expect(manager.stats.pyramidEntries).toBe(1);

      manager.incrementPyramidEntries();
      expect(manager.stats.pyramidEntries).toBe(2);
    });
  });

  describe('updateDailyPnl - no dailyLossLimit configured', () => {
    it('should do nothing when dailyLossLimit is not set', () => {
      manager.updateDailyPnl(-5000, 10000);
      expect(manager.checkDailyLossLimit(Date.now())).toBe(true);
    });
  });

  describe('updateCooldown - cooldown disabled', () => {
    it('should not store cooldown when cooldown is disabled', () => {
      const now = Date.now();
      manager.updateCooldown('setup1', 'BTCUSDT', '1h', now);

      const customManager = new FilterManager({ useCooldown: true, cooldownMinutes: 15 });
      expect(customManager.checkCooldown('setup1', 'BTCUSDT', '1h', now + 60000)).toBe(true);
    });
  });

  describe('checkMaxPositions - empty positions array', () => {
    it('should allow when no open positions exist', () => {
      const customManager = new FilterManager({ maxConcurrentPositions: 1 });
      const result = customManager.checkMaxPositions([], Date.now());
      expect(result).toBe(true);
    });
  });

  describe('initialize - handles null EMA values', () => {
    it('should map null EMA values to 0', async () => {
      vi.mocked(calculateEMA).mockReturnValue([null, 50100, null, 50300, null]);
      const klines = createMockKlines(50);

      await manager.initialize(klines, '2024-01-01', '2024-12-31', 'BTCUSDT');

      const emaTrend = manager.getEmaTrend();
      expect(emaTrend[0]).toBe(0);
      expect(emaTrend[1]).toBe(50100);
      expect(emaTrend[2]).toBe(0);
    });
  });
});
