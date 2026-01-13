import type { MarketType } from '@marketmind/types';
import { and, count, gte, inArray } from 'drizzle-orm';
import { TIME_MS } from '../constants';
import { db } from '../db';
import { setupDetections, strategyPerformance } from '../db/schema';
import { get24hrTickerData, type Ticker24hr } from './binance-exchange-info';
import { logger } from './logger';
import { getMarketCapDataService, type TopCoin } from './market-cap-data';

export interface ScoringWeights {
  marketCapRank: number;
  volume: number;
  volatility: number;
  priceChange: number;
  setupFrequency: number;
  winRate: number;
  profitFactor: number;
}

const DEFAULT_WEIGHTS: ScoringWeights = {
  marketCapRank: 0.15,
  volume: 0.20,
  volatility: 0.15,
  priceChange: 0.10,
  setupFrequency: 0.20,
  winRate: 0.10,
  profitFactor: 0.10,
};

export interface SymbolScore {
  symbol: string;
  compositeScore: number;
  marketCapRank: number;
  breakdown: {
    marketCapScore: number;
    volumeScore: number;
    volatilityScore: number;
    priceChangeScore: number;
    setupFrequencyScore: number;
    winRateScore: number;
    profitFactorScore: number;
  };
  rawData: {
    marketCap: number;
    volume24h: number;
    priceChange24h: number;
    setupCount7d: number;
    winRate: number | null;
    profitFactor: number | null;
  };
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export class OpportunityScoringService {
  private scoreCache: CacheEntry<SymbolScore[]> | null = null;
  private cacheTTL = 10 * TIME_MS.MINUTE;
  private weights: ScoringWeights = DEFAULT_WEIGHTS;

  setWeights(weights: Partial<ScoringWeights>): void {
    this.weights = { ...DEFAULT_WEIGHTS, ...weights };
  }

  setCacheTTL(ttl: number): void {
    this.cacheTTL = ttl;
  }

  async getSymbolScores(
    marketType: MarketType = 'FUTURES',
    limit: number = 100
  ): Promise<SymbolScore[]> {
    const cached = this.getFromCache();
    if (cached) {
      return cached.slice(0, limit);
    }

    const scores = await this.calculateScores(marketType, limit);
    this.setCache(scores);
    return scores;
  }

  async getTopSymbolsByScore(
    marketType: MarketType = 'FUTURES',
    limit: number = 20
  ): Promise<string[]> {
    const scores = await this.getSymbolScores(marketType, limit);
    return scores.map((s) => s.symbol);
  }

  private async calculateScores(
    marketType: MarketType,
    limit: number
  ): Promise<SymbolScore[]> {
    const marketCapService = getMarketCapDataService();
    const topCoins = await marketCapService.getTopCoinsByMarketCap(limit, marketType);

    if (topCoins.length === 0) {
      logger.warn('No coins returned from market cap service');
      return [];
    }

    const symbols = topCoins.map((c) => c.binanceSymbol);
    const tickerData = await get24hrTickerData(symbols, marketType);

    const [setupCounts, performanceData] = await Promise.all([
      this.getSetupCounts(symbols),
      this.getPerformanceData(symbols),
    ]);

    const volumeMax = Math.max(...topCoins.map((c) => c.volume24h), 1);
    const volatilityValues = this.calculateVolatilities(topCoins, tickerData);
    const volatilityMax = Math.max(...volatilityValues, 1);

    const scores: SymbolScore[] = topCoins.map((coin, index) => {
      const setupCount = setupCounts.get(coin.binanceSymbol) ?? 0;
      const performance = performanceData.get(coin.binanceSymbol);

      const marketCapScore = this.calculateMarketCapScore(coin.marketCapRank);
      const volumeScore = this.normalizeScore(coin.volume24h, volumeMax);
      const volatilityScore = this.calculateVolatilityScore(
        volatilityValues[index] ?? 0,
        volatilityMax
      );
      const priceChangeScore = this.calculatePriceChangeScore(coin.priceChangePercent24h);
      const setupFrequencyScore = Math.min(100, setupCount * 10);
      const winRateScore = performance?.winRate != null ? performance.winRate : 50;
      const profitFactorScore = performance?.profitFactor != null
        ? Math.min(100, performance.profitFactor * 50)
        : 50;

      const compositeScore =
        marketCapScore * this.weights.marketCapRank +
        volumeScore * this.weights.volume +
        volatilityScore * this.weights.volatility +
        priceChangeScore * this.weights.priceChange +
        setupFrequencyScore * this.weights.setupFrequency +
        winRateScore * this.weights.winRate +
        profitFactorScore * this.weights.profitFactor;

      return {
        symbol: coin.binanceSymbol,
        compositeScore,
        marketCapRank: coin.marketCapRank,
        breakdown: {
          marketCapScore,
          volumeScore,
          volatilityScore,
          priceChangeScore,
          setupFrequencyScore,
          winRateScore,
          profitFactorScore,
        },
        rawData: {
          marketCap: coin.marketCap,
          volume24h: coin.volume24h,
          priceChange24h: coin.priceChangePercent24h,
          setupCount7d: setupCount,
          winRate: performance?.winRate ?? null,
          profitFactor: performance?.profitFactor ?? null,
        },
      };
    });

    scores.sort((a, b) => b.compositeScore - a.compositeScore);
    return scores;
  }

  private calculateMarketCapScore(rank: number): number {
    if (rank <= 10) return 100;
    if (rank <= 25) return 90;
    if (rank <= 50) return 80;
    if (rank <= 75) return 70;
    return Math.max(50, 100 - rank * 0.5);
  }

  private normalizeScore(value: number, max: number): number {
    if (max === 0) return 50;
    return (value / max) * 100;
  }

  private calculateVolatilityScore(volatility: number, maxVolatility: number): number {
    const normalizedVol = maxVolatility > 0 ? volatility / maxVolatility : 0;
    const optimalRange = { min: 0.2, max: 0.6 };

    if (normalizedVol >= optimalRange.min && normalizedVol <= optimalRange.max) {
      return 100;
    }

    if (normalizedVol < optimalRange.min) {
      return 50 + (normalizedVol / optimalRange.min) * 50;
    }

    const excess = normalizedVol - optimalRange.max;
    return Math.max(30, 100 - excess * 150);
  }

  private calculatePriceChangeScore(priceChangePercent: number): number {
    const absChange = Math.abs(priceChangePercent);

    if (absChange < 0.5) return 30;
    if (absChange <= 3) return 70 + absChange * 10;
    if (absChange <= 8) return 100;
    if (absChange <= 15) return 90;
    return 70;
  }

  private calculateVolatilities(coins: TopCoin[], tickerData: Map<string, Ticker24hr>): number[] {
    return coins.map((coin) => {
      const ticker = tickerData.get(coin.binanceSymbol);
      if (!ticker) return 0;

      const range = ticker.highPrice - ticker.lowPrice;
      const avgPrice = ticker.weightedAvgPrice || coin.currentPrice;
      return avgPrice > 0 ? (range / avgPrice) * 100 : 0;
    });
  }

  private async getSetupCounts(symbols: string[]): Promise<Map<string, number>> {
    const sevenDaysAgo = new Date(Date.now() - 7 * TIME_MS.DAY);

    try {
      const results = await db
        .select({
          symbol: setupDetections.symbol,
          count: count(),
        })
        .from(setupDetections)
        .where(
          and(
            inArray(setupDetections.symbol, symbols),
            gte(setupDetections.detectedAt, sevenDaysAgo)
          )
        )
        .groupBy(setupDetections.symbol);

      return new Map(results.map((r) => [r.symbol, r.count]));
    } catch (error) {
      logger.error({ error }, 'Error fetching setup counts');
      return new Map();
    }
  }

  private async getPerformanceData(
    symbols: string[]
  ): Promise<Map<string, { winRate: number; profitFactor: number }>> {
    try {
      const results = await db
        .select({
          symbol: strategyPerformance.symbol,
          winRate: strategyPerformance.winRate,
          avgWin: strategyPerformance.avgWin,
          avgLoss: strategyPerformance.avgLoss,
        })
        .from(strategyPerformance)
        .where(inArray(strategyPerformance.symbol, symbols));

      const aggregated = new Map<string, { totalWinRate: number; count: number; totalProfitFactor: number }>();

      for (const r of results) {
        const existing = aggregated.get(r.symbol) ?? { totalWinRate: 0, count: 0, totalProfitFactor: 0 };
        const winRate = parseFloat(r.winRate);
        const avgWin = parseFloat(r.avgWin);
        const avgLoss = parseFloat(r.avgLoss);
        const profitFactor = avgLoss > 0 ? avgWin / avgLoss : 1;

        aggregated.set(r.symbol, {
          totalWinRate: existing.totalWinRate + winRate,
          count: existing.count + 1,
          totalProfitFactor: existing.totalProfitFactor + profitFactor,
        });
      }

      return new Map(
        [...aggregated.entries()].map(([symbol, data]) => [
          symbol,
          {
            winRate: data.totalWinRate / data.count,
            profitFactor: data.totalProfitFactor / data.count,
          },
        ])
      );
    } catch (error) {
      logger.error({ error }, 'Error fetching performance data');
      return new Map();
    }
  }

  private getFromCache(): SymbolScore[] | null {
    if (this.scoreCache && Date.now() - this.scoreCache.timestamp < this.cacheTTL) {
      return this.scoreCache.data;
    }
    return null;
  }

  private setCache(data: SymbolScore[]): void {
    this.scoreCache = { data, timestamp: Date.now() };
  }

  clearCache(): void {
    this.scoreCache = null;
  }
}

let opportunityScoringService: OpportunityScoringService | null = null;

export const getOpportunityScoringService = (): OpportunityScoringService => {
  if (!opportunityScoringService) {
    opportunityScoringService = new OpportunityScoringService();
  }
  return opportunityScoringService;
};

export default OpportunityScoringService;
