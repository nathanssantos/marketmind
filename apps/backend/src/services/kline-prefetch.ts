import type { Interval } from '@marketmind/types';
import { ABSOLUTE_MINIMUM_KLINES, REQUIRED_KLINES } from '../constants';
import { smartBackfillKlines, type SmartBackfillResult } from './binance-historical';
import { logger } from './logger';

const log = (message: string, data?: Record<string, unknown>): void => {
  if (data) {
    logger.info(data, `[Kline-Prefetch] ${message}`);
  } else {
    logger.info(`[Kline-Prefetch] ${message}`);
  }
};

const KLINE_TOLERANCE_PERCENT = 0.99;
const HARD_MINIMUM_KLINES = 2000;

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

export const meetsKlineRequirementWithTolerance = (
  totalInDb: number,
  required: number,
  apiExhausted: boolean
): boolean => {
  if (totalInDb >= required) return true;
  if (apiExhausted) {
    const toleranceThreshold = Math.floor(required * KLINE_TOLERANCE_PERCENT);
    return totalInDb >= toleranceThreshold;
  }
  return false;
};

export interface KlineAvailabilityResult {
  hasSufficient: boolean;
  totalAvailable: number;
  required: number;
  apiExhausted: boolean;
}

export const checkKlineAvailability = async (
  symbol: string,
  interval: string,
  marketType: 'SPOT' | 'FUTURES' = 'FUTURES'
): Promise<KlineAvailabilityResult> => {
  const required = ABSOLUTE_MINIMUM_KLINES;

  try {
    const result = await prefetchKlines({
      symbol,
      interval,
      marketType,
      targetCount: required,
    });

    if (!result.success) {
      log('⚠️ Kline availability check failed', { symbol, interval, marketType, error: result.error });
      return { hasSufficient: false, totalAvailable: 0, required, apiExhausted: false };
    }

    const apiExhausted = result.alreadyComplete || result.gaps === 0;
    const toleranceThreshold = Math.floor(required * KLINE_TOLERANCE_PERCENT);
    const meetsExactRequirement = result.totalInDb >= required;
    const meetsToleranceWithApiExhausted = apiExhausted && result.totalInDb >= toleranceThreshold;
    const hasSufficient = meetsExactRequirement || meetsToleranceWithApiExhausted;
    const meetsHardMinimum = result.totalInDb >= HARD_MINIMUM_KLINES;

    if (!hasSufficient) {
      if (!meetsHardMinimum) {
        log('❌ Symbol has critically insufficient klines', {
          symbol,
          interval,
          marketType,
          totalAvailable: result.totalInDb,
          required,
          hardMinimum: HARD_MINIMUM_KLINES,
          apiExhausted,
        });
      } else {
        log('⚠️ Symbol has insufficient klines', {
          symbol,
          interval,
          marketType,
          totalAvailable: result.totalInDb,
          required,
          toleranceThreshold,
          apiExhausted,
        });
      }
      return { hasSufficient: false, totalAvailable: result.totalInDb, required, apiExhausted };
    }

    if (meetsToleranceWithApiExhausted && !meetsExactRequirement) {
      log('ℹ️ Symbol accepted with tolerance (API exhausted)', {
        symbol,
        interval,
        marketType,
        totalAvailable: result.totalInDb,
        required,
        toleranceThreshold,
      });
    }

    return { hasSufficient: true, totalAvailable: result.totalInDb, required, apiExhausted };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log('❌ Kline availability check error', { symbol, interval, marketType, error: errorMessage });
    return { hasSufficient: false, totalAvailable: 0, required, apiExhausted: false };
  }
};
