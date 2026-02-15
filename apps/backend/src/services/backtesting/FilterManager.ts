import { calculateEMA, CHOPPINESS_FILTER } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';
import {
  ADX_FILTER,
  checkAdxCondition,
  checkBtcCorrelation,
  checkFundingRate,
  checkMarketRegime,
  checkMomentumTiming,
  checkMtfCondition,
  checkStochasticCondition,
  checkStochasticRecoveryCondition,
  checkStochasticHtfCondition,
  checkStochasticRecoveryHtfCondition,
  checkTrendCondition,
  checkVolumeCondition,
  checkChoppinessCondition,
  checkSessionCondition,
  checkBollingerSqueezeCondition,
  checkVwapCondition,
  checkSupertrendCondition,
  getHigherTimeframe,
  MOMENTUM_TIMING_FILTER,
  MTF_FILTER,
  STOCHASTIC_FILTER,
  type BtcCorrelationResult,
  type FundingFilterResult,
  type MarketRegimeResult,
  type MtfFilterResult,
  type VolumeFilterConfig,
  type VolumeFilterResult,
  type ChoppinessFilterResult,
  type SessionFilterResult,
  type BollingerSqueezeFilterResult,
  type VwapFilterResult,
  type SupertrendFilterResult,
} from '../../utils/filters';
import { calculateConfluenceScore, type FilterResults } from '../../utils/confluence-scoring';

export interface FilterConfig {
  onlyLong?: boolean;
  directionMode?: 'long_only' | 'short_only';
  useTrendFilter?: boolean;
  trendFilterPeriod?: number;
  useStochasticFilter?: boolean;
  useStochasticRecoveryFilter?: boolean;
  useStochasticHtfFilter?: boolean;
  useStochasticRecoveryHtfFilter?: boolean;
  useMomentumTimingFilter?: boolean;
  useAdxFilter?: boolean;
  useCooldown?: boolean;
  cooldownMinutes?: number;
  dailyLossLimit?: number;
  maxConcurrentPositions?: number;
  maxTotalExposure?: number;
  useMtfFilter?: boolean;
  useBtcCorrelationFilter?: boolean;
  useMarketRegimeFilter?: boolean;
  useVolumeFilter?: boolean;
  volumeFilterConfig?: VolumeFilterConfig;
  useFundingFilter?: boolean;
  useConfluenceScoring?: boolean;
  confluenceMinScore?: number;
  maxPositionsPerStrategy?: number;
  useChoppinessFilter?: boolean;
  choppinessThresholdHigh?: number;
  choppinessThresholdLow?: number;
  choppinessPeriod?: number;
  useSessionFilter?: boolean;
  sessionStartUtc?: number;
  sessionEndUtc?: number;
  useBollingerSqueezeFilter?: boolean;
  bollingerSqueezeThreshold?: number;
  bollingerSqueezePeriod?: number;
  bollingerSqueezeStdDev?: number;
  useVwapFilter?: boolean;
  useSuperTrendFilter?: boolean;
  superTrendPeriod?: number;
  superTrendMultiplier?: number;
}

export interface FilterStats {
  skippedKlineNotFound: number;
  skippedTrend: number;
  skippedMinNotional: number;
  skippedMinProfit: number;
  skippedMaxPositions: number;
  skippedMaxExposure: number;
  skippedCooldown: number;
  skippedDailyLossLimit: number;
  skippedVolatility: number;
  skippedRiskReward: number;
  skippedLimitExpired: number;
  skippedStochastic: number;
  skippedStochasticRecovery: number;
  skippedStochasticHtf: number;
  skippedStochasticRecoveryHtf: number;
  skippedMomentumTiming: number;
  skippedAdx: number;
  skippedMtf: number;
  skippedBtcCorrelation: number;
  skippedMarketRegime: number;
  skippedVolume: number;
  skippedFunding: number;
  skippedConfluence: number;
  skippedPositionConflict: number;
  skippedPyramid: number;
  pyramidEntries: number;
  skippedChoppiness: number;
  skippedSession: number;
  skippedBollingerSqueeze: number;
  skippedVwap: number;
  skippedSupertrend: number;
}

export interface FilterContext {
  setup: any;
  klines: Kline[];
  entryPrice: number;
  equity: number;
  openPositions: Array<{ exitTime: number; positionValue: number }>;
  tradesCount: number;
  emaTrend?: number[];
  strategyOnlyWithTrend?: boolean;
  configExplicitlyDisablesTrend?: boolean;
}

export class FilterManager {
  private config: FilterConfig;
  private cooldownMap: Map<string, number> = new Map();
  private dailyPnl = 0;
  private currentDay = '';
  private dailyLossLimitReached = false;
  private emaTrend: number[] = [];
  private openPositionsBySymbol: Map<string, 'LONG' | 'SHORT'> = new Map();
  private positionsPerStrategy: Map<string, number> = new Map();

  public stats: FilterStats = {
    skippedKlineNotFound: 0,
    skippedTrend: 0,
    skippedMinNotional: 0,
    skippedMinProfit: 0,
    skippedMaxPositions: 0,
    skippedMaxExposure: 0,
    skippedCooldown: 0,
    skippedDailyLossLimit: 0,
    skippedVolatility: 0,
    skippedRiskReward: 0,
    skippedLimitExpired: 0,
    skippedStochastic: 0,
    skippedStochasticRecovery: 0,
    skippedStochasticHtf: 0,
    skippedStochasticRecoveryHtf: 0,
    skippedMomentumTiming: 0,
    skippedAdx: 0,
    skippedMtf: 0,
    skippedBtcCorrelation: 0,
    skippedMarketRegime: 0,
    skippedVolume: 0,
    skippedFunding: 0,
    skippedConfluence: 0,
    skippedPositionConflict: 0,
    skippedPyramid: 0,
    pyramidEntries: 0,
    skippedChoppiness: 0,
    skippedSession: 0,
    skippedBollingerSqueeze: 0,
    skippedVwap: 0,
    skippedSupertrend: 0,
  };

  constructor(config: FilterConfig) {
    this.config = config;
  }

  async initialize(klines: Kline[], _startDate: string, _endDate: string, _symbol: string): Promise<void> {
    const trendPeriod = this.config.trendFilterPeriod ?? 21;
    const emaResult = calculateEMA(klines, trendPeriod);
    this.emaTrend = emaResult.map(v => v ?? 0);
  }

  setEmaTrend(emaTrend: number[]): void {
    this.emaTrend = emaTrend;
  }

  getEmaTrend(): number[] {
    return this.emaTrend;
  }

  checkMaxPositions(openPositions: Array<{ exitTime: number }>, setupTime: number): boolean {
    const MAX_CONCURRENT = this.config.maxConcurrentPositions ?? 10;
    const activePositions = openPositions.filter(p => p.exitTime > setupTime);
    if (activePositions.length >= MAX_CONCURRENT) {
      this.stats.skippedMaxPositions++;
      return false;
    }
    return true;
  }

  checkDailyLossLimit(setupTime: number): boolean {
    if (!this.config.dailyLossLimit) return true;

    const setupDate = new Date(setupTime);
    const setupDay = setupDate.toISOString().slice(0, 10);

    if (setupDay !== this.currentDay) {
      this.currentDay = setupDay;
      this.dailyPnl = 0;
      this.dailyLossLimitReached = false;
    }

    if (this.dailyLossLimitReached) {
      this.stats.skippedDailyLossLimit++;
      return false;
    }

    return true;
  }

  updateDailyPnl(pnl: number, initialCapital: number): void {
    if (!this.config.dailyLossLimit) return;

    this.dailyPnl += pnl;
    const dailyLossLimitAmount = (initialCapital * this.config.dailyLossLimit) / 100;

    if (this.dailyPnl < -dailyLossLimitAmount) {
      this.dailyLossLimitReached = true;
      console.log(`[FilterManager] Daily loss limit reached on ${this.currentDay}: ${this.dailyPnl.toFixed(2)} < -${dailyLossLimitAmount.toFixed(2)}`);
    }
  }

  checkCooldown(setupType: string, symbol: string, interval: string, setupTime: number): boolean {
    if (!this.config.useCooldown) return true;

    const cooldownKey = `${setupType}-${symbol}-${interval}`;
    const lastTradeTime = this.cooldownMap.get(cooldownKey);
    const cooldownMs = (this.config.cooldownMinutes ?? 15) * 60 * 1000;

    if (lastTradeTime && setupTime - lastTradeTime < cooldownMs) {
      this.stats.skippedCooldown++;
      return false;
    }

    return true;
  }

  updateCooldown(setupType: string, symbol: string, interval: string, setupTime: number): void {
    if (!this.config.useCooldown) return;
    const cooldownKey = `${setupType}-${symbol}-${interval}`;
    this.cooldownMap.set(cooldownKey, setupTime);
  }

  checkDirection(setupDirection: string): boolean {
    if (this.config.directionMode) {
      if (this.config.directionMode === 'long_only' && setupDirection === 'SHORT') return false;
      if (this.config.directionMode === 'short_only' && setupDirection === 'LONG') return false;
      return true;
    }
    if (this.config.onlyLong && setupDirection === 'SHORT') return false;
    return true;
  }

  checkStochasticFilter(
    klines: Kline[],
    setupIndex: number,
    direction: 'LONG' | 'SHORT',
    tradesCount: number
  ): boolean {
    if (!this.config.useStochasticFilter) return true;

    const { K_PERIOD, K_SMOOTHING, D_PERIOD } = STOCHASTIC_FILTER;
    const minRequired = K_PERIOD + K_SMOOTHING + D_PERIOD;
    if (setupIndex < minRequired) return true;

    const stochasticKlines = klines.slice(0, setupIndex + 1);
    const result = checkStochasticCondition(stochasticKlines, direction);

    if (!result.isAllowed) {
      this.stats.skippedStochastic++;
      if (tradesCount < 3) {
        const currK = result.currentK?.toFixed(2) ?? 'null';
        console.log(`[FilterManager] Stochastic filter blocked ${direction} trade - currK=${currK}, isOversold=${result.isOversold}, isOverbought=${result.isOverbought}`);
      }
      return false;
    }

    if (tradesCount < 3) {
      console.log(`[FilterManager] Stochastic filter passed ${direction} trade - ${result.reason}`);
    }

    return true;
  }

  checkStochasticRecoveryFilter(
    klines: Kline[],
    setupIndex: number,
    direction: 'LONG' | 'SHORT',
    tradesCount: number
  ): boolean {
    if (!this.config.useStochasticRecoveryFilter) return true;

    const { K_PERIOD, K_SMOOTHING, D_PERIOD } = STOCHASTIC_FILTER;
    const minRequired = K_PERIOD + K_SMOOTHING + D_PERIOD;
    if (setupIndex < minRequired) return true;

    const stochasticKlines = klines.slice(0, setupIndex + 1);
    const result = checkStochasticRecoveryCondition(stochasticKlines, direction);

    if (!result.isAllowed) {
      this.stats.skippedStochasticRecovery++;
      if (tradesCount < 3) {
        const currK = result.currentK?.toFixed(2) ?? 'null';
        console.log(`[FilterManager] Stochastic Recovery filter blocked ${direction} trade - currK=${currK}, ${result.reason}`);
      }
      return false;
    }

    if (tradesCount < 3) {
      console.log(`[FilterManager] Stochastic Recovery filter passed ${direction} trade - ${result.reason}`);
    }

    return true;
  }

  checkStochasticHtfFilter(
    htfKlines: Kline[],
    setupTimestamp: number,
    direction: 'LONG' | 'SHORT',
    tradesCount: number
  ): boolean {
    if (!this.config.useStochasticHtfFilter) return true;
    if (htfKlines.length === 0) return true;

    const result = checkStochasticHtfCondition(htfKlines, setupTimestamp, direction);

    if (!result.isAllowed) {
      this.stats.skippedStochasticHtf++;
      if (tradesCount < 3) {
        const currK = result.currentK?.toFixed(2) ?? 'null';
        console.log(`[FilterManager] HTF Stochastic filter blocked ${direction} trade - currK=${currK}, isOversold=${result.isOversold}, isOverbought=${result.isOverbought}`);
      }
      return false;
    }

    if (tradesCount < 3) {
      console.log(`[FilterManager] HTF Stochastic filter passed ${direction} trade - ${result.reason}`);
    }

    return true;
  }

  checkStochasticRecoveryHtfFilter(
    htfKlines: Kline[],
    setupTimestamp: number,
    direction: 'LONG' | 'SHORT',
    tradesCount: number
  ): boolean {
    if (!this.config.useStochasticRecoveryHtfFilter) return true;
    if (htfKlines.length === 0) return true;

    const result = checkStochasticRecoveryHtfCondition(htfKlines, setupTimestamp, direction);

    if (!result.isAllowed) {
      this.stats.skippedStochasticRecoveryHtf++;
      if (tradesCount < 3) {
        const currK = result.currentK?.toFixed(2) ?? 'null';
        console.log(`[FilterManager] HTF Stochastic Recovery filter blocked ${direction} trade - currK=${currK}, ${result.reason}`);
      }
      return false;
    }

    if (tradesCount < 3) {
      console.log(`[FilterManager] HTF Stochastic Recovery filter passed ${direction} trade - ${result.reason}`);
    }

    return true;
  }

  checkMomentumTimingFilter(
    klines: Kline[],
    setupIndex: number,
    direction: 'LONG' | 'SHORT',
    tradesCount: number,
    setupType?: string
  ): boolean {
    if (!this.config.useMomentumTimingFilter) return true;

    const { MIN_KLINES_REQUIRED } = MOMENTUM_TIMING_FILTER;
    if (setupIndex < MIN_KLINES_REQUIRED) return true;

    const momentumKlines = klines.slice(0, setupIndex + 1);
    const result = checkMomentumTiming(momentumKlines, direction, setupType);

    if (!result.isAllowed) {
      this.stats.skippedMomentumTiming++;
      if (tradesCount < 3) {
        const rsi = result.rsiValue?.toFixed(2) ?? 'null';
        console.log(`[FilterManager] Momentum Timing filter blocked ${direction} trade - RSI=${rsi}, momentum=${result.rsiMomentum}`);
      }
      return false;
    }

    if (tradesCount < 3) {
      console.log(`[FilterManager] Momentum Timing filter passed ${direction} trade - ${result.reason}`);
    }

    return true;
  }

  checkAdxFilter(
    klines: Kline[],
    setupIndex: number,
    direction: 'LONG' | 'SHORT',
    tradesCount: number
  ): boolean {
    if (!this.config.useAdxFilter) return true;

    const { MIN_KLINES_REQUIRED } = ADX_FILTER;
    if (setupIndex < MIN_KLINES_REQUIRED) {
      this.stats.skippedAdx++;
      if (tradesCount < 3) {
        console.warn(`[FilterManager] ADX filter HARD BLOCK - insufficient klines (${setupIndex} < ${MIN_KLINES_REQUIRED})`);
      }
      return false;
    }

    const adxKlines = klines.slice(setupIndex - MIN_KLINES_REQUIRED, setupIndex + 1);
    const result = checkAdxCondition(adxKlines, direction);

    if (!result.isAllowed) {
      this.stats.skippedAdx++;
      if (tradesCount < 3) {
        console.log(`[FilterManager] ADX filter blocked ${direction} trade - ${result.reason}`);
      }
      return false;
    }

    if (tradesCount < 3) {
      console.log(`[FilterManager] ADX filter passed ${direction} trade - ${result.reason}`);
    }

    return true;
  }

  checkTrendFilter(
    klines: Kline[],
    setupIndex: number,
    direction: 'LONG' | 'SHORT',
    useTrendFilter: boolean,
    tradesCount: number
  ): boolean {
    if (!useTrendFilter) return true;

    const trendKlines = klines.slice(0, setupIndex + 1);
    if (trendKlines.length < 2) return true;

    const result = checkTrendCondition(trendKlines, direction);

    if (!result.isAllowed) {
      this.stats.skippedTrend++;
      if (tradesCount < 3) {
        console.warn(`[FilterManager] Trend filter blocked ${direction} - ${result.reason}`);
      }
      return false;
    }

    return true;
  }

  checkMaxExposure(
    currentExposure: number,
    positionValue: number,
    equity: number
  ): boolean {
    const MAX_TOTAL_EXPOSURE = this.config.maxTotalExposure ?? 1.0;
    const totalExposure = (currentExposure + positionValue) / equity;

    if (totalExposure > MAX_TOTAL_EXPOSURE) {
      this.stats.skippedMaxExposure++;
      return false;
    }

    return true;
  }

  incrementKlineNotFound(): void {
    this.stats.skippedKlineNotFound++;
  }

  incrementMinNotional(): void {
    this.stats.skippedMinNotional++;
  }

  incrementMinProfit(): void {
    this.stats.skippedMinProfit++;
  }

  incrementRiskReward(): void {
    this.stats.skippedRiskReward++;
  }

  incrementLimitExpired(): void {
    this.stats.skippedLimitExpired++;
  }

  checkMtfFilter(
    htfKlines: Kline[],
    direction: 'LONG' | 'SHORT',
    htfInterval: string | null,
    tradesCount: number
  ): { passed: boolean; result: MtfFilterResult | null } {
    if (!this.config.useMtfFilter || !htfInterval) {
      return { passed: true, result: null };
    }

    if (htfKlines.length < MTF_FILTER.MIN_KLINES_FOR_EMA200) {
      return { passed: true, result: null };
    }

    const result = checkMtfCondition(htfKlines, direction, htfInterval);

    if (!result.isAllowed) {
      this.stats.skippedMtf++;
      if (tradesCount < 3) {
        console.log(`[FilterManager] MTF filter blocked ${direction} trade - ${result.reason}`);
      }
      return { passed: false, result };
    }

    return { passed: true, result };
  }

  checkBtcCorrelationFilter(
    btcKlines: Kline[],
    direction: 'LONG' | 'SHORT',
    symbol: string,
    tradesCount: number
  ): { passed: boolean; result: BtcCorrelationResult | null } {
    if (!this.config.useBtcCorrelationFilter) {
      return { passed: true, result: null };
    }

    if (btcKlines.length < 26) {
      return { passed: true, result: null };
    }

    const result = checkBtcCorrelation(btcKlines, direction, symbol);

    if (!result.isAllowed) {
      this.stats.skippedBtcCorrelation++;
      if (tradesCount < 3) {
        console.log(`[FilterManager] BTC Correlation filter blocked ${direction} trade - ${result.reason}`);
      }
      return { passed: false, result };
    }

    return { passed: true, result };
  }

  checkMarketRegimeFilter(
    klines: Kline[],
    setupIndex: number,
    setupType: string,
    tradesCount: number
  ): { passed: boolean; result: MarketRegimeResult | null } {
    if (!this.config.useMarketRegimeFilter) {
      return { passed: true, result: null };
    }

    if (setupIndex < 30) {
      return { passed: true, result: null };
    }

    const regimeKlines = klines.slice(Math.max(0, setupIndex - 50), setupIndex + 1);
    const result = checkMarketRegime(regimeKlines, setupType);

    if (!result.isAllowed) {
      this.stats.skippedMarketRegime++;
      if (tradesCount < 3) {
        console.log(`[FilterManager] Market Regime filter blocked trade - ${result.reason}`);
      }
      return { passed: false, result };
    }

    return { passed: true, result };
  }

  checkVolumeFilter(
    klines: Kline[],
    setupIndex: number,
    direction: 'LONG' | 'SHORT',
    setupType: string,
    tradesCount: number
  ): { passed: boolean; result: VolumeFilterResult | null } {
    if (!this.config.useVolumeFilter) {
      return { passed: true, result: null };
    }

    if (setupIndex < 21) {
      return { passed: true, result: null };
    }

    const volumeKlines = klines.slice(Math.max(0, setupIndex - 30), setupIndex + 1);
    const result = checkVolumeCondition(volumeKlines, direction, setupType, this.config.volumeFilterConfig);

    if (!result.isAllowed) {
      this.stats.skippedVolume++;
      if (tradesCount < 3) {
        console.log(`[FilterManager] Volume filter blocked ${direction} trade - ${result.reason}`);
      }
      return { passed: false, result };
    }

    return { passed: true, result };
  }

  checkFundingFilter(
    fundingRate: number | null,
    direction: 'LONG' | 'SHORT',
    tradesCount: number
  ): { passed: boolean; result: FundingFilterResult | null } {
    if (!this.config.useFundingFilter) {
      return { passed: true, result: null };
    }

    const result = checkFundingRate(fundingRate, direction);

    if (!result.isAllowed) {
      this.stats.skippedFunding++;
      if (tradesCount < 3) {
        console.log(`[FilterManager] Funding Rate filter blocked ${direction} trade - ${result.reason}`);
      }
      return { passed: false, result };
    }

    return { passed: true, result };
  }

  checkConfluenceScoring(
    filterResults: FilterResults,
    tradesCount: number
  ): boolean {
    if (!this.config.useConfluenceScoring) {
      return true;
    }

    const minScore = this.config.confluenceMinScore ?? 60;
    const result = calculateConfluenceScore(filterResults, minScore);

    if (!result.isAllowed) {
      this.stats.skippedConfluence++;
      if (tradesCount < 3) {
        console.log(`[FilterManager] Confluence Scoring blocked trade - score ${result.totalScore}/${result.maxPossibleScore} (${result.scorePercent}%), min required ${minScore}`);
      }
      return false;
    }

    return true;
  }

  getHigherTimeframe(interval: string): string | null {
    return getHigherTimeframe(interval);
  }

  getSkipStats(): FilterStats {
    return { ...this.stats };
  }

  getTotalSkipped(): number {
    return Object.values(this.stats).reduce((sum, val) => sum + val, 0);
  }

  checkPositionConflict(
    symbol: string,
    direction: 'LONG' | 'SHORT',
    tradesCount: number
  ): boolean {
    const existingDirection = this.openPositionsBySymbol.get(symbol);

    if (existingDirection && existingDirection !== direction) {
      this.stats.skippedPositionConflict++;
      if (tradesCount < 3) {
        console.warn(`[FilterManager] Position conflict - ${symbol} has ${existingDirection} position, cannot open ${direction}`);
      }
      return false;
    }
    return true;
  }

  updatePositionTracking(symbol: string, direction: 'LONG' | 'SHORT', isOpen: boolean): void {
    if (isOpen) {
      this.openPositionsBySymbol.set(symbol, direction);
    } else {
      this.openPositionsBySymbol.delete(symbol);
    }
  }

  checkStrategyPositionLimit(
    setupType: string,
    maxPerStrategy: number | undefined,
    tradesCount: number
  ): boolean {
    if (!maxPerStrategy) return true;

    const current = this.positionsPerStrategy.get(setupType) ?? 0;
    if (current >= maxPerStrategy) {
      this.stats.skippedMaxPositions++;
      if (tradesCount < 3) {
        console.warn(`[FilterManager] Strategy ${setupType} at max positions (${current}/${maxPerStrategy})`);
      }
      return false;
    }
    return true;
  }

  updateStrategyPositionCount(setupType: string, delta: number): void {
    const current = this.positionsPerStrategy.get(setupType) ?? 0;
    this.positionsPerStrategy.set(setupType, Math.max(0, current + delta));
  }

  incrementPyramidSkipped(): void {
    this.stats.skippedPyramid++;
  }

  incrementPyramidEntries(): void {
    this.stats.pyramidEntries++;
  }

  checkChoppinessFilter(
    klines: Kline[],
    setupIndex: number,
    tradesCount: number
  ): { passed: boolean; result: ChoppinessFilterResult | null } {
    if (!this.config.useChoppinessFilter) {
      return { passed: true, result: null };
    }

    const period = this.config.choppinessPeriod ?? CHOPPINESS_FILTER.DEFAULT_PERIOD;
    if (setupIndex < period + 1) {
      return { passed: true, result: null };
    }

    const choppinessKlines = klines.slice(Math.max(0, setupIndex - period - 10), setupIndex + 1);
    const result = checkChoppinessCondition(
      choppinessKlines,
      this.config.choppinessThresholdHigh ?? CHOPPINESS_FILTER.HIGH_THRESHOLD,
      this.config.choppinessThresholdLow ?? CHOPPINESS_FILTER.LOW_THRESHOLD,
      period
    );

    if (!result.isAllowed) {
      this.stats.skippedChoppiness++;
      if (tradesCount < 3) {
        console.log(`[FilterManager] Choppiness filter blocked trade - ${result.reason}`);
      }
      return { passed: false, result };
    }

    return { passed: true, result };
  }

  checkSessionFilter(
    setupTime: number,
    tradesCount: number
  ): { passed: boolean; result: SessionFilterResult | null } {
    if (!this.config.useSessionFilter) {
      return { passed: true, result: null };
    }

    const result = checkSessionCondition(
      setupTime,
      this.config.sessionStartUtc ?? 13,
      this.config.sessionEndUtc ?? 16
    );

    if (!result.isAllowed) {
      this.stats.skippedSession++;
      if (tradesCount < 3) {
        console.log(`[FilterManager] Session filter blocked trade - ${result.reason}`);
      }
      return { passed: false, result };
    }

    return { passed: true, result };
  }

  checkBollingerSqueezeFilter(
    klines: Kline[],
    setupIndex: number,
    tradesCount: number
  ): { passed: boolean; result: BollingerSqueezeFilterResult | null } {
    if (!this.config.useBollingerSqueezeFilter) {
      return { passed: true, result: null };
    }

    const period = this.config.bollingerSqueezePeriod ?? 20;
    if (setupIndex < period) {
      return { passed: true, result: null };
    }

    const bbKlines = klines.slice(Math.max(0, setupIndex - period - 5), setupIndex + 1);
    const result = checkBollingerSqueezeCondition(
      bbKlines,
      this.config.bollingerSqueezeThreshold ?? 0.1,
      period,
      this.config.bollingerSqueezeStdDev ?? 2.0
    );

    if (!result.isAllowed) {
      this.stats.skippedBollingerSqueeze++;
      if (tradesCount < 3) {
        console.log(`[FilterManager] Bollinger Squeeze filter blocked trade - ${result.reason}`);
      }
      return { passed: false, result };
    }

    return { passed: true, result };
  }

  checkVwapFilter(
    klines: Kline[],
    setupIndex: number,
    direction: 'LONG' | 'SHORT',
    tradesCount: number
  ): { passed: boolean; result: VwapFilterResult | null } {
    if (!this.config.useVwapFilter) {
      return { passed: true, result: null };
    }

    if (setupIndex < 10) {
      return { passed: true, result: null };
    }

    const vwapKlines = klines.slice(Math.max(0, setupIndex - 50), setupIndex + 1);
    const result = checkVwapCondition(vwapKlines, direction);

    if (!result.isAllowed) {
      this.stats.skippedVwap++;
      if (tradesCount < 3) {
        console.log(`[FilterManager] VWAP filter blocked ${direction} trade - ${result.reason}`);
      }
      return { passed: false, result };
    }

    return { passed: true, result };
  }

  checkSupertrendFilter(
    klines: Kline[],
    setupIndex: number,
    direction: 'LONG' | 'SHORT',
    tradesCount: number
  ): { passed: boolean; result: SupertrendFilterResult | null } {
    if (!this.config.useSuperTrendFilter) {
      return { passed: true, result: null };
    }

    const period = this.config.superTrendPeriod ?? 10;
    if (setupIndex < period + 1) {
      return { passed: true, result: null };
    }

    const stKlines = klines.slice(Math.max(0, setupIndex - period - 10), setupIndex + 1);
    const result = checkSupertrendCondition(
      stKlines,
      direction,
      period,
      this.config.superTrendMultiplier ?? 3.0
    );

    if (!result.isAllowed) {
      this.stats.skippedSupertrend++;
      if (tradesCount < 3) {
        console.log(`[FilterManager] SuperTrend filter blocked ${direction} trade - ${result.reason}`);
      }
      return { passed: false, result };
    }

    return { passed: true, result };
  }
}
