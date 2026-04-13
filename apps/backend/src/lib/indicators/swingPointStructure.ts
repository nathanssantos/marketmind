import type { Kline } from '@marketmind/types';
import { getKlineHigh, getKlineLow } from '@marketmind/types';
import { isPivotHigh, isPivotLow } from './swingPointHelpers';
import type { SwingPoint } from './swingPoints';

export interface MarketStructure {
  type: 'uptrend' | 'downtrend' | 'ranging';
  higherHighs: SwingPoint[];
  higherLows: SwingPoint[];
  lowerHighs: SwingPoint[];
  lowerLows: SwingPoint[];
  breakOfStructure: boolean;
}

export const detectMarketStructure = (
  klines: Kline[],
  currentIndex: number,
  lookback: number = 100,
): MarketStructure => {
  const startIndex = Math.max(0, currentIndex - lookback);
  const allSwingPoints: SwingPoint[] = [];

  for (let i = startIndex + 5; i <= currentIndex - 5; i++) {
    if (isPivotHigh(klines, i, 5)) {
      const kline = klines[i]!;
      allSwingPoints.push({
        index: i,
        type: 'high',
        price: getKlineHigh(kline),
        timestamp: Number(kline.openTime),
      });
    }
    if (isPivotLow(klines, i, 5)) {
      const kline = klines[i]!;
      allSwingPoints.push({
        index: i,
        type: 'low',
        price: getKlineLow(kline),
        timestamp: Number(kline.openTime),
      });
    }
  }

  allSwingPoints.sort((a, b) => a.index - b.index);

  const higherHighs: SwingPoint[] = [];
  const higherLows: SwingPoint[] = [];
  const lowerHighs: SwingPoint[] = [];
  const lowerLows: SwingPoint[] = [];

  const highs = allSwingPoints.filter(p => p.type === 'high');
  const lows = allSwingPoints.filter(p => p.type === 'low');

  for (let i = 1; i < highs.length; i++) {
    if (highs[i]!.price > highs[i - 1]!.price) higherHighs.push(highs[i]!);
    else if (highs[i]!.price < highs[i - 1]!.price) lowerHighs.push(highs[i]!);
  }

  for (let i = 1; i < lows.length; i++) {
    if (lows[i]!.price > lows[i - 1]!.price) higherLows.push(lows[i]!);
    else if (lows[i]!.price < lows[i - 1]!.price) lowerLows.push(lows[i]!);
  }

  let type: 'uptrend' | 'downtrend' | 'ranging' = 'ranging';

  if (higherHighs.length >= 2 && higherLows.length >= 2) {
    type = 'uptrend';
  } else if (lowerHighs.length >= 2 && lowerLows.length >= 2) {
    type = 'downtrend';
  }

  const breakOfStructure = false;

  return {
    type,
    higherHighs,
    higherLows,
    lowerHighs,
    lowerLows,
    breakOfStructure,
  };
};

export const validateSwingWithStructure = (
  klines: Kline[],
  swingPoint: SwingPoint,
  lookback: number = 100,
): { valid: boolean; reason: string } => {
  const structure = detectMarketStructure(klines, swingPoint.index, lookback);

  if (swingPoint.type === 'high') {
    const isHigherHigh = structure.higherHighs.some(
      hh => hh.price <= swingPoint.price && hh.index < swingPoint.index
    );

    return {
      valid: isHigherHigh || structure.type === 'uptrend',
      reason: isHigherHigh
        ? 'confirmed_higher_high'
        : structure.type === 'uptrend'
          ? 'uptrend_structure'
          : 'not_higher_high'
    };
  }

  const isLowerLow = structure.lowerLows.some(
    ll => ll.price >= swingPoint.price && ll.index < swingPoint.index
  );

  return {
    valid: isLowerLow || structure.type === 'downtrend',
    reason: isLowerLow
      ? 'confirmed_lower_low'
      : structure.type === 'downtrend'
        ? 'downtrend_structure'
        : 'not_lower_low'
  };
};
