import { calculateADX, calculateEMA, calculateStochastic } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';
import { ADX_FILTER } from '../../constants';
import { HistoricalMarketContextService } from '../historical-market-context';

export interface FilterConfig {
  onlyLong?: boolean;
  onlyWithTrend?: boolean;
  trendFilterPeriod?: number;
  useStochasticFilter?: boolean;
  useAdxFilter?: boolean;
  useMarketContextFilter?: boolean;
  marketContextConfig?: {
    fearGreed?: {
      enabled?: boolean;
      thresholdLow?: number;
      thresholdHigh?: number;
      action?: 'block' | 'reduce_size' | 'warn_only';
      sizeReduction?: number;
    };
    fundingRate?: {
      enabled?: boolean;
      threshold?: number;
      action?: 'block' | 'penalize' | 'warn_only';
      penalty?: number;
    };
  };
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
  skippedMarketContext: number;
  skippedCooldown: number;
  skippedDailyLossLimit: number;
  skippedVolatility: number;
  skippedRiskReward: number;
  skippedLimitExpired: number;
  skippedStochastic: number;
  skippedAdx: number;
}

export interface MarketContextResult {
  shouldTrade: boolean;
  positionSizeMultiplier: number;
  warnings: string[];
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
  private marketContextService: HistoricalMarketContextService | null = null;
  private emaTrend: number[] = [];

  public stats: FilterStats = {
    skippedKlineNotFound: 0,
    skippedTrend: 0,
    skippedMinNotional: 0,
    skippedMinProfit: 0,
    skippedMaxPositions: 0,
    skippedMaxExposure: 0,
    skippedMarketContext: 0,
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

  async initialize(klines: Kline[], startDate: string, endDate: string, symbol: string): Promise<void> {
    const trendPeriod = this.config.trendFilterPeriod ?? 200;
    const emaResult = calculateEMA(klines, trendPeriod);
    this.emaTrend = emaResult.map(v => v ?? 0);

    if (this.config.useMarketContextFilter) {
      console.log('[FilterManager] Initializing historical market context data...');
      this.marketContextService = new HistoricalMarketContextService({
        fearGreed: {
          enabled: this.config.marketContextConfig?.fearGreed?.enabled ?? true,
          thresholdLow: this.config.marketContextConfig?.fearGreed?.thresholdLow ?? 20,
          thresholdHigh: this.config.marketContextConfig?.fearGreed?.thresholdHigh ?? 80,
          action: this.config.marketContextConfig?.fearGreed?.action ?? 'reduce_size',
          sizeReduction: this.config.marketContextConfig?.fearGreed?.sizeReduction ?? 50,
        },
        fundingRate: {
          enabled: this.config.marketContextConfig?.fundingRate?.enabled ?? true,
          threshold: this.config.marketContextConfig?.fundingRate?.threshold ?? 0.05,
          action: this.config.marketContextConfig?.fundingRate?.action ?? 'penalize',
          penalty: this.config.marketContextConfig?.fundingRate?.penalty ?? 20,
        },
      });
      await this.marketContextService.initialize(
        new Date(startDate),
        new Date(endDate),
        [symbol]
      );
      console.log('[FilterManager] Market context data loaded:', this.marketContextService.getStats());
    }
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

    const STOCHASTIC_PERIOD = 14;
    if (setupIndex < STOCHASTIC_PERIOD + 1) return true;

    const stochasticKlines = klines.slice(setupIndex - STOCHASTIC_PERIOD - 10, setupIndex + 1);
    const stochResult = calculateStochastic(stochasticKlines, STOCHASTIC_PERIOD, 3);
    const currentStochK = stochResult.k[stochResult.k.length - 1];

    if (currentStochK === null || currentStochK === undefined) return true;

    let hadOversold = false;
    let hadOverbought = false;

    for (let i = stochResult.k.length - 1; i >= 0; i -= 1) {
      const k = stochResult.k[i];
      if (k === null || k === undefined) continue;

      if (!hadOversold && k < 20) hadOversold = true;
      if (!hadOverbought && k > 80) hadOverbought = true;

      if (hadOversold && hadOverbought) break;
    }

    const isLongAllowed = direction === 'LONG' && hadOversold && currentStochK < 50;
    const isShortAllowed = direction === 'SHORT' && hadOverbought && currentStochK > 50;

    if (!isLongAllowed && !isShortAllowed) {
      this.stats.skippedStochastic++;
      if (tradesCount < 3) {
        console.log(`[FilterManager] Stochastic filter blocked ${direction} trade - currK=${currentStochK.toFixed(2)}, hadOversold=${hadOversold}, hadOverbought=${hadOverbought}`);
      }
      return false;
    }

    if (tradesCount < 3) {
      const longReason = `K was in oversold and hasn't crossed 50 yet (current K: ${currentStochK.toFixed(2)})`;
      const shortReason = `K was in overbought and hasn't crossed 50 yet (current K: ${currentStochK.toFixed(2)})`;
      const reason = direction === 'LONG' ? longReason : shortReason;
      console.log(`[FilterManager] Stochastic filter passed ${direction} trade - ${reason}`);
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

    if (setupIndex < ADX_FILTER.MIN_KLINES_REQUIRED) return true;

    const adxKlines = klines.slice(
      setupIndex - ADX_FILTER.MIN_KLINES_REQUIRED,
      setupIndex + 1
    );
    const adxResult = calculateADX(adxKlines, ADX_FILTER.PERIOD);
    const currentAdx = adxResult.adx[adxResult.adx.length - 1];
    const currentPlusDI = adxResult.plusDI[adxResult.plusDI.length - 1];
    const currentMinusDI = adxResult.minusDI[adxResult.minusDI.length - 1];

    if (currentAdx == null || currentPlusDI == null || currentMinusDI == null) return true;

    const isBullish = currentPlusDI > currentMinusDI;
    const isBearish = currentMinusDI > currentPlusDI;
    const isStrongTrend = currentAdx >= ADX_FILTER.TREND_THRESHOLD;

    const isLongAllowed = direction === 'LONG' && isBullish && isStrongTrend;
    const isShortAllowed = direction === 'SHORT' && isBearish && isStrongTrend;

    if (!isLongAllowed && !isShortAllowed) {
      this.stats.skippedAdx++;
      if (tradesCount < 3) {
        const reason = !isStrongTrend
          ? `ADX (${currentAdx.toFixed(2)}) below threshold (${ADX_FILTER.TREND_THRESHOLD})`
          : direction === 'LONG'
            ? `+DI (${currentPlusDI.toFixed(2)}) <= -DI (${currentMinusDI.toFixed(2)})`
            : `-DI (${currentMinusDI.toFixed(2)}) <= +DI (${currentPlusDI.toFixed(2)})`;
        console.log(`[FilterManager] ADX filter blocked ${direction} trade - ${reason}`);
      }
      return false;
    }

    if (tradesCount < 3) {
      const condition = direction === 'LONG'
        ? `+DI (${currentPlusDI.toFixed(2)}) > -DI (${currentMinusDI.toFixed(2)}) with ADX (${currentAdx.toFixed(2)}) >= ${ADX_FILTER.TREND_THRESHOLD}`
        : `-DI (${currentMinusDI.toFixed(2)}) > +DI (${currentPlusDI.toFixed(2)}) with ADX (${currentAdx.toFixed(2)}) >= ${ADX_FILTER.TREND_THRESHOLD}`;
      console.log(`[FilterManager] ADX filter passed ${direction} trade - ${condition}`);
    }

    return true;
  }

  checkMarketContext(setupTime: number, symbol: string, direction: 'LONG' | 'SHORT'): MarketContextResult {
    if (!this.marketContextService) {
      return { shouldTrade: true, positionSizeMultiplier: 1.0, warnings: [] };
    }

    return this.marketContextService.evaluateSetup(setupTime, symbol, direction);
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
