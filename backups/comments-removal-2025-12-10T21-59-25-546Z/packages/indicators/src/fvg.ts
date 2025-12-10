import type { Kline } from '@marketmind/types';

const getKlineHigh = (kline: Kline): number => parseFloat(kline.high);
const getKlineLow = (kline: Kline): number => parseFloat(kline.low);

export interface FairValueGap {
  index: number;
  type: 'bullish' | 'bearish';
  high: number;
  low: number;
  filled: boolean;
  timestamp: number;
}

export interface FVGResult {
  gaps: FairValueGap[];
  bullishFVG: (FairValueGap | null)[];
  bearishFVG: (FairValueGap | null)[];
}

export const calculateFVG = (klines: Kline[]): FVGResult => {
  if (klines.length < 3) {
    return { gaps: [], bullishFVG: [], bearishFVG: [] };
  }

  const gaps: FairValueGap[] = [];
  const bullishFVG: (FairValueGap | null)[] = [];
  const bearishFVG: (FairValueGap | null)[] = [];

  for (let i = 0; i < klines.length; i++) {
    bullishFVG.push(null);
    bearishFVG.push(null);

    if (i < 2) continue;

    const k1 = klines[i - 2]!;
    const k2 = klines[i - 1]!;
    const k3 = klines[i]!;

    const k1High = getKlineHigh(k1);
    const k1Low = getKlineLow(k1);
    const k3High = getKlineHigh(k3);
    const k3Low = getKlineLow(k3);

    if (k3Low > k1High) {
      const gap: FairValueGap = {
        index: i - 1,
        type: 'bullish',
        high: k3Low,
        low: k1High,
        filled: false,
        timestamp: k2.openTime,
      };
      gaps.push(gap);
      bullishFVG[i - 1] = gap;
    }

    if (k3High < k1Low) {
      const gap: FairValueGap = {
        index: i - 1,
        type: 'bearish',
        high: k1Low,
        low: k3High,
        filled: false,
        timestamp: k2.openTime,
      };
      gaps.push(gap);
      bearishFVG[i - 1] = gap;
    }
  }

  for (const gap of gaps) {
    for (let i = gap.index + 2; i < klines.length; i++) {
      const high = getKlineHigh(klines[i]!);
      const low = getKlineLow(klines[i]!);

      if (gap.type === 'bullish' && low <= gap.low) {
        gap.filled = true;
        break;
      }

      if (gap.type === 'bearish' && high >= gap.high) {
        gap.filled = true;
        break;
      }
    }
  }

  return { gaps, bullishFVG, bearishFVG };
};

export const getUnfilledFVGs = (klines: Kline[]): FairValueGap[] => {
  const { gaps } = calculateFVG(klines);
  return gaps.filter((g) => !g.filled);
};
