import type { Kline, MarketType } from '@marketmind/types';
import type { RotationConfig } from '../dynamic-symbol-rotation';

export interface ActiveWatcher {
  walletId: string;
  userId: string;
  symbol: string;
  interval: string;
  marketType: MarketType;
  enabledStrategies: string[];
  profileId?: string;
  profileName?: string;
  intervalId: ReturnType<typeof setInterval>;
  lastProcessedTime: number;
  lastProcessedCandleOpenTime?: number;
  isManual: boolean;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export interface WalletRotationState {
  config: RotationConfig;
  userId: string;
  profileId?: string;
  lastCandleCloseTime: number;
  lastRotationCandleClose: number;
}

export interface RotationPendingWatcher {
  addedAt: number;
  targetCandleClose: number;
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  preloads: number;
}

export interface WatcherKey {
  walletId: string;
  symbol: string;
  interval: string;
  marketType: MarketType;
}

export const createWatcherId = (key: WatcherKey): string =>
  `${key.walletId}-${key.symbol}-${key.interval}-${key.marketType}`;

export const parseWatcherId = (watcherId: string): WatcherKey | null => {
  const parts = watcherId.split('-');
  if (parts.length < 4) return null;

  const marketType = parts[parts.length - 1] as MarketType;
  const interval = parts[parts.length - 2]!;
  const symbol = parts[parts.length - 3]!;
  const walletId = parts.slice(0, parts.length - 3).join('-');

  return { walletId, symbol, interval, marketType };
};

export const getRotationStateKey = (walletId: string, interval: string): string =>
  `${walletId}:${interval}`;

export interface BtcStreamManagerDeps {
  getCachedConfig: (walletId: string, userId?: string) => Promise<{ useBtcCorrelationFilter: boolean } | null>;
  getActiveWatchers: () => Map<string, ActiveWatcher>;
}

export interface WatcherManagerDeps {
  getCachedConfig: (walletId: string, userId?: string) => Promise<unknown>;
  queueWatcherProcessing: (watcherId: string) => void;
  ensureBtcKlineStream: (walletId: string, userId: string, interval: string, marketType: MarketType) => Promise<void>;
  cleanupBtcKlineStreamIfNeeded: (interval: string, marketType: MarketType) => Promise<void>;
  clearCaches: () => void;
}

export interface SignalProcessorDeps {
  getActiveWatchers: () => Map<string, ActiveWatcher>;
  executeSetupSafe: (
    watcher: ActiveWatcher,
    setup: unknown,
    strategies: unknown[],
    cycleKlines: Kline[],
    logBuffer: unknown
  ) => Promise<boolean>;
  isWatcherRecentlyRotated: (watcherId: string) => boolean;
  getRotationPendingWatcher: (watcherId: string) => RotationPendingWatcher | undefined;
  deleteRotationPendingWatcher: (watcherId: string) => void;
  queueWatcherProcessing: (watcherId: string) => void;
  incrementBarsForOpenTrades: (symbol: string, interval: string, currentPrice: number) => Promise<void>;
}

export interface RotationManagerDeps {
  startWatcher: (
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
    targetCandleClose?: number
  ) => Promise<void>;
  stopWatcher: (walletId: string, symbol: string, interval: string, marketType: MarketType) => Promise<void>;
  addToProcessingQueue: (watcherIds: string[]) => void;
  getActiveWatchers: () => Map<string, ActiveWatcher>;
}
