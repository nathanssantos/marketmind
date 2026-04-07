import type { ExchangeId, MarketType, TradingSetup } from '@marketmind/types';
import type { PineStrategy } from './pine/types';
import { and, eq } from 'drizzle-orm';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from '../db';
import { tradeExecutions } from '../db/schema';
import type { RotationConfig, RotationResult } from './dynamic-symbol-rotation';
import { opportunityCostManagerService } from './opportunity-cost-manager';
import { WatcherLogBuffer } from './watcher-batch-logger';
import {
  SignalProcessor,
  OrderExecutor,
  CacheManager,
  BtcStreamManager,
  WatcherManager,
  RotationManager,
  type ActiveWatcher as ModuleActiveWatcher,
} from './auto-trading/index';
import type { ActiveWatcher } from './auto-trading/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STRATEGIES_DIR = path.join(__dirname, '../../strategies/builtin');

export type { WalletPauseInfo } from './auto-trading/processing/watcher-manager';

export class AutoTradingScheduler {
  private cacheManager: CacheManager;
  private btcStreamManager: BtcStreamManager;
  private watcherManager: WatcherManager;
  private rotationManager: RotationManager;
  private signalProcessor: SignalProcessor;
  private orderExecutor: OrderExecutor;

  constructor() {
    this.cacheManager = new CacheManager();

    this.btcStreamManager = new BtcStreamManager({
      getCachedConfig: (walletId, userId) => this.cacheManager.getCachedConfig(walletId, userId),
      getActiveWatchers: () => this.watcherManager.getActiveWatchersMap(),
    });

    this.watcherManager = new WatcherManager({
      getCachedConfig: (walletId, userId) => this.cacheManager.getCachedConfig(walletId, userId),
      queueWatcherProcessing: (watcherId) => this.signalProcessor.queueWatcherProcessing(watcherId),
      ensureBtcKlineStream: (walletId, userId, interval, marketType) =>
        this.btcStreamManager.ensureBtcKlineStream(walletId, userId, interval, marketType),
      cleanupBtcKlineStreamIfNeeded: (interval, marketType) =>
        this.btcStreamManager.cleanupBtcKlineStreamIfNeeded(interval, marketType),
      clearCaches: () => this.cacheManager.clearAll(),
    });

    this.rotationManager = new RotationManager({
      startWatcher: (...args) => this.watcherManager.startWatcher(...args),
      stopWatcher: (...args) => this.watcherManager.stopWatcher(...args),
      addToProcessingQueue: (ids) => this.signalProcessor.addToProcessingQueue(ids),
      getActiveWatchers: () => this.watcherManager.getActiveWatchersMap(),
    });

    this.orderExecutor = new OrderExecutor({
      getBtcKlines: (interval, marketType) => this.cacheManager.getBtcKlines(interval, marketType),
      getHtfKlines: (symbol, htfInterval, marketType) => this.cacheManager.getHtfKlines(symbol, htfInterval, marketType),
      getCachedFundingRate: (symbol) => this.getCachedFundingRate(symbol),
      getCachedConfig: (walletId, userId) => this.cacheManager.getCachedConfig(walletId, userId),
      getWatcherStatus: (walletId) => this.watcherManager.getWatcherStatus(walletId),
    });

    this.signalProcessor = new SignalProcessor(
      {
        getActiveWatchers: () => this.watcherManager.getActiveWatchersMap() as Map<string, ModuleActiveWatcher>,
        executeSetupSafe: (watcher, setup, strategies, cycleKlines, logBuffer) =>
          this.orderExecutor.executeSetupSafe(
            watcher as ActiveWatcher,
            setup as TradingSetup,
            strategies as PineStrategy[],
            cycleKlines,
            logBuffer as WatcherLogBuffer
          ),
        validateSetupFilters: (watcher, setup, strategies, cycleKlines, logBuffer) =>
          this.orderExecutor.validateSetupFilters(
            watcher as ActiveWatcher,
            setup as TradingSetup,
            strategies as PineStrategy[],
            cycleKlines,
            logBuffer as WatcherLogBuffer
          ),
        isWatcherRecentlyRotated: (watcherId) => this.rotationManager.isWatcherRecentlyRotated(watcherId),
        getRotationPendingWatcher: (watcherId) => this.rotationManager.getRotationPendingWatcher(watcherId),
        deleteRotationPendingWatcher: (watcherId) => this.rotationManager.deleteRotationPendingWatcher(watcherId),
        incrementBarsForOpenTrades: (symbol, interval, currentPrice) =>
          this.incrementBarsForOpenTrades(symbol, interval, currentPrice),
        checkAllRotationsOnce: () => this.rotationManager.checkAllRotationsOnce(),
        getConfigCacheStats: () => this.watcherManager.getConfigCacheStats(),
        isWalletPaused: (walletId) => this.watcherManager.isWalletPaused(walletId),
        pauseWatchersForWallet: (walletId, reason) => this.watcherManager.pauseWatchersForWallet(walletId, reason),
        resumeWatchersForWallet: (walletId) => this.watcherManager.resumeWatchersForWallet(walletId),
      },
      { strategiesDir: STRATEGIES_DIR }
    );
  }

  pauseWatchersForWallet(walletId: string, reason: string): void {
    this.watcherManager.pauseWatchersForWallet(walletId, reason);
  }

  resumeWatchersForWallet(walletId: string): void {
    this.watcherManager.resumeWatchersForWallet(walletId);
  }

  isWalletPaused(walletId: string): boolean {
    return this.watcherManager.isWalletPaused(walletId);
  }

  getPausedWalletInfo(walletId: string) {
    return this.watcherManager.getPausedWalletInfo(walletId);
  }

  getPausedWallets() {
    return this.watcherManager.getPausedWallets();
  }

  getConfigCacheStats() {
    return this.watcherManager.getConfigCacheStats();
  }

  resetCacheMetrics(): void {
    this.watcherManager.resetCacheMetrics();
  }

  invalidateConfigCache(walletId: string): void {
    this.cacheManager.invalidateConfig(walletId);
  }

  private async getCachedFundingRate(symbol: string): Promise<number | null> {
    const cached = this.cacheManager.getCachedFundingRate(symbol);
    if (cached !== null) return cached;

    const { getBinanceFuturesDataService } = await import('./binance-futures-data');
    const markPrice = await getBinanceFuturesDataService().getMarkPrice(symbol);
    const rate = markPrice?.lastFundingRate ?? null;

    if (rate !== null) {
      this.cacheManager.setFundingRateCache(symbol, rate);
    }
    return rate;
  }

  private async incrementBarsForOpenTrades(symbol: string, interval: string, currentPrice: number): Promise<void> {
    const openTrades = await db
      .select()
      .from(tradeExecutions)
      .where(and(
        eq(tradeExecutions.symbol, symbol),
        eq(tradeExecutions.entryInterval, interval),
        eq(tradeExecutions.status, 'open')
      ));

    for (const trade of openTrades) {
      await opportunityCostManagerService.incrementBarsInTrade(trade.id, currentPrice);
    }
  }

  async startWatcher(
    walletId: string,
    userId: string,
    symbol: string,
    interval: string,
    profileId?: string,
    skipDbPersist?: boolean,
    marketType?: MarketType,
    isManual?: boolean,
    runImmediateCheck?: boolean,
    silent?: boolean,
    targetCandleClose?: number,
    exchange?: ExchangeId
  ): Promise<void> {
    await this.watcherManager.startWatcher(
      walletId, userId, symbol, interval, profileId,
      skipDbPersist, marketType, isManual, runImmediateCheck,
      silent, targetCandleClose, exchange
    );
  }

  async stopWatcher(walletId: string, symbol: string, interval: string, marketType: MarketType = 'FUTURES'): Promise<void> {
    await this.watcherManager.stopWatcher(walletId, symbol, interval, marketType);
  }

  async stopAllWatchersForWallet(walletId: string): Promise<void> {
    await this.watcherManager.stopAllWatchersForWallet(walletId);
    await this.rotationManager.stopDynamicRotation(walletId, false);
    this.rotationManager.cleanupWalletMaps(walletId);
    this.cacheManager.invalidateConfig(walletId);
  }

  getWatcherStatus(walletId: string) {
    return this.watcherManager.getWatcherStatus(walletId);
  }

  getActiveWatchers() {
    return this.watcherManager.getActiveWatchers();
  }

  getWatcherStatusFromDb(walletId: string) {
    return this.watcherManager.getWatcherStatusFromDb(walletId);
  }

  async restoreWatchersFromDb(): Promise<void> {
    await this.watcherManager.restoreWatchersFromDb();
    await this.rotationManager.restoreRotationStates(
      await this.getPersistedWatchersForRotation(),
      (walletId) => this.watcherManager.getDynamicWatcherCount(walletId)
    );
  }

  private async getPersistedWatchersForRotation() {
    const { activeWatchers: activeWatchersTable } = await import('../db/schema');
    const persistedWatchers = await db.select().from(activeWatchersTable);
    return persistedWatchers;
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
    await this.rotationManager.startDynamicRotation(walletId, userId, config);
  }

  async stopDynamicRotation(walletId: string, stopDynamicWatchers: boolean = true): Promise<void> {
    await this.rotationManager.stopDynamicRotation(walletId, stopDynamicWatchers);
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
    return this.rotationManager.triggerManualRotation(walletId, userId, config);
  }

  getDynamicWatcherCount(walletId: string): number {
    return this.watcherManager.getDynamicWatcherCount(walletId);
  }

  getManualWatcherCount(walletId: string): number {
    return this.watcherManager.getManualWatcherCount(walletId);
  }

  isRotationActive(walletId: string): boolean {
    return this.rotationManager.isRotationActive(walletId);
  }

  getNextRotationTime(walletId: string): Date | null {
    return this.rotationManager.getNextRotationTime(walletId);
  }

  getRotationConfig(walletId: string): RotationConfig | null {
    return this.rotationManager.getRotationConfig(walletId);
  }

  getRotationCycles(walletId: string) {
    return this.rotationManager.getRotationCycles(walletId);
  }
}

export const autoTradingScheduler = new AutoTradingScheduler();
