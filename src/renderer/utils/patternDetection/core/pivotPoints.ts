import type { Candle } from '@shared/types';
import { PATTERN_DETECTION_CONFIG } from '../constants';
import type { PivotPoint } from '../types';

export const findPivotHighs = (
  candles: Candle[],
  lookback: number = PATTERN_DETECTION_CONFIG.PIVOT_LOOKBACK_DEFAULT,
  lookahead: number = PATTERN_DETECTION_CONFIG.PIVOT_LOOKAHEAD_DEFAULT
): PivotPoint[] => {
  const pivots: PivotPoint[] = [];

  for (let i = lookback; i < candles.length - lookahead; i++) {
    const currentCandle = candles[i];
    if (!currentCandle) continue;
    
    const currentHigh = currentCandle.high;
    
    let isPivot = true;
    let strength = 0;

    for (let j = i - lookback; j < i; j++) {
      const candle = candles[j];
      if (!candle) continue;
      
      if (candle.high >= currentHigh) {
        isPivot = false;
        break;
      }
      strength++;
    }

    if (!isPivot) continue;

    for (let j = i + 1; j <= i + lookahead; j++) {
      const candle = candles[j];
      if (!candle) continue;
      
      if (candle.high >= currentHigh) {
        isPivot = false;
        break;
      }
      strength++;
    }

    if (isPivot) {
      pivots.push({
        index: i,
        price: currentHigh,
        timestamp: currentCandle.timestamp,
        type: 'high',
        strength,
        volume: currentCandle.volume,
      });
    }
  }

  return pivots;
};

export const findPivotLows = (
  candles: Candle[],
  lookback: number = PATTERN_DETECTION_CONFIG.PIVOT_LOOKBACK_DEFAULT,
  lookahead: number = PATTERN_DETECTION_CONFIG.PIVOT_LOOKAHEAD_DEFAULT
): PivotPoint[] => {
  const pivots: PivotPoint[] = [];

  for (let i = lookback; i < candles.length - lookahead; i++) {
    const currentCandle = candles[i];
    if (!currentCandle) continue;
    
    const currentLow = currentCandle.low;
    
    let isPivot = true;
    let strength = 0;

    for (let j = i - lookback; j < i; j++) {
      const candle = candles[j];
      if (!candle) continue;
      
      if (candle.low <= currentLow) {
        isPivot = false;
        break;
      }
      strength++;
    }

    if (!isPivot) continue;

    for (let j = i + 1; j <= i + lookahead; j++) {
      const candle = candles[j];
      if (!candle) continue;
      
      if (candle.low <= currentLow) {
        isPivot = false;
        break;
      }
      strength++;
    }

    if (isPivot) {
      pivots.push({
        index: i,
        price: currentLow,
        timestamp: currentCandle.timestamp,
        type: 'low',
        strength,
        volume: currentCandle.volume,
      });
    }
  }

  return pivots;
};

export const findPivotPoints = (
  candles: Candle[],
  lookback?: number,
  lookahead?: number
): PivotPoint[] => {
  const highs = findPivotHighs(candles, lookback, lookahead);
  const lows = findPivotLows(candles, lookback, lookahead);
  
  return [...highs, ...lows].sort((a, b) => a.index - b.index);
};
