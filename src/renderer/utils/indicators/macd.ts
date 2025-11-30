import type { Kline } from '@shared/types';

const EMA_MULTIPLIER_NUMERATOR = 2;

export interface MACDResult {
  macd: number[];
  signal: number[];
  histogram: number[];
}

const calculateEMA = (data: number[], period: number): number[] => {
  const ema: number[] = [];
  const multiplier = EMA_MULTIPLIER_NUMERATOR / (period + 1);
  let sum = 0;

  for (let i = 0; i < data.length; i++) {
    const currentValue = data[i];
    if (currentValue === undefined) continue;

    if (i < period) {
      sum += currentValue;
      if (i === period - 1) {
        ema.push(sum / period);
      } else {
        ema.push(NaN);
      }
    } else {
      const prevEMA = ema[i - 1];
      if (prevEMA === undefined) continue;
      const currentEMA = (currentValue - prevEMA) * multiplier + prevEMA;
      ema.push(currentEMA);
    }
  }

  return ema;
};

export const calculateMACD = (
  candles: Kline[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9,
): MACDResult => {
  if (candles.length === 0) {
    return { macd: [], signal: [], histogram: [] };
  }

  const closes = candles.map((c) => c.close);

  const emaFast = calculateEMA(closes, fastPeriod);
  const emaSlow = calculateEMA(closes, slowPeriod);

  const macd = emaFast.map((fast, i) => {
    const slow = emaSlow[i];
    return slow !== undefined ? fast - slow : NaN;
  });

  const validMacdIndex = macd.findIndex((v) => !isNaN(v));

  if (validMacdIndex === -1) {
    return {
      macd,
      signal: macd.map(() => NaN),
      histogram: macd.map(() => NaN),
    };
  }

  const validMacd = macd.slice(validMacdIndex).filter((v) => !isNaN(v));
  const signal = calculateEMA(validMacd, signalPeriod);

  const paddedSignal = [
    ...new Array(validMacdIndex).fill(NaN),
    ...signal,
  ];

  const histogram = macd.map((m, i) => {
    const sig = paddedSignal[i];
    if (sig === undefined || isNaN(m) || isNaN(sig)) return NaN;
    return m - sig;
  });

  return { macd, signal: paddedSignal, histogram };
};
