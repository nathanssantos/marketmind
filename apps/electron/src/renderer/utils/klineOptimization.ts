import type { Kline } from '@marketmind/types';
import { getKlineClose, getKlineHigh, getKlineLow, getKlineOpen, getKlineVolume } from '@shared/utils';

export interface SimplifiedKline {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OptimizationResult {
  detailed: Kline[];
  simplified: SimplifiedKline[];
  openTimeInfo: {
    first: number;
    last: number;
    total: number;
    timeframe: string;
  };
}

const DETAILED_KLINES_COUNT = 32;
const MAX_SIMPLIFIED_KLINES = 1000;

export const detectTimeframe = (klines: Kline[]): string => {
  if (klines.length < 2) return 'unknown';

  const firstKline = klines[0];
  const secondKline = klines[1];
  if (!firstKline || !secondKline) return 'unknown';

  const diff = secondKline.openTime - firstKline.openTime;

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff <= minute) return '1m';
  if (diff <= 5 * minute) return '5m';
  if (diff <= 15 * minute) return '15m';
  if (diff <= 30 * minute) return '30m';
  if (diff <= hour) return '1h';
  if (diff <= 4 * hour) return '4h';
  if (diff <= day) return '1d';
  if (diff <= 7 * day) return '1w';

  return 'unknown';
};

export const simplifyKline = (kline: Kline): SimplifiedKline => {
  return {
    openTime: kline.openTime,
    open: Math.round(getKlineOpen(kline) * 100) / 100,
    high: Math.round(getKlineHigh(kline) * 100) / 100,
    low: Math.round(getKlineLow(kline) * 100) / 100,
    close: Math.round(getKlineClose(kline) * 100) / 100,
    volume: Math.round(getKlineVolume(kline)),
  };
};

export const optimizeKlines = (
  klines: Kline[],
  detailedCount: number = DETAILED_KLINES_COUNT
): OptimizationResult => {
  if (klines.length === 0) {
    return {
      detailed: [],
      simplified: [],
      openTimeInfo: {
        first: 0,
        last: 0,
        total: 0,
        timeframe: 'unknown',
      },
    };
  }

  const timeframe = detectTimeframe(klines);
  const detailed = klines.slice(-detailedCount);
  const remainingKlines = klines.slice(0, -detailedCount);

  let simplified: SimplifiedKline[];
  if (remainingKlines.length > MAX_SIMPLIFIED_KLINES) {
    const step = Math.ceil(remainingKlines.length / MAX_SIMPLIFIED_KLINES);
    simplified = [];
    for (let i = 0; i < remainingKlines.length; i += step) {
      const kline = remainingKlines[i];
      if (kline) {
        simplified.push(simplifyKline(kline));
      }
    }
  } else {
    simplified = remainingKlines.map(simplifyKline);
  }

  const firstKline = klines[0];
  const lastKline = klines[klines.length - 1];

  return {
    detailed,
    simplified,
    openTimeInfo: {
      first: firstKline?.openTime ?? 0,
      last: lastKline?.openTime ?? 0,
      total: klines.length,
      timeframe,
    },
  };
};
