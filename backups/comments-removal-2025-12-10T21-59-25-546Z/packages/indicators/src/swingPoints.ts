import type { Kline } from '@marketmind/types';

const DEFAULT_SWING_LOOKBACK = 5;

const getKlineHigh = (kline: Kline): number => parseFloat(kline.high);
const getKlineLow = (kline: Kline): number => parseFloat(kline.low);

export interface SwingPoint {
  index: number;
  type: 'high' | 'low';
  price: number;
  timestamp: number;
}

export interface SwingPointsResult {
  swingHighs: (number | null)[];
  swingLows: (number | null)[];
  swingPoints: SwingPoint[];
}

export const calculateSwingPoints = (
  klines: Kline[],
  lookback: number = DEFAULT_SWING_LOOKBACK,
): SwingPointsResult => {
  if (klines.length === 0 || lookback <= 0) {
    return { swingHighs: [], swingLows: [], swingPoints: [] };
  }

  const swingHighs: (number | null)[] = [];
  const swingLows: (number | null)[] = [];
  const swingPoints: SwingPoint[] = [];

  for (let i = 0; i < klines.length; i++) {
    swingHighs.push(null);
    swingLows.push(null);

    if (i < lookback || i >= klines.length - lookback) {
      continue;
    }

    const currentKline = klines[i]!;
    const currentHigh = getKlineHigh(currentKline);
    const currentLow = getKlineLow(currentKline);

    let isSwingHigh = true;
    let isSwingLow = true;

    for (let j = 1; j <= lookback; j++) {
      if (getKlineHigh(klines[i - j]!) >= currentHigh) isSwingHigh = false;
      if (getKlineHigh(klines[i + j]!) >= currentHigh) isSwingHigh = false;
      if (getKlineLow(klines[i - j]!) <= currentLow) isSwingLow = false;
      if (getKlineLow(klines[i + j]!) <= currentLow) isSwingLow = false;
    }

    if (isSwingHigh) {
      swingHighs[i] = currentHigh;
      swingPoints.push({
        index: i,
        type: 'high',
        price: currentHigh,
        timestamp: currentKline.openTime,
      });
    }

    if (isSwingLow) {
      swingLows[i] = currentLow;
      swingPoints.push({
        index: i,
        type: 'low',
        price: currentLow,
        timestamp: currentKline.openTime,
      });
    }
  }

  swingPoints.sort((a, b) => a.index - b.index);

  return { swingHighs, swingLows, swingPoints };
};

export const calculateSwingHighLowLevels = (
  klines: Kline[],
  lookback: number = DEFAULT_SWING_LOOKBACK,
  maxLevels: number = 10,
): { resistanceLevels: number[]; supportLevels: number[] } => {
  const { swingPoints } = calculateSwingPoints(klines, lookback);

  const highPrices = swingPoints.filter((p) => p.type === 'high').map((p) => p.price);
  const lowPrices = swingPoints.filter((p) => p.type === 'low').map((p) => p.price);

  const resistanceLevels = highPrices.slice(-maxLevels).sort((a, b) => b - a);
  const supportLevels = lowPrices.slice(-maxLevels).sort((a, b) => a - b);

  return { resistanceLevels, supportLevels };
};
