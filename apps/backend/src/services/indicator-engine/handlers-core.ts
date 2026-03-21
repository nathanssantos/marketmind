import type { ComputedIndicator, Kline } from '@marketmind/types';

import {
  calculateADX,
  calculateAO,
  calculateAroon,
  calculateATR,
  calculateBollingerBandsArray,
  calculateCCI,
  calculateCMF,
  calculateCMO,
  calculateCumulativeRSI,
  calculateDEMA,
  calculateDMI,
  calculateDonchian,
  calculateEMA,
  calculateHalvingCycle,
  calculateHMA,
  calculateIBS,
  calculateIchimoku,
  calculateKeltner,
  calculateMACD,
  calculateMFI,
  calculateNDayHighLow,
  calculateNR7,
  calculateOBV,
  calculatePercentBSeries,
  calculateROC,
  calculateRSI,
  calculateSMA,
  calculateStochastic,
  calculateStochRSI,
  calculateSupertrend,
  calculateTEMA,
  calculateVWAP,
  calculateWilliamsR,
  calculateWMA,
  findPivotPoints,
} from '@marketmind/indicators';

import { toNumber } from './types';

type Handler = (klines: Kline[], resolvedParams: Record<string, number | string>) => ComputedIndicator;

export const CORE_HANDLERS: Record<string, Handler> = {
  sma: (klines, resolvedParams) => ({
    type: 'sma',
    values: calculateSMA(klines, toNumber(resolvedParams['period'], 20)),
  }),

  ema: (klines, resolvedParams) => ({
    type: 'ema',
    values: calculateEMA(klines, toNumber(resolvedParams['period'], 20)),
  }),

  rsi: (klines, resolvedParams) => {
    const rsiResult = calculateRSI(klines, toNumber(resolvedParams['period'], 14));
    return { type: 'rsi', values: rsiResult.values };
  },

  macd: (klines, resolvedParams) => {
    const macdResult = calculateMACD(
      klines,
      toNumber(resolvedParams['fastPeriod'], 12),
      toNumber(resolvedParams['slowPeriod'], 26),
      toNumber(resolvedParams['signalPeriod'], 9)
    );
    return {
      type: 'macd',
      values: { macd: macdResult.macd, signal: macdResult.signal, histogram: macdResult.histogram },
    };
  },

  bollingerBands: (klines, resolvedParams) => {
    const bbResult = calculateBollingerBandsArray(
      klines,
      toNumber(resolvedParams['period'], 20),
      toNumber(resolvedParams['stdDev'], 2)
    );
    return {
      type: 'bollingerBands',
      values: {
        upper: bbResult.map((b) => b?.upper ?? null),
        middle: bbResult.map((b) => b?.middle ?? null),
        lower: bbResult.map((b) => b?.lower ?? null),
      },
    };
  },

  atr: (klines, resolvedParams) => {
    const atrResult = calculateATR(klines, toNumber(resolvedParams['period'], 14));
    return { type: 'atr', values: atrResult.map((v) => (isNaN(v) ? null : v)) };
  },

  stochastic: (klines, resolvedParams) => {
    const stochResult = calculateStochastic(
      klines,
      toNumber(resolvedParams['kPeriod'], 14),
      toNumber(resolvedParams['kSmoothing'], 3),
      toNumber(resolvedParams['dPeriod'], 3)
    );
    return { type: 'stochastic', values: { k: stochResult.k, d: stochResult.d } };
  },

  stochRsi: (klines, resolvedParams) => {
    const stochRsiResult = calculateStochRSI(
      klines,
      toNumber(resolvedParams['rsiPeriod'], 14),
      toNumber(resolvedParams['stochPeriod'], 14),
      toNumber(resolvedParams['kSmooth'], 3),
      toNumber(resolvedParams['dSmooth'], 3)
    );
    return { type: 'stochRsi', values: { k: stochRsiResult.k, d: stochRsiResult.d } };
  },

  ichimoku: (klines, resolvedParams) => {
    const ichimokuResult = calculateIchimoku(
      klines,
      toNumber(resolvedParams['tenkanPeriod'], 9),
      toNumber(resolvedParams['kijunPeriod'], 26),
      toNumber(resolvedParams['senkouBPeriod'], 52),
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

  halvingCycle: (klines) => {
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

  vwap: (klines) => ({ type: 'vwap', values: calculateVWAP(klines) }),

  pivotPoints: (klines, resolvedParams) => {
    const pivots = findPivotPoints(klines, toNumber(resolvedParams['lookback'], 5));
    const pivotValues: (number | null)[] = new Array(klines.length).fill(null);
    for (const pivot of pivots) {
      if (pivot.index >= 0 && pivot.index < pivotValues.length) pivotValues[pivot.index] = pivot.price;
    }
    return { type: 'pivotPoints', values: pivotValues };
  },

  adx: (klines, resolvedParams) => {
    const adxResult = calculateADX(klines, toNumber(resolvedParams['period'], 14));
    return { type: 'adx', values: { adx: adxResult.adx, plusDI: adxResult.plusDI, minusDI: adxResult.minusDI } };
  },

  obv: (klines, resolvedParams) => {
    const smaPeriod = resolvedParams['smaPeriod'];
    const obvResult = calculateOBV(klines, typeof smaPeriod === 'number' ? smaPeriod : undefined);
    return { type: 'obv', values: { obv: obvResult.values, sma: obvResult.sma } };
  },

  williamsR: (klines, resolvedParams) => ({
    type: 'williamsR',
    values: calculateWilliamsR(klines, toNumber(resolvedParams['period'], 14)),
  }),

  cci: (klines, resolvedParams) => ({
    type: 'cci',
    values: calculateCCI(klines, toNumber(resolvedParams['period'], 20)),
  }),

  mfi: (klines, resolvedParams) => ({
    type: 'mfi',
    values: calculateMFI(klines, toNumber(resolvedParams['period'], 14)),
  }),

  donchian: (klines, resolvedParams) => {
    const donchianResult = calculateDonchian(klines, toNumber(resolvedParams['period'], 20));
    return { type: 'donchian', values: { upper: donchianResult.upper, middle: donchianResult.middle, lower: donchianResult.lower } };
  },

  keltner: (klines, resolvedParams) => {
    const keltnerResult = calculateKeltner(
      klines,
      toNumber(resolvedParams['emaPeriod'], 20),
      toNumber(resolvedParams['atrPeriod'], 10),
      toNumber(resolvedParams['multiplier'], 2)
    );
    return { type: 'keltner', values: { upper: keltnerResult.upper, middle: keltnerResult.middle, lower: keltnerResult.lower } };
  },

  supertrend: (klines, resolvedParams) => {
    const supertrendResult = calculateSupertrend(
      klines,
      toNumber(resolvedParams['period'], 10),
      toNumber(resolvedParams['multiplier'], 3)
    );
    return {
      type: 'supertrend',
      values: {
        trend: supertrendResult.trend.map((t) => (t === 'up' ? 1 : t === 'down' ? -1 : null)),
        value: supertrendResult.value,
      },
    };
  },

  ibs: (klines) => ({ type: 'ibs', values: calculateIBS(klines).values }),

  percentB: (klines, resolvedParams) => ({
    type: 'percentB',
    values: calculatePercentBSeries(klines, toNumber(resolvedParams['period'], 20), toNumber(resolvedParams['stdDev'], 2)).values,
  }),

  cumulativeRsi: (klines, resolvedParams) => {
    const cumulativeRsiResult = calculateCumulativeRSI(
      klines,
      toNumber(resolvedParams['rsiPeriod'], 2),
      toNumber(resolvedParams['sumPeriod'], 2)
    );
    return { type: 'cumulativeRsi', values: { cumulative: cumulativeRsiResult.values, rsi: cumulativeRsiResult.rsiValues } };
  },

  nDayHighLow: (klines, resolvedParams) => {
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

  nr7: (klines, resolvedParams) => ({
    type: 'nr7',
    values: calculateNR7(klines, toNumber(resolvedParams['lookback'], 7)).isNR7.map((v) => (v ? 1 : 0)),
  }),

  roc: (klines, resolvedParams) => ({ type: 'roc', values: calculateROC(klines, toNumber(resolvedParams['period'], 12)).values }),

  dema: (klines, resolvedParams) => ({ type: 'dema', values: calculateDEMA(klines, toNumber(resolvedParams['period'], 20)).values }),

  tema: (klines, resolvedParams) => ({ type: 'tema', values: calculateTEMA(klines, toNumber(resolvedParams['period'], 20)).values }),

  wma: (klines, resolvedParams) => ({ type: 'wma', values: calculateWMA(klines, toNumber(resolvedParams['period'], 20)).values }),

  hma: (klines, resolvedParams) => ({ type: 'hma', values: calculateHMA(klines, toNumber(resolvedParams['period'], 20)).values }),

  cmo: (klines, resolvedParams) => ({ type: 'cmo', values: calculateCMO(klines, toNumber(resolvedParams['period'], 14)).values }),

  ao: (klines, resolvedParams) => ({
    type: 'ao',
    values: calculateAO(klines, toNumber(resolvedParams['fastPeriod'], 5), toNumber(resolvedParams['slowPeriod'], 34)).values,
  }),

  aroon: (klines, resolvedParams) => {
    const aroonResult = calculateAroon(klines, toNumber(resolvedParams['period'], 25));
    return { type: 'aroon', values: { up: aroonResult.aroonUp, down: aroonResult.aroonDown, oscillator: aroonResult.oscillator } };
  },

  dmi: (klines, resolvedParams) => {
    const dmiResult = calculateDMI(klines, toNumber(resolvedParams['period'], 14));
    return { type: 'dmi', values: { plusDI: dmiResult.plusDI, minusDI: dmiResult.minusDI, dx: dmiResult.dx } };
  },

  cmf: (klines, resolvedParams) => ({ type: 'cmf', values: calculateCMF(klines, toNumber(resolvedParams['period'], 20)).values }),
};
