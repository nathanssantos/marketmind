import type { ComputedIndicator, Kline } from '@marketmind/types';

import {
  calculateAO,
  calculateAroon,
  calculateCMF,
  calculateCumulativeRSI,
  calculateDEMA,
  calculateDMI,
  calculateDonchian,
  calculateHalvingCycle,
  calculateIBS,
  calculateIchimoku,
  calculateNDayHighLow,
  calculateNR7,
  calculatePercentBSeries,
  calculateStochRSI,
  calculateTEMA,
  findPivotPoints,
} from '../../lib/indicators';

import { PineIndicatorService } from '../pine/PineIndicatorService';
import { toNumber } from './types';

const pineService = new PineIndicatorService();

type Handler = (klines: Kline[], resolvedParams: Record<string, number | string>) => Promise<ComputedIndicator>;

export const CORE_HANDLERS: Record<string, Handler> = {
  sma: async (klines, resolvedParams) => ({
    type: 'sma',
    values: await pineService.compute('sma', klines, { period: toNumber(resolvedParams['period'], 20) }),
  }),

  ema: async (klines, resolvedParams) => ({
    type: 'ema',
    values: await pineService.compute('ema', klines, { period: toNumber(resolvedParams['period'], 20) }),
  }),

  rsi: async (klines, resolvedParams) => ({
    type: 'rsi',
    values: await pineService.compute('rsi', klines, { period: toNumber(resolvedParams['period'], 14) }),
  }),

  macd: async (klines, resolvedParams) => {
    const result = await pineService.computeMulti('macd', klines, {
      fastPeriod: toNumber(resolvedParams['fastPeriod'], 12),
      slowPeriod: toNumber(resolvedParams['slowPeriod'], 26),
      signalPeriod: toNumber(resolvedParams['signalPeriod'], 9),
    });
    return {
      type: 'macd',
      values: { macd: result['line'] ?? [], signal: result['signal'] ?? [], histogram: result['histogram'] ?? [] },
    };
  },

  bollingerBands: async (klines, resolvedParams) => {
    const result = await pineService.computeMulti('bb', klines, {
      period: toNumber(resolvedParams['period'], 20),
      stdDev: toNumber(resolvedParams['stdDev'], 2),
    });
    return {
      type: 'bollingerBands',
      values: { upper: result['upper'] ?? [], middle: result['middle'] ?? [], lower: result['lower'] ?? [] },
    };
  },

  atr: async (klines, resolvedParams) => ({
    type: 'atr',
    values: await pineService.compute('atr', klines, { period: toNumber(resolvedParams['period'], 14) }),
  }),

  stochastic: async (klines, resolvedParams) => {
    const result = await pineService.computeMulti('stoch', klines, {
      period: toNumber(resolvedParams['period'], 14),
      smoothK: toNumber(resolvedParams['smoothK'], 3),
      smoothD: toNumber(resolvedParams['smoothD'], 3),
    });
    return { type: 'stochastic', values: { k: result['k'] ?? [], d: result['d'] ?? [] } };
  },

  stochRsi: async (klines, resolvedParams) => {
    const stochRsiResult = calculateStochRSI(
      klines,
      toNumber(resolvedParams['rsiPeriod'], 14),
      toNumber(resolvedParams['stochPeriod'], 14),
      toNumber(resolvedParams['kPeriod'], 3),
      toNumber(resolvedParams['dPeriod'], 3)
    );
    return { type: 'stochRsi', values: { k: stochRsiResult.k, d: stochRsiResult.d } };
  },

  ichimoku: async (klines, resolvedParams) => {
    const ichimokuResult = calculateIchimoku(
      klines,
      toNumber(resolvedParams['tenkanPeriod'], 9),
      toNumber(resolvedParams['kijunPeriod'], 26),
      toNumber(resolvedParams['senkouPeriod'], 52),
      toNumber(resolvedParams['displacement'], 26)
    );
    return {
      type: 'ichimoku',
      values: {
        tenkan: ichimokuResult.tenkan,
        kijun: ichimokuResult.kijun,
        senkouA: ichimokuResult.senkouA,
        senkouB: ichimokuResult.senkouB,
        chikou: ichimokuResult.chikou,
      },
    };
  },

  halvingCycle: async (klines) => {
    const halvingResult = calculateHalvingCycle(klines);
    return {
      type: 'halvingCycle',
      values: {
        phase: halvingResult.phase as unknown as (number | null)[],
        daysFromHalving: halvingResult.daysFromHalving,
        cycleProgress: halvingResult.cycleProgress,
      },
    };
  },

  vwap: async (klines) => ({ type: 'vwap', values: await pineService.compute('vwap', klines) }),

  pivotPoints: async (klines, resolvedParams) => {
    const pivots = findPivotPoints(klines, toNumber(resolvedParams['lookback'], 5));
    const pivotValues: (number | null)[] = new Array(klines.length).fill(null);
    for (const pivot of pivots) {
      if (pivot.index >= 0 && pivot.index < pivotValues.length) pivotValues[pivot.index] = pivot.price;
    }
    return { type: 'pivotPoints', values: pivotValues };
  },

  adx: async (klines, resolvedParams) => {
    const result = await pineService.computeMulti('dmi', klines, { period: toNumber(resolvedParams['period'], 14) });
    return { type: 'adx', values: { adx: result['adx'] ?? [], plusDI: result['plusDI'] ?? [], minusDI: result['minusDI'] ?? [] } };
  },

  obv: async (klines, resolvedParams) => {
    const obvValues = await pineService.compute('obv', klines);
    const smaPeriod = resolvedParams['smaPeriod'];
    let sma: (number | null)[] = [];
    if (typeof smaPeriod === 'number') {
      sma = await pineService.compute('sma', klines, { period: smaPeriod });
    }
    return { type: 'obv', values: { obv: obvValues, sma } };
  },

  williamsR: async (klines, resolvedParams) => ({
    type: 'williamsR',
    values: await pineService.compute('wpr', klines, { period: toNumber(resolvedParams['period'], 14) }),
  }),

  cci: async (klines, resolvedParams) => ({
    type: 'cci',
    values: await pineService.compute('cci', klines, { period: toNumber(resolvedParams['period'], 20) }),
  }),

  mfi: async (klines, resolvedParams) => ({
    type: 'mfi',
    values: await pineService.compute('mfi', klines, { period: toNumber(resolvedParams['period'], 14) }),
  }),

  donchian: async (klines, resolvedParams) => {
    const donchianResult = calculateDonchian(klines, toNumber(resolvedParams['period'], 20));
    return { type: 'donchian', values: { upper: donchianResult.upper, middle: donchianResult.middle, lower: donchianResult.lower } };
  },

  keltner: async (klines, resolvedParams) => {
    const result = await pineService.computeMulti('kc', klines, {
      period: toNumber(resolvedParams['period'], 20),
      multiplier: toNumber(resolvedParams['multiplier'], 2),
    });
    return { type: 'keltner', values: { upper: result['upper'] ?? [], middle: result['middle'] ?? [], lower: result['lower'] ?? [] } };
  },

  supertrend: async (klines, resolvedParams) => {
    const result = await pineService.computeMulti('supertrend', klines, {
      period: toNumber(resolvedParams['period'], 10),
      multiplier: toNumber(resolvedParams['multiplier'], 3),
    });
    return {
      type: 'supertrend',
      values: {
        trend: (result['direction'] ?? []).map((v) => (v === null ? null : v > 0 ? 1 : -1)),
        value: result['value'] ?? [],
      },
    };
  },

  ibs: async (klines) => ({ type: 'ibs', values: calculateIBS(klines).values }),

  percentB: async (klines, resolvedParams) => ({
    type: 'percentB',
    values: calculatePercentBSeries(klines, toNumber(resolvedParams['period'], 20), toNumber(resolvedParams['stdDev'], 2)).values,
  }),

  cumulativeRsi: async (klines, resolvedParams) => {
    const cumulativeRsiResult = calculateCumulativeRSI(
      klines,
      toNumber(resolvedParams['rsiPeriod'], 2),
      toNumber(resolvedParams['sumPeriod'], 2)
    );
    return { type: 'cumulativeRsi', values: { cumulative: cumulativeRsiResult.values, rsi: cumulativeRsiResult.rsiValues } };
  },

  nDayHighLow: async (klines, resolvedParams) => {
    const nDayResult = calculateNDayHighLow(klines, toNumber(resolvedParams['period'], 7));
    return {
      type: 'nDayHighLow',
      values: {
        isNDayHigh: nDayResult.isNDayHigh.map((v) => (v ? 1 : 0)),
        isNDayLow: nDayResult.isNDayLow.map((v) => (v ? 1 : 0)),
        highestClose: nDayResult.highestClose,
        lowestClose: nDayResult.lowestClose,
      },
    };
  },

  nr7: async (klines, resolvedParams) => ({
    type: 'nr7',
    values: calculateNR7(klines, toNumber(resolvedParams['lookback'], 7)).isNR7.map((v) => (v ? 1 : 0)),
  }),

  roc: async (klines, resolvedParams) => ({
    type: 'roc',
    values: await pineService.compute('roc', klines, { period: toNumber(resolvedParams['period'], 12) }),
  }),

  dema: async (klines, resolvedParams) => ({
    type: 'dema',
    values: calculateDEMA(klines, toNumber(resolvedParams['period'], 20)).values,
  }),

  tema: async (klines, resolvedParams) => ({
    type: 'tema',
    values: calculateTEMA(klines, toNumber(resolvedParams['period'], 20)).values,
  }),

  wma: async (klines, resolvedParams) => ({
    type: 'wma',
    values: await pineService.compute('wma', klines, { period: toNumber(resolvedParams['period'], 20) }),
  }),

  hma: async (klines, resolvedParams) => ({
    type: 'hma',
    values: await pineService.compute('hma', klines, { period: toNumber(resolvedParams['period'], 20) }),
  }),

  cmo: async (klines, resolvedParams) => ({
    type: 'cmo',
    values: await pineService.compute('cmo', klines, { period: toNumber(resolvedParams['period'], 14) }),
  }),

  ao: async (klines, resolvedParams) => ({
    type: 'ao',
    values: calculateAO(klines, toNumber(resolvedParams['fastPeriod'], 5), toNumber(resolvedParams['slowPeriod'], 34)).values,
  }),

  aroon: async (klines, resolvedParams) => {
    const aroonResult = calculateAroon(klines, toNumber(resolvedParams['period'], 25));
    return { type: 'aroon', values: { up: aroonResult.aroonUp, down: aroonResult.aroonDown, oscillator: aroonResult.oscillator } };
  },

  dmi: async (klines, resolvedParams) => {
    const dmiResult = calculateDMI(klines, toNumber(resolvedParams['period'], 14));
    return { type: 'dmi', values: { plusDI: dmiResult.plusDI, minusDI: dmiResult.minusDI, dx: dmiResult.dx } };
  },

  cmf: async (klines, resolvedParams) => {
    const cmfResult = calculateCMF(klines, toNumber(resolvedParams['period'], 20));
    return { type: 'cmf', values: cmfResult.values };
  },
};
