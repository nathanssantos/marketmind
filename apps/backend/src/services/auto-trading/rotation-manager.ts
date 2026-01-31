import type { Interval, MarketType } from '@marketmind/types';
import { TRADING_DEFAULTS } from '@marketmind/types';
import { and, eq, inArray } from 'drizzle-orm';
import {
  AUTO_TRADING_ROTATION,
  AUTO_TRADING_TIMING,
  INTERVAL_MS,
  TIME_MS,
} from '../../constants';
import { AUTO_TRADING_CONFIG } from '@marketmind/types';
import { db } from '../../db';
import { activeWatchers as activeWatchersTable, autoTradingConfig, wallets } from '../../db/schema';
import { calculateRequiredKlines } from '../../utils/kline-calculator';
import { parseDynamicSymbolExcluded } from '../../utils/profile-transformers';
import { serializeError } from '../../utils/errors';
import {
  getDynamicSymbolRotationService,
  type RotationConfig,
  type RotationResult,
} from '../dynamic-symbol-rotation';
import { getKlineMaintenance } from '../kline-maintenance';
import { prefetchKlines } from '../kline-prefetch';
import type { RotationManagerDeps, RotationPendingWatcher, WalletRotationState } from './types';
import { getRotationStateKey } from './types';
import { log, getCandleCloseTime, getNextCandleCloseTime, getRotationAnticipationMs } from './utils';

const MIN_ROTATION_PREPARATION_TIME_MS = AUTO_TRADING_ROTATION.MIN_PREPARATION_TIME_MS;

export class RotationManager {
  private rotationStates: Map<string, WalletRotationState> = new Map();
  private isCheckingRotation: Set<string> = new Set();
  private rotationPendingWatchers = new Map<string, RotationPendingWatcher>();
  private recentlyRotatedWatchers = new Map<string, number>();
  private anticipationCheckIntervalId: ReturnType<typeof setInterval> | null = null;
  private readonly ANTICIPATION_CHECK_INTERVAL_MS = AUTO_TRADING_TIMING.ANTICIPATION_CHECK_INTERVAL_MS;

  constructor(private deps: RotationManagerDeps) {}

  getRotationPendingWatcher(watcherId: string): RotationPendingWatcher | undefined {
    return this.rotationPendingWatchers.get(watcherId);
  }

  deleteRotationPendingWatcher(watcherId: string): void {
    this.rotationPendingWatchers.delete(watcherId);
  }

  isWatcherRecentlyRotated(watcherId: string): boolean {
    const rotatedAt = this.recentlyRotatedWatchers.get(watcherId);
    if (!rotatedAt) return false;

    const maxAge = 2 * TIME_MS.HOUR;
    if (Date.now() - rotatedAt > maxAge) {
      this.recentlyRotatedWatchers.delete(watcherId);
      return false;
    }
    return true;
  }

  startAnticipationTimer(): void {
    if (this.anticipationCheckIntervalId) return;

    this.anticipationCheckIntervalId = setInterval(() => {
      void this.checkAnticipatedRotations();
    }, this.ANTICIPATION_CHECK_INTERVAL_MS);
  }

  stopAnticipationTimer(): void {
    if (!this.anticipationCheckIntervalId) return;

    clearInterval(this.anticipationCheckIntervalId);
    this.anticipationCheckIntervalId = null;

    log('⏹️ [DynamicRotation] Stopped anticipation timer');
  }

  async checkAnticipatedRotations(): Promise<void> {
    if (this.rotationStates.size === 0) return;

    const now = Date.now();

    for (const [stateKey, state] of this.rotationStates.entries()) {
      if (this.isCheckingRotation.has(stateKey)) continue;

      const anticipationMs = getRotationAnticipationMs(state.config.interval);
      const currentCandleClose = getCandleCloseTime(state.config.interval, now);
      const timeUntilCurrentClose = currentCandleClose - now;

      const isInRotationWindow = timeUntilCurrentClose > 0 &&
                                 timeUntilCurrentClose <= anticipationMs &&
                                 timeUntilCurrentClose >= MIN_ROTATION_PREPARATION_TIME_MS;

      if (isInRotationWindow && state.lastRotationCandleClose !== currentCandleClose) {
        log('🔮 [DynamicRotation] Anticipating rotation', {
          stateKey,
          interval: state.config.interval,
          marketType: state.config.marketType,
          timeUntilClose: `${Math.round(timeUntilCurrentClose / 1000)}s`,
          targetCandleClose: new Date(currentCandleClose).toISOString(),
        });

        this.isCheckingRotation.add(stateKey);

        try {
          const walletId = stateKey.split(':')[0]!;
          const rotationService = getDynamicSymbolRotationService();

          if (state.config.capitalRequirement) {
            const [wallet] = await db
              .select({ currentBalance: wallets.currentBalance })
              .from(wallets)
              .where(eq(wallets.id, walletId))
              .limit(1);

            if (wallet) {
              state.config.capitalRequirement.walletBalance = parseFloat(wallet.currentBalance ?? '0');
            }
          }

          const result = await rotationService.executeRotation(
            walletId,
            state.userId,
            state.config
          );

          if (result.added.length > 0 || result.removed.length > 0) {
            log('🔮 [DynamicRotation] Applying anticipated rotation', {
              walletId,
              added: result.added.length,
              removed: result.removed.length,
              targetCandleClose: new Date(currentCandleClose).toISOString(),
            });

            await this.applyRotationWithQueue(
              walletId,
              state.userId,
              result,
              state.config.interval,
              state.profileId,
              state.config.marketType,
              currentCandleClose
            );
          }

          state.lastRotationCandleClose = currentCandleClose;
        } catch (error) {
          log('❌ [DynamicRotation] Anticipated rotation failed', {
            stateKey,
            error: serializeError(error),
          });
        } finally {
          this.isCheckingRotation.delete(stateKey);
        }
      }
    }
  }

  async checkAllRotationsOnce(): Promise<string[]> {
    const allAddedWatcherIds: string[] = [];

    if (this.rotationStates.size === 0) {
      return allAddedWatcherIds;
    }

    const now = Date.now();
    const rotationsToExecute: Array<{ stateKey: string; state: WalletRotationState; targetCandleClose: number; isAnticipated: boolean }> = [];

    for (const [stateKey, state] of this.rotationStates.entries()) {
      if (this.isCheckingRotation.has(stateKey)) continue;

      const intervalMs = INTERVAL_MS[state.config.interval as Interval] ?? TIME_MS.HOUR;
      const currentCandleClose = getCandleCloseTime(state.config.interval, now);
      const previousCandleClose = currentCandleClose - intervalMs;
      const isNewCandle = currentCandleClose > state.lastCandleCloseTime;

      if (isNewCandle && state.lastRotationCandleClose !== previousCandleClose) {
        rotationsToExecute.push({ stateKey, state, targetCandleClose: previousCandleClose, isAnticipated: false });
      }
    }

    if (rotationsToExecute.length === 0) {
      return allAddedWatcherIds;
    }

    log('🔄 [DynamicRotation] Checking rotations', {
      count: rotationsToExecute.length,
      wallets: rotationsToExecute.map(r => r.state.config.marketType).join(', '),
      anticipated: rotationsToExecute.filter(r => r.isAnticipated).length,
    });

    for (const { stateKey, state, targetCandleClose, isAnticipated } of rotationsToExecute) {
      this.isCheckingRotation.add(stateKey);

      try {
        const walletId = stateKey.split(':')[0]!;
        const rotationService = getDynamicSymbolRotationService();

        if (state.config.capitalRequirement) {
          const [wallet] = await db
            .select({ currentBalance: wallets.currentBalance })
            .from(wallets)
            .where(eq(wallets.id, walletId))
            .limit(1);

          if (wallet) {
            state.config.capitalRequirement.walletBalance = parseFloat(wallet.currentBalance ?? '0');
          }
        }

        const result = await rotationService.executeRotation(
          walletId,
          state.userId,
          state.config
        );

        if (result.added.length > 0 || result.removed.length > 0) {
          log('🔄 [DynamicRotation] Applying rotation', {
            walletId,
            added: result.added.length,
            removed: result.removed.length,
            anticipated: isAnticipated,
            targetCandleClose: new Date(targetCandleClose).toISOString(),
          });

          const addedIds = await this.applyRotationWithQueue(
            walletId,
            state.userId,
            result,
            state.config.interval,
            state.profileId,
            state.config.marketType,
            targetCandleClose
          );
          allAddedWatcherIds.push(...addedIds);
        }

        state.lastCandleCloseTime = getCandleCloseTime(state.config.interval, now);
        state.lastRotationCandleClose = targetCandleClose;
      } catch (error) {
        log('❌ [DynamicRotation] Rotation check failed', {
          stateKey,
          error: serializeError(error),
        });
      } finally {
        this.isCheckingRotation.delete(stateKey);
      }
    }

    return allAddedWatcherIds;
  }

  async applyRotationWithQueue(
    walletId: string,
    userId: string,
    result: RotationResult,
    interval: string,
    profileId?: string,
    marketType: MarketType = 'SPOT',
    targetCandleClose?: number
  ): Promise<string[]> {
    const addedWatcherIds: string[] = [];

    for (const symbol of result.removed) {
      await this.deps.stopWatcher(walletId, symbol, interval, marketType);
    }

    const activeWatchers = this.deps.getActiveWatchers();
    const symbolsToAdd = result.added.filter(symbol => {
      const existingWatcher = activeWatchers.get(`${walletId}-${symbol}-${interval}-${marketType}`);
      return !existingWatcher;
    });

    if (symbolsToAdd.length > 0) {
      log('📥 [DynamicRotation] Backfilling new symbols', {
        count: symbolsToAdd.length,
        symbols: symbolsToAdd.join(', '),
        targetCandleClose: targetCandleClose ? new Date(targetCandleClose).toISOString() : 'not set',
      });

      const klineMaintenance = getKlineMaintenance();
      const requiredKlinesForRotation = calculateRequiredKlines();

      await Promise.all(
        symbolsToAdd.map(async (symbol) => {
          log('📥 [DynamicRotation] Starting prefetch', { symbol, interval, marketType, targetCount: requiredKlinesForRotation });
          const prefetchResult = await prefetchKlines({
            symbol,
            interval,
            marketType,
            targetCount: requiredKlinesForRotation,
            silent: false,
            forRotation: true,
          });
          log('📊 [DynamicRotation] Prefetch result', {
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
      await this.deps.startWatcher(walletId, userId, symbol, interval, profileId, false, marketType, false, false, true, targetCandleClose);
      addedWatcherIds.push(watcherId);

      this.recentlyRotatedWatchers.set(watcherId, Date.now());

      if (targetCandleClose) {
        this.rotationPendingWatchers.set(watcherId, {
          addedAt: Date.now(),
          targetCandleClose,
        });
      }
    }

    this.deps.addToProcessingQueue(addedWatcherIds);

    return addedWatcherIds;
  }

  async startDynamicRotation(
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
      exposureMultiplier?: number;
      walletBalance?: number;
      useTrendFilter?: boolean;
    }
  ): Promise<void> {
    if (!config.useDynamicSymbolSelection) {
      log('ℹ️ Dynamic symbol selection is disabled', { walletId });
      return;
    }

    const enableAutoRotation = config.enableAutoRotation ?? true;

    const rotationService = getDynamicSymbolRotationService();
    const excludedSymbols = parseDynamicSymbolExcluded(config.dynamicSymbolExcluded);

    const rotationConfig: RotationConfig = {
      enabled: true,
      limit: config.targetWatcherCount,
      interval: config.interval,
      excludedSymbols,
      marketType: config.marketType,
      capitalRequirement: config.walletBalance !== undefined ? {
        walletBalance: config.walletBalance,
        leverage: config.leverage ?? 1,
        targetWatchersCount: config.targetWatcherCount,
        exposureMultiplier: TRADING_DEFAULTS.EXPOSURE_MULTIPLIER,
      } : undefined,
      useTrendFilter: config.useTrendFilter,
    };

    const initialResult = await rotationService.executeRotation(walletId, userId, rotationConfig);
    const addedWatcherIds = await this.applyRotation(walletId, userId, initialResult, config.interval, config.profileId, config.marketType);

    this.deps.addToProcessingQueue(addedWatcherIds);

    if (enableAutoRotation) {
      const stateKey = getRotationStateKey(walletId, config.interval);
      const intervalMs = INTERVAL_MS[config.interval as Interval] ?? TIME_MS.HOUR;
      const currentCandleClose = getCandleCloseTime(config.interval);
      const previousCandleClose = currentCandleClose - intervalMs;

      this.rotationStates.set(stateKey, {
        config: rotationConfig,
        userId,
        profileId: config.profileId,
        lastCandleCloseTime: currentCandleClose,
        lastRotationCandleClose: previousCandleClose,
      });

      this.startAnticipationTimer();
    } else {
      log('ℹ️ Auto rotation disabled - manual rotation only', { walletId });
    }
  }

  async stopDynamicRotation(walletId: string, stopDynamicWatchers: boolean = true): Promise<void> {
    const keysToDelete: string[] = [];
    for (const key of this.rotationStates.keys()) {
      if (key.startsWith(`${walletId}:`)) {
        keysToDelete.push(key);
      }
    }

    if (keysToDelete.length === 0) {
      log('ℹ️ No active rotation for wallet', { walletId });
      return;
    }

    for (const key of keysToDelete) {
      this.rotationStates.delete(key);
      this.isCheckingRotation.delete(key);
    }

    if (this.rotationStates.size === 0) {
      this.stopAnticipationTimer();
    }

    if (stopDynamicWatchers) {
      const dynamicWatchers = await db
        .select()
        .from(activeWatchersTable)
        .where(
          and(
            eq(activeWatchersTable.walletId, walletId),
            eq(activeWatchersTable.isManual, false)
          )
        );

      for (const watcher of dynamicWatchers) {
        await this.deps.stopWatcher(watcher.walletId, watcher.symbol, watcher.interval, watcher.marketType as MarketType);
      }

      log('🛑 Stopped dynamic rotation and removed dynamic watchers', {
        walletId,
        watchersRemoved: dynamicWatchers.length,
      });
    } else {
      log('🛑 Stopped dynamic rotation (kept existing watchers)', { walletId });
    }
  }

  async applyRotation(
    walletId: string,
    userId: string,
    result: RotationResult,
    interval: string,
    profileId?: string,
    marketType: MarketType = 'SPOT'
  ): Promise<string[]> {
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
        await this.deps.stopWatcher(walletId, symbol, interval, marketType);
      }
    }

    const klineMaintenance = getKlineMaintenance();
    const validations: Array<{ symbol: string; gapsFilled: number; corruptedFixed: number }> = [];

    const symbolsToAdd: string[] = [];
    for (const symbol of result.added) {
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
      log('📥 [Rotation] Backfilling new symbols', {
        count: symbolsToAdd.length,
        symbols: symbolsToAdd.join(', '),
      });

      const requiredKlinesForApply = calculateRequiredKlines();

      await Promise.all(
        symbolsToAdd.map(async (symbol) => {
          log('📥 [Rotation] Starting prefetch', { symbol, interval, marketType, targetCount: requiredKlinesForApply });
          const prefetchResult = await prefetchKlines({ symbol, interval, marketType, targetCount: requiredKlinesForApply, silent: false });
          log('📊 [Rotation] Prefetch result', {
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
      await this.deps.startWatcher(
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
      log('🔧 [Rotation] Kline validations completed', {
        symbols: validations.map(v => v.symbol).join(', '),
        totalGapsFilled: validations.reduce((sum, v) => sum + v.gapsFilled, 0),
        totalCorruptedFixed: validations.reduce((sum, v) => sum + v.corruptedFixed, 0),
        details: validations,
      });
    }

    return addedWatcherIds;
  }

  async triggerManualRotation(
    walletId: string,
    userId: string,
    config: {
      targetWatcherCount: number;
      dynamicSymbolExcluded: string | null;
      marketType: MarketType;
      interval: string;
      profileId?: string;
      leverage?: number;
      exposureMultiplier?: number;
      walletBalance?: number;
      useTrendFilter?: boolean;
    }
  ): Promise<RotationResult> {
    const rotationService = getDynamicSymbolRotationService();
    const excludedSymbols = parseDynamicSymbolExcluded(config.dynamicSymbolExcluded);

    const rotationConfig: RotationConfig = {
      enabled: true,
      limit: config.targetWatcherCount,
      interval: config.interval,
      excludedSymbols,
      marketType: config.marketType,
      capitalRequirement: config.walletBalance !== undefined ? {
        walletBalance: config.walletBalance,
        leverage: config.leverage ?? 1,
        targetWatchersCount: config.targetWatcherCount,
        exposureMultiplier: TRADING_DEFAULTS.EXPOSURE_MULTIPLIER,
      } : undefined,
      useTrendFilter: config.useTrendFilter,
    };

    const result = await rotationService.executeRotation(walletId, userId, rotationConfig);
    const addedWatcherIds = await this.applyRotation(walletId, userId, result, config.interval, config.profileId, config.marketType);

    this.deps.addToProcessingQueue(addedWatcherIds);

    return result;
  }

  isRotationActive(walletId: string): boolean {
    for (const key of this.rotationStates.keys()) {
      if (key.startsWith(`${walletId}:`)) {
        return true;
      }
    }
    return false;
  }

  getNextRotationTime(walletId: string): Date | null {
    let earliestTime: Date | null = null;
    const now = Date.now();

    for (const [key, state] of this.rotationStates.entries()) {
      if (key.startsWith(`${walletId}:`)) {
        const nextCandleClose = getNextCandleCloseTime(state.config.interval, now);
        const nextTime = new Date(nextCandleClose);
        if (!earliestTime || nextTime < earliestTime) {
          earliestTime = nextTime;
        }
      }
    }

    return earliestTime;
  }

  getRotationConfig(walletId: string): RotationConfig | null {
    for (const [key, state] of this.rotationStates.entries()) {
      if (key.startsWith(`${walletId}:`)) {
        return state.config;
      }
    }
    return null;
  }

  getRotationCycles(walletId: string): Array<{ interval: string; nextRotation: Date; config: RotationConfig }> {
    const cycles: Array<{ interval: string; nextRotation: Date; config: RotationConfig }> = [];
    const now = Date.now();

    for (const [key, state] of this.rotationStates.entries()) {
      if (key.startsWith(`${walletId}:`)) {
        const interval = key.split(':')[1] ?? state.config.interval;
        const nextCandleClose = getNextCandleCloseTime(state.config.interval, now);
        cycles.push({
          interval,
          nextRotation: new Date(nextCandleClose),
          config: state.config,
        });
      }
    }

    return cycles.sort((a, b) => a.nextRotation.getTime() - b.nextRotation.getTime());
  }

  async restoreRotationStates(
    persistedWatchers: Array<{
      walletId: string;
      userId: string;
      interval: string;
      marketType: string | null;
      isManual: boolean;
      profileId: string | null;
    }>,
    getDynamicWatcherCount: (walletId: string) => number
  ): Promise<void> {
    const dynamicWatchersByWallet = new Map<string, {
      userId: string;
      interval: string;
      marketType: MarketType;
      profileId?: string;
    }>();

    for (const pw of persistedWatchers) {
      if (pw.isManual) continue;

      const key = `${pw.walletId}:${pw.interval}`;
      if (!dynamicWatchersByWallet.has(key)) {
        dynamicWatchersByWallet.set(key, {
          userId: pw.userId,
          interval: pw.interval,
          marketType: (pw.marketType as MarketType) ?? 'SPOT',
          profileId: pw.profileId ?? undefined,
        });
      }
    }

    if (dynamicWatchersByWallet.size === 0) {
      log('📊 [Startup] No dynamic watchers to restore rotation for');
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

    let restoredCount = 0;
    for (const [key, watcherInfo] of dynamicWatchersByWallet.entries()) {
      const walletId = key.split(':')[0]!;
      const config = configByWallet.get(walletId);

      if (!config?.useDynamicSymbolSelection) continue;

      try {
        const activeCount = getDynamicWatcherCount(walletId);
        const targetCount = activeCount > 0 ? activeCount : AUTO_TRADING_CONFIG.TARGET_COUNT.DEFAULT;

        await this.startDynamicRotation(walletId, watcherInfo.userId, {
          useDynamicSymbolSelection: true,
          targetWatcherCount: targetCount,
          dynamicSymbolExcluded: config.dynamicSymbolExcluded,
          marketType: watcherInfo.marketType,
          interval: watcherInfo.interval,
          profileId: watcherInfo.profileId,
          enableAutoRotation: config.enableAutoRotation,
          leverage: config.leverage ?? 1,
          exposureMultiplier: TRADING_DEFAULTS.EXPOSURE_MULTIPLIER,
          walletBalance: walletBalanceMap.get(walletId),
          useTrendFilter: config.useTrendFilter ?? true,
        });
        restoredCount++;
      } catch (error) {
        log('⚠️ [Startup] Failed to restore rotation', {
          walletId,
          interval: watcherInfo.interval,
          error: serializeError(error),
        });
      }
    }
  }
}
