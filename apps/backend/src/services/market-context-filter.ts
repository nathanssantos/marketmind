import type {
  MarketContextAction,
  MarketContextConfig,
  MarketContextData,
  MarketContextFilterResult,
  TradingSetup,
} from '@marketmind/types';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { marketContextConfig, type MarketContextConfigRow } from '../db/schema';
import { BTCDominanceDataService } from './btc-dominance-data';
import { BinanceFuturesDataService } from './binance-futures-data';
import { logger } from './logger';

const btcDominanceService = new BTCDominanceDataService();
const binanceFuturesService = new BinanceFuturesDataService();

const DEFAULT_CONFIG: Omit<MarketContextConfig, 'id' | 'walletId' | 'userId' | 'createdAt' | 'updatedAt'> = {
  enabled: true,
  shadowMode: true,
  fearGreed: {
    enabled: true,
    thresholdLow: 20,
    thresholdHigh: 80,
    action: 'reduce_size',
    sizeReduction: 50,
  },
  fundingRate: {
    enabled: true,
    threshold: 0.05,
    action: 'penalize',
    penalty: 20,
  },
  btcDominance: {
    enabled: false,
    changeThreshold: 1.0,
    action: 'reduce_size',
    sizeReduction: 25,
  },
  openInterest: {
    enabled: false,
    changeThreshold: 10,
    action: 'warn_only',
  },
};

export class MarketContextFilter {
  private configCache: Map<string, { config: MarketContextConfig; expiry: number }> = new Map();
  private readonly CACHE_TTL_MS = 60000;

  async getConfig(walletId: string): Promise<MarketContextConfig> {
    const cached = this.configCache.get(walletId);
    if (cached && cached.expiry > Date.now()) {
      return cached.config;
    }

    const [row] = await db
      .select()
      .from(marketContextConfig)
      .where(eq(marketContextConfig.walletId, walletId))
      .limit(1);

    const config = row ? this.rowToConfig(row) : this.getDefaultConfig(walletId);

    this.configCache.set(walletId, {
      config,
      expiry: Date.now() + this.CACHE_TTL_MS,
    });

    return config;
  }

  private getDefaultConfig(walletId: string): MarketContextConfig {
    return {
      id: '',
      walletId,
      userId: '',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...DEFAULT_CONFIG,
    };
  }

  private rowToConfig(row: MarketContextConfigRow): MarketContextConfig {
    return {
      id: row.id,
      walletId: row.walletId,
      userId: row.userId,
      enabled: row.enabled,
      shadowMode: row.shadowMode,
      fearGreed: {
        enabled: row.fearGreedEnabled,
        thresholdLow: row.fearGreedThresholdLow,
        thresholdHigh: row.fearGreedThresholdHigh,
        action: row.fearGreedAction as MarketContextAction,
        sizeReduction: row.fearGreedSizeReduction,
      },
      fundingRate: {
        enabled: row.fundingRateEnabled,
        threshold: parseFloat(row.fundingRateThreshold),
        action: row.fundingRateAction as MarketContextAction,
        penalty: row.fundingRatePenalty,
      },
      btcDominance: {
        enabled: row.btcDominanceEnabled,
        changeThreshold: parseFloat(row.btcDominanceChangeThreshold),
        action: row.btcDominanceAction as MarketContextAction,
        sizeReduction: row.btcDominanceSizeReduction,
      },
      openInterest: {
        enabled: row.openInterestEnabled,
        changeThreshold: parseFloat(row.openInterestChangeThreshold),
        action: row.openInterestAction as MarketContextAction,
      },
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async fetchMarketData(symbol: string): Promise<MarketContextData> {
    const [fearGreed, btcDom, funding, oi] = await Promise.all([
      this.fetchFearGreedIndex(),
      this.fetchBtcDominance(),
      this.fetchFundingRate(symbol),
      this.fetchOpenInterest(symbol),
    ]);

    return {
      fearGreedIndex: fearGreed,
      btcDominance: btcDom.current,
      btcDominanceChange24h: btcDom.change24h,
      fundingRate: funding,
      openInterest: oi?.openInterest,
      openInterestChange24h: undefined,
      timestamp: new Date(),
    };
  }

  private async fetchFearGreedIndex(): Promise<number> {
    try {
      const response = await fetch('https://api.alternative.me/fng/?limit=1');
      if (!response.ok) return 50;
      const data = await response.json();
      return data?.data?.[0]?.value ? parseInt(data.data[0].value, 10) : 50;
    } catch {
      return 50;
    }
  }

  private async fetchBtcDominance(): Promise<{ current: number; change24h?: number }> {
    try {
      const result = await btcDominanceService.getBTCDominanceResult();
      return {
        current: result.current ?? 50,
        change24h: result.change24h ?? undefined,
      };
    } catch {
      return { current: 50 };
    }
  }

  private async fetchFundingRate(symbol: string): Promise<number | undefined> {
    try {
      const result = await binanceFuturesService.getCurrentFundingRate(symbol);
      return result?.rate;
    } catch {
      return undefined;
    }
  }

  private async fetchOpenInterest(symbol: string): Promise<{ openInterest: number; timestamp: number } | undefined> {
    try {
      const result = await binanceFuturesService.getCurrentOpenInterest(symbol);
      return result ?? undefined;
    } catch {
      return undefined;
    }
  }

  async validateSetup(
    setup: TradingSetup,
    symbol: string,
    walletId: string
  ): Promise<MarketContextFilterResult> {
    const config = await this.getConfig(walletId);

    if (!config.enabled) {
      return this.passResult();
    }

    const marketData = await this.fetchMarketData(symbol);
    const result = this.evaluateFilters(setup, config, marketData, symbol);

    const logData = {
      symbol,
      walletId,
      setupType: setup.type,
      direction: setup.direction,
      shadowMode: config.shadowMode,
      marketData: {
        fearGreed: marketData.fearGreedIndex,
        fundingRate: marketData.fundingRate,
        btcDominance: marketData.btcDominance,
      },
      result: {
        shouldTrade: result.shouldTrade,
        positionSizeMultiplier: result.positionSizeMultiplier,
        confidenceAdjustment: result.confidenceAdjustment,
        warnings: result.warnings,
        appliedFilters: result.appliedFilters,
      },
    };

    if (!result.shouldTrade) {
      logger.warn(logData, '🛑 Market context filter blocked trade');
    } else if (result.warnings.length > 0) {
      logger.info(logData, '⚠️ Market context filter warnings');
    } else {
      logger.debug(logData, '✅ Market context filter passed');
    }

    if (config.shadowMode) {
      return {
        ...this.passResult(),
        warnings: [`[SHADOW] ${result.reason || 'Would have modified trade'}`],
        appliedFilters: result.appliedFilters,
      };
    }

    return result;
  }

  private evaluateFilters(
    setup: TradingSetup,
    config: MarketContextConfig,
    data: MarketContextData,
    symbol: string
  ): MarketContextFilterResult {
    const result: MarketContextFilterResult = {
      shouldTrade: true,
      positionSizeMultiplier: 1.0,
      confidenceAdjustment: 0,
      warnings: [],
      appliedFilters: [],
    };

    if (config.fearGreed.enabled) {
      this.applyFearGreedFilter(setup, config, data, result);
    }

    if (config.fundingRate.enabled && data.fundingRate !== undefined) {
      this.applyFundingRateFilter(setup, config, data, result);
    }

    if (config.btcDominance.enabled && !symbol.startsWith('BTC')) {
      this.applyBtcDominanceFilter(config, data, result);
    }

    if (config.openInterest.enabled && data.openInterest !== undefined) {
      this.applyOpenInterestFilter(config, data, result);
    }

    return result;
  }

  private applyFearGreedFilter(
    setup: TradingSetup,
    config: MarketContextConfig,
    data: MarketContextData,
    result: MarketContextFilterResult
  ): void {
    const { fearGreedIndex } = data;
    const { thresholdLow, thresholdHigh, action, sizeReduction } = config.fearGreed;
    const isLong = setup.direction === 'LONG';

    if (fearGreedIndex <= thresholdLow) {
      result.appliedFilters.push({
        filter: 'fear_greed_extreme_fear',
        action,
        value: fearGreedIndex,
        threshold: thresholdLow,
        result: this.getFilterResult(action),
      });

      this.applyAction(action, sizeReduction, 0, result, `Extreme fear (${fearGreedIndex})`);
    }

    if (fearGreedIndex >= thresholdHigh && isLong) {
      result.appliedFilters.push({
        filter: 'fear_greed_extreme_greed',
        action,
        value: fearGreedIndex,
        threshold: thresholdHigh,
        result: this.getFilterResult(action),
      });

      this.applyAction(action, sizeReduction, 0, result, `Extreme greed on LONG (${fearGreedIndex})`);
    }
  }

  private applyFundingRateFilter(
    setup: TradingSetup,
    config: MarketContextConfig,
    data: MarketContextData,
    result: MarketContextFilterResult
  ): void {
    const fundingRate = data.fundingRate!;
    const { threshold, action, penalty } = config.fundingRate;
    const isLong = setup.direction === 'LONG';

    if (fundingRate > threshold && isLong) {
      result.appliedFilters.push({
        filter: 'funding_rate_high_long',
        action,
        value: fundingRate,
        threshold,
        result: this.getFilterResult(action),
      });

      this.applyAction(action, 0, penalty, result, `High funding rate on LONG (${fundingRate.toFixed(4)}%)`);
    }

    if (fundingRate < -threshold && !isLong) {
      result.appliedFilters.push({
        filter: 'funding_rate_low_short',
        action,
        value: fundingRate,
        threshold: -threshold,
        result: this.getFilterResult(action),
      });

      this.applyAction(action, 0, penalty, result, `Low funding rate on SHORT (${fundingRate.toFixed(4)}%)`);
    }
  }

  private applyBtcDominanceFilter(
    config: MarketContextConfig,
    data: MarketContextData,
    result: MarketContextFilterResult
  ): void {
    const change = data.btcDominanceChange24h;
    if (change === undefined) return;

    const { changeThreshold, action, sizeReduction } = config.btcDominance;

    if (change > changeThreshold) {
      result.appliedFilters.push({
        filter: 'btc_dominance_rising',
        action,
        value: change,
        threshold: changeThreshold,
        result: this.getFilterResult(action),
      });

      this.applyAction(action, sizeReduction, 0, result, `BTC dominance rising on altcoin (+${change.toFixed(2)}%)`);
    }
  }

  private applyOpenInterestFilter(
    config: MarketContextConfig,
    data: MarketContextData,
    result: MarketContextFilterResult
  ): void {
    const change = data.openInterestChange24h;
    if (change === undefined) return;

    const { changeThreshold, action } = config.openInterest;
    const absChange = Math.abs(change);

    if (absChange > changeThreshold) {
      result.appliedFilters.push({
        filter: 'open_interest_spike',
        action,
        value: change,
        threshold: changeThreshold,
        result: this.getFilterResult(action),
      });

      this.applyAction(action, 0, 0, result, `Open interest spike (${change > 0 ? '+' : ''}${change.toFixed(2)}%)`);
    }
  }

  private applyAction(
    action: MarketContextAction,
    sizeReduction: number,
    confidencePenalty: number,
    result: MarketContextFilterResult,
    reason: string
  ): void {
    switch (action) {
      case 'block':
        result.shouldTrade = false;
        result.reason = reason;
        break;
      case 'reduce_size':
        result.positionSizeMultiplier *= (100 - sizeReduction) / 100;
        result.warnings.push(reason);
        break;
      case 'penalize':
        result.confidenceAdjustment -= confidencePenalty;
        result.warnings.push(reason);
        break;
      case 'warn_only':
        result.warnings.push(reason);
        break;
    }
  }

  private getFilterResult(action: MarketContextAction): 'pass' | 'warn' | 'adjust' | 'block' {
    switch (action) {
      case 'block': return 'block';
      case 'reduce_size': return 'adjust';
      case 'penalize': return 'adjust';
      case 'warn_only': return 'warn';
      default: return 'pass';
    }
  }

  private passResult(): MarketContextFilterResult {
    return {
      shouldTrade: true,
      positionSizeMultiplier: 1.0,
      confidenceAdjustment: 0,
      warnings: [],
      appliedFilters: [],
    };
  }

  invalidateCache(walletId: string): void {
    this.configCache.delete(walletId);
  }
}

export const marketContextFilter = new MarketContextFilter();
