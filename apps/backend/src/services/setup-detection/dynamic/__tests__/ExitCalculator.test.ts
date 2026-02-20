import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExitContext, ExitLevel, Kline, StrategyDefinition } from '@marketmind/types';

vi.mock('../../../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    trace: vi.fn(),
  },
}));

vi.mock('../../../volatility-profile', () => ({
  calculateATRPercent: vi.fn().mockReturnValue(2.0),
  getVolatilityAdjustedMultiplier: vi.fn((_base) => _base),
  getVolatilityProfile: vi.fn().mockReturnValue({
    level: 'normal',
    minTrailingDistance: 0.005,
    atrMultiplier: 1.0,
  }),
}));

vi.mock('@marketmind/indicators', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@marketmind/indicators')>();
  return {
    ...actual,
    analyzePivots: vi.fn().mockReturnValue({
      pivots: [],
      support: [],
      resistance: [],
    }),
    findNearestPivotTarget: vi.fn().mockReturnValue({
      target: null,
      pivot: null,
    }),
    findSignificantSwingHigh: vi.fn().mockReturnValue(null),
    findSignificantSwingLow: vi.fn().mockReturnValue(null),
    findMostRecentSwingHigh: vi.fn().mockReturnValue(null),
    findMostRecentSwingLow: vi.fn().mockReturnValue(null),
  };
});

import { ExitCalculator } from '../ExitCalculator';
import type { IndicatorEngine } from '../IndicatorEngine';
import {
  analyzePivots,
  findNearestPivotTarget,
  findSignificantSwingHigh,
  findSignificantSwingLow,
  findMostRecentSwingHigh,
  findMostRecentSwingLow,
} from '@marketmind/indicators';
import type { EnhancedPivotPoint } from '@marketmind/indicators';

describe('ExitCalculator', () => {
  let calculator: ExitCalculator;
  let mockIndicatorEngine: IndicatorEngine;

  const createMockKlines = (count: number): Kline[] => {
    const klines: Kline[] = [];
    for (let i = 0; i < count; i++) {
      klines.push({
        openTime: Date.now() - (count - i) * 3600000,
        open: (50000 + i * 100).toString(),
        high: (50100 + i * 100).toString(),
        low: (49900 + i * 100).toString(),
        close: (50050 + i * 100).toString(),
        volume: '100',
        closeTime: Date.now() - (count - i - 1) * 3600000,
        quoteVolume: '5000000',
        trades: 1000,
        takerBuyBaseVolume: '50',
        takerBuyQuoteVolume: '2500000',
      });
    }
    return klines;
  };

  const createMockContext = (overrides: Partial<ExitContext> = {}): ExitContext => ({
    direction: 'LONG',
    entryPrice: 50000,
    indicators: {},
    currentIndex: 20,
    klines: createMockKlines(50),
    params: {},
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockIndicatorEngine = {
      resolveIndicatorValue: vi.fn().mockReturnValue(500),
    } as unknown as IndicatorEngine;
    calculator = new ExitCalculator(mockIndicatorEngine);
  });

  describe('calculateStopLoss', () => {
    describe('ATR-based stop loss', () => {
      it('should calculate ATR-based stop loss for LONG', () => {
        const exit: ExitLevel = { type: 'atr', multiplier: 2 };
        const context = createMockContext({ direction: 'LONG', entryPrice: 50000 });

        const stopLoss = calculator.calculateStopLoss(exit, context);

        expect(stopLoss).toBeLessThan(50000);
        expect(stopLoss).toBe(49000);
      });

      it('should calculate ATR-based stop loss for SHORT', () => {
        const exit: ExitLevel = { type: 'atr', multiplier: 2 };
        const context = createMockContext({ direction: 'SHORT', entryPrice: 50000 });

        const stopLoss = calculator.calculateStopLoss(exit, context);

        expect(stopLoss).toBeGreaterThan(50000);
        expect(stopLoss).toBe(51000);
      });

      it('should use default multiplier when not specified', () => {
        const exit: ExitLevel = { type: 'atr' };
        const context = createMockContext({ direction: 'LONG', entryPrice: 50000 });

        const stopLoss = calculator.calculateStopLoss(exit, context);

        expect(stopLoss).toBeLessThan(50000);
      });
    });

    describe('percent-based stop loss', () => {
      it('should calculate percent-based stop loss for LONG', () => {
        const exit: ExitLevel = { type: 'percent', value: 2 };
        const context = createMockContext({ direction: 'LONG', entryPrice: 50000 });

        const stopLoss = calculator.calculateStopLoss(exit, context);

        expect(stopLoss).toBe(49000);
      });

      it('should calculate percent-based stop loss for SHORT', () => {
        const exit: ExitLevel = { type: 'percent', value: 2 };
        const context = createMockContext({ direction: 'SHORT', entryPrice: 50000 });

        const stopLoss = calculator.calculateStopLoss(exit, context);

        expect(stopLoss).toBe(51000);
      });
    });

    describe('fixed-value stop loss', () => {
      it('should calculate fixed stop loss for LONG', () => {
        const exit: ExitLevel = { type: 'fixed', value: 1000 };
        const context = createMockContext({ direction: 'LONG', entryPrice: 50000 });

        const stopLoss = calculator.calculateStopLoss(exit, context);

        expect(stopLoss).toBe(49000);
      });

      it('should calculate fixed stop loss for SHORT', () => {
        const exit: ExitLevel = { type: 'fixed', value: 1000 };
        const context = createMockContext({ direction: 'SHORT', entryPrice: 50000 });

        const stopLoss = calculator.calculateStopLoss(exit, context);

        expect(stopLoss).toBe(51000);
      });
    });

    describe('swing high/low stop loss', () => {
      it('should throw error for insufficient klines', () => {
        const exit: ExitLevel = { type: 'swingHighLow' };
        const context = createMockContext({ klines: [], currentIndex: 1 });

        expect(() => calculator.calculateStopLoss(exit, context)).toThrow('Insufficient klines');
      });

      it('should calculate swing low stop for LONG', () => {
        const exit: ExitLevel = { type: 'swingHighLow' };
        const context = createMockContext({ direction: 'LONG', entryPrice: 52000 });

        const stopLoss = calculator.calculateStopLoss(exit, context);

        expect(stopLoss).toBeLessThan(52000);
      });

      it('should calculate swing high stop for SHORT', () => {
        const exit: ExitLevel = { type: 'swingHighLow' };
        const context = createMockContext({ direction: 'SHORT', entryPrice: 48000 });

        const stopLoss = calculator.calculateStopLoss(exit, context);

        expect(stopLoss).toBeGreaterThan(48000);
      });
    });

    describe('validation', () => {
      it('should throw error if stop loss is above entry for LONG', () => {
        vi.mocked(mockIndicatorEngine.resolveIndicatorValue).mockReturnValue(-500);
        const exit: ExitLevel = { type: 'atr', multiplier: 2 };
        const context = createMockContext({ direction: 'LONG', entryPrice: 50000 });

        expect(() => calculator.calculateStopLoss(exit, context)).toThrow('Invalid negative distance');
      });

      it('should enforce minimum stop distance based on volatility', () => {
        const exit: ExitLevel = { type: 'percent', value: 0.001 };
        const context = createMockContext({ direction: 'LONG', entryPrice: 50000 });

        const stopLoss = calculator.calculateStopLoss(exit, context);

        expect(Math.abs(50000 - stopLoss) / 50000).toBeGreaterThanOrEqual(0.005);
      });
    });
  });

  describe('calculateTakeProfit', () => {
    describe('risk/reward based take profit', () => {
      it('should calculate TP based on risk/reward ratio for LONG', () => {
        const exit: ExitLevel = { type: 'riskReward', multiplier: 2 };
        const context = createMockContext({ direction: 'LONG', entryPrice: 50000 });
        const stopLoss = 49000;

        const takeProfit = calculator.calculateTakeProfit(exit, context, stopLoss);

        expect(takeProfit).toBe(52000);
      });

      it('should calculate TP based on risk/reward ratio for SHORT', () => {
        const exit: ExitLevel = { type: 'riskReward', multiplier: 2 };
        const context = createMockContext({ direction: 'SHORT', entryPrice: 50000 });
        const stopLoss = 51000;

        const takeProfit = calculator.calculateTakeProfit(exit, context, stopLoss);

        expect(takeProfit).toBe(48000);
      });

      it('should use default multiplier when not specified', () => {
        const exit: ExitLevel = { type: 'riskReward' };
        const context = createMockContext({ direction: 'LONG', entryPrice: 50000 });
        const stopLoss = 49000;

        const takeProfit = calculator.calculateTakeProfit(exit, context, stopLoss);

        expect(takeProfit).toBeGreaterThan(50000);
      });
    });

    describe('ATR-based take profit', () => {
      it('should calculate ATR-based TP for LONG', () => {
        const exit: ExitLevel = { type: 'atr', multiplier: 3 };
        const context = createMockContext({ direction: 'LONG', entryPrice: 50000 });

        const takeProfit = calculator.calculateTakeProfit(exit, context);

        expect(takeProfit).toBe(51500);
      });

      it('should calculate ATR-based TP for SHORT', () => {
        const exit: ExitLevel = { type: 'atr', multiplier: 3 };
        const context = createMockContext({ direction: 'SHORT', entryPrice: 50000 });

        const takeProfit = calculator.calculateTakeProfit(exit, context);

        expect(takeProfit).toBe(48500);
      });
    });

    describe('percent-based take profit', () => {
      it('should calculate percent-based TP for LONG', () => {
        const exit: ExitLevel = { type: 'percent', value: 4 };
        const context = createMockContext({ direction: 'LONG', entryPrice: 50000 });

        const takeProfit = calculator.calculateTakeProfit(exit, context);

        expect(takeProfit).toBe(52000);
      });

      it('should calculate percent-based TP for SHORT', () => {
        const exit: ExitLevel = { type: 'percent', value: 4 };
        const context = createMockContext({ direction: 'SHORT', entryPrice: 50000 });

        const takeProfit = calculator.calculateTakeProfit(exit, context);

        expect(takeProfit).toBe(48000);
      });
    });

    describe('indicator-based take profit', () => {
      it('should use indicator value as TP', () => {
        vi.mocked(mockIndicatorEngine.resolveIndicatorValue).mockReturnValue(52000);
        const exit: ExitLevel = { type: 'indicator', indicator: 'ema200' };
        const context = createMockContext({ direction: 'LONG', entryPrice: 50000 });

        const takeProfit = calculator.calculateTakeProfit(exit, context);

        expect(takeProfit).toBe(52000);
      });

      it('should use fallback when indicator TP is invalid', () => {
        vi.mocked(mockIndicatorEngine.resolveIndicatorValue).mockReturnValue(48000);
        const exit: ExitLevel = {
          type: 'indicator',
          indicator: 'ema200',
          fallback: { type: 'percent', value: 4 },
        };
        const context = createMockContext({ direction: 'LONG', entryPrice: 50000 });

        const takeProfit = calculator.calculateTakeProfit(exit, context);

        expect(takeProfit).toBe(52000);
      });
    });

    describe('validation', () => {
      it('should throw error if TP is below entry for LONG without fallback', () => {
        vi.mocked(mockIndicatorEngine.resolveIndicatorValue).mockReturnValue(48000);
        const exit: ExitLevel = { type: 'indicator', indicator: 'ema200' };
        const context = createMockContext({ direction: 'LONG', entryPrice: 50000 });

        expect(() => calculator.calculateTakeProfit(exit, context)).toThrow('Invalid take profit');
      });

      it('should throw error if TP is above entry for SHORT without fallback', () => {
        vi.mocked(mockIndicatorEngine.resolveIndicatorValue).mockReturnValue(52000);
        const exit: ExitLevel = { type: 'indicator', indicator: 'ema200' };
        const context = createMockContext({ direction: 'SHORT', entryPrice: 50000 });

        expect(() => calculator.calculateTakeProfit(exit, context)).toThrow('Invalid take profit');
      });
    });
  });

  describe('calculateConfidence', () => {
    it('should calculate confidence with base value', () => {
      const strategy: StrategyDefinition = {
        id: 'test',
        name: 'Test Strategy',
        version: '1.0',
        description: 'Test',
        parameters: {},
        indicators: {},
        confidence: { base: 65 },
        entry: {},
        exit: { stopLoss: { type: 'atr' }, takeProfit: { type: 'atr' } },
      };
      const context = createMockContext();

      const confidence = calculator.calculateConfidence(strategy, context);

      expect(confidence).toBe(65);
    });

    it('should apply bonuses when conditions are met', () => {
      vi.mocked(mockIndicatorEngine.resolveIndicatorValue).mockReturnValue(150);
      const strategy: StrategyDefinition = {
        id: 'test',
        name: 'Test Strategy',
        version: '1.0',
        description: 'Test',
        parameters: {},
        indicators: {},
        confidence: {
          base: 60,
          bonuses: [
            {
              condition: { left: 'volume.current', op: '>', right: 100 },
              bonus: 10,
              description: 'High volume',
            },
          ],
        },
        entry: {},
        exit: { stopLoss: { type: 'atr' }, takeProfit: { type: 'atr' } },
      };
      const context = createMockContext();

      const confidence = calculator.calculateConfidence(strategy, context);

      expect(confidence).toBe(70);
    });

    it('should cap confidence at max value', () => {
      vi.mocked(mockIndicatorEngine.resolveIndicatorValue).mockReturnValue(200);
      const strategy: StrategyDefinition = {
        id: 'test',
        name: 'Test Strategy',
        version: '1.0',
        description: 'Test',
        parameters: {},
        indicators: {},
        confidence: {
          base: 80,
          max: 90,
          bonuses: [
            { condition: { left: 'volume', op: '>', right: 100 }, bonus: 20 },
          ],
        },
        entry: {},
        exit: { stopLoss: { type: 'atr' }, takeProfit: { type: 'atr' } },
      };
      const context = createMockContext();

      const confidence = calculator.calculateConfidence(strategy, context);

      expect(confidence).toBe(90);
    });

    it('should return default confidence when no config', () => {
      const strategy: StrategyDefinition = {
        id: 'test',
        name: 'Test Strategy',
        version: '1.0',
        description: 'Test',
        parameters: {},
        indicators: {},
        entry: {},
        exit: { stopLoss: { type: 'atr' }, takeProfit: { type: 'atr' } },
      };
      const context = createMockContext();

      const confidence = calculator.calculateConfidence(strategy, context);

      expect(confidence).toBeGreaterThan(0);
    });
  });

  describe('calculateRiskReward', () => {
    it('should calculate risk/reward ratio correctly for LONG', () => {
      const rr = calculator.calculateRiskReward(50000, 49000, 53000, 'LONG');

      expect(rr).toBe(3);
    });

    it('should calculate risk/reward ratio correctly for SHORT', () => {
      const rr = calculator.calculateRiskReward(50000, 51000, 47000, 'SHORT');

      expect(rr).toBe(3);
    });

    it('should return 0 when stop loss is null', () => {
      const rr = calculator.calculateRiskReward(50000, null, 53000, 'LONG');

      expect(rr).toBe(0);
    });

    it('should return 0 when take profit is null', () => {
      const rr = calculator.calculateRiskReward(50000, 49000, null, 'LONG');

      expect(rr).toBe(0);
    });

    it('should return 0 when risk distance is 0', () => {
      const rr = calculator.calculateRiskReward(50000, 50000, 53000, 'LONG');

      expect(rr).toBe(0);
    });
  });

  describe('parameter resolution', () => {
    it('should resolve parameter references', () => {
      const exit: ExitLevel = { type: 'percent', value: '$slPercent' as unknown as number };
      const context = createMockContext({
        direction: 'LONG',
        entryPrice: 50000,
        params: { slPercent: 2 },
      });

      const stopLoss = calculator.calculateStopLoss(exit, context);

      expect(stopLoss).toBe(49000);
    });

    it('should resolve indicator references', () => {
      vi.mocked(mockIndicatorEngine.resolveIndicatorValue).mockReturnValue(3);
      const exit: ExitLevel = { type: 'percent', value: 'atr.percent' as unknown as number };
      const context = createMockContext({ direction: 'LONG', entryPrice: 50000 });

      const stopLoss = calculator.calculateStopLoss(exit, context);

      expect(stopLoss).toBeLessThan(50000);
    });
  });

  describe('bonus condition evaluation', () => {
    it('should evaluate > operator', () => {
      vi.mocked(mockIndicatorEngine.resolveIndicatorValue).mockReturnValue(150);
      const strategy: StrategyDefinition = {
        id: 'test',
        name: 'Test',
        version: '1.0',
        description: 'Test',
        confidence: {
          base: 60,
          bonuses: [
            { condition: { left: 'volume', op: '>', right: 100 }, bonus: 10 },
          ],
        },
        parameters: {},
        indicators: {},
        entry: {},
        exit: { stopLoss: { type: 'atr' }, takeProfit: { type: 'atr' } },
      };
      const context = createMockContext();

      const confidence = calculator.calculateConfidence(strategy, context);

      expect(confidence).toBe(70);
    });

    it('should evaluate < operator', () => {
      vi.mocked(mockIndicatorEngine.resolveIndicatorValue).mockReturnValue(50);
      const strategy: StrategyDefinition = {
        id: 'test',
        name: 'Test',
        version: '1.0',
        description: 'Test',
        confidence: {
          base: 60,
          bonuses: [
            { condition: { left: 'rsi', op: '<', right: 70 }, bonus: 10 },
          ],
        },
        parameters: {},
        indicators: {},
        entry: {},
        exit: { stopLoss: { type: 'atr' }, takeProfit: { type: 'atr' } },
      };
      const context = createMockContext();

      const confidence = calculator.calculateConfidence(strategy, context);

      expect(confidence).toBe(70);
    });

    it('should evaluate >= operator', () => {
      vi.mocked(mockIndicatorEngine.resolveIndicatorValue).mockReturnValue(100);
      const strategy: StrategyDefinition = {
        id: 'test',
        name: 'Test',
        version: '1.0',
        description: 'Test',
        confidence: {
          base: 60,
          bonuses: [
            { condition: { left: 'volume', op: '>=', right: 100 }, bonus: 10 },
          ],
        },
        parameters: {},
        indicators: {},
        entry: {},
        exit: { stopLoss: { type: 'atr' }, takeProfit: { type: 'atr' } },
      };
      const context = createMockContext();

      const confidence = calculator.calculateConfidence(strategy, context);

      expect(confidence).toBe(70);
    });

    it('should evaluate <= operator', () => {
      vi.mocked(mockIndicatorEngine.resolveIndicatorValue).mockReturnValue(70);
      const strategy: StrategyDefinition = {
        id: 'test',
        name: 'Test',
        version: '1.0',
        description: 'Test',
        confidence: {
          base: 60,
          bonuses: [
            { condition: { left: 'rsi', op: '<=', right: 70 }, bonus: 10 },
          ],
        },
        parameters: {},
        indicators: {},
        entry: {},
        exit: { stopLoss: { type: 'atr' }, takeProfit: { type: 'atr' } },
      };
      const context = createMockContext();

      const confidence = calculator.calculateConfidence(strategy, context);

      expect(confidence).toBe(70);
    });

    it('should evaluate == operator with epsilon', () => {
      vi.mocked(mockIndicatorEngine.resolveIndicatorValue).mockReturnValue(50.000000000001);
      const strategy: StrategyDefinition = {
        id: 'test',
        name: 'Test',
        version: '1.0',
        description: 'Test',
        confidence: {
          base: 60,
          bonuses: [
            { condition: { left: 'price', op: '==', right: 50.000000000001 }, bonus: 10 },
          ],
        },
        parameters: {},
        indicators: {},
        entry: {},
        exit: { stopLoss: { type: 'atr' }, takeProfit: { type: 'atr' } },
      };
      const context = createMockContext();

      const confidence = calculator.calculateConfidence(strategy, context);

      expect(confidence).toBe(70);
    });

    it('should evaluate != operator', () => {
      vi.mocked(mockIndicatorEngine.resolveIndicatorValue).mockReturnValue(60);
      const strategy: StrategyDefinition = {
        id: 'test',
        name: 'Test',
        version: '1.0',
        description: 'Test',
        confidence: {
          base: 60,
          bonuses: [
            { condition: { left: 'rsi', op: '!=', right: 50 }, bonus: 10 },
          ],
        },
        parameters: {},
        indicators: {},
        entry: {},
        exit: { stopLoss: { type: 'atr' }, takeProfit: { type: 'atr' } },
      };
      const context = createMockContext();

      const confidence = calculator.calculateConfidence(strategy, context);

      expect(confidence).toBe(70);
    });

    it('should not apply bonus when condition is not met', () => {
      vi.mocked(mockIndicatorEngine.resolveIndicatorValue).mockReturnValue(50);
      const strategy: StrategyDefinition = {
        id: 'test',
        name: 'Test',
        version: '1.0',
        description: 'Test',
        confidence: {
          base: 60,
          bonuses: [
            { condition: { left: 'volume', op: '>', right: 200 }, bonus: 10 },
          ],
        },
        parameters: {},
        indicators: {},
        entry: {},
        exit: { stopLoss: { type: 'atr' }, takeProfit: { type: 'atr' } },
      };
      const context = createMockContext();

      const confidence = calculator.calculateConfidence(strategy, context);

      expect(confidence).toBe(60);
    });

    it('should return false for unknown operator', () => {
      vi.mocked(mockIndicatorEngine.resolveIndicatorValue).mockReturnValue(50);
      const strategy: StrategyDefinition = {
        id: 'test',
        name: 'Test',
        version: '1.0',
        description: 'Test',
        confidence: {
          base: 60,
          bonuses: [
            { condition: { left: 'volume', op: 'unknown' as '>', right: 100 }, bonus: 10 },
          ],
        },
        parameters: {},
        indicators: {},
        entry: {},
        exit: { stopLoss: { type: 'atr' }, takeProfit: { type: 'atr' } },
      };
      const context = createMockContext();

      const confidence = calculator.calculateConfidence(strategy, context);

      expect(confidence).toBe(60);
    });

    it('should return false when operand resolves to null', () => {
      vi.mocked(mockIndicatorEngine.resolveIndicatorValue).mockReturnValue(null);
      const strategy: StrategyDefinition = {
        id: 'test',
        name: 'Test',
        version: '1.0',
        description: 'Test',
        confidence: {
          base: 60,
          bonuses: [
            { condition: { left: 'nonexistent', op: '>', right: 100 }, bonus: 10 },
          ],
        },
        parameters: {},
        indicators: {},
        entry: {},
        exit: { stopLoss: { type: 'atr' }, takeProfit: { type: 'atr' } },
      };
      const context = createMockContext();

      const confidence = calculator.calculateConfidence(strategy, context);

      expect(confidence).toBe(60);
    });

    it('should resolve parameter references in condition operands', () => {
      vi.mocked(mockIndicatorEngine.resolveIndicatorValue).mockReturnValue(150);
      const strategy: StrategyDefinition = {
        id: 'test',
        name: 'Test',
        version: '1.0',
        description: 'Test',
        confidence: {
          base: 60,
          bonuses: [
            { condition: { left: 'volume', op: '>', right: '$threshold' as unknown as number }, bonus: 10 },
          ],
        },
        parameters: {},
        indicators: {},
        entry: {},
        exit: { stopLoss: { type: 'atr' }, takeProfit: { type: 'atr' } },
      };
      const context = createMockContext({ params: { threshold: 100 } });

      const confidence = calculator.calculateConfidence(strategy, context);

      expect(confidence).toBe(70);
    });

    it('should return null for missing parameter reference in condition operand', () => {
      vi.mocked(mockIndicatorEngine.resolveIndicatorValue).mockReturnValue(150);
      const strategy: StrategyDefinition = {
        id: 'test',
        name: 'Test',
        version: '1.0',
        description: 'Test',
        confidence: {
          base: 60,
          bonuses: [
            { condition: { left: 'volume', op: '>', right: '$missing' as unknown as number }, bonus: 10 },
          ],
        },
        parameters: {},
        indicators: {},
        entry: {},
        exit: { stopLoss: { type: 'atr' }, takeProfit: { type: 'atr' } },
      };
      const context = createMockContext({ params: {} });

      const confidence = calculator.calculateConfidence(strategy, context);

      expect(confidence).toBe(60);
    });
  });

  describe('calculateStopLoss - pivot-based', () => {
    it('should throw for insufficient klines', () => {
      const exit: ExitLevel = { type: 'pivotBased' };
      const context = createMockContext({ klines: [], currentIndex: 3 });

      expect(() => calculator.calculateStopLoss(exit, context)).toThrow('Insufficient klines for pivot-based stop');
    });

    it('should fall back to swing-based stop when no pivots found for LONG', () => {
      vi.mocked(analyzePivots).mockReturnValue({
        pivots: [],
        resistanceLevels: [],
        supportLevels: [],
        nearestResistance: null,
        nearestSupport: null,
      });
      const exit: ExitLevel = { type: 'pivotBased' };
      const context = createMockContext({ direction: 'LONG', entryPrice: 52000, currentIndex: 20 });

      const stopLoss = calculator.calculateStopLoss(exit, context);

      expect(stopLoss).toBeLessThan(52000);
    });

    it('should use strong pivot with volume confirmation for LONG stop', () => {
      const strongPivot: EnhancedPivotPoint = {
        type: 'low',
        index: 15,
        openTime: 1000000,
        price: 49000,
        strength: 'strong',
        volumeConfirmed: true,
        volumeRatio: 1.5,
        priceDistance: 0.02,
      };
      vi.mocked(analyzePivots).mockReturnValue({
        pivots: [strongPivot],
        resistanceLevels: [],
        supportLevels: [49000],
        nearestResistance: null,
        nearestSupport: 49000,
      });
      const exit: ExitLevel = { type: 'pivotBased' };
      const context = createMockContext({ direction: 'LONG', entryPrice: 50000, currentIndex: 20 });

      const stopLoss = calculator.calculateStopLoss(exit, context);

      expect(stopLoss).toBeLessThan(50000);
      expect(stopLoss).toBeLessThan(49000);
    });

    it('should use strong pivot without volume for SHORT stop', () => {
      const strongPivot: EnhancedPivotPoint = {
        type: 'high',
        index: 15,
        openTime: 1000000,
        price: 51000,
        strength: 'strong',
        volumeConfirmed: false,
        volumeRatio: 0.8,
        priceDistance: 0.02,
      };
      vi.mocked(analyzePivots).mockReturnValue({
        pivots: [strongPivot],
        resistanceLevels: [51000],
        supportLevels: [],
        nearestResistance: 51000,
        nearestSupport: null,
      });
      const exit: ExitLevel = { type: 'pivotBased' };
      const context = createMockContext({ direction: 'SHORT', entryPrice: 50000, currentIndex: 20 });

      const stopLoss = calculator.calculateStopLoss(exit, context);

      expect(stopLoss).toBeGreaterThan(50000);
    });

    it('should use medium pivot when no strong pivots are available', () => {
      const mediumPivot: EnhancedPivotPoint = {
        type: 'low',
        index: 12,
        openTime: 1000000,
        price: 48500,
        strength: 'medium',
        volumeConfirmed: false,
        volumeRatio: 1.0,
        priceDistance: 0.03,
      };
      vi.mocked(analyzePivots).mockReturnValue({
        pivots: [mediumPivot],
        resistanceLevels: [],
        supportLevels: [48500],
        nearestResistance: null,
        nearestSupport: 48500,
      });
      const exit: ExitLevel = { type: 'pivotBased' };
      const context = createMockContext({ direction: 'LONG', entryPrice: 50000, currentIndex: 20 });

      const stopLoss = calculator.calculateStopLoss(exit, context);

      expect(stopLoss).toBeLessThan(50000);
    });

    it('should apply custom ATR buffer to pivot stop', () => {
      const strongPivot: EnhancedPivotPoint = {
        type: 'low',
        index: 15,
        openTime: 1000000,
        price: 48000,
        strength: 'strong',
        volumeConfirmed: true,
        volumeRatio: 1.5,
        priceDistance: 0.04,
      };
      vi.mocked(analyzePivots).mockReturnValue({
        pivots: [strongPivot],
        resistanceLevels: [],
        supportLevels: [48000],
        nearestResistance: null,
        nearestSupport: 48000,
      });
      const exit: ExitLevel = { type: 'pivotBased', buffer: 1.5 };
      const context = createMockContext({ direction: 'LONG', entryPrice: 50000, currentIndex: 20 });

      const stopLoss = calculator.calculateStopLoss(exit, context);

      expect(stopLoss).toBeLessThan(48000);
    });

    it('should fall back to swing stop when pivot stop is too close to entry', () => {
      const closePivot: EnhancedPivotPoint = {
        type: 'low',
        index: 15,
        openTime: 1000000,
        price: 49999,
        strength: 'strong',
        volumeConfirmed: true,
        volumeRatio: 1.5,
        priceDistance: 0.0001,
      };
      vi.mocked(analyzePivots).mockReturnValue({
        pivots: [closePivot],
        resistanceLevels: [],
        supportLevels: [49999],
        nearestResistance: null,
        nearestSupport: 49999,
      });
      const exit: ExitLevel = { type: 'pivotBased' };
      const context = createMockContext({ direction: 'LONG', entryPrice: 50000, currentIndex: 20 });

      const stopLoss = calculator.calculateStopLoss(exit, context);

      expect(stopLoss).toBeLessThan(50000);
      const separationPercent = (Math.abs(50000 - stopLoss) / 50000) * 100;
      expect(separationPercent).toBeGreaterThanOrEqual(0.5);
    });

    it('should skip weak pivots and fall back', () => {
      const weakPivot: EnhancedPivotPoint = {
        type: 'low',
        index: 15,
        openTime: 1000000,
        price: 48000,
        strength: 'weak',
        volumeConfirmed: false,
        volumeRatio: 0.5,
        priceDistance: 0.04,
      };
      vi.mocked(analyzePivots).mockReturnValue({
        pivots: [weakPivot],
        resistanceLevels: [],
        supportLevels: [48000],
        nearestResistance: null,
        nearestSupport: 48000,
      });
      const exit: ExitLevel = { type: 'pivotBased' };
      const context = createMockContext({ direction: 'LONG', entryPrice: 50000, currentIndex: 20 });

      const stopLoss = calculator.calculateStopLoss(exit, context);

      expect(stopLoss).toBeLessThan(50000);
    });
  });

  describe('calculateTakeProfit - pivot-based', () => {
    it('should throw for insufficient klines', () => {
      const exit: ExitLevel = { type: 'pivotBased' };
      const context = createMockContext({ klines: [], currentIndex: 3 });

      expect(() => calculator.calculateTakeProfit(exit, context)).toThrow('Insufficient klines for pivot-based target');
    });

    it('should use pivot target for LONG when valid', () => {
      const resistancePivot: EnhancedPivotPoint = {
        type: 'high',
        index: 10,
        openTime: 1000000,
        price: 53000,
        strength: 'strong',
        volumeConfirmed: true,
        volumeRatio: 1.5,
        priceDistance: 0.06,
      };
      vi.mocked(findNearestPivotTarget).mockReturnValue({
        target: 53000,
        pivot: resistancePivot,
      });
      const exit: ExitLevel = { type: 'pivotBased' };
      const context = createMockContext({ direction: 'LONG', entryPrice: 50000, currentIndex: 20 });

      const takeProfit = calculator.calculateTakeProfit(exit, context);

      expect(takeProfit).toBe(53000);
    });

    it('should use pivot target for SHORT when valid', () => {
      const supportPivot: EnhancedPivotPoint = {
        type: 'low',
        index: 10,
        openTime: 1000000,
        price: 47000,
        strength: 'strong',
        volumeConfirmed: true,
        volumeRatio: 1.5,
        priceDistance: 0.06,
      };
      vi.mocked(findNearestPivotTarget).mockReturnValue({
        target: 47000,
        pivot: supportPivot,
      });
      const exit: ExitLevel = { type: 'pivotBased' };
      const context = createMockContext({ direction: 'SHORT', entryPrice: 50000, currentIndex: 20 });

      const takeProfit = calculator.calculateTakeProfit(exit, context);

      expect(takeProfit).toBe(47000);
    });

    it('should use fallback when no pivot target found and fallback configured', () => {
      vi.mocked(findNearestPivotTarget).mockReturnValue({ target: null, pivot: null });
      vi.mocked(mockIndicatorEngine.resolveIndicatorValue).mockReturnValue(500);
      const exit: ExitLevel = {
        type: 'pivotBased',
        fallback: { type: 'percent', value: 4 },
      };
      const context = createMockContext({ direction: 'LONG', entryPrice: 50000, currentIndex: 20 });

      const takeProfit = calculator.calculateTakeProfit(exit, context);

      expect(takeProfit).toBe(52000);
    });

    it('should use 2:1 R:R fallback when no pivot found and stopLossPrice provided', () => {
      vi.mocked(findNearestPivotTarget).mockReturnValue({ target: null, pivot: null });
      vi.mocked(mockIndicatorEngine.resolveIndicatorValue).mockReturnValue(500);
      const exit: ExitLevel = { type: 'pivotBased' };
      const context = createMockContext({ direction: 'LONG', entryPrice: 50000, currentIndex: 20 });

      const takeProfit = calculator.calculateTakeProfit(exit, context, 49000);

      expect(takeProfit).toBe(52000);
    });

    it('should use ATR fallback when no pivot found and no stopLossPrice', () => {
      vi.mocked(findNearestPivotTarget).mockReturnValue({ target: null, pivot: null });
      vi.mocked(mockIndicatorEngine.resolveIndicatorValue).mockReturnValue(500);
      const exit: ExitLevel = { type: 'pivotBased' };
      const context = createMockContext({ direction: 'LONG', entryPrice: 50000, currentIndex: 20 });

      const takeProfit = calculator.calculateTakeProfit(exit, context);

      expect(takeProfit).toBe(51500);
    });

    it('should use ATR fallback for SHORT when no pivot found and no stopLossPrice', () => {
      vi.mocked(findNearestPivotTarget).mockReturnValue({ target: null, pivot: null });
      vi.mocked(mockIndicatorEngine.resolveIndicatorValue).mockReturnValue(500);
      const exit: ExitLevel = { type: 'pivotBased' };
      const context = createMockContext({ direction: 'SHORT', entryPrice: 50000, currentIndex: 20 });

      const takeProfit = calculator.calculateTakeProfit(exit, context);

      expect(takeProfit).toBe(48500);
    });

    it('should throw when pivot target is on wrong side without fallback', () => {
      const badPivot: EnhancedPivotPoint = {
        type: 'low',
        index: 10,
        openTime: 1000000,
        price: 48000,
        strength: 'strong',
        volumeConfirmed: true,
        volumeRatio: 1.5,
        priceDistance: 0.04,
      };
      vi.mocked(findNearestPivotTarget).mockReturnValue({
        target: 48000,
        pivot: badPivot,
      });
      const exit: ExitLevel = { type: 'pivotBased' };
      const context = createMockContext({ direction: 'LONG', entryPrice: 50000, currentIndex: 20 });

      expect(() => calculator.calculateTakeProfit(exit, context)).toThrow('Invalid pivot-based target');
    });

    it('should use fallback when pivot target is on wrong side and fallback configured', () => {
      const badPivot: EnhancedPivotPoint = {
        type: 'low',
        index: 10,
        openTime: 1000000,
        price: 48000,
        strength: 'strong',
        volumeConfirmed: true,
        volumeRatio: 1.5,
        priceDistance: 0.04,
      };
      vi.mocked(findNearestPivotTarget).mockReturnValue({
        target: 48000,
        pivot: badPivot,
      });
      vi.mocked(mockIndicatorEngine.resolveIndicatorValue).mockReturnValue(500);
      const exit: ExitLevel = {
        type: 'pivotBased',
        fallback: { type: 'percent', value: 3 },
      };
      const context = createMockContext({ direction: 'LONG', entryPrice: 50000, currentIndex: 20 });

      const takeProfit = calculator.calculateTakeProfit(exit, context);

      expect(takeProfit).toBe(51500);
    });

    it('should reject pivot that does not meet minimum strength filter', () => {
      const weakPivot: EnhancedPivotPoint = {
        type: 'high',
        index: 10,
        openTime: 1000000,
        price: 53000,
        strength: 'weak',
        volumeConfirmed: false,
        volumeRatio: 0.5,
        priceDistance: 0.06,
      };
      vi.mocked(findNearestPivotTarget).mockReturnValue({
        target: 53000,
        pivot: weakPivot,
      });
      vi.mocked(mockIndicatorEngine.resolveIndicatorValue).mockReturnValue(500);
      const exit: ExitLevel = {
        type: 'pivotBased',
        pivotConfig: { minStrength: 'strong' },
      };
      const context = createMockContext({ direction: 'LONG', entryPrice: 50000, currentIndex: 20 });

      const takeProfit = calculator.calculateTakeProfit(exit, context, 49000);

      expect(takeProfit).toBe(52000);
    });

    it('should reject pivot without volume confirmation when required', () => {
      const unconfirmedPivot: EnhancedPivotPoint = {
        type: 'high',
        index: 10,
        openTime: 1000000,
        price: 53000,
        strength: 'strong',
        volumeConfirmed: false,
        volumeRatio: 0.8,
        priceDistance: 0.06,
      };
      vi.mocked(findNearestPivotTarget).mockReturnValue({
        target: 53000,
        pivot: unconfirmedPivot,
      });
      vi.mocked(mockIndicatorEngine.resolveIndicatorValue).mockReturnValue(500);
      const exit: ExitLevel = {
        type: 'pivotBased',
        pivotConfig: { requireVolumeConfirmation: true },
      };
      const context = createMockContext({ direction: 'LONG', entryPrice: 50000, currentIndex: 20 });

      const takeProfit = calculator.calculateTakeProfit(exit, context, 49000);

      expect(takeProfit).toBe(52000);
    });
  });

  describe('calculateStopLoss - swing with fibonacciSwing', () => {
    it('should use fibonacciSwing swingLow for LONG stop', () => {
      const exit: ExitLevel = { type: 'swingHighLow' };
      const context = createMockContext({
        direction: 'LONG',
        entryPrice: 52000,
        fibonacciSwing: {
          swingLow: { price: 49000, index: 10 },
          swingHigh: { price: 54000, index: 15 },
        },
      });

      const stopLoss = calculator.calculateStopLoss(exit, context);

      expect(stopLoss).toBeLessThan(52000);
      expect(stopLoss).toBeLessThan(49000);
    });

    it('should use fibonacciSwing swingHigh for SHORT stop', () => {
      const exit: ExitLevel = { type: 'swingHighLow' };
      const context = createMockContext({
        direction: 'SHORT',
        entryPrice: 48000,
        fibonacciSwing: {
          swingLow: { price: 46000, index: 10 },
          swingHigh: { price: 50000, index: 15 },
        },
      });

      const stopLoss = calculator.calculateStopLoss(exit, context);

      expect(stopLoss).toBeGreaterThan(48000);
    });
  });

  describe('calculateStopLoss - swing with custom ATR buffer', () => {
    it('should apply ATR buffer for LONG swing stop', () => {
      const exit: ExitLevel = { type: 'swingHighLow', indicator: 'atr', buffer: 2.0 };
      const context = createMockContext({ direction: 'LONG', entryPrice: 52000 });

      const stopLoss = calculator.calculateStopLoss(exit, context);

      expect(stopLoss).toBeLessThan(52000);
    });

    it('should apply ATR buffer for SHORT swing stop', () => {
      const exit: ExitLevel = { type: 'swingHighLow', indicator: 'atr', buffer: 2.0 };
      const context = createMockContext({ direction: 'SHORT', entryPrice: 48000 });

      const stopLoss = calculator.calculateStopLoss(exit, context);

      expect(stopLoss).toBeGreaterThan(48000);
    });

    it('should apply percentage buffer when indicator is not ATR', () => {
      const exit: ExitLevel = { type: 'swingHighLow', buffer: 1.0 };
      const context = createMockContext({ direction: 'LONG', entryPrice: 52000 });

      const stopLoss = calculator.calculateStopLoss(exit, context);

      expect(stopLoss).toBeLessThan(52000);
    });

    it('should enforce minimum ATR buffer', () => {
      const exit: ExitLevel = { type: 'swingHighLow', indicator: 'atr', buffer: 0.1 };
      const context = createMockContext({ direction: 'LONG', entryPrice: 52000 });

      const stopLoss = calculator.calculateStopLoss(exit, context);

      expect(stopLoss).toBeLessThan(52000);
    });
  });

  describe('calculateStopLoss - swing fallback when stop is on wrong side', () => {
    it('should use ATR-based fallback when swing stop is above entry for LONG', () => {
      const klines: Kline[] = [];
      for (let i = 0; i < 50; i++) {
        klines.push({
          openTime: Date.now() - (50 - i) * 3600000,
          open: '50000',
          high: '50200',
          low: '50100',
          close: '50150',
          volume: '100',
          closeTime: Date.now() - (49 - i) * 3600000,
          quoteVolume: '5000000',
          trades: 1000,
          takerBuyBaseVolume: '50',
          takerBuyQuoteVolume: '2500000',
        });
      }
      const exit: ExitLevel = { type: 'swingHighLow' };
      const context = createMockContext({
        direction: 'LONG',
        entryPrice: 50000,
        klines,
        currentIndex: 20,
      });

      const stopLoss = calculator.calculateStopLoss(exit, context);

      expect(stopLoss).toBeLessThan(50000);
    });
  });

  describe('calculateStopLoss - zero ATR', () => {
    it('should handle zero ATR value gracefully for ATR-based stop', () => {
      vi.mocked(mockIndicatorEngine.resolveIndicatorValue).mockReturnValue(0);
      const exit: ExitLevel = { type: 'percent', value: 2 };
      const context = createMockContext({ direction: 'LONG', entryPrice: 50000 });

      const stopLoss = calculator.calculateStopLoss(exit, context);

      expect(stopLoss).toBe(49000);
    });

    it('should handle null ATR value by using zero distance and enforcing minimum', () => {
      vi.mocked(mockIndicatorEngine.resolveIndicatorValue).mockReturnValue(null);
      const exit: ExitLevel = { type: 'atr', multiplier: 2 };
      const context = createMockContext({ direction: 'LONG', entryPrice: 50000 });

      const stopLoss = calculator.calculateStopLoss(exit, context);

      expect(stopLoss).toBeLessThan(50000);
      const distancePercent = Math.abs(50000 - stopLoss) / 50000;
      expect(distancePercent).toBeGreaterThanOrEqual(0.005);
    });
  });

  describe('calculateTakeProfit - fixed', () => {
    it('should calculate fixed TP for LONG', () => {
      vi.mocked(mockIndicatorEngine.resolveIndicatorValue).mockReturnValue(500);
      const exit: ExitLevel = { type: 'fixed', value: 2000 };
      const context = createMockContext({ direction: 'LONG', entryPrice: 50000 });

      const takeProfit = calculator.calculateTakeProfit(exit, context);

      expect(takeProfit).toBe(52000);
    });

    it('should calculate fixed TP for SHORT', () => {
      vi.mocked(mockIndicatorEngine.resolveIndicatorValue).mockReturnValue(500);
      const exit: ExitLevel = { type: 'fixed', value: 2000 };
      const context = createMockContext({ direction: 'SHORT', entryPrice: 50000 });

      const takeProfit = calculator.calculateTakeProfit(exit, context);

      expect(takeProfit).toBe(48000);
    });
  });

  describe('calculateTakeProfit - riskReward without stopLossPrice', () => {
    it('should use default distance when riskReward has no stopLossPrice for LONG', () => {
      vi.mocked(mockIndicatorEngine.resolveIndicatorValue).mockReturnValue(500);
      const exit: ExitLevel = { type: 'riskReward', multiplier: 2 };
      const context = createMockContext({ direction: 'LONG', entryPrice: 50000 });

      const takeProfit = calculator.calculateTakeProfit(exit, context);

      expect(takeProfit).toBeGreaterThan(50000);
    });
  });

  describe('calculateTakeProfit - indicator with value as number', () => {
    it('should use numeric value directly for indicator type', () => {
      vi.mocked(mockIndicatorEngine.resolveIndicatorValue).mockReturnValue(500);
      const exit: ExitLevel = { type: 'indicator', value: 53000 };
      const context = createMockContext({ direction: 'LONG', entryPrice: 50000 });

      const takeProfit = calculator.calculateTakeProfit(exit, context);

      expect(takeProfit).toBe(53000);
    });

    it('should use numeric value for SHORT indicator type', () => {
      vi.mocked(mockIndicatorEngine.resolveIndicatorValue).mockReturnValue(500);
      const exit: ExitLevel = { type: 'indicator', value: 47000 };
      const context = createMockContext({ direction: 'SHORT', entryPrice: 50000 });

      const takeProfit = calculator.calculateTakeProfit(exit, context);

      expect(takeProfit).toBe(47000);
    });
  });

  describe('calculateTakeProfit - validation for distance-based types', () => {
    it('should throw when percent TP results in loss for LONG', () => {
      vi.mocked(mockIndicatorEngine.resolveIndicatorValue).mockReturnValue(500);
      const exit: ExitLevel = { type: 'percent', value: -5 };
      const context = createMockContext({ direction: 'LONG', entryPrice: 50000 });

      expect(() => calculator.calculateTakeProfit(exit, context)).toThrow('Invalid take profit');
    });

    it('should throw when percent TP results in loss for SHORT', () => {
      vi.mocked(mockIndicatorEngine.resolveIndicatorValue).mockReturnValue(500);
      const exit: ExitLevel = { type: 'percent', value: -5 };
      const context = createMockContext({ direction: 'SHORT', entryPrice: 50000 });

      expect(() => calculator.calculateTakeProfit(exit, context)).toThrow('Invalid take profit');
    });
  });

  describe('calculateExitDistance - indicator type with fallback', () => {
    it('should use fallback distance when indicator returns null for stop', () => {
      vi.mocked(mockIndicatorEngine.resolveIndicatorValue)
        .mockReturnValueOnce(null)
        .mockReturnValue(500);
      const exit: ExitLevel = {
        type: 'indicator',
        indicator: 'nonexistent',
        fallback: { type: 'percent', value: 2 },
      };
      const context = createMockContext({ direction: 'LONG', entryPrice: 50000 });

      const stopLoss = calculator.calculateStopLoss(exit, context);

      expect(stopLoss).toBeLessThan(50000);
    });

    it('should use default distance when indicator returns null and no fallback', () => {
      vi.mocked(mockIndicatorEngine.resolveIndicatorValue)
        .mockReturnValueOnce(null)
        .mockReturnValue(500);
      const exit: ExitLevel = { type: 'indicator' };
      const context = createMockContext({ direction: 'LONG', entryPrice: 50000 });

      const stopLoss = calculator.calculateStopLoss(exit, context);

      expect(stopLoss).toBeLessThan(50000);
    });
  });

  describe('calculateDefaultConfidence', () => {
    it('should add volume confirmation bonus when current volume exceeds SMA20', () => {
      vi.mocked(mockIndicatorEngine.resolveIndicatorValue).mockImplementation(
        (_indicators: unknown, ref: string) => {
          if (ref === 'volume.current') return 200;
          if (ref === 'volume.sma20') return 100;
          return 500;
        }
      );
      const strategy: StrategyDefinition = {
        id: 'test',
        name: 'Test',
        version: '1.0',
        description: 'Test',
        parameters: {},
        indicators: {},
        entry: {},
        exit: { stopLoss: { type: 'atr' }, takeProfit: { type: 'atr' } },
      };
      const context = createMockContext();

      const confidence = calculator.calculateConfidence(strategy, context);

      expect(confidence).toBe(70);
    });

    it('should not add volume bonus when current volume is below SMA20', () => {
      vi.mocked(mockIndicatorEngine.resolveIndicatorValue).mockImplementation(
        (_indicators: unknown, ref: string) => {
          if (ref === 'volume.current') return 50;
          if (ref === 'volume.sma20') return 100;
          return 500;
        }
      );
      const strategy: StrategyDefinition = {
        id: 'test',
        name: 'Test',
        version: '1.0',
        description: 'Test',
        parameters: {},
        indicators: {},
        entry: {},
        exit: { stopLoss: { type: 'atr' }, takeProfit: { type: 'atr' } },
      };
      const context = createMockContext();

      const confidence = calculator.calculateConfidence(strategy, context);

      expect(confidence).toBe(60);
    });

    it('should not add volume bonus when volume indicators are null', () => {
      vi.mocked(mockIndicatorEngine.resolveIndicatorValue).mockImplementation(
        (_indicators: unknown, ref: string) => {
          if (ref === 'volume.current') return null;
          if (ref === 'volume.sma20') return null;
          return 500;
        }
      );
      const strategy: StrategyDefinition = {
        id: 'test',
        name: 'Test',
        version: '1.0',
        description: 'Test',
        parameters: {},
        indicators: {},
        entry: {},
        exit: { stopLoss: { type: 'atr' }, takeProfit: { type: 'atr' } },
      };
      const context = createMockContext();

      const confidence = calculator.calculateConfidence(strategy, context);

      expect(confidence).toBe(60);
    });
  });

  describe('resolveOperand edge cases', () => {
    it('should use zero distance for fixed type without value and enforce minimum', () => {
      vi.mocked(mockIndicatorEngine.resolveIndicatorValue).mockReturnValue(500);
      const exit: ExitLevel = { type: 'fixed' };
      const context = createMockContext({ direction: 'LONG', entryPrice: 50000 });

      const stopLoss = calculator.calculateStopLoss(exit, context);

      expect(stopLoss).toBeLessThan(50000);
      const distancePercent = Math.abs(50000 - stopLoss) / 50000;
      expect(distancePercent).toBeGreaterThanOrEqual(0.005);
    });

    it('should handle indicator reference in multiplier', () => {
      vi.mocked(mockIndicatorEngine.resolveIndicatorValue).mockReturnValue(2);
      const exit: ExitLevel = { type: 'atr', multiplier: 'atr.multiplier' as unknown as number };
      const context = createMockContext({ direction: 'LONG', entryPrice: 50000 });

      const stopLoss = calculator.calculateStopLoss(exit, context);

      expect(stopLoss).toBeLessThan(50000);
    });
  });

  describe('calculateTakeProfit - indicator with fallback chain', () => {
    it('should use indicator TP fallback when indicator value is null and fallback provided', () => {
      vi.mocked(mockIndicatorEngine.resolveIndicatorValue).mockImplementation(
        (_indicators: unknown, ref: string) => {
          if (ref === 'nonexistent') return null;
          return 500;
        }
      );
      const exit: ExitLevel = {
        type: 'indicator',
        value: 'nonexistent' as unknown as number,
        fallback: { type: 'atr', multiplier: 3 },
      };
      const context = createMockContext({ direction: 'LONG', entryPrice: 50000 });

      const takeProfit = calculator.calculateTakeProfit(exit, context);

      expect(takeProfit).toBeGreaterThan(50000);
    });
  });

  describe('pivotConfig customization', () => {
    it('should pass custom lookback to pivot config', () => {
      vi.mocked(analyzePivots).mockReturnValue({
        pivots: [],
        resistanceLevels: [],
        supportLevels: [],
        nearestResistance: null,
        nearestSupport: null,
      });
      const exit: ExitLevel = {
        type: 'pivotBased',
        lookback: 10,
        pivotConfig: { volumeLookback: 30, volumeMultiplier: 1.5 },
      };
      const context = createMockContext({ direction: 'LONG', entryPrice: 52000, currentIndex: 20 });

      calculator.calculateStopLoss(exit, context);

      expect(analyzePivots).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          lookback: 10,
          lookahead: 2,
          volumeLookback: 30,
          volumeMultiplier: 1.5,
        })
      );
    });
  });

  describe('calculateStopLoss - minimum volatility distance enforcement', () => {
    it('should enforce minimum stop distance when stop is too tight for LONG', () => {
      vi.mocked(mockIndicatorEngine.resolveIndicatorValue).mockReturnValue(500);
      const exit: ExitLevel = { type: 'percent', value: 0.0001 };
      const context = createMockContext({ direction: 'LONG', entryPrice: 50000 });

      const stopLoss = calculator.calculateStopLoss(exit, context);

      const distancePercent = Math.abs(50000 - stopLoss) / 50000;
      expect(distancePercent).toBeGreaterThanOrEqual(0.005);
    });

    it('should enforce minimum stop distance when stop is too tight for SHORT', () => {
      vi.mocked(mockIndicatorEngine.resolveIndicatorValue).mockReturnValue(500);
      const exit: ExitLevel = { type: 'percent', value: 0.0001 };
      const context = createMockContext({ direction: 'SHORT', entryPrice: 50000 });

      const stopLoss = calculator.calculateStopLoss(exit, context);

      const distancePercent = Math.abs(50000 - stopLoss) / 50000;
      expect(distancePercent).toBeGreaterThanOrEqual(0.005);
    });
  });

  describe('calculateRiskReward - additional scenarios', () => {
    it('should return correct R:R for small risk distance', () => {
      const rr = calculator.calculateRiskReward(50000, 49900, 50500, 'LONG');

      expect(rr).toBe(5);
    });

    it('should return fractional R:R when reward is less than risk', () => {
      const rr = calculator.calculateRiskReward(50000, 49000, 50500, 'LONG');

      expect(rr).toBe(0.5);
    });
  });

  describe('findSwingHigh - fallback paths', () => {
    it('should use findMostRecentSwingHigh when findSignificantSwingHigh returns null', () => {
      vi.mocked(findSignificantSwingHigh).mockReturnValue(null);
      vi.mocked(findMostRecentSwingHigh).mockReturnValue({ index: 15, price: 50500, type: 'high', timestamp: 1000000 });

      const exit: ExitLevel = { type: 'swingHighLow' };
      const context = createMockContext({ direction: 'SHORT', entryPrice: 48000 });

      const stopLoss = calculator.calculateStopLoss(exit, context);

      expect(stopLoss).toBeGreaterThan(48000);
    });

    it('should use findMostRecentSwingLow when findSignificantSwingLow returns null', () => {
      vi.mocked(findSignificantSwingLow).mockReturnValue(null);
      vi.mocked(findMostRecentSwingLow).mockReturnValue({ index: 10, price: 49500, type: 'low', timestamp: 1000000 });

      const exit: ExitLevel = { type: 'swingHighLow' };
      const context = createMockContext({ direction: 'LONG', entryPrice: 52000 });

      const stopLoss = calculator.calculateStopLoss(exit, context);

      expect(stopLoss).toBeLessThan(52000);
    });
  });

  describe('calculatePivotBasedStop - SHORT with custom buffer', () => {
    it('should apply buffer in correct direction for SHORT pivot stop', () => {
      const strongPivot: EnhancedPivotPoint = {
        type: 'high',
        index: 15,
        openTime: 1000000,
        price: 51000,
        strength: 'strong',
        volumeConfirmed: true,
        volumeRatio: 1.5,
        priceDistance: 0.02,
      };
      vi.mocked(analyzePivots).mockReturnValue({
        pivots: [strongPivot],
        resistanceLevels: [51000],
        supportLevels: [],
        nearestResistance: 51000,
        nearestSupport: null,
      });
      const exit: ExitLevel = { type: 'pivotBased', buffer: 0.5 };
      const context = createMockContext({ direction: 'SHORT', entryPrice: 50000, currentIndex: 20 });

      const stopLoss = calculator.calculateStopLoss(exit, context);

      expect(stopLoss).toBeGreaterThan(51000);
    });
  });

  describe('calculatePivotBasedStop - invalid pivot stop for SHORT falls back', () => {
    it('should fall back to swing stop when SHORT pivot stop is below entry', () => {
      const closePivot: EnhancedPivotPoint = {
        type: 'high',
        index: 15,
        openTime: 1000000,
        price: 50001,
        strength: 'strong',
        volumeConfirmed: true,
        volumeRatio: 1.5,
        priceDistance: 0.0001,
      };
      vi.mocked(analyzePivots).mockReturnValue({
        pivots: [closePivot],
        resistanceLevels: [50001],
        supportLevels: [],
        nearestResistance: 50001,
        nearestSupport: null,
      });
      const exit: ExitLevel = { type: 'pivotBased' };
      const context = createMockContext({ direction: 'SHORT', entryPrice: 50000, currentIndex: 20 });

      const stopLoss = calculator.calculateStopLoss(exit, context);

      expect(stopLoss).toBeGreaterThan(50000);
      const separationPercent = (Math.abs(50000 - stopLoss) / 50000) * 100;
      expect(separationPercent).toBeGreaterThanOrEqual(0.5);
    });
  });
});
