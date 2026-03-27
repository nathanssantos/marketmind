import type { Interval, MarketType } from '@marketmind/types';
import { TRADING_DEFAULTS } from '@marketmind/types';
import { and, eq, inArray } from 'drizzle-orm';
import { AUTO_TRADING_CONFIG } from '@marketmind/types';
import { db } from '../../../db';
import { activeWatchers as activeWatchersTable, autoTradingConfig, wallets } from '../../../db/schema';
import { calculateRequiredKlines } from '../../../utils/kline-calculator';
import { parseDynamicSymbolExcluded } from '../../../utils/profile-transformers';
import { serializeError } from '../../../utils/errors';
import type { RotationConfig, RotationResult } from '../../dynamic-symbol-rotation';
import { getKlineMaintenance } from '../../kline-maintenance';
import { prefetchKlines } from '../../kline-prefetch';
import type { ActiveWatcher, RotationManagerDeps, RotationPendingWatcher } from '../types';
import { log } from '../utils';

export const countDynamicWatchersForInterval = (
  watchers: Map<string, ActiveWatcher>,
  walletId: string,
  interval: string,
  marketType: MarketType
): number => {
  let count = 0;
  for (const watcher of watchers.values()) {
    if (watcher.walletId === walletId && !watcher.isManual && watcher.interval === interval && watcher.marketType === marketType) count++;
  }
  return count;
};

export const applyRotationWithQueue = async (
  deps: RotationManagerDeps,
  rotationPendingWatchers: Map<string, RotationPendingWatcher>,
  recentlyRotatedWatchers: Map<string, number>,
  walletId: string,
  userId: string,
  result: RotationResult,
  interval: string,
  profileId?: string,
  marketType: MarketType = 'FUTURES',
  targetCandleClose?: number
): Promise<string[]> => {
  const addedWatcherIds: string[] = [];

  for (const symbol of result.removed) {
    await deps.stopWatcher(walletId, symbol, interval, marketType);
  }

  const activeWatchers = deps.getActiveWatchers();
  const currentDynamicCount = countDynamicWatchersForInterval(activeWatchers, walletId, interval, marketType);
  const maxToAdd = Math.max(0, result.targetLimit - currentDynamicCount);

  const symbolsToAdd = result.added
    .filter(symbol => {
      const existingWatcher = activeWatchers.get(`${walletId}-${symbol}-${interval}-${marketType}`);
      return !existingWatcher;
    })
    .slice(0, maxToAdd);

  if (symbolsToAdd.length > 0) {
    log('> [DynamicRotation] Backfilling new symbols', {
      count: symbolsToAdd.length,
      symbols: symbolsToAdd.join(', '),
      targetCandleClose: targetCandleClose ? new Date(targetCandleClose).toISOString() : 'not set',
    });

    const klineMaintenance = getKlineMaintenance();
    const requiredKlinesForRotation = calculateRequiredKlines();

    await Promise.all(
      symbolsToAdd.map(async (symbol) => {
        log('> [DynamicRotation] Starting prefetch', { symbol, interval, marketType, targetCount: requiredKlinesForRotation });
        const prefetchResult = await prefetchKlines({
          symbol,
          interval,
          marketType,
          targetCount: requiredKlinesForRotation,
          silent: false,
          forRotation: true,
        });
        log('> [DynamicRotation] Prefetch result', {
          symbol,
          success: prefetchResult.success,
          downloaded: prefetchResult.downloaded,
          totalInDb: prefetchResult.totalInDb,
          gaps: prefetchResult.gaps,
          alreadyComplete: prefetchResult.alreadyComplete,
          error: prefetchResult.error,
        });
        await klineMaintenance.forceCheckSymbol(symbol, interval as Interval, marketType);
      })
    );
  }

  for (const symbol of symbolsToAdd) {
    const watcherId = `${walletId}-${symbol}-${interval}-${marketType}`;
    await deps.startWatcher(walletId, userId, symbol, interval, profileId, false, marketType, false, false, true, targetCandleClose);
    addedWatcherIds.push(watcherId);

    recentlyRotatedWatchers.set(watcherId, Date.now());

    if (targetCandleClose) {
      rotationPendingWatchers.set(watcherId, {
        addedAt: Date.now(),
        targetCandleClose,
      });
    }
  }

  deps.addToProcessingQueue(addedWatcherIds);

  return addedWatcherIds;
};

export const applyRotation = async (
  deps: RotationManagerDeps,
  walletId: string,
  userId: string,
  result: RotationResult,
  interval: string,
  profileId?: string,
  marketType: MarketType = 'FUTURES'
): Promise<string[]> => {
  const addedWatcherIds: string[] = [];

  for (const symbol of result.removed) {
    const existingWatcher = await db
      .select()
      .from(activeWatchersTable)
      .where(
        and(
          eq(activeWatchersTable.walletId, walletId),
          eq(activeWatchersTable.symbol, symbol),
          eq(activeWatchersTable.isManual, false)
        )
      )
      .limit(1);

    if (existingWatcher.length > 0) {
      await deps.stopWatcher(walletId, symbol, interval, marketType);
    }
  }

  const klineMaintenance = getKlineMaintenance();
  const validations: Array<{ symbol: string; gapsFilled: number; corruptedFixed: number }> = [];

  const activeWatchers = deps.getActiveWatchers();
  const currentDynamicCount = countDynamicWatchersForInterval(activeWatchers, walletId, interval, marketType);
  const maxToAdd = Math.max(0, result.targetLimit - currentDynamicCount);

  const symbolsToAdd: string[] = [];
  for (const symbol of result.added) {
    if (symbolsToAdd.length >= maxToAdd) break;

    const existingWatcher = await db
      .select()
      .from(activeWatchersTable)
      .where(
        and(
          eq(activeWatchersTable.walletId, walletId),
          eq(activeWatchersTable.symbol, symbol)
        )
      )
      .limit(1);

    if (existingWatcher.length === 0) {
      symbolsToAdd.push(symbol);
    }
  }

  if (symbolsToAdd.length > 0) {
    log('> [Rotation] Backfilling new symbols', {
      count: symbolsToAdd.length,
      symbols: symbolsToAdd.join(', '),
    });

    const requiredKlinesForApply = calculateRequiredKlines();

    await Promise.all(
      symbolsToAdd.map(async (symbol) => {
        log('> [Rotation] Starting prefetch', { symbol, interval, marketType, targetCount: requiredKlinesForApply });
        const prefetchResult = await prefetchKlines({ symbol, interval, marketType, targetCount: requiredKlinesForApply, silent: false });
        log('> [Rotation] Prefetch result', {
          symbol,
          success: prefetchResult.success,
          downloaded: prefetchResult.downloaded,
          totalInDb: prefetchResult.totalInDb,
          gaps: prefetchResult.gaps,
          alreadyComplete: prefetchResult.alreadyComplete,
          error: prefetchResult.error,
        });

        const validationResult = await klineMaintenance.forceCheckSymbol(
          symbol,
          interval as Interval,
          marketType
        );

        if (validationResult.gapsFilled > 0 || validationResult.corruptedFixed > 0) {
          validations.push({
            symbol,
            gapsFilled: validationResult.gapsFilled,
            corruptedFixed: validationResult.corruptedFixed,
          });
        }
      })
    );
  }

  for (const symbol of symbolsToAdd) {
    const watcherId = `${walletId}-${symbol}-${interval}-${marketType}`;
    await deps.startWatcher(
      walletId,
      userId,
      symbol,
      interval,
      profileId,
      false,
      marketType,
      false,
      false,
      true
    );
    addedWatcherIds.push(watcherId);
  }

  if (validations.length > 0) {
    log('# [Rotation] Kline validations completed', {
      symbols: validations.map(v => v.symbol).join(', '),
      totalGapsFilled: validations.reduce((sum, v) => sum + v.gapsFilled, 0),
      totalCorruptedFixed: validations.reduce((sum, v) => sum + v.corruptedFixed, 0),
      details: validations,
    });
  }

  return addedWatcherIds;
};

export const buildRotationConfig = (config: {
  targetWatcherCount: number;
  dynamicSymbolExcluded: string | null;
  marketType: MarketType;
  interval: string;
  leverage?: number;
  walletBalance?: number;
  useBtcCorrelationFilter?: boolean;
  directionMode?: 'auto' | 'long_only' | 'short_only';
}): RotationConfig => {
  const excludedSymbols = parseDynamicSymbolExcluded(config.dynamicSymbolExcluded);

  return {
    enabled: true,
    limit: config.targetWatcherCount,
    interval: config.interval,
    excludedSymbols,
    marketType: config.marketType,
    capitalRequirement: config.walletBalance !== undefined ? {
      walletBalance: config.walletBalance,
      leverage: config.leverage ?? 1,
      targetWatchersCount: config.targetWatcherCount,
      positionSizePercent: TRADING_DEFAULTS.POSITION_SIZE_PERCENT,
    } : undefined,
    useBtcCorrelationFilter: config.useBtcCorrelationFilter,
    directionMode: config.directionMode,
  };
};

export const restoreRotationStates = async (
  startDynamicRotation: (
    walletId: string,
    userId: string,
    config: {
      useDynamicSymbolSelection: boolean;
      targetWatcherCount: number;
      dynamicSymbolExcluded: string | null;
      marketType: MarketType;
      interval: string;
      profileId?: string;
      enableAutoRotation?: boolean;
      leverage?: number;
      positionSizePercent?: number;
      walletBalance?: number;
      useBtcCorrelationFilter?: boolean;
      directionMode?: 'auto' | 'long_only' | 'short_only';
    }
  ) => Promise<void>,
  persistedWatchers: Array<{
    walletId: string;
    userId: string;
    interval: string;
    marketType: string | null;
    isManual: boolean;
    profileId: string | null;
  }>,
  _getDynamicWatcherCount: (walletId: string) => number
): Promise<void> => {
  const dynamicWatchersByWallet = new Map<string, {
    userId: string;
    interval: string;
    marketType: MarketType;
    profileId?: string;
    count: number;
  }>();

  for (const pw of persistedWatchers) {
    if (pw.isManual) continue;

    const key = `${pw.walletId}:${pw.interval}`;
    const existing = dynamicWatchersByWallet.get(key);
    if (existing) {
      existing.count++;
    } else {
      dynamicWatchersByWallet.set(key, {
        userId: pw.userId,
        interval: pw.interval,
        marketType: (pw.marketType as MarketType) ?? 'FUTURES',
        profileId: pw.profileId ?? undefined,
        count: 1,
      });
    }
  }

  if (dynamicWatchersByWallet.size === 0) {
    log('> [Startup] No dynamic watchers to restore rotation for');
    return;
  }

  const walletIds = [...new Set([...dynamicWatchersByWallet.keys()].map(k => k.split(':')[0]!))].filter(Boolean);

  const configs = await db
    .select()
    .from(autoTradingConfig)
    .where(inArray(autoTradingConfig.walletId, walletIds));

  const walletsData = await db
    .select({ id: wallets.id, currentBalance: wallets.currentBalance })
    .from(wallets)
    .where(inArray(wallets.id, walletIds));

  const configByWallet = new Map(configs.map(c => [c.walletId, c]));
  const walletBalanceMap = new Map(walletsData.map(w => [w.id, parseFloat(w.currentBalance ?? '0')]));

  for (const [key, watcherInfo] of dynamicWatchersByWallet.entries()) {
    const walletId = key.split(':')[0]!;
    const config = configByWallet.get(walletId);

    if (!config?.useDynamicSymbolSelection) continue;

    try {
      const targetCount = watcherInfo.count > 0 ? watcherInfo.count : AUTO_TRADING_CONFIG.TARGET_COUNT.DEFAULT;

      await startDynamicRotation(walletId, watcherInfo.userId, {
        useDynamicSymbolSelection: true,
        targetWatcherCount: targetCount,
        dynamicSymbolExcluded: config.dynamicSymbolExcluded,
        marketType: watcherInfo.marketType,
        interval: watcherInfo.interval,
        profileId: watcherInfo.profileId,
        enableAutoRotation: config.enableAutoRotation,
        leverage: config.leverage ?? 1,
        positionSizePercent: TRADING_DEFAULTS.POSITION_SIZE_PERCENT,
        walletBalance: walletBalanceMap.get(walletId),
        useBtcCorrelationFilter: config.useBtcCorrelationFilter ?? true,
        directionMode: config.directionMode,
      });
    } catch (error) {
      log('! [Startup] Failed to restore rotation', {
        walletId,
        interval: watcherInfo.interval,
        error: serializeError(error),
      });
    }
  }
};
