import type { Kline } from '@shared/types';
import { getKlineHigh, getKlineLow, getKlineVolume } from '@shared/utils';
import { PATTERN_DETECTION_CONFIG } from '../constants';
import type { PivotPoint } from '../types';

export const findPivotHighs = (
  klines: Kline[],
  lookback: number = PATTERN_DETECTION_CONFIG.PIVOT_LOOKBACK_DEFAULT,
  lookahead: number = PATTERN_DETECTION_CONFIG.PIVOT_LOOKAHEAD_DEFAULT
): PivotPoint[] => {
  const pivots: PivotPoint[] = [];

  for (let i = lookback; i < klines.length - lookahead; i++) {
    const currentKline = klines[i];
    if (!currentKline) continue;
    
    const currentHigh = getKlineHigh(currentKline);
    
    let isPivot = true;
    let strength = 0;

    for (let j = i - lookback; j < i; j++) {
      const kline = klines[j];
      if (!kline) continue;
      
      if (getKlineHigh(kline) >= currentHigh) {
        isPivot = false;
        break;
      }
      strength++;
    }

    if (!isPivot) continue;

    for (let j = i + 1; j <= i + lookahead; j++) {
      const kline = klines[j];
      if (!kline) continue;
      
      if (getKlineHigh(kline) >= currentHigh) {
        isPivot = false;
        break;
      }
      strength++;
    }

    if (isPivot) {
      pivots.push({
        index: i,
        price: currentHigh,
        openTime: currentKline.openTime,
        type: 'high',
        strength,
        volume: getKlineVolume(currentKline),
      });
    }
  }

  return pivots;
};

export const findPivotLows = (
  klines: Kline[],
  lookback: number = PATTERN_DETECTION_CONFIG.PIVOT_LOOKBACK_DEFAULT,
  lookahead: number = PATTERN_DETECTION_CONFIG.PIVOT_LOOKAHEAD_DEFAULT
): PivotPoint[] => {
  const pivots: PivotPoint[] = [];

  for (let i = lookback; i < klines.length - lookahead; i++) {
    const currentKline = klines[i];
    if (!currentKline) continue;
    
    const currentLow = getKlineLow(currentKline);
    
    let isPivot = true;
    let strength = 0;

    for (let j = i - lookback; j < i; j++) {
      const kline = klines[j];
      if (!kline) continue;
      
      if (getKlineLow(kline) <= currentLow) {
        isPivot = false;
        break;
      }
      strength++;
    }

    if (!isPivot) continue;

    for (let j = i + 1; j <= i + lookahead; j++) {
      const kline = klines[j];
      if (!kline) continue;
      
      if (getKlineLow(kline) <= currentLow) {
        isPivot = false;
        break;
      }
      strength++;
    }

    if (isPivot) {
      pivots.push({
        index: i,
        price: currentLow,
        openTime: currentKline.openTime,
        type: 'low',
        strength,
        volume: getKlineVolume(currentKline),
      });
    }
  }

  return pivots;
};

export const findPivotPoints = (
  klines: Kline[],
  lookback?: number,
  lookahead?: number
): PivotPoint[] => {
  const highs = findPivotHighs(klines, lookback, lookahead);
  const lows = findPivotLows(klines, lookback, lookahead);
  
  return [...highs, ...lows].sort((a, b) => a.index - b.index);
};
