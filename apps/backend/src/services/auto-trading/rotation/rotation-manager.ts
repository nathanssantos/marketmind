import type { Interval, MarketType } from '@marketmind/types';
import { and, eq } from 'drizzle-orm';
import {
  AUTO_TRADING_ROTATION,
  AUTO_TRADING_TIMING,
  INTERVAL_MS,
  TIME_MS,
} from '../../../constants';
import { db } from '../../../db';
import { activeWatchers as activeWatchersTable, wallets } from '../../../db/schema';
import { serializeError } from '../../../utils/errors';
import {
  getDynamicSymbolRotationService,
  type RotationConfig,
  type RotationResult,
} from '../../dynamic-symbol-rotation';
import type { RotationManagerDeps, RotationPendingWatcher, WalletRotationState } from '../types';
import { getRotationStateKey } from '../types';
import { log, getCandleCloseTime, getNextCandleCloseTime, getRotationAnticipationMs } from '../utils';
import {
  applyRotation,
  applyRotationWithQueue,
  buildRotationConfig,
  restoreRotationStates as restoreRotationStatesImpl,
} from './rotation-executor';

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

    log('✗ [DynamicRotation] Stopped anticipation timer');
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
        log('> [DynamicRotation] Anticipating rotation', {
          stateKey,
          interval: state.config.interval,
          marketType: state.config.marketType,
          timeUntilClose: `${Math.round(timeUntilCurrentClose / 1000)}s`,
          targetCandleClose: new Date(currentCandleClose).toISOString(),
        });

        this.isCheckingRotation.add(stateKey);

        try {
          const walletId = stateKey.split(':')[0]!;
          await this.refreshWalletBalance(state, walletId);

          const rotationService = getDynamicSymbolRotationService();
          const result = await rotationService.executeRotation(walletId, state.userId, state.config);

          if (result.added.length > 0 || result.removed.length > 0) {
            log('> [DynamicRotation] Applying anticipated rotation', {
              walletId,
              added: result.added.length,
              removed: result.removed.length,
              targetCandleClose: new Date(currentCandleClose).toISOString(),
            });

            await this.applyRotationWithQueue(
              walletId, state.userId, result, state.config.interval,
              state.profileId, state.config.marketType, currentCandleClose
            );
          }

          state.lastRotationCandleClose = currentCandleClose;
        } catch (error) {
          log('✗ [DynamicRotation] Anticipated rotation failed', {
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
    if (this.rotationStates.size === 0) return allAddedWatcherIds;

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

    if (rotationsToExecute.length === 0) return allAddedWatcherIds;

    log('> [DynamicRotation] Checking rotations', {
      count: rotationsToExecute.length,
      wallets: rotationsToExecute.map(r => r.state.config.marketType).join(', '),
      anticipated: rotationsToExecute.filter(r => r.isAnticipated).length,
    });

    for (const { stateKey, state, targetCandleClose, isAnticipated } of rotationsToExecute) {
      this.isCheckingRotation.add(stateKey);

      try {
        const walletId = stateKey.split(':')[0]!;
        await this.refreshWalletBalance(state, walletId);

        const rotationService = getDynamicSymbolRotationService();
        const result = await rotationService.executeRotation(walletId, state.userId, state.config);

        if (result.added.length > 0 || result.removed.length > 0) {
          log('> [DynamicRotation] Applying rotation', {
            walletId,
            added: result.added.length,
            removed: result.removed.length,
            anticipated: isAnticipated,
            targetCandleClose: new Date(targetCandleClose).toISOString(),
          });

          const addedIds = await this.applyRotationWithQueue(
            walletId, state.userId, result, state.config.interval,
            state.profileId, state.config.marketType, targetCandleClose
          );
          allAddedWatcherIds.push(...addedIds);
        }

        state.lastCandleCloseTime = getCandleCloseTime(state.config.interval, now);
        state.lastRotationCandleClose = targetCandleClose;
      } catch (error) {
        log('✗ [DynamicRotation] Rotation check failed', {
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
    marketType: MarketType = 'FUTURES',
    targetCandleClose?: number
  ): Promise<string[]> {
    return applyRotationWithQueue(
      this.deps, this.rotationPendingWatchers, this.recentlyRotatedWatchers,
      walletId, userId, result, interval, profileId, marketType, targetCandleClose
    );
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
      positionSizePercent?: number;
      walletBalance?: number;
      useBtcCorrelationFilter?: boolean;
      directionMode?: 'auto' | 'long_only' | 'short_only';
    }
  ): Promise<void> {
    if (!config.useDynamicSymbolSelection) {
      log('· Dynamic symbol selection is disabled', { walletId });
      return;
    }

    const enableAutoRotation = config.enableAutoRotation ?? true;
    const rotationConfig = buildRotationConfig(config);

    const rotationService = getDynamicSymbolRotationService();
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
      log('· Auto rotation disabled - manual rotation only', { walletId });
    }
  }

  cleanupWalletMaps(walletId: string): void {
    for (const key of this.rotationPendingWatchers.keys()) {
      if (key.startsWith(`${walletId}-`)) this.rotationPendingWatchers.delete(key);
    }
    for (const key of this.recentlyRotatedWatchers.keys()) {
      if (key.startsWith(`${walletId}-`)) this.recentlyRotatedWatchers.delete(key);
    }
  }

  async stopDynamicRotation(walletId: string, stopDynamicWatchers: boolean = true): Promise<void> {
    const keysToDelete: string[] = [];
    for (const key of this.rotationStates.keys()) {
      if (key.startsWith(`${walletId}:`)) keysToDelete.push(key);
    }

    if (keysToDelete.length === 0) {
      log('· No active rotation for wallet', { walletId });
      return;
    }

    for (const key of keysToDelete) {
      this.rotationStates.delete(key);
      this.isCheckingRotation.delete(key);
    }

    if (this.rotationStates.size === 0) this.stopAnticipationTimer();

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

      log('✗ Stopped dynamic rotation and removed dynamic watchers', {
        walletId,
        watchersRemoved: dynamicWatchers.length,
      });
    } else {
      log('✗ Stopped dynamic rotation (kept existing watchers)', { walletId });
    }
  }

  async applyRotation(
    walletId: string,
    userId: string,
    result: RotationResult,
    interval: string,
    profileId?: string,
    marketType: MarketType = 'FUTURES'
  ): Promise<string[]> {
    return applyRotation(this.deps, walletId, userId, result, interval, profileId, marketType);
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
      positionSizePercent?: number;
      walletBalance?: number;
      useBtcCorrelationFilter?: boolean;
      directionMode?: 'auto' | 'long_only' | 'short_only';
    }
  ): Promise<RotationResult> {
    const rotationConfig = buildRotationConfig(config);

    const rotationService = getDynamicSymbolRotationService();
    const result = await rotationService.executeRotation(walletId, userId, rotationConfig);
    const addedWatcherIds = await this.applyRotation(walletId, userId, result, config.interval, config.profileId, config.marketType);

    this.deps.addToProcessingQueue(addedWatcherIds);

    return result;
  }

  isRotationActive(walletId: string): boolean {
    for (const key of this.rotationStates.keys()) {
      if (key.startsWith(`${walletId}:`)) return true;
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
        if (!earliestTime || nextTime < earliestTime) earliestTime = nextTime;
      }
    }

    return earliestTime;
  }

  getRotationConfig(walletId: string): RotationConfig | null {
    for (const [key, state] of this.rotationStates.entries()) {
      if (key.startsWith(`${walletId}:`)) return state.config;
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
        cycles.push({ interval, nextRotation: new Date(nextCandleClose), config: state.config });
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
    _getDynamicWatcherCount: (walletId: string) => number
  ): Promise<void> {
    return restoreRotationStatesImpl(
      this.startDynamicRotation.bind(this),
      persistedWatchers,
      _getDynamicWatcherCount
    );
  }

  private async refreshWalletBalance(state: WalletRotationState, walletId: string): Promise<void> {
    if (!state.config.capitalRequirement) return;

    const [wallet] = await db
      .select({ currentBalance: wallets.currentBalance })
      .from(wallets)
      .where(eq(wallets.id, walletId))
      .limit(1);

    if (wallet) {
      state.config.capitalRequirement.walletBalance = parseFloat(wallet.currentBalance ?? '0');
    }
  }
}
