import type { Kline } from '@marketmind/types';
import { getKlineClose, getKlineHigh, getKlineLow } from '@marketmind/types';
import { calculateATR } from './atr';
import type { SwingPoint } from './swingPoints';

export const isPivotHigh = (
  klines: Kline[],
  index: number,
  period: number = 5,
): boolean => {
  const leftBars = Math.floor(period / 2);
  const rightBars = Math.floor(period / 2);

  if (index < leftBars || index >= klines.length - rightBars) return false;

  const centerKline = klines[index];
  if (!centerKline) return false;

  const centerHigh = getKlineHigh(centerKline);

  for (let i = 1; i <= leftBars; i++) {
    const leftKline = klines[index - i];
    if (!leftKline || getKlineHigh(leftKline) >= centerHigh) return false;
  }

  for (let i = 1; i <= rightBars; i++) {
    const rightKline = klines[index + i];
    if (!rightKline || getKlineHigh(rightKline) >= centerHigh) return false;
  }

  return true;
};

export const isPivotLow = (
  klines: Kline[],
  index: number,
  period: number = 5,
): boolean => {
  const leftBars = Math.floor(period / 2);
  const rightBars = Math.floor(period / 2);

  if (index < leftBars || index >= klines.length - rightBars) return false;

  const centerKline = klines[index];
  if (!centerKline) return false;

  const centerLow = getKlineLow(centerKline);

  for (let i = 1; i <= leftBars; i++) {
    const leftKline = klines[index - i];
    if (!leftKline || getKlineLow(leftKline) <= centerLow) return false;
  }

  for (let i = 1; i <= rightBars; i++) {
    const rightKline = klines[index + i];
    if (!rightKline || getKlineLow(rightKline) <= centerLow) return false;
  }

  return true;
};

export const findRecentLow = (
  klines: Kline[],
  startIndex: number,
  endIndex: number,
): SwingPoint | null => {
  let lowestPrice = Infinity;
  let lowestIndex = -1;

  for (let i = startIndex; i <= endIndex && i < klines.length; i++) {
    const kline = klines[i];
    if (!kline) continue;
    const low = getKlineLow(kline);
    if (low < lowestPrice) {
      lowestPrice = low;
      lowestIndex = i;
    }
  }

  if (lowestIndex === -1) return null;

  const kline = klines[lowestIndex]!;
  return {
    index: lowestIndex,
    type: 'low',
    price: lowestPrice,
    timestamp: Number(kline.openTime),
  };
};

export const findRecentHigh = (
  klines: Kline[],
  startIndex: number,
  endIndex: number,
): SwingPoint | null => {
  let highestPrice = -Infinity;
  let highestIndex = -1;

  for (let i = startIndex; i <= endIndex && i < klines.length; i++) {
    const kline = klines[i];
    if (!kline) continue;
    const high = getKlineHigh(kline);
    if (high > highestPrice) {
      highestPrice = high;
      highestIndex = i;
    }
  }

  if (highestIndex === -1) return null;

  const kline = klines[highestIndex]!;
  return {
    index: highestIndex,
    type: 'high',
    price: highestPrice,
    timestamp: Number(kline.openTime),
  };
};

export const findZigZagHighs = (
  klines: Kline[],
  currentIndex: number,
  lookback: number,
  minSwingSize: number,
): SwingPoint[] => {
  const highs: SwingPoint[] = [];
  const startIndex = Math.max(0, currentIndex - lookback);

  for (let i = startIndex + 5; i <= currentIndex - 5; i++) {
    if (isPivotHigh(klines, i, 5)) {
      const kline = klines[i]!;
      const high = getKlineHigh(kline);

      const recentLow = findRecentLow(klines, Math.max(0, i - lookback), i);
      if (recentLow && (high - recentLow.price) >= minSwingSize) {
        highs.push({
          index: i,
          type: 'high',
          price: high,
          timestamp: Number(kline.openTime),
        });
      }
    }
  }

  return highs;
};

export const findZigZagLows = (
  klines: Kline[],
  currentIndex: number,
  lookback: number,
  minSwingSize: number,
): SwingPoint[] => {
  const lows: SwingPoint[] = [];
  const startIndex = Math.max(0, currentIndex - lookback);

  for (let i = startIndex + 5; i <= currentIndex - 5; i++) {
    if (isPivotLow(klines, i, 5)) {
      const kline = klines[i]!;
      const low = getKlineLow(kline);

      const recentHigh = findRecentHigh(klines, Math.max(0, i - lookback), i);
      if (recentHigh && (recentHigh.price - low) >= minSwingSize) {
        lows.push({
          index: i,
          type: 'low',
          price: low,
          timestamp: Number(kline.openTime),
        });
      }
    }
  }

  return lows;
};

export const calculateMinSwingSize = (
  klines: Kline[],
  currentIndex: number,
  atrMultiplier: number,
  percentThreshold: number,
  useATR: boolean,
): number => {
  if (useATR) {
    const atrValues = calculateATR(klines.slice(0, currentIndex + 1), 14);
    const currentATR = atrValues[atrValues.length - 1];
    if (!currentATR || isNaN(currentATR)) {
      const closePrice = getKlineClose(klines[currentIndex]!);
      return closePrice * (percentThreshold / 100);
    }
    return currentATR * atrMultiplier;
  }
  const closePrice = getKlineClose(klines[currentIndex]!);
  return closePrice * (percentThreshold / 100);
};
