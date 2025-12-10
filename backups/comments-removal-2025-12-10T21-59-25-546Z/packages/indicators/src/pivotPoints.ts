import type { Kline, PivotPoint } from '@marketmind/types';

const DEFAULT_PIVOT_LOOKBACK = 5;
const DEFAULT_PIVOT_LOOKAHEAD = 2;

const getKlineHigh = (kline: Kline): number => parseFloat(kline.high);
const getKlineLow = (kline: Kline): number => parseFloat(kline.low);

export const findPivotHighs = (
  klines: Kline[],
  lookback: number = DEFAULT_PIVOT_LOOKBACK,
  lookahead: number = DEFAULT_PIVOT_LOOKAHEAD
): PivotPoint[] => {
  const pivots: PivotPoint[] = [];

  for (let i = lookback; i < klines.length - lookahead; i++) {
    const currentKline = klines[i];
    if (!currentKline) continue;
    
    const currentHigh = getKlineHigh(currentKline);
    
    let isPivot = true;

    for (let j = i - lookback; j < i; j++) {
      const kline = klines[j];
      if (!kline) continue;
      
      if (getKlineHigh(kline) >= currentHigh) {
        isPivot = false;
        break;
      }
    }

    if (!isPivot) continue;

    for (let j = i + 1; j <= i + lookahead; j++) {
      const kline = klines[j];
      if (!kline) continue;
      
      if (getKlineHigh(kline) >= currentHigh) {
        isPivot = false;
        break;
      }
    }

    if (isPivot) {
      pivots.push({
        index: i,
        price: currentHigh,
        openTime: currentKline.openTime,
        type: 'high',
      });
    }
  }

  return pivots;
};

export const findPivotLows = (
  klines: Kline[],
  lookback: number = DEFAULT_PIVOT_LOOKBACK,
  lookahead: number = DEFAULT_PIVOT_LOOKAHEAD
): PivotPoint[] => {
  const pivots: PivotPoint[] = [];

  for (let i = lookback; i < klines.length - lookahead; i++) {
    const currentKline = klines[i];
    if (!currentKline) continue;
    
    const currentLow = getKlineLow(currentKline);
    
    let isPivot = true;

    for (let j = i - lookback; j < i; j++) {
      const kline = klines[j];
      if (!kline) continue;
      
      if (getKlineLow(kline) <= currentLow) {
        isPivot = false;
        break;
      }
    }

    if (!isPivot) continue;

    for (let j = i + 1; j <= i + lookahead; j++) {
      const kline = klines[j];
      if (!kline) continue;
      
      if (getKlineLow(kline) <= currentLow) {
        isPivot = false;
        break;
      }
    }

    if (isPivot) {
      pivots.push({
        index: i,
        price: currentLow,
        openTime: currentKline.openTime,
        type: 'low',
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

export const findLowestSwingLow = (
  klines: Kline[],
  currentIndex: number,
  lookback: number = 20,
  pivotStrength: number = 3,
): number | null => {
  if (currentIndex < lookback) return null;

  const startIndex = Math.max(0, currentIndex - lookback);
  const recentKlines = klines.slice(startIndex, currentIndex + 1);
  const pivots = findPivotPoints(recentKlines, pivotStrength);

  const lows = pivots
    .filter((p) => p.type === 'low')
    .sort((a, b) => a.price - b.price);

  return lows.length > 0 ? lows[0]!.price : null;
};

export const findHighestSwingHigh = (
  klines: Kline[],
  currentIndex: number,
  lookback: number = 20,
  pivotStrength: number = 3,
): number | null => {
  if (currentIndex < lookback) return null;

  const startIndex = Math.max(0, currentIndex - lookback);
  const recentKlines = klines.slice(startIndex, currentIndex + 1);
  const pivots = findPivotPoints(recentKlines, pivotStrength);

  const highs = pivots
    .filter((p) => p.type === 'high')
    .sort((a, b) => b.price - a.price);

  return highs.length > 0 ? highs[0]!.price : null;
};
