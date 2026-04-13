import type { Kline } from '@marketmind/types';
import { getKlineHigh, getKlineLow } from '@marketmind/types';

const DEFAULT_AROON_PERIOD = 25;

export interface AroonResult {
  aroonUp: (number | null)[];
  aroonDown: (number | null)[];
  oscillator: (number | null)[];
}

export const calculateAroon = (
  klines: Kline[],
  period: number = DEFAULT_AROON_PERIOD,
): AroonResult => {
  if (klines.length === 0 || period <= 0) {
    return { aroonUp: [], aroonDown: [], oscillator: [] };
  }

  const aroonUp: (number | null)[] = [];
  const aroonDown: (number | null)[] = [];
  const oscillator: (number | null)[] = [];

  for (let i = 0; i < klines.length; i++) {
    if (i < period) {
      aroonUp.push(null);
      aroonDown.push(null);
      oscillator.push(null);
      continue;
    }

    let highestIndex = i - period;
    let lowestIndex = i - period;
    const firstKline = klines[i - period]!;
    let highestValue = getKlineHigh(firstKline);
    let lowestValue = getKlineLow(firstKline);

    for (let j = i - period + 1; j <= i; j++) {
      const kline = klines[j]!;
      const high = getKlineHigh(kline);
      const low = getKlineLow(kline);

      if (high >= highestValue) {
        highestValue = high;
        highestIndex = j;
      }

      if (low <= lowestValue) {
        lowestValue = low;
        lowestIndex = j;
      }
    }

    const daysSinceHigh = i - highestIndex;
    const daysSinceLow = i - lowestIndex;

    const up = ((period - daysSinceHigh) / period) * 100;
    const down = ((period - daysSinceLow) / period) * 100;

    aroonUp.push(up);
    aroonDown.push(down);
    oscillator.push(up - down);
  }

  return { aroonUp, aroonDown, oscillator };
};
