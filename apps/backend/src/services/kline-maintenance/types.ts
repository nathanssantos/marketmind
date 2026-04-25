import type { Interval, MarketType } from '@marketmind/types';

export interface GapInfo {
  symbol: string;
  interval: Interval;
  marketType: MarketType;
  gapStart: Date;
  gapEnd: Date;
  missingCandles: number;
}

export interface ActivePair {
  symbol: string;
  interval: Interval;
  marketType: MarketType;
}

export interface KlineMaintenanceStartOptions {
  skipStartupSync?: boolean;
  delayMs?: number;
}
