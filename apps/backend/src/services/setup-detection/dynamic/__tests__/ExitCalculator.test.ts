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
    breakevenThreshold: 0.005,
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
  };
});

import { ExitCalculator } from '../ExitCalculator';
import type { IndicatorEngine } from '../IndicatorEngine';

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
  });
});
