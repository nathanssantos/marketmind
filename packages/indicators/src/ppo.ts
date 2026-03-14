import type { Kline } from '@marketmind/types';
import { getKlineClose } from '@marketmind/types';

const DEFAULT_FAST_PERIOD = 12;
const DEFAULT_SLOW_PERIOD = 26;
const DEFAULT_SIGNAL_PERIOD = 9;

export interface PPOResult {
  ppo: (number | null)[];
  signal: (number | null)[];
  histogram: (number | null)[];
}

export const calculatePPO = (
  klines: Kline[],
  fastPeriod: number = DEFAULT_FAST_PERIOD,
  slowPeriod: number = DEFAULT_SLOW_PERIOD,
  signalPeriod: number = DEFAULT_SIGNAL_PERIOD,
): PPOResult => {
  if (klines.length === 0 || fastPeriod <= 0 || slowPeriod <= 0 || signalPeriod <= 0) {
    return { ppo: [], signal: [], histogram: [] };
  }

  if (fastPeriod >= slowPeriod) {
    return { ppo: [], signal: [], histogram: [] };
  }

  const closes = klines.map(getKlineClose);
  const fastMultiplier = 2 / (fastPeriod + 1);
  const slowMultiplier = 2 / (slowPeriod + 1);
  const signalMultiplier = 2 / (signalPeriod + 1);

  const fastEMA: (number | null)[] = [];
  const slowEMA: (number | null)[] = [];
  const ppo: (number | null)[] = [];
  const signal: (number | null)[] = [];
  const histogram: (number | null)[] = [];

  for (let i = 0; i < closes.length; i++) {
    if (i < fastPeriod - 1) {
      fastEMA.push(null);
    } else if (i === fastPeriod - 1) {
      let sum = 0;
      for (let j = 0; j < fastPeriod; j++) {
        sum += closes[i - j]!;
      }
      fastEMA.push(sum / fastPeriod);
    } else {
      const prev = fastEMA[i - 1];
      if (prev === null || prev === undefined) {
        fastEMA.push(null);
      } else {
        fastEMA.push((closes[i]! - prev) * fastMultiplier + prev);
      }
    }

    if (i < slowPeriod - 1) {
      slowEMA.push(null);
    } else if (i === slowPeriod - 1) {
      let sum = 0;
      for (let j = 0; j < slowPeriod; j++) {
        sum += closes[i - j]!;
      }
      slowEMA.push(sum / slowPeriod);
    } else {
      const prev = slowEMA[i - 1];
      if (prev === null || prev === undefined) {
        slowEMA.push(null);
      } else {
        slowEMA.push((closes[i]! - prev) * slowMultiplier + prev);
      }
    }

    const fast = fastEMA[i];
    const slow = slowEMA[i];

    if (fast === null || fast === undefined || slow === null || slow === undefined || slow === 0) {
      ppo.push(null);
    } else {
      ppo.push(((fast - slow) / slow) * 100);
    }
  }

  let signalStartIndex = -1;
  for (let i = 0; i < ppo.length; i++) {
    if (ppo[i] !== null) {
      if (signalStartIndex === -1) {
        signalStartIndex = i;
      }

      const ppoIndex = i - signalStartIndex;
      if (ppoIndex < signalPeriod - 1) {
        signal.push(null);
      } else if (ppoIndex === signalPeriod - 1) {
        let sum = 0;
        for (let j = 0; j < signalPeriod; j++) {
          sum += ppo[i - j] ?? 0;
        }
        signal.push(sum / signalPeriod);
      } else {
        const prev = signal[i - 1];
        if (prev === null || prev === undefined) {
          signal.push(null);
        } else {
          signal.push(((ppo[i] ?? 0) - prev) * signalMultiplier + prev);
        }
      }
    } else {
      signal.push(null);
    }

    const ppoVal = ppo[i];
    const sigVal = signal[i];

    if (ppoVal === null || ppoVal === undefined || sigVal === null || sigVal === undefined) {
      histogram.push(null);
    } else {
      histogram.push(ppoVal - sigVal);
    }
  }

  return { ppo, signal, histogram };
};
