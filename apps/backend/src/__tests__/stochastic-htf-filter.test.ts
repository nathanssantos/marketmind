import type { Kline } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import {
  STOCHASTIC_HTF_MAPPING,
  checkStochasticHtfCondition,
  checkStochasticRecoveryHtfCondition,
  findHtfKlineIndex,
  getOneStepAboveTimeframe,
} from '../utils/filters';
import { STOCHASTIC_FILTER } from '../utils/filters';

const createKline = (open: number, high: number, low: number, close: number, index: number, baseTime = 0): Kline => ({
  openTime: baseTime + index * 7200000,
  open: String(open),
  high: String(high),
  low: String(low),
  close: String(close),
  volume: '1000',
  closeTime: baseTime + (index + 1) * 7200000 - 1,
  quoteVolume: '10000',
  trades: 100,
  takerBuyBaseVolume: '500',
  takerBuyQuoteVolume: '5000',
});

const MIN_KLINES = STOCHASTIC_FILTER.K_PERIOD + STOCHASTIC_FILTER.K_SMOOTHING + STOCHASTIC_FILTER.D_PERIOD + 20;

const createKlinesForScenario = (scenario: 'oversold' | 'overbought' | 'neutral', baseTime = 0): Kline[] => {
  const klines: Kline[] = [];
  let price = 100;

  for (let i = 0; i < MIN_KLINES; i += 1) {
    let change: number;

    switch (scenario) {
      case 'oversold':
        if (i < MIN_KLINES / 2) {
          change = (i % 2 === 0) ? 1.2 : -0.3;
        } else {
          change = -1.8;
        }
        break;
      case 'overbought':
        if (i < MIN_KLINES / 2) {
          change = (i % 2 === 0) ? -1.2 : 0.3;
        } else {
          change = 1.8;
        }
        break;
      case 'neutral':
      default:
        change = (i % 2 === 0) ? 0.8 : -0.8;
        break;
    }

    const open = price;
    price = Math.max(price + change, 10);
    const close = price;
    const high = Math.max(open, close) + 0.3;
    const low = Math.min(open, close) - 0.3;

    klines.push(createKline(open, high, low, close, i, baseTime));
  }

  return klines;
};

describe('STOCHASTIC_HTF_MAPPING', () => {
  it('should map each timeframe to one step above', () => {
    expect(STOCHASTIC_HTF_MAPPING['1m']).toBe('3m');
    expect(STOCHASTIC_HTF_MAPPING['3m']).toBe('5m');
    expect(STOCHASTIC_HTF_MAPPING['5m']).toBe('15m');
    expect(STOCHASTIC_HTF_MAPPING['15m']).toBe('30m');
    expect(STOCHASTIC_HTF_MAPPING['30m']).toBe('1h');
    expect(STOCHASTIC_HTF_MAPPING['1h']).toBe('2h');
    expect(STOCHASTIC_HTF_MAPPING['2h']).toBe('4h');
    expect(STOCHASTIC_HTF_MAPPING['4h']).toBe('6h');
    expect(STOCHASTIC_HTF_MAPPING['6h']).toBe('8h');
    expect(STOCHASTIC_HTF_MAPPING['8h']).toBe('12h');
    expect(STOCHASTIC_HTF_MAPPING['12h']).toBe('1d');
    expect(STOCHASTIC_HTF_MAPPING['1d']).toBe('3d');
    expect(STOCHASTIC_HTF_MAPPING['3d']).toBe('1w');
    expect(STOCHASTIC_HTF_MAPPING['1w']).toBe('1M');
  });
});

describe('getOneStepAboveTimeframe', () => {
  it('should return the HTF for known intervals', () => {
    expect(getOneStepAboveTimeframe('1h')).toBe('2h');
    expect(getOneStepAboveTimeframe('4h')).toBe('6h');
    expect(getOneStepAboveTimeframe('1d')).toBe('3d');
  });

  it('should return null for unknown intervals', () => {
    expect(getOneStepAboveTimeframe('1M')).toBeNull();
    expect(getOneStepAboveTimeframe('2w')).toBeNull();
    expect(getOneStepAboveTimeframe('unknown')).toBeNull();
  });
});

describe('findHtfKlineIndex', () => {
  const baseTime = 1000000;
  const klines = [
    createKline(100, 105, 95, 102, 0, baseTime),
    createKline(102, 108, 98, 106, 1, baseTime),
    createKline(106, 112, 100, 110, 2, baseTime),
    createKline(110, 115, 105, 112, 3, baseTime),
  ];

  it('should return index of kline at exact timestamp', () => {
    const index = findHtfKlineIndex(klines, baseTime);
    expect(index).toBe(0);
  });

  it('should return latest kline before timestamp', () => {
    const midTime = baseTime + 1.5 * 7200000;
    const index = findHtfKlineIndex(klines, midTime);
    expect(index).toBe(1);
  });

  it('should return last kline when timestamp is after all klines', () => {
    const futureTime = baseTime + 100 * 7200000;
    const index = findHtfKlineIndex(klines, futureTime);
    expect(index).toBe(3);
  });

  it('should return -1 when timestamp is before all klines', () => {
    const pastTime = baseTime - 7200000;
    const index = findHtfKlineIndex(klines, pastTime);
    expect(index).toBe(-1);
  });

  it('should return -1 for empty array', () => {
    const index = findHtfKlineIndex([], 1000000);
    expect(index).toBe(-1);
  });
});

describe('checkStochasticHtfCondition', () => {
  it('should soft pass when no HTF kline found for timestamp', () => {
    const klines = createKlinesForScenario('oversold', 1000000);
    const result = checkStochasticHtfCondition(klines, 0, 'LONG');

    expect(result.isAllowed).toBe(true);
    expect(result.currentK).toBeNull();
    expect(result.reason).toContain('HTF kline not found');
    expect(result.reason).toContain('soft pass');
  });

  it('should delegate to checkStochasticCondition with sliced klines', () => {
    const klines = createKlinesForScenario('oversold');
    const lastKlineTime = klines[klines.length - 1]!.openTime;
    const result = checkStochasticHtfCondition(klines, lastKlineTime, 'LONG');

    expect(result.currentK).not.toBeNull();
    expect(result.isOversold).toBe(true);
    expect(result.isAllowed).toBe(true);
  });

  it('should add (HTF) prefix to reason for allowed LONG', () => {
    const klines = createKlinesForScenario('oversold');
    const lastKlineTime = klines[klines.length - 1]!.openTime;
    const result = checkStochasticHtfCondition(klines, lastKlineTime, 'LONG');

    expect(result.reason).toContain('(HTF)');
    expect(result.reason).toContain('LONG allowed');
  });

  it('should add (HTF) prefix to reason for blocked LONG', () => {
    const klines = createKlinesForScenario('neutral');
    const lastKlineTime = klines[klines.length - 1]!.openTime;
    const result = checkStochasticHtfCondition(klines, lastKlineTime, 'LONG');

    expect(result.isAllowed).toBe(false);
    expect(result.reason).toContain('(HTF)');
    expect(result.reason).toContain('LONG blocked');
  });

  it('should allow SHORT when overbought on HTF', () => {
    const klines = createKlinesForScenario('overbought');
    const lastKlineTime = klines[klines.length - 1]!.openTime;
    const result = checkStochasticHtfCondition(klines, lastKlineTime, 'SHORT');

    expect(result.isAllowed).toBe(true);
    expect(result.isOverbought).toBe(true);
    expect(result.reason).toContain('(HTF)');
    expect(result.reason).toContain('SHORT allowed');
  });

  it('should block SHORT when neutral on HTF', () => {
    const klines = createKlinesForScenario('neutral');
    const lastKlineTime = klines[klines.length - 1]!.openTime;
    const result = checkStochasticHtfCondition(klines, lastKlineTime, 'SHORT');

    expect(result.isAllowed).toBe(false);
    expect(result.reason).toContain('(HTF)');
    expect(result.reason).toContain('SHORT blocked');
  });

  it('should only use klines up to the setup timestamp', () => {
    const klines = createKlinesForScenario('oversold');
    const midIndex = Math.floor(klines.length / 2);
    const midTime = klines[midIndex]!.openTime;

    const resultMid = checkStochasticHtfCondition(klines, midTime, 'LONG');
    const resultFull = checkStochasticHtfCondition(klines, klines[klines.length - 1]!.openTime, 'LONG');

    expect(resultMid.currentK).not.toBe(resultFull.currentK);
  });

  it('should soft pass with insufficient sliced klines', () => {
    const klines = createKlinesForScenario('oversold');
    const earlyTime = klines[3]!.openTime;
    const result = checkStochasticHtfCondition(klines, earlyTime, 'LONG');

    expect(result.isAllowed).toBe(true);
    if (result.currentK === null) {
      expect(result.reason).toContain('Insufficient');
    }
  });
});

describe('checkStochasticRecoveryHtfCondition', () => {
  it('should soft pass when no HTF kline found for timestamp', () => {
    const klines = createKlinesForScenario('oversold', 1000000);
    const result = checkStochasticRecoveryHtfCondition(klines, 0, 'LONG');

    expect(result.isAllowed).toBe(true);
    expect(result.currentK).toBeNull();
    expect(result.reason).toContain('HTF kline not found');
    expect(result.reason).toContain('soft pass');
  });

  it('should delegate to checkStochasticRecoveryCondition with sliced klines', () => {
    const klines = createKlinesForScenario('oversold');
    const lastKlineTime = klines[klines.length - 1]!.openTime;
    const result = checkStochasticRecoveryHtfCondition(klines, lastKlineTime, 'LONG');

    expect(result.currentK).not.toBeNull();
    expect(result).toHaveProperty('isAllowed');
    expect(result).toHaveProperty('reason');
  });

  it('should add (HTF) prefix to reason when applicable', () => {
    const klines = createKlinesForScenario('neutral');
    const lastKlineTime = klines[klines.length - 1]!.openTime;
    const result = checkStochasticRecoveryHtfCondition(klines, lastKlineTime, 'LONG');

    if (result.reason.includes('LONG allowed') || result.reason.includes('LONG blocked')) {
      expect(result.reason).toContain('(HTF)');
    }
  });

  it('should return all required fields in result', () => {
    const klines = createKlinesForScenario('neutral');
    const lastKlineTime = klines[klines.length - 1]!.openTime;
    const result = checkStochasticRecoveryHtfCondition(klines, lastKlineTime, 'LONG');

    expect(result).toHaveProperty('isAllowed');
    expect(result).toHaveProperty('currentK');
    expect(result).toHaveProperty('currentD');
    expect(result).toHaveProperty('isOversold');
    expect(result).toHaveProperty('isOverbought');
    expect(result).toHaveProperty('reason');
  });

  it('should handle SHORT direction', () => {
    const klines = createKlinesForScenario('overbought');
    const lastKlineTime = klines[klines.length - 1]!.openTime;
    const result = checkStochasticRecoveryHtfCondition(klines, lastKlineTime, 'SHORT');

    expect(result).toHaveProperty('isAllowed');
    expect(result.currentK).not.toBeNull();
  });
});
