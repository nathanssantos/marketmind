import type { Kline, MarketType } from '@marketmind/types';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db';
import { klines } from '../db/schema';
import { getEma21Direction } from '../utils/filters/btc-correlation-filter';
import { mapDbKlinesReversed } from '../utils/kline-mapper';
import { logger } from './logger';
import { SetupDetectionService } from './setup-detection/SetupDetectionService';

const MIN_KLINES_FOR_SCAN = 100;
const STRATEGIES_DIR = './strategies';

export interface PendingSetupInfo {
  type: string;
  side: 'LONG' | 'SHORT';
  confidence: number;
  entryPrice: number;
  stopLoss?: number;
  takeProfit?: number;
}

export interface SetupScanResult {
  symbol: string;
  hasPendingSetup: boolean;
  pendingSetups: PendingSetupInfo[];
  alignedWithBTC: boolean;
  btcTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  score: number;
}

export interface SetupPreScannerConfig {
  interval: string;
  marketType: MarketType;
  minConfidence?: number;
  enabledSetupTypes?: string[];
}

export class SetupPreScanner {
  private detectionService: SetupDetectionService | null = null;
  private btcKlinesCache: { klines: Kline[]; timestamp: number } | null = null;
  private btcCacheTTL = 60000;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.detectionService = new SetupDetectionService({
      minConfidence: 50,
      minRiskReward: 0.75,
      silent: true,
    });

    try {
      await this.detectionService.loadStrategiesFromDirectory(STRATEGIES_DIR);
      logger.info('[SetupPreScanner] Initialized with strategies from directory');
    } catch {
      logger.info('[SetupPreScanner] No strategies directory found, scanner will return empty results');
    }

    this.initialized = true;
  }

  async scanSymbol(
    symbol: string,
    config: SetupPreScannerConfig
  ): Promise<SetupScanResult> {
    await this.initialize();

    if (!this.detectionService) {
      return {
        symbol,
        hasPendingSetup: false,
        pendingSetups: [],
        alignedWithBTC: true,
        btcTrend: 'NEUTRAL',
        score: 0,
      };
    }

    const dbKlines = await db.query.klines.findMany({
      where: and(
        eq(klines.symbol, symbol),
        eq(klines.interval, config.interval),
        eq(klines.marketType, config.marketType)
      ),
      orderBy: [desc(klines.openTime)],
      limit: MIN_KLINES_FOR_SCAN,
    });

    if (dbKlines.length < MIN_KLINES_FOR_SCAN) {
      return {
        symbol,
        hasPendingSetup: false,
        pendingSetups: [],
        alignedWithBTC: true,
        btcTrend: 'NEUTRAL',
        score: 0,
      };
    }

    const klinesData = mapDbKlinesReversed(dbKlines);
    const setups = this.detectionService.detectSetups(klinesData);

    const filteredSetups = config.enabledSetupTypes?.length
      ? setups.filter(s => config.enabledSetupTypes!.includes(s.type))
      : setups;

    const pendingSetups: PendingSetupInfo[] = filteredSetups.map(setup => ({
      type: setup.type,
      side: setup.direction as 'LONG' | 'SHORT',
      confidence: setup.confidence,
      entryPrice: setup.entryPrice,
      stopLoss: setup.stopLoss,
      takeProfit: setup.takeProfit,
    }));

    const { btcTrend, alignedWithBTC } = await this.checkBtcAlignment(
      pendingSetups,
      config.interval
    );

    const score = this.calculateScanScore(pendingSetups, alignedWithBTC);

    return {
      symbol,
      hasPendingSetup: pendingSetups.length > 0,
      pendingSetups,
      alignedWithBTC,
      btcTrend,
      score,
    };
  }

  async scanSymbols(
    symbols: string[],
    config: SetupPreScannerConfig
  ): Promise<Map<string, SetupScanResult>> {
    const results = new Map<string, SetupScanResult>();

    const scanPromises = symbols.map(async (symbol) => {
      try {
        const result = await this.scanSymbol(symbol, config);
        results.set(symbol, result);
      } catch (error) {
        logger.warn({ symbol, error }, '[SetupPreScanner] Failed to scan symbol');
        results.set(symbol, {
          symbol,
          hasPendingSetup: false,
          pendingSetups: [],
          alignedWithBTC: true,
          btcTrend: 'NEUTRAL',
          score: 0,
        });
      }
    });

    await Promise.all(scanPromises);
    return results;
  }

  private async checkBtcAlignment(
    pendingSetups: PendingSetupInfo[],
    interval: string
  ): Promise<{ btcTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL'; alignedWithBTC: boolean }> {
    if (pendingSetups.length === 0) {
      return { btcTrend: 'NEUTRAL', alignedWithBTC: true };
    }

    const btcKlines = await this.getBtcKlines(interval);
    if (btcKlines.length < 30) {
      return { btcTrend: 'NEUTRAL', alignedWithBTC: true };
    }

    const btcEma21Trend = getEma21Direction(btcKlines);
    const btcTrend = btcEma21Trend.direction;

    const hasLongSetups = pendingSetups.some(s => s.side === 'LONG');
    const hasShortSetups = pendingSetups.some(s => s.side === 'SHORT');

    let alignedWithBTC = true;
    if (btcTrend === 'BULLISH' && hasShortSetups && !hasLongSetups) {
      alignedWithBTC = false;
    } else if (btcTrend === 'BEARISH' && hasLongSetups && !hasShortSetups) {
      alignedWithBTC = false;
    }

    return { btcTrend, alignedWithBTC };
  }

  private async getBtcKlines(interval: string): Promise<Kline[]> {
    const now = Date.now();
    if (this.btcKlinesCache && now - this.btcKlinesCache.timestamp < this.btcCacheTTL) {
      return this.btcKlinesCache.klines;
    }

    const btcDbKlines = await db.query.klines.findMany({
      where: and(eq(klines.symbol, 'BTCUSDT'), eq(klines.interval, interval)),
      orderBy: [desc(klines.openTime)],
      limit: 100,
    });

    const btcKlines = mapDbKlinesReversed(btcDbKlines);
    this.btcKlinesCache = { klines: btcKlines, timestamp: now };
    return btcKlines;
  }

  private calculateScanScore(pendingSetups: PendingSetupInfo[], alignedWithBTC: boolean): number {
    if (pendingSetups.length === 0) return 0;

    const avgConfidence = pendingSetups.reduce((sum, s) => sum + s.confidence, 0) / pendingSetups.length;
    const setupCountBonus = Math.min(pendingSetups.length * 10, 30);
    const alignmentBonus = alignedWithBTC ? 20 : 0;

    return Math.min(100, avgConfidence * 0.5 + setupCountBonus + alignmentBonus);
  }

  clearCache(): void {
    this.btcKlinesCache = null;
  }
}

let setupPreScannerInstance: SetupPreScanner | null = null;

export const getSetupPreScanner = (): SetupPreScanner => {
  if (!setupPreScannerInstance) {
    setupPreScannerInstance = new SetupPreScanner();
  }
  return setupPreScannerInstance;
};
