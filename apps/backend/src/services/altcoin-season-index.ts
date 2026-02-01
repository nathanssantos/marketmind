import type { MarketType } from '@marketmind/types';
import { ALTCOIN_SEASON, INDICATOR_CACHE } from '../constants';
import { SimpleCache } from '../utils/cache';
import { get24hrTickerData } from './binance-exchange-info';
import { logger } from './logger';
import { getMarketCapDataService } from './market-cap-data';

export type SeasonType = 'ALT_SEASON' | 'BTC_SEASON' | 'NEUTRAL';

export interface AltcoinSeasonResult {
  seasonType: SeasonType;
  altSeasonIndex: number;
  altsOutperformingBtc: number;
  totalAltsAnalyzed: number;
  btcPerformance24h: number;
  avgAltPerformance24h: number;
  topPerformers: Array<{ symbol: string; performance: number }>;
  worstPerformers: Array<{ symbol: string; performance: number }>;
  timestamp: Date;
}

export interface AltcoinSeasonConfig {
  altSeasonThreshold?: number;
  btcSeasonThreshold?: number;
  topCoinsCount?: number;
  marketType?: MarketType;
}

const DEFAULT_CONFIG: Required<AltcoinSeasonConfig> = {
  altSeasonThreshold: ALTCOIN_SEASON.ALT_SEASON_THRESHOLD,
  btcSeasonThreshold: ALTCOIN_SEASON.BTC_SEASON_THRESHOLD,
  topCoinsCount: ALTCOIN_SEASON.DEFAULT_TOP_COINS,
  marketType: 'FUTURES',
};

export class AltcoinSeasonIndexService {
  private cache = new SimpleCache<AltcoinSeasonResult>(INDICATOR_CACHE.ALTCOIN_SEASON_TTL);

  async getAltcoinSeasonIndex(
    config: AltcoinSeasonConfig = {}
  ): Promise<AltcoinSeasonResult> {
    const cached = this.cache.get();
    if (cached) return cached;

    const result = await this.calculateIndex(config);
    this.cache.set(result);
    return result;
  }

  private async calculateIndex(
    config: AltcoinSeasonConfig
  ): Promise<AltcoinSeasonResult> {
    const {
      altSeasonThreshold,
      btcSeasonThreshold,
      topCoinsCount,
      marketType,
    } = { ...DEFAULT_CONFIG, ...config };

    try {
      const marketCapService = getMarketCapDataService();
      const topCoins = await marketCapService.getTopCoinsByMarketCap(topCoinsCount + 1, marketType);

      const btcCoin = topCoins.find(c => c.binanceSymbol === 'BTCUSDT');
      const altCoins = topCoins.filter(c => c.binanceSymbol !== 'BTCUSDT').slice(0, topCoinsCount);

      if (!btcCoin || altCoins.length === 0) {
        logger.warn('[AltcoinSeasonIndex] No BTC or alt data available');
        return this.createNeutralResult();
      }

      const symbols = [btcCoin.binanceSymbol, ...altCoins.map(c => c.binanceSymbol)];
      const tickerData = await get24hrTickerData(symbols, marketType);

      const btcTicker = tickerData.get('BTCUSDT');
      if (!btcTicker) {
        logger.warn('[AltcoinSeasonIndex] BTC ticker not available');
        return this.createNeutralResult();
      }

      const btcPerformance24h = btcTicker.priceChangePercent;

      const altPerformances: Array<{ symbol: string; performance: number }> = [];
      let altsOutperformingBtc = 0;

      for (const alt of altCoins) {
        const ticker = tickerData.get(alt.binanceSymbol);
        if (!ticker) continue;

        const performance = ticker.priceChangePercent;
        altPerformances.push({ symbol: alt.binanceSymbol, performance });

        if (performance > btcPerformance24h) {
          altsOutperformingBtc++;
        }
      }

      const totalAltsAnalyzed = altPerformances.length;
      if (totalAltsAnalyzed === 0) {
        return this.createNeutralResult();
      }

      const altSeasonIndex = (altsOutperformingBtc / totalAltsAnalyzed) * 100;
      const avgAltPerformance24h = altPerformances.reduce((sum, a) => sum + a.performance, 0) / totalAltsAnalyzed;

      altPerformances.sort((a, b) => b.performance - a.performance);
      const topPerformers = altPerformances.slice(0, ALTCOIN_SEASON.TOP_PERFORMERS_COUNT);
      const worstPerformers = altPerformances.slice(-ALTCOIN_SEASON.TOP_PERFORMERS_COUNT).reverse();

      let seasonType: SeasonType = 'NEUTRAL';
      if (altSeasonIndex >= altSeasonThreshold) {
        seasonType = 'ALT_SEASON';
      } else if (altSeasonIndex <= btcSeasonThreshold) {
        seasonType = 'BTC_SEASON';
      }

      logger.info({
        seasonType,
        altSeasonIndex: altSeasonIndex.toFixed(1),
        altsOutperformingBtc,
        totalAltsAnalyzed,
        btcPerformance24h: btcPerformance24h.toFixed(2),
        avgAltPerformance24h: avgAltPerformance24h.toFixed(2),
      }, '[AltcoinSeasonIndex] Index calculated');

      return {
        seasonType,
        altSeasonIndex,
        altsOutperformingBtc,
        totalAltsAnalyzed,
        btcPerformance24h,
        avgAltPerformance24h,
        topPerformers,
        worstPerformers,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error({ error }, '[AltcoinSeasonIndex] Error calculating index');
      return this.createNeutralResult();
    }
  }

  private createNeutralResult(): AltcoinSeasonResult {
    return {
      seasonType: 'NEUTRAL',
      altSeasonIndex: ALTCOIN_SEASON.NEUTRAL_INDEX,
      altsOutperformingBtc: 0,
      totalAltsAnalyzed: 0,
      btcPerformance24h: 0,
      avgAltPerformance24h: 0,
      topPerformers: [],
      worstPerformers: [],
      timestamp: new Date(),
    };
  }

  clearCache(): void {
    this.cache.clear();
  }

  setCacheTTL(ttl: number): void {
    this.cache.setTTL(ttl);
  }
}

let altcoinSeasonIndexService: AltcoinSeasonIndexService | null = null;

export const getAltcoinSeasonIndexService = (): AltcoinSeasonIndexService => {
  if (!altcoinSeasonIndexService) {
    altcoinSeasonIndexService = new AltcoinSeasonIndexService();
  }
  return altcoinSeasonIndexService;
};
