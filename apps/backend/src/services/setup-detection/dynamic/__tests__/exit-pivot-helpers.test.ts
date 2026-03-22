import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ExitContext, ExitLevel, Kline, PivotStrengthFilter } from '@marketmind/types';
import type { EnhancedPivotPoint } from '@marketmind/indicators';

vi.mock('../../../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    trace: vi.fn(),
  },
}));

vi.mock('@marketmind/indicators', () => ({
  analyzePivots: vi.fn().mockReturnValue({ pivots: [], support: [], resistance: [] }),
  findNearestPivotTarget: vi.fn().mockReturnValue({ target: null, pivot: null }),
}));

import {
  buildPivotConfig,
  findPrioritizedPivotStop,
  isPivotAcceptable,
  calculatePivotBasedStop,
  calculatePivotBasedTarget,
} from '../exit-pivot-helpers';
import { analyzePivots, findNearestPivotTarget } from '@marketmind/indicators';
import type { IndicatorEngine } from '../IndicatorEngine';

const createMockKline = (close: number, high: number, low: number, index: number): Kline => {
  const baseTime = new Date('2024-01-01').getTime() + index * 3600000;
  return {
    openTime: baseTime,
    closeTime: baseTime + 3599999,
    open: close.toString(),
    high: high.toString(),
    low: low.toString(),
    close: close.toString(),
    volume: '1000',
    quoteVolume: (1000 * close).toString(),
    trades: 100,
    takerBuyBaseVolume: '500',
    takerBuyQuoteVolume: (500 * close).toString(),
  };
};

const generateKlines = (count: number, basePrice: number = 100): Kline[] =>
  Array.from({ length: count }, (_, i) =>
    createMockKline(basePrice + i, basePrice + i + 5, basePrice + i - 5, i)
  );

describe('exit-pivot-helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('buildPivotConfig', () => {
    it('should return defaults when no pivotConfig specified', () => {
      const exit: ExitLevel = { type: 'pivotBased' };
      const config = buildPivotConfig(exit);
      expect(config.lookback).toBe(5);
      expect(config.lookahead).toBe(2);
      expect(config.volumeLookback).toBe(20);
      expect(config.volumeMultiplier).toBe(1.2);
    });

    it('should use exit.lookback when specified', () => {
      const exit: ExitLevel = { type: 'pivotBased', lookback: 10 };
      const config = buildPivotConfig(exit);
      expect(config.lookback).toBe(10);
    });

    it('should use pivotConfig values when specified', () => {
      const exit: ExitLevel = {
        type: 'pivotBased',
        pivotConfig: { volumeLookback: 30, volumeMultiplier: 1.5 },
      };
      const config = buildPivotConfig(exit);
      expect(config.volumeLookback).toBe(30);
      expect(config.volumeMultiplier).toBe(1.5);
    });
  });

  describe('findPrioritizedPivotStop', () => {
    it('should return no_pivots_found when no relevant pivots exist', () => {
      vi.mocked(analyzePivots).mockReturnValue({ pivots: [], support: [], resistance: [] });
      const klines = generateKlines(30);
      const result = findPrioritizedPivotStop(klines, 100, 'LONG');
      expect(result.stop).toBeNull();
      expect(result.pivot).toBeNull();
      expect(result.reason).toBe('no_pivots_found');
    });

    it('should prioritize strong pivot with volume confirmation for LONG', () => {
      const strongVolPivot: EnhancedPivotPoint = {
        price: 95, index: 10, type: 'low', strength: 'strong', volumeConfirmed: true,
      };
      const strongPivot: EnhancedPivotPoint = {
        price: 93, index: 8, type: 'low', strength: 'strong', volumeConfirmed: false,
      };
      vi.mocked(analyzePivots).mockReturnValue({
        pivots: [strongVolPivot, strongPivot],
        support: [],
        resistance: [],
      });
      const klines = generateKlines(30);
      const result = findPrioritizedPivotStop(klines, 100, 'LONG');
      expect(result.stop).toBe(95);
      expect(result.reason).toBe('strong_with_volume');
    });

    it('should use strong pivot without volume when no volume-confirmed strong exists', () => {
      const strongPivot: EnhancedPivotPoint = {
        price: 93, index: 8, type: 'low', strength: 'strong', volumeConfirmed: false,
      };
      vi.mocked(analyzePivots).mockReturnValue({
        pivots: [strongPivot],
        support: [],
        resistance: [],
      });
      const klines = generateKlines(30);
      const result = findPrioritizedPivotStop(klines, 100, 'LONG');
      expect(result.stop).toBe(93);
      expect(result.reason).toBe('strong');
    });

    it('should use medium pivot when no strong pivots exist', () => {
      const mediumPivot: EnhancedPivotPoint = {
        price: 94, index: 12, type: 'low', strength: 'medium', volumeConfirmed: false,
      };
      vi.mocked(analyzePivots).mockReturnValue({
        pivots: [mediumPivot],
        support: [],
        resistance: [],
      });
      const klines = generateKlines(30);
      const result = findPrioritizedPivotStop(klines, 100, 'LONG');
      expect(result.stop).toBe(94);
      expect(result.reason).toBe('medium');
    });

    it('should return only_weak_pivots when only weak pivots exist', () => {
      const weakPivot: EnhancedPivotPoint = {
        price: 96, index: 14, type: 'low', strength: 'weak', volumeConfirmed: false,
      };
      vi.mocked(analyzePivots).mockReturnValue({
        pivots: [weakPivot],
        support: [],
        resistance: [],
      });
      const klines = generateKlines(30);
      const result = findPrioritizedPivotStop(klines, 100, 'LONG');
      expect(result.stop).toBeNull();
      expect(result.reason).toBe('only_weak_pivots');
    });

    it('should filter high pivots above entry for SHORT direction', () => {
      const highPivot: EnhancedPivotPoint = {
        price: 110, index: 10, type: 'high', strength: 'strong', volumeConfirmed: true,
      };
      vi.mocked(analyzePivots).mockReturnValue({
        pivots: [highPivot],
        support: [],
        resistance: [],
      });
      const klines = generateKlines(30);
      const result = findPrioritizedPivotStop(klines, 100, 'SHORT');
      expect(result.stop).toBe(110);
      expect(result.reason).toBe('strong_with_volume');
    });

    it('should filter out pivots on wrong side for LONG', () => {
      const highPivot: EnhancedPivotPoint = {
        price: 110, index: 10, type: 'high', strength: 'strong', volumeConfirmed: true,
      };
      vi.mocked(analyzePivots).mockReturnValue({
        pivots: [highPivot],
        support: [],
        resistance: [],
      });
      const klines = generateKlines(30);
      const result = findPrioritizedPivotStop(klines, 100, 'LONG');
      expect(result.stop).toBeNull();
      expect(result.reason).toBe('no_pivots_found');
    });
  });

  describe('isPivotAcceptable', () => {
    it('should return false when pivot is null', () => {
      expect(isPivotAcceptable(null, 'any', false)).toBe(false);
    });

    it('should return false when volume confirmation required but not met', () => {
      const pivot: EnhancedPivotPoint = {
        price: 95, index: 10, type: 'low', strength: 'strong', volumeConfirmed: false,
      };
      expect(isPivotAcceptable(pivot, 'any', true)).toBe(false);
    });

    it('should return true for any strength filter', () => {
      const pivot: EnhancedPivotPoint = {
        price: 95, index: 10, type: 'low', strength: 'weak', volumeConfirmed: false,
      };
      expect(isPivotAcceptable(pivot, 'any', false)).toBe(true);
    });

    it('should accept strong pivot when medium is minimum', () => {
      const pivot: EnhancedPivotPoint = {
        price: 95, index: 10, type: 'low', strength: 'strong', volumeConfirmed: false,
      };
      expect(isPivotAcceptable(pivot, 'medium', false)).toBe(true);
    });

    it('should reject weak pivot when medium is minimum', () => {
      const pivot: EnhancedPivotPoint = {
        price: 95, index: 10, type: 'low', strength: 'weak', volumeConfirmed: false,
      };
      expect(isPivotAcceptable(pivot, 'medium', false)).toBe(false);
    });

    it('should reject medium pivot when strong is minimum', () => {
      const pivot: EnhancedPivotPoint = {
        price: 95, index: 10, type: 'low', strength: 'medium', volumeConfirmed: false,
      };
      expect(isPivotAcceptable(pivot, 'strong', false)).toBe(false);
    });

    it('should accept strong pivot with volume confirmation when both required', () => {
      const pivot: EnhancedPivotPoint = {
        price: 95, index: 10, type: 'low', strength: 'strong', volumeConfirmed: true,
      };
      expect(isPivotAcceptable(pivot, 'strong', true)).toBe(true);
    });
  });

  describe('calculatePivotBasedStop', () => {
    const mockIndicatorEngine = {
      resolveIndicatorValue: vi.fn().mockReturnValue(2),
    } as unknown as IndicatorEngine;

    const mockResolveOperand = vi.fn().mockReturnValue(1.0);
    const mockCalculateSwingStop = vi.fn().mockReturnValue(96);

    const createContext = (overrides: Partial<ExitContext> = {}): ExitContext => ({
      direction: 'LONG',
      entryPrice: 100,
      klines: generateKlines(30),
      currentIndex: 25,
      indicators: {},
      params: {},
      ...overrides,
    });

    it('should throw when klines is empty', () => {
      const ctx = createContext({ klines: [], currentIndex: 0 });
      const exit: ExitLevel = { type: 'pivotBased' };
      expect(() => calculatePivotBasedStop(exit, ctx, mockIndicatorEngine, mockResolveOperand, mockCalculateSwingStop))
        .toThrow('Insufficient klines');
    });

    it('should throw when currentIndex is less than 5', () => {
      const ctx = createContext({ currentIndex: 4 });
      const exit: ExitLevel = { type: 'pivotBased' };
      expect(() => calculatePivotBasedStop(exit, ctx, mockIndicatorEngine, mockResolveOperand, mockCalculateSwingStop))
        .toThrow('Insufficient klines');
    });

    it('should fall back to swing stop when no suitable pivot found', () => {
      vi.mocked(analyzePivots).mockReturnValue({ pivots: [], support: [], resistance: [] });
      const ctx = createContext();
      const exit: ExitLevel = { type: 'pivotBased' };
      const result = calculatePivotBasedStop(exit, ctx, mockIndicatorEngine, mockResolveOperand, mockCalculateSwingStop);
      expect(mockCalculateSwingStop).toHaveBeenCalled();
      expect(result).toBe(96);
    });

    it('should return pivot-based stop with ATR buffer for LONG', () => {
      const strongPivot: EnhancedPivotPoint = {
        price: 92, index: 10, type: 'low', strength: 'strong', volumeConfirmed: true,
      };
      vi.mocked(analyzePivots).mockReturnValue({
        pivots: [strongPivot],
        support: [],
        resistance: [],
      });
      const exit: ExitLevel = { type: 'pivotBased', buffer: 1.0 };
      const ctx = createContext({ direction: 'LONG', entryPrice: 100 });
      const result = calculatePivotBasedStop(exit, ctx, mockIndicatorEngine, mockResolveOperand, mockCalculateSwingStop);
      expect(result).toBeLessThan(92);
      expect(result).toBeLessThan(100);
    });

    it('should return pivot-based stop with ATR buffer for SHORT', () => {
      const strongPivot: EnhancedPivotPoint = {
        price: 108, index: 10, type: 'high', strength: 'strong', volumeConfirmed: true,
      };
      vi.mocked(analyzePivots).mockReturnValue({
        pivots: [strongPivot],
        support: [],
        resistance: [],
      });
      const exit: ExitLevel = { type: 'pivotBased', buffer: 1.0 };
      const ctx = createContext({ direction: 'SHORT', entryPrice: 100 });
      const result = calculatePivotBasedStop(exit, ctx, mockIndicatorEngine, mockResolveOperand, mockCalculateSwingStop);
      expect(result).toBeGreaterThan(108);
      expect(result).toBeGreaterThan(100);
    });

    it('should apply default ATR buffer when no explicit buffer', () => {
      const strongPivot: EnhancedPivotPoint = {
        price: 92, index: 10, type: 'low', strength: 'strong', volumeConfirmed: true,
      };
      vi.mocked(analyzePivots).mockReturnValue({
        pivots: [strongPivot],
        support: [],
        resistance: [],
      });
      const exit: ExitLevel = { type: 'pivotBased' };
      const ctx = createContext({ direction: 'LONG', entryPrice: 100 });
      const result = calculatePivotBasedStop(exit, ctx, mockIndicatorEngine, mockResolveOperand, mockCalculateSwingStop);
      expect(result).toBeLessThan(92);
    });

    it('should fall back to swing stop when pivot stop is too close to entry', () => {
      const strongPivot: EnhancedPivotPoint = {
        price: 99.95, index: 10, type: 'low', strength: 'strong', volumeConfirmed: true,
      };
      vi.mocked(analyzePivots).mockReturnValue({
        pivots: [strongPivot],
        support: [],
        resistance: [],
      });
      const zeroAtrEngine = {
        resolveIndicatorValue: vi.fn().mockReturnValue(0),
      } as unknown as IndicatorEngine;
      const exit: ExitLevel = { type: 'pivotBased' };
      const ctx = createContext({ direction: 'LONG', entryPrice: 100 });
      const result = calculatePivotBasedStop(exit, ctx, zeroAtrEngine, mockResolveOperand, mockCalculateSwingStop);
      expect(mockCalculateSwingStop).toHaveBeenCalled();
      expect(result).toBe(96);
    });

    it('should fall back to swing stop when pivot stop is on wrong side', () => {
      const strongPivot: EnhancedPivotPoint = {
        price: 105, index: 10, type: 'low', strength: 'strong', volumeConfirmed: true,
      };
      vi.mocked(analyzePivots).mockReturnValue({
        pivots: [strongPivot],
        support: [],
        resistance: [],
      });
      vi.mocked(mockIndicatorEngine.resolveIndicatorValue).mockReturnValue(10);
      const exit: ExitLevel = { type: 'pivotBased' };
      const ctx = createContext({ direction: 'LONG', entryPrice: 100 });
      calculatePivotBasedStop(exit, ctx, mockIndicatorEngine, mockResolveOperand, mockCalculateSwingStop);
      expect(mockCalculateSwingStop).toHaveBeenCalled();
    });
  });

  describe('calculatePivotBasedTarget', () => {
    const mockIndicatorEngine = {
      resolveIndicatorValue: vi.fn().mockReturnValue(2),
    } as unknown as IndicatorEngine;

    const mockCalculateTakeProfit = vi.fn().mockReturnValue(110);

    const createContext = (overrides: Partial<ExitContext> = {}): ExitContext => ({
      direction: 'LONG',
      entryPrice: 100,
      klines: generateKlines(30),
      currentIndex: 25,
      indicators: {},
      params: {},
      ...overrides,
    });

    it('should throw when klines is empty', () => {
      const ctx = createContext({ klines: [], currentIndex: 0 });
      const exit: ExitLevel = { type: 'pivotBased' };
      expect(() => calculatePivotBasedTarget(exit, ctx, mockIndicatorEngine, 95, mockCalculateTakeProfit))
        .toThrow('Insufficient klines');
    });

    it('should throw when currentIndex is less than 5', () => {
      const ctx = createContext({ currentIndex: 4 });
      const exit: ExitLevel = { type: 'pivotBased' };
      expect(() => calculatePivotBasedTarget(exit, ctx, mockIndicatorEngine, 95, mockCalculateTakeProfit))
        .toThrow('Insufficient klines');
    });

    it('should return pivot target when valid for LONG', () => {
      const pivot: EnhancedPivotPoint = {
        price: 115, index: 5, type: 'high', strength: 'strong', volumeConfirmed: true,
      };
      vi.mocked(findNearestPivotTarget).mockReturnValue({ target: 115, pivot });
      const ctx = createContext({ direction: 'LONG', entryPrice: 100 });
      const exit: ExitLevel = { type: 'pivotBased' };
      const result = calculatePivotBasedTarget(exit, ctx, mockIndicatorEngine, 95, mockCalculateTakeProfit);
      expect(result).toBe(115);
    });

    it('should return pivot target when valid for SHORT', () => {
      const pivot: EnhancedPivotPoint = {
        price: 90, index: 5, type: 'low', strength: 'strong', volumeConfirmed: true,
      };
      vi.mocked(findNearestPivotTarget).mockReturnValue({ target: 90, pivot });
      const ctx = createContext({ direction: 'SHORT', entryPrice: 100 });
      const exit: ExitLevel = { type: 'pivotBased' };
      const result = calculatePivotBasedTarget(exit, ctx, mockIndicatorEngine, 105, mockCalculateTakeProfit);
      expect(result).toBe(90);
    });

    it('should use fallback exit when no pivot target and fallback specified', () => {
      vi.mocked(findNearestPivotTarget).mockReturnValue({ target: null, pivot: null });
      const fallback: ExitLevel = { type: 'riskReward', multiplier: 2 };
      const exit: ExitLevel = { type: 'pivotBased', fallback };
      const ctx = createContext();
      const result = calculatePivotBasedTarget(exit, ctx, mockIndicatorEngine, 95, mockCalculateTakeProfit);
      expect(mockCalculateTakeProfit).toHaveBeenCalledWith(fallback, ctx, 95);
      expect(result).toBe(110);
    });

    it('should use 2:1 R:R fallback when no pivot, no fallback, but stopLoss exists', () => {
      vi.mocked(findNearestPivotTarget).mockReturnValue({ target: null, pivot: null });
      const exit: ExitLevel = { type: 'pivotBased' };
      const ctx = createContext({ direction: 'LONG', entryPrice: 100 });
      const result = calculatePivotBasedTarget(exit, ctx, mockIndicatorEngine, 95, mockCalculateTakeProfit);
      expect(result).toBe(110);
    });

    it('should use ATR fallback when no pivot, no fallback, no stopLoss', () => {
      vi.mocked(findNearestPivotTarget).mockReturnValue({ target: null, pivot: null });
      const exit: ExitLevel = { type: 'pivotBased' };
      const ctx = createContext({ direction: 'LONG', entryPrice: 100 });
      const result = calculatePivotBasedTarget(exit, ctx, mockIndicatorEngine, undefined, mockCalculateTakeProfit);
      expect(result).toBe(106);
    });

    it('should use ATR fallback for SHORT when no pivot, no fallback, no stopLoss', () => {
      vi.mocked(findNearestPivotTarget).mockReturnValue({ target: null, pivot: null });
      const exit: ExitLevel = { type: 'pivotBased' };
      const ctx = createContext({ direction: 'SHORT', entryPrice: 100 });
      const result = calculatePivotBasedTarget(exit, ctx, mockIndicatorEngine, undefined, mockCalculateTakeProfit);
      expect(result).toBe(94);
    });

    it('should throw when target is on wrong side and no fallback', () => {
      const pivot: EnhancedPivotPoint = {
        price: 90, index: 5, type: 'low', strength: 'strong', volumeConfirmed: true,
      };
      vi.mocked(findNearestPivotTarget).mockReturnValue({ target: 90, pivot });
      const exit: ExitLevel = { type: 'pivotBased' };
      const ctx = createContext({ direction: 'LONG', entryPrice: 100 });
      expect(() => calculatePivotBasedTarget(exit, ctx, mockIndicatorEngine, 95, mockCalculateTakeProfit))
        .toThrow('Invalid pivot-based target');
    });

    it('should use fallback when target is on wrong side and fallback exists', () => {
      const pivot: EnhancedPivotPoint = {
        price: 90, index: 5, type: 'low', strength: 'strong', volumeConfirmed: true,
      };
      vi.mocked(findNearestPivotTarget).mockReturnValue({ target: 90, pivot });
      const fallback: ExitLevel = { type: 'riskReward', multiplier: 2 };
      const exit: ExitLevel = { type: 'pivotBased', fallback };
      const ctx = createContext({ direction: 'LONG', entryPrice: 100 });
      const result = calculatePivotBasedTarget(exit, ctx, mockIndicatorEngine, 95, mockCalculateTakeProfit);
      expect(mockCalculateTakeProfit).toHaveBeenCalledWith(fallback, ctx, 95);
      expect(result).toBe(110);
    });

    it('should reject pivot when minStrength filter not met', () => {
      const weakPivot: EnhancedPivotPoint = {
        price: 115, index: 5, type: 'high', strength: 'weak', volumeConfirmed: false,
      };
      vi.mocked(findNearestPivotTarget).mockReturnValue({ target: 115, pivot: weakPivot });
      const exit: ExitLevel = {
        type: 'pivotBased',
        pivotConfig: { minStrength: 'strong' },
      };
      const ctx = createContext({ direction: 'LONG', entryPrice: 100 });
      const result = calculatePivotBasedTarget(exit, ctx, mockIndicatorEngine, 95, mockCalculateTakeProfit);
      expect(result).toBe(110);
    });
  });
});
