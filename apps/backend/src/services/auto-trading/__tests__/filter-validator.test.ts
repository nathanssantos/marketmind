import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Kline, TradingSetup, StrategyDefinition, MarketType } from '@marketmind/types';

const filterMocks = vi.hoisted(() => ({
  checkStochasticCondition: vi.fn(),
  checkStochasticRecoveryCondition: vi.fn(),
  checkMomentumTiming: vi.fn(),
  checkAdxCondition: vi.fn(),
  checkChoppinessCondition: vi.fn(),
  checkSessionCondition: vi.fn(),
  checkBollingerSqueezeCondition: vi.fn(),
  checkVwapCondition: vi.fn(),
  checkSupertrendCondition: vi.fn(),
  checkDirectionFilter: vi.fn(),
  checkBtcCorrelation: vi.fn(),
  checkFundingRate: vi.fn(),
  checkMtfCondition: vi.fn(),
  checkMarketRegime: vi.fn(),
  checkVolumeCondition: vi.fn(),
  checkTrendCondition: vi.fn(),
  getHigherTimeframe: vi.fn(),
  calculateConfluenceScore: vi.fn(),
}));

vi.mock('../../../utils/filters/stochastic-filter', () => ({
  checkStochasticCondition: filterMocks.checkStochasticCondition,
}));
vi.mock('../../../utils/filters/stochastic-recovery-filter', () => ({
  checkStochasticRecoveryCondition: filterMocks.checkStochasticRecoveryCondition,
}));
vi.mock('../../../utils/filters/momentum-timing-filter', () => ({
  checkMomentumTiming: filterMocks.checkMomentumTiming,
}));
vi.mock('../../../utils/filters/adx-filter', () => ({
  checkAdxCondition: filterMocks.checkAdxCondition,
}));
vi.mock('../../../utils/filters/choppiness-filter', () => ({
  checkChoppinessCondition: filterMocks.checkChoppinessCondition,
}));
vi.mock('../../../utils/filters/session-filter', () => ({
  checkSessionCondition: filterMocks.checkSessionCondition,
}));
vi.mock('../../../utils/filters/bollinger-squeeze-filter', () => ({
  checkBollingerSqueezeCondition: filterMocks.checkBollingerSqueezeCondition,
}));
vi.mock('../../../utils/filters/vwap-filter', () => ({
  checkVwapCondition: filterMocks.checkVwapCondition,
}));
vi.mock('../../../utils/filters/supertrend-filter', () => ({
  checkSupertrendCondition: filterMocks.checkSupertrendCondition,
}));
vi.mock('../../../utils/filters/direction-filter', () => ({
  checkDirectionFilter: filterMocks.checkDirectionFilter,
}));
vi.mock('../../../utils/filters/market-regime-filter', () => ({
  checkMarketRegime: filterMocks.checkMarketRegime,
}));
vi.mock('../../../utils/filters/volume-filter', () => ({
  checkVolumeCondition: filterMocks.checkVolumeCondition,
}));
vi.mock('../../../utils/filters/trend-filter', () => ({
  checkTrendCondition: filterMocks.checkTrendCondition,
}));
vi.mock('../../../utils/filters/btc-correlation-filter', () => ({
  checkBtcCorrelation: filterMocks.checkBtcCorrelation,
}));

vi.mock('../../../utils/filters', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../utils/filters')>();
  return {
    ...actual,
    ...filterMocks,
    ADX_FILTER: { MIN_KLINES_REQUIRED: 35 },
    MOMENTUM_TIMING_FILTER: { MIN_KLINES_REQUIRED: 20 },
    MTF_FILTER: { MIN_KLINES_FOR_EMA200: 200 },
    STOCHASTIC_FILTER: { K_PERIOD: 14, K_SMOOTHING: 3, D_PERIOD: 3 },
  };
});

vi.mock('../../../utils/confluence-scoring', () => ({
  calculateConfluenceScore: filterMocks.calculateConfluenceScore,
}));

import { FilterValidator, type FilterValidatorConfig, type FilterValidatorDeps } from '../validation/filter-validator';
import {
  checkBtcCorrelation,
  checkFundingRate,
  checkMtfCondition,
  checkMarketRegime,
  checkVolumeCondition,
  checkStochasticCondition,
  checkStochasticRecoveryCondition,
  checkMomentumTiming,
  checkAdxCondition,
  checkTrendCondition,
  getHigherTimeframe,
} from '../../../utils/filters';
import { calculateConfluenceScore } from '../../../utils/confluence-scoring';
import { createDisabledFilterConfig } from '../../../utils/filters/filter-registry';
import type { WatcherLogBuffer } from '../../watcher-batch-logger';
import type { ActiveWatcher } from '../types';

const createKline = (close: number, index: number): Kline => ({
  openTime: Date.now() + index * 60000,
  open: String(close),
  high: String(close + 1),
  low: String(close - 1),
  close: String(close),
  volume: '1000',
  closeTime: Date.now() + (index + 1) * 60000 - 1,
  quoteVolume: '10000',
  trades: 100,
  takerBuyBaseVolume: '500',
  takerBuyQuoteVolume: '5000',
});

const createKlines = (count: number): Kline[] =>
  Array.from({ length: count }, (_, i) => createKline(100 + i * 0.1, i));

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

const createSetup = (overrides: Partial<TradingSetup> = {}): TradingSetup => ({
  type: 'larry_williams_9_1',
  direction: 'LONG',
  entryPrice: 100,
  stopLoss: 95,
  takeProfit: 110,
  confidence: 80,
  riskRewardRatio: 2,
  ...overrides,
} as TradingSetup);

const createLogBuffer = (): WatcherLogBuffer => ({
  addFilterCheck: vi.fn(),
  addValidationCheck: vi.fn(),
  addRejection: vi.fn(),
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  startSetupValidation: vi.fn(),
  completeSetupValidation: vi.fn(),
} as unknown as WatcherLogBuffer);

const allDisabledConfig = {
  ...createDisabledFilterConfig(),
} as unknown as FilterValidatorConfig;

const createDeps = (): FilterValidatorDeps => ({
  getBtcKlines: vi.fn().mockResolvedValue(createKlines(30)),
  getHtfKlines: vi.fn().mockResolvedValue(createKlines(210)),
  getCachedFundingRate: vi.fn().mockResolvedValue(0.01),
});

describe('FilterValidator', () => {
  let validator: FilterValidator;
  let deps: FilterValidatorDeps;
  let logBuffer: WatcherLogBuffer;

  beforeEach(() => {
    vi.clearAllMocks();
    const defaultAllow = { isAllowed: true, reason: 'OK' };
    filterMocks.checkStochasticCondition.mockReturnValue(defaultAllow);
    filterMocks.checkStochasticRecoveryCondition.mockReturnValue(defaultAllow);
    filterMocks.checkMomentumTiming.mockReturnValue(defaultAllow);
    filterMocks.checkAdxCondition.mockReturnValue(defaultAllow);
    filterMocks.checkChoppinessCondition.mockReturnValue(defaultAllow);
    filterMocks.checkSessionCondition.mockReturnValue(defaultAllow);
    filterMocks.checkBollingerSqueezeCondition.mockReturnValue(defaultAllow);
    filterMocks.checkVwapCondition.mockReturnValue(defaultAllow);
    filterMocks.checkSupertrendCondition.mockReturnValue(defaultAllow);
    filterMocks.checkDirectionFilter.mockReturnValue(defaultAllow);
    filterMocks.checkTrendCondition.mockReturnValue(defaultAllow);
    filterMocks.checkBtcCorrelation.mockReturnValue(defaultAllow);
    filterMocks.checkMarketRegime.mockReturnValue(defaultAllow);
    filterMocks.checkVolumeCondition.mockReturnValue(defaultAllow);
    deps = createDeps();
    validator = new FilterValidator(deps);
    logBuffer = createLogBuffer();
  });

  describe('all filters disabled', () => {
    it('should pass when all filters are disabled', async () => {
      const result = await validator.validateFilters(
        createWatcher(),
        createSetup(),
        allDisabledConfig,
        createKlines(50),
        [],
        logBuffer,
      );

      expect(result.passed).toBe(true);
      expect(result.filterResults).toEqual({});
    });
  });

  describe('BTC correlation filter', () => {
    it('should skip for BTC symbols', async () => {
      vi.mocked(checkBtcCorrelation).mockReturnValue({ isAllowed: false } as never);

      const result = await validator.validateFilters(
        createWatcher({ symbol: 'BTCUSDT' }),
        createSetup(),
        { ...allDisabledConfig, useBtcCorrelationFilter: true },
        createKlines(50),
        [],
        logBuffer,
      );

      expect(result.passed).toBe(true);
      expect(checkBtcCorrelation).not.toHaveBeenCalled();
    });

    it('should skip for Interactive Brokers exchange', async () => {
      const result = await validator.validateFilters(
        createWatcher({ exchange: 'INTERACTIVE_BROKERS' } as never),
        createSetup(),
        { ...allDisabledConfig, useBtcCorrelationFilter: true },
        createKlines(50),
        [],
        logBuffer,
      );

      expect(result.passed).toBe(true);
      expect(checkBtcCorrelation).not.toHaveBeenCalled();
    });

    it('should fail when BTC correlation rejects', async () => {
      vi.mocked(checkBtcCorrelation).mockReturnValue({
        isAllowed: false,
        btcTrend: 'BEARISH',
        reason: 'BTC bearish',
      } as never);

      const result = await validator.validateFilters(
        createWatcher({ symbol: 'ETHUSDT' }),
        createSetup(),
        { ...allDisabledConfig, useBtcCorrelationFilter: true },
        createKlines(50),
        [],
        logBuffer,
      );

      expect(result.passed).toBe(false);
      expect(result.rejectionReason).toContain('BTC Correlation');
    });

    it('should pass when BTC correlation allows', async () => {
      vi.mocked(checkBtcCorrelation).mockReturnValue({
        isAllowed: true,
        btcTrend: 'BULLISH',
        reason: 'Aligned',
      } as never);

      const result = await validator.validateFilters(
        createWatcher({ symbol: 'ETHUSDT' }),
        createSetup(),
        { ...allDisabledConfig, useBtcCorrelationFilter: true },
        createKlines(50),
        [],
        logBuffer,
      );

      expect(result.passed).toBe(true);
      expect(result.filterResults.btcCorrelation).toBeDefined();
    });

    it('should pass when BTC klines are insufficient (< 26)', async () => {
      deps = createDeps();
      vi.mocked(deps.getBtcKlines).mockResolvedValue(createKlines(10));
      validator = new FilterValidator(deps);

      const result = await validator.validateFilters(
        createWatcher({ symbol: 'ETHUSDT' }),
        createSetup(),
        { ...allDisabledConfig, useBtcCorrelationFilter: true },
        createKlines(50),
        [],
        logBuffer,
      );

      expect(result.passed).toBe(true);
    });
  });

  describe('funding rate filter', () => {
    it('should skip for non-FUTURES market type', async () => {
      const result = await validator.validateFilters(
        createWatcher({ marketType: 'SPOT' as MarketType }),
        createSetup(),
        { ...allDisabledConfig, useFundingFilter: true },
        createKlines(50),
        [],
        logBuffer,
      );

      expect(result.passed).toBe(true);
      expect(checkFundingRate).not.toHaveBeenCalled();
    });

    it('should fail when funding rate rejects', async () => {
      vi.mocked(checkFundingRate).mockReturnValue({
        isAllowed: false,
        currentRate: 0.001,
        fundingLevel: 'extreme',
        reason: 'Rate too high',
      } as never);

      const result = await validator.validateFilters(
        createWatcher(),
        createSetup(),
        { ...allDisabledConfig, useFundingFilter: true },
        createKlines(50),
        [],
        logBuffer,
      );

      expect(result.passed).toBe(false);
      expect(result.rejectionReason).toContain('Funding Rate');
    });

    it('should pass when funding rate allows', async () => {
      vi.mocked(checkFundingRate).mockReturnValue({
        isAllowed: true,
        currentRate: 0.001,
        fundingLevel: 'normal',
        reason: 'OK',
      } as never);

      const result = await validator.validateFilters(
        createWatcher(),
        createSetup(),
        { ...allDisabledConfig, useFundingFilter: true },
        createKlines(50),
        [],
        logBuffer,
      );

      expect(result.passed).toBe(true);
      expect(result.filterResults.fundingRate).toBeDefined();
    });

    it('should pass on funding rate error (soft fail)', async () => {
      vi.mocked(deps.getCachedFundingRate).mockRejectedValue(new Error('fetch fail'));
      vi.mocked(checkFundingRate).mockImplementation(() => { throw new Error('fetch fail'); });

      const result = await validator.validateFilters(
        createWatcher(),
        createSetup(),
        { ...allDisabledConfig, useFundingFilter: true },
        createKlines(50),
        [],
        logBuffer,
      );

      expect(result.passed).toBe(true);
    });
  });

  describe('MTF filter', () => {
    it('should skip when no higher timeframe available', async () => {
      vi.mocked(getHigherTimeframe).mockReturnValue(null as never);

      const result = await validator.validateFilters(
        createWatcher(),
        createSetup(),
        { ...allDisabledConfig, useMtfFilter: true },
        createKlines(50),
        [],
        logBuffer,
      );

      expect(result.passed).toBe(true);
    });

    it('should fail when MTF condition rejects', async () => {
      vi.mocked(getHigherTimeframe).mockReturnValue('4h');
      vi.mocked(checkMtfCondition).mockReturnValue({
        isAllowed: false,
        htfTrend: 'BEARISH',
        reason: 'Against trend',
      } as never);

      const result = await validator.validateFilters(
        createWatcher(),
        createSetup(),
        { ...allDisabledConfig, useMtfFilter: true },
        createKlines(50),
        [],
        logBuffer,
      );

      expect(result.passed).toBe(false);
      expect(result.rejectionReason).toContain('MTF');
    });

    it('should pass when MTF condition allows', async () => {
      vi.mocked(getHigherTimeframe).mockReturnValue('4h');
      vi.mocked(checkMtfCondition).mockReturnValue({
        isAllowed: true,
        htfTrend: 'BULLISH',
        reason: 'Aligned',
      } as never);

      const result = await validator.validateFilters(
        createWatcher(),
        createSetup(),
        { ...allDisabledConfig, useMtfFilter: true },
        createKlines(50),
        [],
        logBuffer,
      );

      expect(result.passed).toBe(true);
      expect(result.filterResults.mtf).toBeDefined();
    });

    it('should skip when HTF klines are insufficient', async () => {
      vi.mocked(getHigherTimeframe).mockReturnValue('4h');
      vi.mocked(deps.getHtfKlines).mockResolvedValue(createKlines(50));
      validator = new FilterValidator(deps);

      const result = await validator.validateFilters(
        createWatcher(),
        createSetup(),
        { ...allDisabledConfig, useMtfFilter: true },
        createKlines(50),
        [],
        logBuffer,
      );

      expect(result.passed).toBe(true);
      expect(checkMtfCondition).not.toHaveBeenCalled();
    });
  });

  describe('market regime filter', () => {
    it('should skip when klines < 30', async () => {
      const result = await validator.validateFilters(
        createWatcher(),
        createSetup(),
        { ...allDisabledConfig, useMarketRegimeFilter: true },
        createKlines(20),
        [],
        logBuffer,
      );

      expect(result.passed).toBe(true);
      expect(checkMarketRegime).not.toHaveBeenCalled();
    });

    it('should fail when market regime rejects', async () => {
      vi.mocked(checkMarketRegime).mockReturnValue({
        isAllowed: false,
        regime: 'RANGING',
        adx: 15.5,
        reason: 'Incompatible',
      } as never);

      const result = await validator.validateFilters(
        createWatcher(),
        createSetup(),
        { ...allDisabledConfig, useMarketRegimeFilter: true },
        createKlines(50),
        [],
        logBuffer,
      );

      expect(result.passed).toBe(false);
      expect(result.rejectionReason).toContain('Market Regime');
    });

    it('should pass and include regime in filter results', async () => {
      vi.mocked(checkMarketRegime).mockReturnValue({
        isAllowed: true,
        regime: 'TRENDING',
        adx: 30.5,
        reason: 'OK',
      } as never);

      const result = await validator.validateFilters(
        createWatcher(),
        createSetup(),
        { ...allDisabledConfig, useMarketRegimeFilter: true },
        createKlines(50),
        [],
        logBuffer,
      );

      expect(result.passed).toBe(true);
      expect(result.filterResults.marketRegime).toBeDefined();
      expect(result.filterResults.adxValue).toBe(30.5);
    });
  });

  describe('volume filter', () => {
    it('should skip when klines < 21', async () => {
      const result = await validator.validateFilters(
        createWatcher(),
        createSetup(),
        { ...allDisabledConfig, useVolumeFilter: true },
        createKlines(15),
        [],
        logBuffer,
      );

      expect(result.passed).toBe(true);
      expect(checkVolumeCondition).not.toHaveBeenCalled();
    });

    it('should fail when volume condition rejects', async () => {
      vi.mocked(checkVolumeCondition).mockReturnValue({
        isAllowed: false,
        volumeRatio: 0.5,
        reason: 'Low volume',
      } as never);

      const result = await validator.validateFilters(
        createWatcher(),
        createSetup(),
        { ...allDisabledConfig, useVolumeFilter: true },
        createKlines(50),
        [],
        logBuffer,
      );

      expect(result.passed).toBe(false);
      expect(result.rejectionReason).toContain('Volume');
    });

    it('should pass when volume is sufficient', async () => {
      vi.mocked(checkVolumeCondition).mockReturnValue({
        isAllowed: true,
        volumeRatio: 1.5,
        reason: 'OK',
      } as never);

      const result = await validator.validateFilters(
        createWatcher(),
        createSetup(),
        { ...allDisabledConfig, useVolumeFilter: true },
        createKlines(50),
        [],
        logBuffer,
      );

      expect(result.passed).toBe(true);
    });
  });

  describe('confluence scoring', () => {
    it('should fail when confluence score is too low', async () => {
      vi.mocked(calculateConfluenceScore).mockReturnValue({
        isAllowed: false,
        scorePercent: 30,
        reason: 'Low score',
      } as never);

      const result = await validator.validateFilters(
        createWatcher(),
        createSetup(),
        { ...allDisabledConfig, useConfluenceScoring: true, confluenceMinScore: 50 },
        createKlines(50),
        [],
        logBuffer,
      );

      expect(result.passed).toBe(false);
      expect(result.rejectionReason).toContain('Confluence');
    });

    it('should pass when confluence score is sufficient', async () => {
      vi.mocked(calculateConfluenceScore).mockReturnValue({
        isAllowed: true,
        scorePercent: 75,
        reason: 'OK',
      } as never);

      const result = await validator.validateFilters(
        createWatcher(),
        createSetup(),
        { ...allDisabledConfig, useConfluenceScoring: true, confluenceMinScore: 50 },
        createKlines(50),
        [],
        logBuffer,
      );

      expect(result.passed).toBe(true);
    });
  });

  describe('stochastic filter', () => {
    it('should pass when check function allows with few klines', async () => {
      const result = await validator.validateFilters(
        createWatcher(),
        createSetup(),
        { ...allDisabledConfig, useStochasticFilter: true },
        createKlines(10),
        [],
        logBuffer,
      );

      expect(result.passed).toBe(true);
      expect(checkStochasticCondition).toHaveBeenCalled();
    });

    it('should fail when stochastic rejects', async () => {
      vi.mocked(checkStochasticCondition).mockReturnValue({
        isAllowed: false,
        currentK: 85,
        reason: 'Overbought',
      } as never);

      const result = await validator.validateFilters(
        createWatcher(),
        createSetup(),
        { ...allDisabledConfig, useStochasticFilter: true },
        createKlines(50),
        [],
        logBuffer,
      );

      expect(result.passed).toBe(false);
      expect(result.rejectionReason).toContain('Stochastic');
    });

    it('should pass when stochastic allows', async () => {
      vi.mocked(checkStochasticCondition).mockReturnValue({
        isAllowed: true,
        currentK: 50,
        reason: 'OK',
      } as never);

      const result = await validator.validateFilters(
        createWatcher(),
        createSetup(),
        { ...allDisabledConfig, useStochasticFilter: true },
        createKlines(50),
        [],
        logBuffer,
      );

      expect(result.passed).toBe(true);
    });
  });

  describe('stochastic recovery filter', () => {
    it('should pass when check function allows with few klines', async () => {
      const result = await validator.validateFilters(
        createWatcher(),
        createSetup(),
        { ...allDisabledConfig, useStochasticRecoveryFilter: true },
        createKlines(10),
        [],
        logBuffer,
      );

      expect(result.passed).toBe(true);
      expect(checkStochasticRecoveryCondition).toHaveBeenCalled();
    });

    it('should fail when stochastic recovery rejects', async () => {
      vi.mocked(checkStochasticRecoveryCondition).mockReturnValue({
        isAllowed: false,
        currentK: 55,
        reason: 'Already crossed midpoint',
      } as never);

      const result = await validator.validateFilters(
        createWatcher(),
        createSetup(),
        { ...allDisabledConfig, useStochasticRecoveryFilter: true },
        createKlines(50),
        [],
        logBuffer,
      );

      expect(result.passed).toBe(false);
      expect(result.rejectionReason).toContain('Stochastic Recovery');
    });

    it('should pass when stochastic recovery allows', async () => {
      vi.mocked(checkStochasticRecoveryCondition).mockReturnValue({
        isAllowed: true,
        currentK: 30,
        reason: 'Recovering from oversold',
      } as never);

      const result = await validator.validateFilters(
        createWatcher(),
        createSetup(),
        { ...allDisabledConfig, useStochasticRecoveryFilter: true },
        createKlines(50),
        [],
        logBuffer,
      );

      expect(result.passed).toBe(true);
    });
  });

  describe('momentum timing filter', () => {
    it('should pass when check function allows with few klines', async () => {
      const result = await validator.validateFilters(
        createWatcher(),
        createSetup(),
        { ...allDisabledConfig, useMomentumTimingFilter: true },
        createKlines(10),
        [],
        logBuffer,
      );

      expect(result.passed).toBe(true);
      expect(checkMomentumTiming).toHaveBeenCalled();
    });

    it('should fail when momentum rejects', async () => {
      vi.mocked(checkMomentumTiming).mockReturnValue({
        isAllowed: false,
        rsiValue: 35,
        reason: 'Weak',
      } as never);

      const result = await validator.validateFilters(
        createWatcher(),
        createSetup(),
        { ...allDisabledConfig, useMomentumTimingFilter: true },
        createKlines(50),
        [],
        logBuffer,
      );

      expect(result.passed).toBe(false);
      expect(result.rejectionReason).toContain('Momentum');
    });
  });

  describe('ADX filter', () => {
    it('should pass when check function allows with few klines', async () => {
      const result = await validator.validateFilters(
        createWatcher(),
        createSetup(),
        { ...allDisabledConfig, useAdxFilter: true },
        createKlines(20),
        [],
        logBuffer,
      );

      expect(result.passed).toBe(true);
      expect(checkAdxCondition).toHaveBeenCalled();
    });

    it('should fail when ADX rejects', async () => {
      vi.mocked(checkAdxCondition).mockReturnValue({
        isAllowed: false,
        adx: 15,
        reason: 'Weak trend',
      } as never);

      const result = await validator.validateFilters(
        createWatcher(),
        createSetup(),
        { ...allDisabledConfig, useAdxFilter: true },
        createKlines(50),
        [],
        logBuffer,
      );

      expect(result.passed).toBe(false);
    });

    it('should pass when ADX allows', async () => {
      vi.mocked(checkAdxCondition).mockReturnValue({
        isAllowed: true,
        adx: 30,
        reason: 'OK',
      } as never);

      const result = await validator.validateFilters(
        createWatcher(),
        createSetup(),
        { ...allDisabledConfig, useAdxFilter: true },
        createKlines(50),
        [],
        logBuffer,
      );

      expect(result.passed).toBe(true);
    });
  });

  describe('trend filter', () => {
    it('should skip when not configured globally or per-strategy', async () => {
      const result = await validator.validateFilters(
        createWatcher(),
        createSetup(),
        { ...allDisabledConfig, useTrendFilter: false },
        createKlines(50),
        [],
        logBuffer,
      );

      expect(result.passed).toBe(true);
      expect(checkTrendCondition).not.toHaveBeenCalled();
    });

    it('should apply when global config is enabled', async () => {
      vi.mocked(checkTrendCondition).mockReturnValue({
        isAllowed: true,
        price: 100,
        ema21: 99,
        reason: 'OK',
      } as never);

      const result = await validator.validateFilters(
        createWatcher(),
        createSetup(),
        { ...allDisabledConfig, useTrendFilter: true },
        createKlines(50),
        [],
        logBuffer,
      );

      expect(result.passed).toBe(true);
      expect(checkTrendCondition).toHaveBeenCalled();
    });

    it('should apply when strategy-level trend filter is enabled', async () => {
      vi.mocked(checkTrendCondition).mockReturnValue({
        isAllowed: true,
        price: 100,
        ema21: 99,
        reason: 'OK',
      } as never);

      const strategies: StrategyDefinition[] = [{
        id: 'larry_williams_9_1',
        filters: { trendFilter: { enabled: true } },
      } as unknown as StrategyDefinition];

      const result = await validator.validateFilters(
        createWatcher(),
        createSetup({ type: 'larry_williams_9_1' as never }),
        { ...allDisabledConfig, useTrendFilter: false },
        createKlines(50),
        strategies,
        logBuffer,
      );

      expect(result.passed).toBe(true);
      expect(checkTrendCondition).toHaveBeenCalled();
    });

    it('should fail when klines < 2 for trend filter', async () => {
      const result = await validator.validateFilters(
        createWatcher(),
        createSetup(),
        { ...allDisabledConfig, useTrendFilter: true },
        createKlines(1),
        [],
        logBuffer,
      );

      expect(result.passed).toBe(false);
      expect(result.rejectionReason).toContain('Insufficient');
    });

    it('should fail when trend rejects', async () => {
      vi.mocked(checkTrendCondition).mockReturnValue({
        isAllowed: false,
        price: 100,
        ema21: 105,
        reason: 'Against trend',
      } as never);

      const result = await validator.validateFilters(
        createWatcher(),
        createSetup(),
        { ...allDisabledConfig, useTrendFilter: true },
        createKlines(50),
        [],
        logBuffer,
      );

      expect(result.passed).toBe(false);
    });
  });

  describe('filter ordering (short-circuit)', () => {
    it('should not check later filters when early filter rejects', async () => {
      vi.mocked(checkBtcCorrelation).mockReturnValue({
        isAllowed: false,
        btcTrend: 'BEARISH',
        reason: 'Not aligned',
      } as never);

      await validator.validateFilters(
        createWatcher({ symbol: 'ETHUSDT' }),
        createSetup(),
        {
          ...allDisabledConfig,
          useBtcCorrelationFilter: true,
          useVolumeFilter: true,
          useMarketRegimeFilter: true,
        },
        createKlines(50),
        [],
        logBuffer,
      );

      expect(checkBtcCorrelation).toHaveBeenCalled();
      expect(checkVolumeCondition).not.toHaveBeenCalled();
      expect(checkMarketRegime).not.toHaveBeenCalled();
    });
  });
});
