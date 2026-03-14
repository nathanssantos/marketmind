import type { Kline } from '@marketmind/types';
import { getKlineClose, getKlineHigh, getKlineLow } from '@marketmind/types';

export interface Gap {
  index: number;
  type: 'up' | 'down';
  gapHigh: number;
  gapLow: number;
  size: number;
  percentSize: number;
  filled: boolean;
  timestamp: number;
}

export interface GapDetectionResult {
  gaps: Gap[];
  gapUp: (Gap | null)[];
  gapDown: (Gap | null)[];
}

export const calculateGaps = (
  klines: Kline[],
  minGapPercent: number = 0.5,
): GapDetectionResult => {
  if (klines.length < 2) {
    return { gaps: [], gapUp: [], gapDown: [] };
  }

  const gaps: Gap[] = [];
  const gapUp: (Gap | null)[] = [null];
  const gapDown: (Gap | null)[] = [null];

  for (let i = 1; i < klines.length; i++) {
    const prevHigh = getKlineHigh(klines[i - 1]!);
    const prevLow = getKlineLow(klines[i - 1]!);
    const prevClose = getKlineClose(klines[i - 1]!);
    const currHigh = getKlineHigh(klines[i]!);
    const currLow = getKlineLow(klines[i]!);

    if (currLow > prevHigh) {
      const gapSize = currLow - prevHigh;
      const percentSize = (gapSize / prevClose) * 100;

      if (percentSize >= minGapPercent) {
        const gap: Gap = {
          index: i,
          type: 'up',
          gapHigh: currLow,
          gapLow: prevHigh,
          size: gapSize,
          percentSize,
          filled: false,
          timestamp: klines[i]!.openTime,
        };
        gaps.push(gap);
        gapUp.push(gap);
        gapDown.push(null);
      } else {
        gapUp.push(null);
        gapDown.push(null);
      }
    } else if (currHigh < prevLow) {
      const gapSize = prevLow - currHigh;
      const percentSize = (gapSize / prevClose) * 100;

      if (percentSize >= minGapPercent) {
        const gap: Gap = {
          index: i,
          type: 'down',
          gapHigh: prevLow,
          gapLow: currHigh,
          size: gapSize,
          percentSize,
          filled: false,
          timestamp: klines[i]!.openTime,
        };
        gaps.push(gap);
        gapDown.push(gap);
        gapUp.push(null);
      } else {
        gapUp.push(null);
        gapDown.push(null);
      }
    } else {
      gapUp.push(null);
      gapDown.push(null);
    }
  }

  for (const gap of gaps) {
    for (let i = gap.index + 1; i < klines.length; i++) {
      const high = getKlineHigh(klines[i]!);
      const low = getKlineLow(klines[i]!);

      if (gap.type === 'up' && low <= gap.gapLow) {
        gap.filled = true;
        break;
      }

      if (gap.type === 'down' && high >= gap.gapHigh) {
        gap.filled = true;
        break;
      }
    }
  }

  return { gaps, gapUp, gapDown };
};

export const getUnfilledGaps = (klines: Kline[], minGapPercent: number = 0.5): Gap[] => {
  const { gaps } = calculateGaps(klines, minGapPercent);
  return gaps.filter((g) => !g.filled);
};
