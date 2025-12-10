import type { Kline } from '@marketmind/types';

const DEFAULT_AF_START = 0.02;
const DEFAULT_AF_INCREMENT = 0.02;
const DEFAULT_AF_MAX = 0.2;

const getKlineHigh = (kline: Kline): number => parseFloat(kline.high);
const getKlineLow = (kline: Kline): number => parseFloat(kline.low);

export interface ParabolicSARResult {
  sar: (number | null)[];
  trend: ('up' | 'down' | null)[];
}

export const calculateParabolicSAR = (
  klines: Kline[],
  afStart: number = DEFAULT_AF_START,
  afIncrement: number = DEFAULT_AF_INCREMENT,
  afMax: number = DEFAULT_AF_MAX,
): ParabolicSARResult => {
  if (klines.length === 0 || afStart <= 0 || afIncrement <= 0 || afMax <= 0) {
    return { sar: [], trend: [] };
  }

  if (klines.length < 2) {
    return { sar: [null], trend: [null] };
  }

  const sar: (number | null)[] = [];
  const trend: ('up' | 'down' | null)[] = [];

  let isUpTrend = getKlineHigh(klines[1]!) > getKlineHigh(klines[0]!);
  let af = afStart;
  let ep = isUpTrend ? getKlineHigh(klines[0]!) : getKlineLow(klines[0]!);
  let currentSar = isUpTrend ? getKlineLow(klines[0]!) : getKlineHigh(klines[0]!);

  sar.push(null);
  trend.push(null);

  for (let i = 1; i < klines.length; i++) {
    const high = getKlineHigh(klines[i]!);
    const low = getKlineLow(klines[i]!);
    const prevHigh = getKlineHigh(klines[i - 1]!);
    const prevLow = getKlineLow(klines[i - 1]!);

    let newSar = currentSar + af * (ep - currentSar);

    if (isUpTrend) {
      newSar = Math.min(newSar, prevLow);
      if (i >= 2) {
        newSar = Math.min(newSar, getKlineLow(klines[i - 2]!));
      }

      if (low < newSar) {
        isUpTrend = false;
        newSar = ep;
        ep = low;
        af = afStart;
      } else {
        if (high > ep) {
          ep = high;
          af = Math.min(af + afIncrement, afMax);
        }
      }
    } else {
      newSar = Math.max(newSar, prevHigh);
      if (i >= 2) {
        newSar = Math.max(newSar, getKlineHigh(klines[i - 2]!));
      }

      if (high > newSar) {
        isUpTrend = true;
        newSar = ep;
        ep = high;
        af = afStart;
      } else {
        if (low < ep) {
          ep = low;
          af = Math.min(af + afIncrement, afMax);
        }
      }
    }

    currentSar = newSar;
    sar.push(currentSar);
    trend.push(isUpTrend ? 'up' : 'down');
  }

  return { sar, trend };
};
