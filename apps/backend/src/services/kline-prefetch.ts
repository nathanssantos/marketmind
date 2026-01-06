import type { Interval } from '@marketmind/types';
import { REQUIRED_KLINES } from '../constants';
import { smartBackfillKlines, type SmartBackfillResult } from './binance-historical';
import { logger } from './logger';

const log = (message: string, data?: Record<string, unknown>): void => {
  if (data) {
    logger.info(data, `[Kline-Prefetch] ${message}`);
  } else {
    logger.info(`[Kline-Prefetch] ${message}`);
  }
};

const activeBackfills = new Map<string, Promise<SmartBackfillResult>>();

const getBackfillKey = (symbol: string, interval: string, marketType: 'SPOT' | 'FUTURES'): string =>
  `${symbol}:${interval}:${marketType}`;

export interface PrefetchOptions {
  symbol: string;
  interval: string;
  marketType?: 'SPOT' | 'FUTURES';
  targetCount?: number;
}

export interface PrefetchResult {
  success: boolean;
  downloaded: number;
  totalInDb: number;
  gaps: number;
  alreadyComplete: boolean;
  error?: string;
}

export const prefetchKlines = async (options: PrefetchOptions): Promise<PrefetchResult> => {
  const {
    symbol,
    interval,
    marketType = 'FUTURES',
    targetCount = REQUIRED_KLINES,
  } = options;

  const key = getBackfillKey(symbol, interval, marketType);

  const existingBackfill = activeBackfills.get(key);
  if (existingBackfill) {
    log('⏳ Backfill already in progress, waiting...', { symbol, interval, marketType });
    try {
      const result = await existingBackfill;
      return {
        success: true,
        downloaded: result.downloaded,
        totalInDb: result.totalInDb,
        gaps: result.gaps,
        alreadyComplete: result.alreadyComplete,
      };
    } catch (err) {
      return {
        success: false,
        downloaded: 0,
        totalInDb: 0,
        gaps: 0,
        alreadyComplete: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  const backfillPromise = smartBackfillKlines(symbol, interval as Interval, targetCount, marketType);
  activeBackfills.set(key, backfillPromise);

  try {
    const result = await backfillPromise;

    log('✅ Prefetch complete', {
      symbol,
      interval,
      marketType,
      downloaded: result.downloaded,
      totalInDb: result.totalInDb,
      gaps: result.gaps,
      alreadyComplete: result.alreadyComplete,
    });

    return {
      success: true,
      downloaded: result.downloaded,
      totalInDb: result.totalInDb,
      gaps: result.gaps,
      alreadyComplete: result.alreadyComplete,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error({ symbol, interval, marketType, error: errorMessage }, '[Kline-Prefetch] ❌ Failed to prefetch klines');

    return {
      success: false,
      downloaded: 0,
      totalInDb: 0,
      gaps: 0,
      alreadyComplete: false,
      error: errorMessage,
    };
  } finally {
    activeBackfills.delete(key);
  }
};

export const prefetchKlinesAsync = (options: PrefetchOptions): void => {
  prefetchKlines(options).catch(() => {});
};

export const hasSufficientKlines = (totalInDb: number, minRequired: number = 50): boolean =>
  totalInDb >= minRequired;
