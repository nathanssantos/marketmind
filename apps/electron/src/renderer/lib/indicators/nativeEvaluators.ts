import type { Kline } from '@marketmind/types';
import { getKlineVolume } from '@marketmind/types';
import type { IndicatorParamValue } from '@marketmind/trading-core';
import { calculateChoppiness } from './choppiness';
import { calculateDEMA } from './dema';
import { calculateDonchian } from './donchian';
import { calculatePPO } from './ppo';
import { calculateStochRSI } from './stochRsi';
import { calculateTEMA } from './tema';

export type NativeEvaluatorOutput = Record<string, (number | null)[]>;

export type NativeEvaluator = (
  klines: Kline[],
  params: Record<string, IndicatorParamValue>,
) => NativeEvaluatorOutput;

const num = (v: IndicatorParamValue | undefined, fallback: number): number => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v !== '') {
    const parsed = Number(v);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

export const NATIVE_EVALUATORS: Record<string, NativeEvaluator> = {
  dema: (klines, params) => {
    const result = calculateDEMA(klines, num(params['period'], 21));
    return { value: result.values };
  },

  tema: (klines, params) => {
    const result = calculateTEMA(klines, num(params['period'], 20));
    return { value: result.values };
  },

  stochRsi: (klines, params) => {
    const result = calculateStochRSI(
      klines,
      num(params['rsiPeriod'], 14),
      num(params['stochPeriod'], 14),
      num(params['kPeriod'], 3),
      num(params['dPeriod'], 3),
    );
    return { k: result.k, d: result.d };
  },

  donchian: (klines, params) => {
    const result = calculateDonchian(klines, num(params['period'], 20));
    return { upper: result.upper, middle: result.middle, lower: result.lower };
  },

  ppo: (klines, params) => {
    const result = calculatePPO(
      klines,
      num(params['fastPeriod'], 12),
      num(params['slowPeriod'], 26),
      num(params['signalPeriod'], 9),
    );
    return { line: result.ppo, signal: result.signal, histogram: result.histogram };
  },

  choppiness: (klines, params) => {
    const result = calculateChoppiness(klines, num(params['period'], 14));
    return { value: result.values };
  },

  volume: (klines) => ({
    value: klines.map((k) => getKlineVolume(k)),
  }),
};

export const hasNativeEvaluator = (scriptId: string): boolean =>
  Object.prototype.hasOwnProperty.call(NATIVE_EVALUATORS, scriptId);

export const getNativeEvaluator = (scriptId: string): NativeEvaluator | undefined =>
  NATIVE_EVALUATORS[scriptId];
