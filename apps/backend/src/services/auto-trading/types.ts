import type { Interval, Kline, MarketType } from '@marketmind/types';
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
  const interval = parts[parts.length - 2];
  const symbol = parts[parts.length - 3];
  const walletId = parts.slice(0, parts.length - 3).join('-');

  return { walletId, symbol, interval, marketType };
};

export const getRotationStateKey = (walletId: string, interval: string): string =>
  `${walletId}:${interval}`;
