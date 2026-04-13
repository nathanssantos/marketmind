import type { ComputedIndicator, Kline } from '@marketmind/types';

import {
  calculateDeltaVolume,
  calculateElderRay,
  calculateFibonacciRetracement,
  calculateFloorPivotSeries,
  calculateFVG,
  calculateGaps,
  calculateKlinger,
  calculateLiquidityLevels,
  calculateMassIndex,
  calculatePPO,
  calculateSwingPoints,
  calculateUltimateOscillator,
  calculateVortex,
  type FairValueGap,
} from '../../lib/indicators';

import { PineIndicatorService } from '../pine/PineIndicatorService';
import { calculateHighest, calculateLowest } from './indicator-utils';
import { toNumber } from './types';

const pineService = new PineIndicatorService();

type Handler = (klines: Kline[], resolvedParams: Record<string, number | string>) => Promise<ComputedIndicator>;

export const ADVANCED_HANDLERS: Record<string, Handler> = {
  ppo: async (klines, resolvedParams) => {
    const ppoResult = calculatePPO(klines, toNumber(resolvedParams['fastPeriod'], 12), toNumber(resolvedParams['slowPeriod'], 26), toNumber(resolvedParams['signalPeriod'], 9));
    return { type: 'ppo', values: { ppo: ppoResult.ppo, signal: ppoResult.signal, histogram: ppoResult.histogram } };
  },

  tsi: async (klines, resolvedParams) => {
    const tsiValues = await pineService.compute('tsi', klines, {
      shortPeriod: toNumber(resolvedParams['shortPeriod'], 13),
      longPeriod: toNumber(resolvedParams['longPeriod'], 25),
    });
    const signalPeriod = toNumber(resolvedParams['signalPeriod'], 13);
    const signal: (number | null)[] = [];
    let count = 0;
    let sum = 0;
    let lastSignal: number | null = null;
    for (let i = 0; i < tsiValues.length; i++) {
      const v = tsiValues[i];
      if (v === null || v === undefined) { signal.push(null); continue; }
      count++;
      if (count <= signalPeriod) {
        sum += v;
        if (count === signalPeriod) {
          lastSignal = sum / signalPeriod;
          signal.push(lastSignal);
        } else {
          signal.push(null);
        }
      } else {
        const k = 2 / (signalPeriod + 1);
        lastSignal = lastSignal !== null ? lastSignal + k * (v - lastSignal) : v;
        signal.push(lastSignal);
      }
    }
    return { type: 'tsi', values: { tsi: tsiValues, signal } };
  },

  ultimateOscillator: async (klines, resolvedParams) => ({
    type: 'ultimateOscillator',
    values: calculateUltimateOscillator(klines, toNumber(resolvedParams['period1'], 7), toNumber(resolvedParams['period2'], 14), toNumber(resolvedParams['period3'], 28)).values,
  }),

  vortex: async (klines, resolvedParams) => {
    const vortexResult = calculateVortex(klines, toNumber(resolvedParams['period'], 14));
    return { type: 'vortex', values: { viPlus: vortexResult.viPlus, viMinus: vortexResult.viMinus } };
  },

  parabolicSar: async (klines, resolvedParams) => {
    const sarValues = await pineService.compute('sar', klines, {
      start: toNumber(resolvedParams['step'], 0.02),
      increment: toNumber(resolvedParams['step'], 0.02),
      max: toNumber(resolvedParams['max'], 0.2),
    });
    const closes = klines.map((k) => parseFloat(k.close));
    const trend = sarValues.map((sar, i) => {
      if (sar === null) return null;
      return sar < closes[i]! ? 1 : -1;
    });
    return { type: 'parabolicSar', values: { sar: sarValues, trend } };
  },

  massIndex: async (klines, resolvedParams) => ({
    type: 'massIndex',
    values: calculateMassIndex(klines, toNumber(resolvedParams['emaPeriod'], 9), toNumber(resolvedParams['sumPeriod'], 25)).values,
  }),

  klinger: async (klines, resolvedParams) => {
    const klingerResult = calculateKlinger(klines, toNumber(resolvedParams['shortPeriod'], 34), toNumber(resolvedParams['longPeriod'], 55), toNumber(resolvedParams['signalPeriod'], 13));
    return { type: 'klinger', values: { kvo: klingerResult.kvo, signal: klingerResult.signal } };
  },

  elderRay: async (klines, resolvedParams) => {
    const elderResult = calculateElderRay(klines, toNumber(resolvedParams['period'], 13));
    return { type: 'elderRay', values: { bullPower: elderResult.bullPower, bearPower: elderResult.bearPower } };
  },

  deltaVolume: async (klines) => {
    const deltaResult = calculateDeltaVolume(klines);
    return { type: 'deltaVolume', values: { delta: deltaResult.delta, cumulative: deltaResult.cumulativeDelta } };
  },

  swingPoints: async (klines, resolvedParams) => {
    const swingResult = calculateSwingPoints(klines, toNumber(resolvedParams['lookback'], 5));
    return { type: 'swingPoints', values: { high: swingResult.swingHighs, low: swingResult.swingLows } };
  },

  fvg: async (klines) => {
    const fvgResult = calculateFVG(klines);
    const bullish: (number | null)[] = new Array(klines.length).fill(null);
    const bearish: (number | null)[] = new Array(klines.length).fill(null);
    const bullishTop: (number | null)[] = new Array(klines.length).fill(null);
    const bullishBottom: (number | null)[] = new Array(klines.length).fill(null);
    const bearishTop: (number | null)[] = new Array(klines.length).fill(null);
    const bearishBottom: (number | null)[] = new Array(klines.length).fill(null);

    const fillAt: number[] = new Array(fvgResult.gaps.length).fill(Infinity);
    for (let g = 0; g < fvgResult.gaps.length; g++) {
      const gap = fvgResult.gaps[g]!;
      for (let j = gap.index + 2; j < klines.length; j++) {
        const k = klines[j]!;
        const low = parseFloat(k.low);
        const high = parseFloat(k.high);
        if (gap.type === 'bullish' && low <= gap.low) { fillAt[g] = j; break; }
        if (gap.type === 'bearish' && high >= gap.high) { fillAt[g] = j; break; }
      }
    }

    const bullishGaps: Array<{ gap: FairValueGap; fillIdx: number }> = [];
    const bearishGaps: Array<{ gap: FairValueGap; fillIdx: number }> = [];
    for (let g = 0; g < fvgResult.gaps.length; g++) {
      const gap = fvgResult.gaps[g]!;
      const entry = { gap, fillIdx: fillAt[g]! };
      if (gap.type === 'bullish') bullishGaps.push(entry);
      else bearishGaps.push(entry);
    }

    let bPtr = 0;
    let rPtr = 0;
    const bStack: Array<{ gap: FairValueGap; fillIdx: number }> = [];
    const rStack: Array<{ gap: FairValueGap; fillIdx: number }> = [];

    for (let i = 0; i < klines.length; i++) {
      while (bPtr < bullishGaps.length && bullishGaps[bPtr]!.gap.index < i) bStack.push(bullishGaps[bPtr++]!);
      while (rPtr < bearishGaps.length && bearishGaps[rPtr]!.gap.index < i) rStack.push(bearishGaps[rPtr++]!);

      while (bStack.length > 0 && bStack[bStack.length - 1]!.fillIdx <= i) bStack.pop();
      while (rStack.length > 0 && rStack[rStack.length - 1]!.fillIdx <= i) rStack.pop();

      const latestBullish = bStack.length > 0 ? bStack[bStack.length - 1]!.gap : null;
      const latestBearish = rStack.length > 0 ? rStack[rStack.length - 1]!.gap : null;

      if (latestBullish) {
        bullish[i] = 1;
        bullishTop[i] = latestBullish.high;
        bullishBottom[i] = latestBullish.low;
      }
      if (latestBearish) {
        bearish[i] = 1;
        bearishTop[i] = latestBearish.high;
        bearishBottom[i] = latestBearish.low;
      }
    }

    return {
      type: 'fvg',
      values: { bullish, bearish, bullishTop, bullishBottom, bearishTop, bearishBottom },
    };
  },

  gapDetection: async (klines, resolvedParams) => {
    const gapsResult = calculateGaps(klines, toNumber(resolvedParams['threshold'], 0.5));
    const gapValues: (number | null)[] = new Array(klines.length).fill(null);
    for (const gap of gapsResult.gaps) {
      if (gap.index >= 0 && gap.index < gapValues.length) gapValues[gap.index] = gap.type === 'up' ? 1 : -1;
    }
    return { type: 'gapDetection', values: gapValues };
  },

  fibonacci: async (klines) => {
    const highs = klines.map((k) => parseFloat(k.high));
    const lows = klines.map((k) => parseFloat(k.low));
    const highPrice = Math.max(...highs.filter((h) => !isNaN(h)));
    const lowPrice = Math.min(...lows.filter((l) => !isNaN(l)));
    const fibLevels = calculateFibonacciRetracement(highPrice, lowPrice);
    const getLevel = (targetLevel: number) => fibLevels.find((l) => l.level === targetLevel)?.price ?? null;
    return {
      type: 'fibonacci',
      values: {
        level236: Array(klines.length).fill(getLevel(0.236)),
        level382: Array(klines.length).fill(getLevel(0.382)),
        level500: Array(klines.length).fill(getLevel(0.5)),
        level618: Array(klines.length).fill(getLevel(0.618)),
        level786: Array(klines.length).fill(getLevel(0.786)),
      },
    };
  },

  floorPivots: async (klines, resolvedParams) => {
    const highs = klines.map((k) => parseFloat(k.high));
    const lows = klines.map((k) => parseFloat(k.low));
    const closes = klines.map((k) => parseFloat(k.close));
    const pivotTypeParam = resolvedParams['pivotType'];
    const validTypes = ['standard', 'fibonacci', 'woodie', 'camarilla', 'demark'] as const;
    const pivotType = typeof pivotTypeParam === 'string' && validTypes.includes(pivotTypeParam as typeof validTypes[number])
      ? (pivotTypeParam as typeof validTypes[number])
      : 'standard';
    const floorResult = calculateFloorPivotSeries(highs, lows, closes, undefined, pivotType);
    return {
      type: 'floorPivots',
      values: {
        pivot: floorResult.pivot,
        r1: floorResult.r1,
        r2: floorResult.r2,
        r3: floorResult.r3,
        s1: floorResult.s1,
        s2: floorResult.s2,
        s3: floorResult.s3,
      },
    };
  },

  liquidityLevels: async (klines, resolvedParams) => {
    const highs = klines.map((k) => parseFloat(k.high));
    const lows = klines.map((k) => parseFloat(k.low));
    const closes = klines.map((k) => parseFloat(k.close));
    const liquidityResult = calculateLiquidityLevels(highs, lows, closes, {
      lookback: toNumber(resolvedParams['lookback'], 50),
      minTouches: toNumber(resolvedParams['minTouches'], 2),
    });
    const supportValues: (number | null)[] = new Array(klines.length).fill(null);
    const resistanceValues: (number | null)[] = new Array(klines.length).fill(null);
    for (const level of liquidityResult) {
      if (level.lastIndex >= 0 && level.lastIndex < klines.length) {
        if (level.type === 'support') supportValues[level.lastIndex] = level.price;
        else resistanceValues[level.lastIndex] = level.price;
      }
    }
    return { type: 'liquidityLevels', values: { support: supportValues, resistance: resistanceValues } };
  },

  fundingRate: async (klines) => ({ type: 'fundingRate', values: new Array(klines.length).fill(null) }),
  openInterest: async (klines) => ({ type: 'openInterest', values: new Array(klines.length).fill(null) }),
  liquidations: async (klines) => ({ type: 'liquidations', values: new Array(klines.length).fill(null) }),
  btcDominance: async (klines) => ({ type: 'btcDominance', values: new Array(klines.length).fill(null) }),
  relativeStrength: async (klines) => ({ type: 'relativeStrength', values: new Array(klines.length).fill(null) }),

  highest: async (klines, resolvedParams) => {
    const period = toNumber(resolvedParams['period'], 20);
    const sourceParam = resolvedParams['source'];
    const source = typeof sourceParam === 'string' ? sourceParam : 'high';
    if (source === 'high') {
      return { type: 'highest', values: await pineService.compute('highest', klines, { period }) };
    }
    return { type: 'highest', values: calculateHighest(klines, period, source) };
  },

  lowest: async (klines, resolvedParams) => {
    const period = toNumber(resolvedParams['period'], 20);
    const sourceParam = resolvedParams['source'];
    const source = typeof sourceParam === 'string' ? sourceParam : 'low';
    if (source === 'low') {
      return { type: 'lowest', values: await pineService.compute('lowest', klines, { period }) };
    }
    return { type: 'lowest', values: calculateLowest(klines, period, source) };
  },
};
