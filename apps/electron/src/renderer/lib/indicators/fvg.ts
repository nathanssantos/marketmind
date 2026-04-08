import type { Kline, FairValueGap, FVGResult } from '@marketmind/types';
import { getKlineHigh, getKlineLow } from '@marketmind/types';

export const calculateFVG = (klines: Kline[]): FVGResult => {
  if (klines.length < 3) return { gaps: [], bullishFVG: [], bearishFVG: [] };

  const gaps: FairValueGap[] = [];
  const bullishFVG: (FairValueGap | null)[] = new Array(klines.length).fill(null);
  const bearishFVG: (FairValueGap | null)[] = new Array(klines.length).fill(null);
  const unfilledGaps: FairValueGap[] = [];

  for (let i = 0; i < klines.length; i++) {
    if (i < 2) continue;

    const k1 = klines[i - 2]!;
    const k2 = klines[i - 1]!;
    const k3 = klines[i]!;

    const k1High = getKlineHigh(k1);
    const k1Low = getKlineLow(k1);
    const k3High = getKlineHigh(k3);
    const k3Low = getKlineLow(k3);

    for (let g = unfilledGaps.length - 1; g >= 0; g--) {
      const gap = unfilledGaps[g]!;
      if (gap.type === 'bullish' && k3Low <= gap.low) {
        gap.filled = true;
        unfilledGaps.splice(g, 1);
      } else if (gap.type === 'bearish' && k3High >= gap.high) {
        gap.filled = true;
        unfilledGaps.splice(g, 1);
      }
    }

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
      unfilledGaps.push(gap);
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
      unfilledGaps.push(gap);
      bearishFVG[i - 1] = gap;
    }
  }

  return { gaps, bullishFVG, bearishFVG };
};

export const getUnfilledFVGs = (klines: Kline[]): FairValueGap[] => {
  const { gaps } = calculateFVG(klines);
  return gaps.filter((g) => !g.filled);
};
