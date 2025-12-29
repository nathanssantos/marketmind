import { calculateEMA } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';
import { checkAdxCondition, ADX_FILTER } from '../../utils/adx-filter';
import { checkStochasticCondition, STOCHASTIC_FILTER } from '../../utils/stochastic-filter';

export interface FilterConfig {
  onlyLong?: boolean;
  onlyWithTrend?: boolean;
  trendFilterPeriod?: number;
  useStochasticFilter?: boolean;
  useAdxFilter?: boolean;
  useCooldown?: boolean;
  cooldownMinutes?: number;
  dailyLossLimit?: number;
  maxConcurrentPositions?: number;
  maxTotalExposure?: number;
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
  skippedAdx: number;
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
    skippedAdx: 0,
  };

  constructor(config: FilterConfig) {
    this.config = config;
  }

  async initialize(klines: Kline[], _startDate: string, _endDate: string, _symbol: string): Promise<void> {
    const trendPeriod = this.config.trendFilterPeriod ?? 200;
    const emaResult = calculateEMA(klines, trendPeriod);
    this.emaTrend = emaResult.map(v => v ?? 0);
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
    if (this.config.onlyLong && setupDirection === 'SHORT') {
      return false;
    }
    return true;
  }

  checkStochasticFilter(
    klines: Kline[],
    setupIndex: number,
    direction: 'LONG' | 'SHORT',
    tradesCount: number
  ): boolean {
    if (!this.config.useStochasticFilter) return true;

    const { PERIOD, LOOKBACK_BUFFER } = STOCHASTIC_FILTER;
    if (setupIndex < PERIOD + 1) return true;

    const stochasticKlines = klines.slice(setupIndex - PERIOD - LOOKBACK_BUFFER, setupIndex + 1);
    const result = checkStochasticCondition(stochasticKlines, direction);

    if (!result.isAllowed) {
      this.stats.skippedStochastic++;
      if (tradesCount < 3) {
        const currK = result.currentK?.toFixed(2) ?? 'null';
        console.log(`[FilterManager] Stochastic filter blocked ${direction} trade - currK=${currK}, hadOversold=${result.hadOversold}, hadOverbought=${result.hadOverbought}, oversoldMoreRecent=${result.oversoldMoreRecent}`);
      }
      return false;
    }

    if (tradesCount < 3) {
      console.log(`[FilterManager] Stochastic filter passed ${direction} trade - ${result.reason}`);
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
    if (setupIndex < MIN_KLINES_REQUIRED) return true;

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
    setupIndex: number,
    entryPrice: number,
    direction: 'LONG' | 'SHORT',
    useTrendFilter: boolean,
    tradesCount: number
  ): boolean {
    if (!useTrendFilter || this.emaTrend.length === 0) return true;

    const emaTrendValue = this.emaTrend[setupIndex];
    if (emaTrendValue === null || emaTrendValue === undefined) return true;

    const trendPeriod = this.config.trendFilterPeriod ?? 200;
    const isBullishTrend = entryPrice > emaTrendValue;
    const isBearishTrend = entryPrice < emaTrendValue;

    if (direction === 'LONG' && !isBullishTrend) {
      if (tradesCount < 3) console.warn(`[FilterManager] Skipping LONG setup - price below EMA${trendPeriod} (counter-trend)`);
      this.stats.skippedTrend++;
      return false;
    }
    if (direction === 'SHORT' && !isBearishTrend) {
      if (tradesCount < 3) console.warn(`[FilterManager] Skipping SHORT setup - price above EMA${trendPeriod} (counter-trend)`);
      this.stats.skippedTrend++;
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

  getSkipStats(): FilterStats {
    return { ...this.stats };
  }

  getTotalSkipped(): number {
    return Object.values(this.stats).reduce((sum, val) => sum + val, 0);
  }
}
