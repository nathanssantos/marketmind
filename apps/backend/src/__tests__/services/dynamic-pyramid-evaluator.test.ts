import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Kline } from '@marketmind/types';

vi.mock('@marketmind/indicators', () => ({
  calculateATR: vi.fn(),
  calculateADX: vi.fn(),
  calculateRSI: vi.fn(),
}));

import {
  evaluateDynamicConditions,
  prioritizePyramidCandidates,
  calculateLeverageAdjustedScaleFactor,
  calculateAtrAdjustedMinDistance,
  getCurrentIndicatorValues,
  type DynamicPyramidConfig,
  type PyramidCandidate,
} from '../../services/dynamic-pyramid-evaluator';
import { calculateATR, calculateADX, calculateRSI } from '@marketmind/indicators';

const mockedCalculateATR = vi.mocked(calculateATR);
const mockedCalculateADX = vi.mocked(calculateADX);
const mockedCalculateRSI = vi.mocked(calculateRSI);

const createKline = (close: number, high: number, low: number, index: number): Kline => ({
  openTime: Date.now() + index * 60000,
  open: String(close),
  high: String(high),
  low: String(low),
  close: String(close),
  volume: '1000',
  closeTime: Date.now() + (index + 1) * 60000 - 1,
  quoteVolume: '10000',
  trades: 100,
  takerBuyBaseVolume: '500',
  takerBuyQuoteVolume: '5000',
});

const createKlines = (count: number): Kline[] =>
  Array.from({ length: count }, (_, i) => createKline(100 + i, 101 + i, 99 + i, i));

const defaultConfig: DynamicPyramidConfig = {
  useAtr: true,
  useAdx: true,
  useRsi: false,
  adxThreshold: 25,
  rsiLowerBound: 40,
  rsiUpperBound: 60,
  baseMinDistance: 0.005,
  baseScaleFactor: 0.8,
  leverage: 1,
  leverageAware: true,
};

describe('evaluateDynamicConditions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject when klines are insufficient (< 30)', () => {
    const klines = createKlines(20);
    const result = evaluateDynamicConditions(klines, defaultConfig);

    expect(result.canPyramid).toBe(false);
    expect(result.reason).toBe('Insufficient kline data for indicator calculation');
    expect(result.adxValue).toBeNull();
    expect(result.rsiValue).toBeNull();
    expect(result.atrValue).toBeNull();
    expect(result.atrRatio).toBe(1);
    expect(result.adjustedMinDistance).toBe(defaultConfig.baseMinDistance);
    expect(result.adjustedScaleFactor).toBe(defaultConfig.baseScaleFactor);
  });

  it('should reject when klines length is exactly 29', () => {
    const klines = createKlines(29);
    const result = evaluateDynamicConditions(klines, defaultConfig);

    expect(result.canPyramid).toBe(false);
    expect(result.reason).toContain('Insufficient');
  });

  it('should calculate ATR ratio and adjust min distance', () => {
    const klines = createKlines(50);
    const atrValues: number[] = Array.from({ length: 50 }, (_, i) => (i < 10 ? 0 : 2.0));
    atrValues[atrValues.length - 1] = 3.0;

    mockedCalculateATR.mockReturnValue(atrValues);
    mockedCalculateADX.mockReturnValue({
      adx: [30],
      plusDI: [20],
      minusDI: [15],
    });

    const result = evaluateDynamicConditions(klines, { ...defaultConfig, useRsi: false });

    expect(result.canPyramid).toBe(true);
    expect(result.atrValue).toBe(3.0);
    expect(result.atrRatio).toBeGreaterThan(1);
    expect(result.adjustedMinDistance).toBeGreaterThan(defaultConfig.baseMinDistance);
  });

  it('should clamp ATR ratio between 0.5 and 2.0', () => {
    const klines = createKlines(50);
    const atrValues = Array.from({ length: 50 }, () => 1.0);
    atrValues[atrValues.length - 1] = 100.0;

    mockedCalculateATR.mockReturnValue(atrValues);
    mockedCalculateADX.mockReturnValue({
      adx: [30],
      plusDI: [20],
      minusDI: [15],
    });

    const result = evaluateDynamicConditions(klines, { ...defaultConfig, useRsi: false });

    expect(result.atrRatio).toBeLessThanOrEqual(2.0);
    expect(result.atrRatio).toBeGreaterThanOrEqual(0.5);
  });

  it('should handle ATR with fewer than 2 valid values', () => {
    const klines = createKlines(50);
    mockedCalculateATR.mockReturnValue([NaN, 0, NaN, 0, 1.5]);
    mockedCalculateADX.mockReturnValue({
      adx: [30],
      plusDI: [20],
      minusDI: [15],
    });

    const result = evaluateDynamicConditions(klines, { ...defaultConfig, useRsi: false });

    expect(result.canPyramid).toBe(true);
    expect(result.atrRatio).toBe(1);
  });

  it('should skip ATR calculation when useAtr is false', () => {
    const klines = createKlines(50);
    mockedCalculateADX.mockReturnValue({
      adx: [30],
      plusDI: [20],
      minusDI: [15],
    });

    const result = evaluateDynamicConditions(klines, {
      ...defaultConfig,
      useAtr: false,
      useRsi: false,
    });

    expect(mockedCalculateATR).not.toHaveBeenCalled();
    expect(result.atrRatio).toBe(1);
    expect(result.atrValue).toBeNull();
    expect(result.canPyramid).toBe(true);
  });

  it('should reject when ADX is below threshold', () => {
    const klines = createKlines(50);
    mockedCalculateATR.mockReturnValue(Array.from({ length: 50 }, () => 1.5));
    mockedCalculateADX.mockReturnValue({
      adx: [20.0],
      plusDI: [15],
      minusDI: [18],
    });

    const result = evaluateDynamicConditions(klines, defaultConfig);

    expect(result.canPyramid).toBe(false);
    expect(result.reason).toContain('ADX');
    expect(result.reason).toContain('below threshold');
    expect(result.adxValue).toBe(20.0);
  });

  it('should pass when ADX is above threshold', () => {
    const klines = createKlines(50);
    mockedCalculateATR.mockReturnValue(Array.from({ length: 50 }, () => 1.5));
    mockedCalculateADX.mockReturnValue({
      adx: [35.0],
      plusDI: [25],
      minusDI: [10],
    });

    const result = evaluateDynamicConditions(klines, { ...defaultConfig, useRsi: false });

    expect(result.canPyramid).toBe(true);
    expect(result.adxValue).toBe(35.0);
  });

  it('should pass when ADX equals threshold exactly', () => {
    const klines = createKlines(50);
    mockedCalculateATR.mockReturnValue(Array.from({ length: 50 }, () => 1.5));
    mockedCalculateADX.mockReturnValue({
      adx: [25.0],
      plusDI: [20],
      minusDI: [10],
    });

    const result = evaluateDynamicConditions(klines, { ...defaultConfig, useRsi: false });

    expect(result.canPyramid).toBe(true);
    expect(result.adxValue).toBe(25.0);
  });

  it('should skip ADX check when useAdx is false', () => {
    const klines = createKlines(50);
    mockedCalculateATR.mockReturnValue(Array.from({ length: 50 }, () => 1.5));

    const result = evaluateDynamicConditions(klines, {
      ...defaultConfig,
      useAdx: false,
      useRsi: false,
    });

    expect(mockedCalculateADX).not.toHaveBeenCalled();
    expect(result.adxValue).toBeNull();
    expect(result.canPyramid).toBe(true);
  });

  it('should handle empty ADX values array', () => {
    const klines = createKlines(50);
    mockedCalculateATR.mockReturnValue(Array.from({ length: 50 }, () => 1.5));
    mockedCalculateADX.mockReturnValue({
      adx: [null, null],
      plusDI: [null],
      minusDI: [null],
    });

    const result = evaluateDynamicConditions(klines, { ...defaultConfig, useRsi: false });

    expect(result.canPyramid).toBe(true);
    expect(result.adxValue).toBeNull();
  });

  it('should reject when RSI is in neutral zone', () => {
    const klines = createKlines(50);
    mockedCalculateATR.mockReturnValue(Array.from({ length: 50 }, () => 1.5));
    mockedCalculateADX.mockReturnValue({
      adx: [30],
      plusDI: [20],
      minusDI: [10],
    });
    mockedCalculateRSI.mockReturnValue({
      values: [50.0],
    } as ReturnType<typeof calculateRSI>);

    const result = evaluateDynamicConditions(klines, { ...defaultConfig, useRsi: true });

    expect(result.canPyramid).toBe(false);
    expect(result.reason).toContain('RSI');
    expect(result.reason).toContain('neutral zone');
    expect(result.rsiValue).toBe(50.0);
  });

  it('should pass when RSI is below lower bound (strong downtrend)', () => {
    const klines = createKlines(50);
    mockedCalculateATR.mockReturnValue(Array.from({ length: 50 }, () => 1.5));
    mockedCalculateADX.mockReturnValue({
      adx: [30],
      plusDI: [20],
      minusDI: [10],
    });
    mockedCalculateRSI.mockReturnValue({
      values: [30.0],
    } as ReturnType<typeof calculateRSI>);

    const result = evaluateDynamicConditions(klines, { ...defaultConfig, useRsi: true });

    expect(result.canPyramid).toBe(true);
    expect(result.rsiValue).toBe(30.0);
  });

  it('should pass when RSI is above upper bound (strong uptrend)', () => {
    const klines = createKlines(50);
    mockedCalculateATR.mockReturnValue(Array.from({ length: 50 }, () => 1.5));
    mockedCalculateADX.mockReturnValue({
      adx: [30],
      plusDI: [20],
      minusDI: [10],
    });
    mockedCalculateRSI.mockReturnValue({
      values: [70.0],
    } as ReturnType<typeof calculateRSI>);

    const result = evaluateDynamicConditions(klines, { ...defaultConfig, useRsi: true });

    expect(result.canPyramid).toBe(true);
    expect(result.rsiValue).toBe(70.0);
  });

  it('should pass when RSI equals lower bound exactly', () => {
    const klines = createKlines(50);
    mockedCalculateATR.mockReturnValue(Array.from({ length: 50 }, () => 1.5));
    mockedCalculateADX.mockReturnValue({
      adx: [30],
      plusDI: [20],
      minusDI: [10],
    });
    mockedCalculateRSI.mockReturnValue({
      values: [40.0],
    } as ReturnType<typeof calculateRSI>);

    const result = evaluateDynamicConditions(klines, { ...defaultConfig, useRsi: true });

    expect(result.canPyramid).toBe(true);
  });

  it('should pass when RSI equals upper bound exactly', () => {
    const klines = createKlines(50);
    mockedCalculateATR.mockReturnValue(Array.from({ length: 50 }, () => 1.5));
    mockedCalculateADX.mockReturnValue({
      adx: [30],
      plusDI: [20],
      minusDI: [10],
    });
    mockedCalculateRSI.mockReturnValue({
      values: [60.0],
    } as ReturnType<typeof calculateRSI>);

    const result = evaluateDynamicConditions(klines, { ...defaultConfig, useRsi: true });

    expect(result.canPyramid).toBe(true);
  });

  it('should skip RSI check when useRsi is false', () => {
    const klines = createKlines(50);
    mockedCalculateATR.mockReturnValue(Array.from({ length: 50 }, () => 1.5));
    mockedCalculateADX.mockReturnValue({
      adx: [30],
      plusDI: [20],
      minusDI: [10],
    });

    const result = evaluateDynamicConditions(klines, {
      ...defaultConfig,
      useRsi: false,
    });

    expect(mockedCalculateRSI).not.toHaveBeenCalled();
    expect(result.rsiValue).toBeNull();
  });

  it('should handle empty RSI values array', () => {
    const klines = createKlines(50);
    mockedCalculateATR.mockReturnValue(Array.from({ length: 50 }, () => 1.5));
    mockedCalculateADX.mockReturnValue({
      adx: [30],
      plusDI: [20],
      minusDI: [10],
    });
    mockedCalculateRSI.mockReturnValue({
      values: [null, null],
    } as ReturnType<typeof calculateRSI>);

    const result = evaluateDynamicConditions(klines, { ...defaultConfig, useRsi: true });

    expect(result.canPyramid).toBe(true);
    expect(result.rsiValue).toBeNull();
  });

  it('should apply leverage-aware scale factor when leverage > 1', () => {
    const klines = createKlines(50);
    mockedCalculateATR.mockReturnValue(Array.from({ length: 50 }, () => 1.5));
    mockedCalculateADX.mockReturnValue({
      adx: [30],
      plusDI: [20],
      minusDI: [10],
    });

    const result = evaluateDynamicConditions(klines, {
      ...defaultConfig,
      useRsi: false,
      leverage: 4,
      leverageAware: true,
    });

    expect(result.canPyramid).toBe(true);
    expect(result.adjustedScaleFactor).toBeCloseTo(0.8 * (1 / Math.sqrt(4)), 4);
    expect(result.adjustedScaleFactor).toBe(0.4);
  });

  it('should not adjust scale factor when leverageAware is false', () => {
    const klines = createKlines(50);
    mockedCalculateATR.mockReturnValue(Array.from({ length: 50 }, () => 1.5));
    mockedCalculateADX.mockReturnValue({
      adx: [30],
      plusDI: [20],
      minusDI: [10],
    });

    const result = evaluateDynamicConditions(klines, {
      ...defaultConfig,
      useRsi: false,
      leverage: 10,
      leverageAware: false,
    });

    expect(result.adjustedScaleFactor).toBe(defaultConfig.baseScaleFactor);
  });

  it('should not adjust scale factor when leverage is 1', () => {
    const klines = createKlines(50);
    mockedCalculateATR.mockReturnValue(Array.from({ length: 50 }, () => 1.5));
    mockedCalculateADX.mockReturnValue({
      adx: [30],
      plusDI: [20],
      minusDI: [10],
    });

    const result = evaluateDynamicConditions(klines, {
      ...defaultConfig,
      useRsi: false,
      leverage: 1,
      leverageAware: true,
    });

    expect(result.adjustedScaleFactor).toBe(defaultConfig.baseScaleFactor);
  });

  it('should clamp adjusted scale factor to minimum 0.1', () => {
    const klines = createKlines(50);
    mockedCalculateATR.mockReturnValue(Array.from({ length: 50 }, () => 1.5));
    mockedCalculateADX.mockReturnValue({
      adx: [30],
      plusDI: [20],
      minusDI: [10],
    });

    const result = evaluateDynamicConditions(klines, {
      ...defaultConfig,
      useRsi: false,
      baseScaleFactor: 0.1,
      leverage: 100,
      leverageAware: true,
    });

    expect(result.adjustedScaleFactor).toBeGreaterThanOrEqual(0.1);
  });

  it('should clamp adjusted scale factor to maximum 1.0', () => {
    const klines = createKlines(50);
    mockedCalculateATR.mockReturnValue(Array.from({ length: 50 }, () => 1.5));
    mockedCalculateADX.mockReturnValue({
      adx: [30],
      plusDI: [20],
      minusDI: [10],
    });

    const result = evaluateDynamicConditions(klines, {
      ...defaultConfig,
      useRsi: false,
      baseScaleFactor: 1.5,
      leverage: 2,
      leverageAware: true,
    });

    expect(result.adjustedScaleFactor).toBeLessThanOrEqual(1.0);
  });

  it('should return all indicator values when all conditions pass', () => {
    const klines = createKlines(50);
    mockedCalculateATR.mockReturnValue(Array.from({ length: 50 }, () => 2.0));
    mockedCalculateADX.mockReturnValue({
      adx: [30.5],
      plusDI: [20],
      minusDI: [10],
    });
    mockedCalculateRSI.mockReturnValue({
      values: [72.0],
    } as ReturnType<typeof calculateRSI>);

    const result = evaluateDynamicConditions(klines, { ...defaultConfig, useRsi: true });

    expect(result.canPyramid).toBe(true);
    expect(result.reason).toBe('Dynamic conditions met');
    expect(result.adxValue).toBe(30.5);
    expect(result.rsiValue).toBe(72.0);
    expect(result.atrValue).toBe(2.0);
  });

  it('should handle all indicators disabled', () => {
    const klines = createKlines(50);

    const result = evaluateDynamicConditions(klines, {
      ...defaultConfig,
      useAtr: false,
      useAdx: false,
      useRsi: false,
    });

    expect(result.canPyramid).toBe(true);
    expect(result.atrValue).toBeNull();
    expect(result.adxValue).toBeNull();
    expect(result.rsiValue).toBeNull();
    expect(result.atrRatio).toBe(1);
    expect(result.adjustedMinDistance).toBe(defaultConfig.baseMinDistance);
    expect(result.adjustedScaleFactor).toBe(defaultConfig.baseScaleFactor);
  });

  it('should handle ATR where avgAtr is 0', () => {
    const klines = createKlines(50);
    mockedCalculateATR.mockReturnValue([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1.0, 2.0]);
    mockedCalculateADX.mockReturnValue({
      adx: [30],
      plusDI: [20],
      minusDI: [10],
    });

    const result = evaluateDynamicConditions(klines, { ...defaultConfig, useRsi: false });

    expect(result.canPyramid).toBe(true);
  });
});

describe('prioritizePyramidCandidates', () => {
  it('should sort candidates by ADX value descending', () => {
    const candidates: PyramidCandidate[] = [
      { symbol: 'BTCUSDT', direction: 'LONG', adxValue: 20, currentPrice: 50000, profitPercent: 0.02, suggestedSize: 0.1, entryCount: 1 },
      { symbol: 'ETHUSDT', direction: 'LONG', adxValue: 35, currentPrice: 3000, profitPercent: 0.03, suggestedSize: 1, entryCount: 1 },
      { symbol: 'SOLUSDT', direction: 'SHORT', adxValue: 28, currentPrice: 100, profitPercent: 0.015, suggestedSize: 10, entryCount: 2 },
    ];

    const sorted = prioritizePyramidCandidates(candidates);

    expect(sorted[0]?.symbol).toBe('ETHUSDT');
    expect(sorted[1]?.symbol).toBe('SOLUSDT');
    expect(sorted[2]?.symbol).toBe('BTCUSDT');
  });

  it('should treat null ADX as 0', () => {
    const candidates: PyramidCandidate[] = [
      { symbol: 'BTCUSDT', direction: 'LONG', adxValue: null, currentPrice: 50000, profitPercent: 0.02, suggestedSize: 0.1, entryCount: 1 },
      { symbol: 'ETHUSDT', direction: 'LONG', adxValue: 10, currentPrice: 3000, profitPercent: 0.03, suggestedSize: 1, entryCount: 1 },
    ];

    const sorted = prioritizePyramidCandidates(candidates);

    expect(sorted[0]?.symbol).toBe('ETHUSDT');
    expect(sorted[1]?.symbol).toBe('BTCUSDT');
  });

  it('should return empty array for empty input', () => {
    expect(prioritizePyramidCandidates([])).toEqual([]);
  });

  it('should not mutate the original array', () => {
    const candidates: PyramidCandidate[] = [
      { symbol: 'BTCUSDT', direction: 'LONG', adxValue: 20, currentPrice: 50000, profitPercent: 0.02, suggestedSize: 0.1, entryCount: 1 },
      { symbol: 'ETHUSDT', direction: 'LONG', adxValue: 35, currentPrice: 3000, profitPercent: 0.03, suggestedSize: 1, entryCount: 1 },
    ];

    const original = [...candidates];
    prioritizePyramidCandidates(candidates);

    expect(candidates[0]?.symbol).toBe(original[0]?.symbol);
    expect(candidates[1]?.symbol).toBe(original[1]?.symbol);
  });

  it('should handle single candidate', () => {
    const candidates: PyramidCandidate[] = [
      { symbol: 'BTCUSDT', direction: 'LONG', adxValue: 30, currentPrice: 50000, profitPercent: 0.02, suggestedSize: 0.1, entryCount: 1 },
    ];

    const sorted = prioritizePyramidCandidates(candidates);
    expect(sorted).toHaveLength(1);
    expect(sorted[0]?.symbol).toBe('BTCUSDT');
  });
});

describe('calculateLeverageAdjustedScaleFactor', () => {
  it('should return base scale factor when leverageAware is false', () => {
    expect(calculateLeverageAdjustedScaleFactor(0.8, 10, false)).toBe(0.8);
  });

  it('should return base scale factor when leverage is 1', () => {
    expect(calculateLeverageAdjustedScaleFactor(0.8, 1, true)).toBe(0.8);
  });

  it('should return base scale factor when leverage is 0', () => {
    expect(calculateLeverageAdjustedScaleFactor(0.8, 0, true)).toBe(0.8);
  });

  it('should reduce scale factor with higher leverage', () => {
    const result = calculateLeverageAdjustedScaleFactor(0.8, 4, true);
    expect(result).toBeCloseTo(0.4, 4);
  });

  it('should clamp to minimum 0.1', () => {
    const result = calculateLeverageAdjustedScaleFactor(0.1, 125, true);
    expect(result).toBeGreaterThanOrEqual(0.1);
  });

  it('should clamp to maximum 1.0', () => {
    const result = calculateLeverageAdjustedScaleFactor(2.0, 2, true);
    expect(result).toBeLessThanOrEqual(1.0);
  });

  it('should apply sqrt formula correctly for leverage 9', () => {
    const result = calculateLeverageAdjustedScaleFactor(0.9, 9, true);
    expect(result).toBeCloseTo(0.9 * (1 / 3), 4);
  });

  it('should apply sqrt formula correctly for leverage 25', () => {
    const result = calculateLeverageAdjustedScaleFactor(0.8, 25, true);
    expect(result).toBeCloseTo(0.8 * (1 / 5), 4);
  });
});

describe('calculateAtrAdjustedMinDistance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return base distance when klines are insufficient', () => {
    const klines = createKlines(20);
    expect(calculateAtrAdjustedMinDistance(0.005, klines)).toBe(0.005);
  });

  it('should return base distance when klines length is exactly 29', () => {
    const klines = createKlines(29);
    expect(calculateAtrAdjustedMinDistance(0.005, klines)).toBe(0.005);
  });

  it('should return base distance when fewer than 2 valid ATR values', () => {
    const klines = createKlines(50);
    mockedCalculateATR.mockReturnValue([NaN, 0, NaN]);

    expect(calculateAtrAdjustedMinDistance(0.005, klines)).toBe(0.005);
  });

  it('should adjust distance based on ATR ratio', () => {
    const klines = createKlines(50);
    const atrValues = Array.from({ length: 50 }, () => 1.0);
    atrValues[atrValues.length - 1] = 1.5;
    mockedCalculateATR.mockReturnValue(atrValues);

    const result = calculateAtrAdjustedMinDistance(0.005, klines);
    expect(result).toBeGreaterThan(0.005);
  });

  it('should clamp ratio between 0.5 and 2.0', () => {
    const klines = createKlines(50);
    const atrValues = Array.from({ length: 50 }, () => 1.0);
    atrValues[atrValues.length - 1] = 100.0;
    mockedCalculateATR.mockReturnValue(atrValues);

    const result = calculateAtrAdjustedMinDistance(0.005, klines);
    expect(result).toBeLessThanOrEqual(0.005 * 2.0);
    expect(result).toBeGreaterThanOrEqual(0.005 * 0.5);
  });

  it('should handle avgAtr of 0', () => {
    const klines = createKlines(50);
    mockedCalculateATR.mockReturnValue([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1.0, 2.0]);

    const result = calculateAtrAdjustedMinDistance(0.005, klines);
    expect(result).toBeGreaterThan(0);
  });
});

describe('getCurrentIndicatorValues', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return nulls when klines are insufficient', () => {
    const klines = createKlines(20);
    const result = getCurrentIndicatorValues(klines);

    expect(result.atr).toBeNull();
    expect(result.adx).toBeNull();
    expect(result.rsi).toBeNull();
    expect(result.plusDI).toBeNull();
    expect(result.minusDI).toBeNull();
  });

  it('should return all indicator values for sufficient klines', () => {
    const klines = createKlines(50);
    mockedCalculateATR.mockReturnValue([1.5, 2.0, 2.5]);
    mockedCalculateADX.mockReturnValue({
      adx: [25.0, 30.0],
      plusDI: [20.0, 22.0],
      minusDI: [15.0, 12.0],
    });
    mockedCalculateRSI.mockReturnValue({
      values: [55.0, 60.0],
    } as ReturnType<typeof calculateRSI>);

    const result = getCurrentIndicatorValues(klines);

    expect(result.atr).toBe(2.5);
    expect(result.adx).toBe(30.0);
    expect(result.rsi).toBe(60.0);
    expect(result.plusDI).toBe(22.0);
    expect(result.minusDI).toBe(12.0);
  });

  it('should return null for indicators with no valid values', () => {
    const klines = createKlines(50);
    mockedCalculateATR.mockReturnValue([NaN, 0, NaN]);
    mockedCalculateADX.mockReturnValue({
      adx: [null, null],
      plusDI: [null],
      minusDI: [null],
    });
    mockedCalculateRSI.mockReturnValue({
      values: [null, null],
    } as ReturnType<typeof calculateRSI>);

    const result = getCurrentIndicatorValues(klines);

    expect(result.atr).toBeNull();
    expect(result.adx).toBeNull();
    expect(result.rsi).toBeNull();
    expect(result.plusDI).toBeNull();
    expect(result.minusDI).toBeNull();
  });

  it('should return last valid value for each indicator', () => {
    const klines = createKlines(50);
    mockedCalculateATR.mockReturnValue([0, NaN, 3.0, 0, 4.0]);
    mockedCalculateADX.mockReturnValue({
      adx: [null, 25.0, null, 28.0],
      plusDI: [null, 18.0, null, 20.0],
      minusDI: [null, 14.0, null, 11.0],
    });
    mockedCalculateRSI.mockReturnValue({
      values: [null, 45.0, null, 55.0],
    } as ReturnType<typeof calculateRSI>);

    const result = getCurrentIndicatorValues(klines);

    expect(result.atr).toBe(4.0);
    expect(result.adx).toBe(28.0);
    expect(result.rsi).toBe(55.0);
    expect(result.plusDI).toBe(20.0);
    expect(result.minusDI).toBe(11.0);
  });
});
