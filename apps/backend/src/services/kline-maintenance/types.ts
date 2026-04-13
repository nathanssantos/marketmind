import type { Interval } from '@marketmind/types';

export interface GapInfo {
  symbol: string;
  interval: Interval;
  marketType: 'SPOT' | 'FUTURES';
  gapStart: Date;
  gapEnd: Date;
  missingCandles: number;
}

export interface ActivePair {
  symbol: string;
  interval: Interval;
  marketType: 'SPOT' | 'FUTURES';
}

export interface KlineMaintenanceStartOptions {
  skipStartupSync?: boolean;
  delayMs?: number;
}
