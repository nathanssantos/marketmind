import type { Kline } from '@marketmind/types';
import { getKlineVolume } from '@marketmind/types';
import type { IndicatorParamValue } from '@marketmind/trading-core';
import { calculateAO } from './ao';
import { calculateAroon } from './aroon';
import { calculateCMF } from './cmf';
import { calculateChoppiness } from './choppiness';
import { calculateDEMA } from './dema';
import { calculateDonchian } from './donchian';
import { calculateElderRay } from './elderRay';
import { calculateIchimoku } from './ichimoku';
import { calculateKlinger } from './klinger';
import { findEnhancedPivotHighs, findEnhancedPivotLows } from './pivotPoints';
import { calculatePPO } from './ppo';
import { calculateStochRSI } from './stochRsi';
import { calculateTEMA } from './tema';
import { calculateUltimateOscillator } from './ultimateOscillator';
import { calculateVortex } from './vortex';
import { calculateIntradayVWAP, calculateWeeklyVWAP } from './vwap';

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

  ao: (klines, params) => {
    const result = calculateAO(klines, num(params['fastPeriod'], 5), num(params['slowPeriod'], 34));
    return { value: result.values };
  },

  aroon: (klines, params) => {
    const result = calculateAroon(klines, num(params['period'], 25));
    return { up: result.aroonUp, down: result.aroonDown, oscillator: result.oscillator };
  },

  cmf: (klines, params) => {
    const result = calculateCMF(klines, num(params['period'], 20));
    return { value: result.values };
  },

  elderRay: (klines, params) => {
    const result = calculateElderRay(klines, num(params['period'], 13));
    return { bullPower: result.bullPower, bearPower: result.bearPower };
  },

  klinger: (klines, params) => {
    const result = calculateKlinger(
      klines,
      num(params['fastPeriod'], 34),
      num(params['slowPeriod'], 55),
      num(params['signalPeriod'], 13),
    );
    return { kvo: result.kvo, signal: result.signal };
  },

  ultimateOsc: (klines, params) => {
    const result = calculateUltimateOscillator(
      klines,
      num(params['shortPeriod'], 7),
      num(params['midPeriod'], 14),
      num(params['longPeriod'], 28),
    );
    return { value: result.values };
  },

  vortex: (klines, params) => {
    const result = calculateVortex(klines, num(params['period'], 14));
    return { viPlus: result.viPlus, viMinus: result.viMinus };
  },

  dailyVwap: (klines) => ({ value: calculateIntradayVWAP(klines) }),

  weeklyVwap: (klines) => ({ value: calculateWeeklyVWAP(klines) }),

  ichimoku: (klines, params) => {
    const result = calculateIchimoku(
      klines,
      num(params['tenkanPeriod'], 9),
      num(params['kijunPeriod'], 26),
      num(params['senkouPeriod'], 52),
      num(params['kijunPeriod'], 26),
    );
    return {
      tenkan: result.tenkan,
      kijun: result.kijun,
      senkouA: result.senkouA,
      senkouB: result.senkouB,
      chikou: result.chikou,
    };
  },

  pivotPoints: (klines, params) => {
    const config = {
      lookback: num(params['lookback'], 5),
      lookahead: num(params['lookahead'], 2),
      volumeLookback: num(params['volumeLookback'], 20),
    };
    const len = klines.length;
    const pivotHigh: (number | null)[] = new Array(len).fill(null);
    const pivotLow: (number | null)[] = new Array(len).fill(null);
    for (const p of findEnhancedPivotHighs(klines, config)) {
      pivotHigh[p.index] = p.price;
    }
    for (const p of findEnhancedPivotLows(klines, config)) {
      pivotLow[p.index] = p.price;
    }
    return { pivotHigh, pivotLow };
  },

  volumeProfile: (klines) => ({ rendered: new Array(klines.length).fill(null) }),
};

export const hasNativeEvaluator = (scriptId: string): boolean =>
  Object.prototype.hasOwnProperty.call(NATIVE_EVALUATORS, scriptId);

export const getNativeEvaluator = (scriptId: string): NativeEvaluator | undefined =>
  NATIVE_EVALUATORS[scriptId];
