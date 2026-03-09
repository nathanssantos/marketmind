import { serializeError } from '../utils/errors';
import { createLogger } from '@marketmind/logger';
import type { Interval } from '@marketmind/types';
import { ABSOLUTE_MINIMUM_KLINES, BACKFILL_TARGET_KLINES } from '../constants';
import { binanceApiCache } from './binance-api-cache';
import { smartBackfillKlines, type SmartBackfillResult } from './binance-historical';

const log = createLogger('Kline-Prefetch');

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
  silent?: boolean;
  forRotation?: boolean;
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
    targetCount = BACKFILL_TARGET_KLINES,
    silent = false,
    forRotation = false,
  } = options;

  if (binanceApiCache.isBanned()) {
    const waitSeconds = Math.ceil(binanceApiCache.getBanExpiresIn() / 1000);
    if (!silent) log.warn('~ Skipping prefetch - IP banned', { symbol, interval, marketType, waitSeconds });
    return {
      success: false,
      downloaded: 0,
      totalInDb: 0,
      gaps: 0,
      alreadyComplete: false,
      error: `IP banned. Try again in ${waitSeconds} seconds.`,
    };
  }

  const key = getBackfillKey(symbol, interval, marketType);

  const existingBackfill = activeBackfills.get(key);
  if (existingBackfill) {
    if (!silent) log.info('~ Backfill already in progress, waiting...', { symbol, interval, marketType });
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
        error: serializeError(err),
      };
    }
  }

  const backfillPromise = smartBackfillKlines(symbol, interval as Interval, targetCount, marketType, forRotation);
  activeBackfills.set(key, backfillPromise);

  try {
    const result = await backfillPromise;

    const hasGapsToFill = result.gaps > 0;
    if (!silent && hasGapsToFill) {
      log.info('✓ Prefetch complete', {
        symbol,
        interval,
        marketType,
        downloaded: result.downloaded,
        totalInDb: result.totalInDb,
        gapsFilled: result.gaps,
      });
    }

    return {
      success: true,
      downloaded: result.downloaded,
      totalInDb: result.totalInDb,
      gaps: result.gaps,
      alreadyComplete: result.alreadyComplete,
    };
  } catch (err) {
    const errorMessage = serializeError(err);

    if (errorMessage.includes('418') || errorMessage.includes('banned') || errorMessage.includes('-1003')) {
      const banMatch = errorMessage.match(/until\s+(\d+)/);
      const banExpiry = banMatch?.[1] ? parseInt(banMatch[1], 10) : Date.now() + 5 * 60 * 1000;
      binanceApiCache.setBanned(banExpiry);
    }

    if (!silent) {
      log.error('✗ Failed to prefetch klines', { symbol, interval, marketType, error: errorMessage });
    }

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

export const runBatchBackfill = async (
  walletId: string,
  symbols: string[],
  interval: string,
  marketType: 'SPOT' | 'FUTURES' = 'FUTURES'
): Promise<void> => {
  const { getWebSocketService } = await import('./websocket');
  const ws = getWebSocketService();
  const total = symbols.length;
  const BATCH_SIZE = 3;

  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(
      batch.map(symbol =>
        prefetchKlines({ symbol, interval, marketType, silent: true, forRotation: true })
      )
    );

    const completed = Math.min(i + BATCH_SIZE, total);
    const currentSymbol = batch[batch.length - 1] ?? '';
    ws?.emitBackfillProgress(walletId, {
      completed,
      total,
      currentSymbol,
      status: completed >= total ? 'completed' : 'in_progress',
    });
  }
};

export const checkKlineAvailability = async (
  symbol: string,
  interval: string,
  marketType: 'SPOT' | 'FUTURES' = 'FUTURES',
  silent: boolean = false
): Promise<KlineAvailabilityResult> => {
  const required = ABSOLUTE_MINIMUM_KLINES;

  try {
    const result = await prefetchKlines({
      symbol,
      interval,
      marketType,
      targetCount: BACKFILL_TARGET_KLINES,
      silent,
    });

    if (!result.success) {
      if (!silent) log.warn('! Kline availability check failed', { symbol, interval, marketType, error: result.error });
      return { hasSufficient: false, totalAvailable: 0, required, apiExhausted: false };
    }

    const apiExhausted = result.alreadyComplete || result.gaps === 0;
    const toleranceThreshold = Math.floor(required * KLINE_TOLERANCE_PERCENT);
    const meetsExactRequirement = result.totalInDb >= required;
    const meetsToleranceWithApiExhausted = apiExhausted && result.totalInDb >= toleranceThreshold;
    const hasSufficient = meetsExactRequirement || meetsToleranceWithApiExhausted;
    const meetsHardMinimum = result.totalInDb >= HARD_MINIMUM_KLINES;

    if (!hasSufficient) {
      if (!silent) {
        if (!meetsHardMinimum) {
          log.error('✗ Symbol has critically insufficient klines', {
            symbol,
            interval,
            marketType,
            totalAvailable: result.totalInDb,
            required,
            hardMinimum: HARD_MINIMUM_KLINES,
            apiExhausted,
          });
        } else {
          log.warn('! Symbol has insufficient klines', {
            symbol,
            interval,
            marketType,
            totalAvailable: result.totalInDb,
            required,
            toleranceThreshold,
            apiExhausted,
          });
        }
      }
      return { hasSufficient: false, totalAvailable: result.totalInDb, required, apiExhausted };
    }

    if (!silent && meetsToleranceWithApiExhausted && !meetsExactRequirement) {
      log.info('· Symbol accepted with tolerance (API exhausted)', {
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
    const errorMessage = serializeError(error);
    if (!silent) log.error('✗ Kline availability check error', { symbol, interval, marketType, error: errorMessage });
    return { hasSufficient: false, totalAvailable: 0, required, apiExhausted: false };
  }
};
