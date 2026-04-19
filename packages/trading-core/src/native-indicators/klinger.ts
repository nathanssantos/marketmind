import type { Kline } from '@marketmind/types';
import { getKlineClose, getKlineHigh, getKlineLow, getKlineVolume } from '@marketmind/types';

const DEFAULT_FAST_PERIOD = 34;
const DEFAULT_SLOW_PERIOD = 55;
const DEFAULT_SIGNAL_PERIOD = 13;

export interface KlingerResult {
  kvo: (number | null)[];
  signal: (number | null)[];
}

export const calculateKlinger = (
  klines: Kline[],
  fastPeriod: number = DEFAULT_FAST_PERIOD,
  slowPeriod: number = DEFAULT_SLOW_PERIOD,
  signalPeriod: number = DEFAULT_SIGNAL_PERIOD,
): KlingerResult => {
  if (klines.length === 0 || fastPeriod <= 0 || slowPeriod <= 0 || signalPeriod <= 0) {
    return { kvo: [], signal: [] };
  }

  const kvo: (number | null)[] = [];
  const signal: (number | null)[] = [];

  const hlc: number[] = klines.map(
    (k) => (getKlineHigh(k) + getKlineLow(k) + getKlineClose(k)) / 3,
  );

  const trend: number[] = [];
  const dm: number[] = [];
  const vf: number[] = [];

  for (let i = 0; i < klines.length; i++) {
    if (i === 0) {
      trend.push(0);
      dm.push(0);
      vf.push(0);
      continue;
    }

    const t = hlc[i]! > hlc[i - 1]! ? 1 : -1;
    trend.push(t);

    const high = getKlineHigh(klines[i]!);
    const low = getKlineLow(klines[i]!);
    dm.push(high - low);

    const cm = trend[i] === trend[i - 1] ? dm[i - 1]! + dm[i]! : dm[i]!;
    const cmRatio = cm === 0 ? 0 : Math.abs(2 * (dm[i]! / cm) - 1);

    const volume = getKlineVolume(klines[i]!);
    vf.push(volume * cmRatio * trend[i]! * 100);
  }

  const fastMultiplier = 2 / (fastPeriod + 1);
  const slowMultiplier = 2 / (slowPeriod + 1);
  const signalMultiplier = 2 / (signalPeriod + 1);

  const fastEMA: number[] = [];
  const slowEMA: number[] = [];

  for (let i = 0; i < vf.length; i++) {
    if (i === 0) {
      fastEMA.push(vf[i]!);
      slowEMA.push(vf[i]!);
    } else {
      fastEMA.push((vf[i]! - fastEMA[i - 1]!) * fastMultiplier + fastEMA[i - 1]!);
      slowEMA.push((vf[i]! - slowEMA[i - 1]!) * slowMultiplier + slowEMA[i - 1]!);
    }
  }

  const minWarmup = Math.max(fastPeriod, slowPeriod);

  for (let i = 0; i < klines.length; i++) {
    if (i < minWarmup) {
      kvo.push(null);
      signal.push(null);
      continue;
    }

    const kvoValue = fastEMA[i]! - slowEMA[i]!;
    kvo.push(kvoValue);
  }

  let signalStartIndex = -1;
  for (let i = 0; i < kvo.length; i++) {
    const kvoVal = kvo[i];
    if (kvoVal !== null && kvoVal !== undefined) {
      if (signalStartIndex === -1) {
        signalStartIndex = i;
        signal[i] = kvoVal;
      } else {
        const prev = signal[i - 1];
        if (prev === null || prev === undefined) {
          signal[i] = kvoVal;
        } else {
          signal[i] = (kvoVal - prev) * signalMultiplier + prev;
        }
      }
    }
  }

  return { kvo, signal };
};
