import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Kline, StrategyDefinition } from '@marketmind/types';

vi.mock('../../../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@marketmind/indicators', () => ({
  calculateFibonacciProjection: vi.fn().mockReturnValue(null),
  selectDynamicFibonacciLevel: vi.fn().mockReturnValue({ level: 1.618, reason: 'mock' }),
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

const mockMethods = {
  indicatorEngine: {
    computeIndicators: vi.fn().mockReturnValue({
      ema: { values: [50000] },
      atr: { values: [500] },
      volume: {
        values: {
          current: [1000000],
          sma20: [800000],
        },
      },
    }),
    resolveIndicatorValue: vi.fn().mockImplementation((_indicators, ref) => {
      if (ref === 'volume.current') return 1000000;
      if (ref === 'volume.sma20') return 800000;
      if (ref === 'ema') return 50000;
      if (ref === 'atr') return 500;
      return null;
    }),
    clearCache: vi.fn(),
  },
  conditionEvaluator: {
    evaluate: vi.fn().mockReturnValue(false),
  },
  exitCalculator: {
    calculateStopLoss: vi.fn().mockReturnValue(49000),
    calculateTakeProfit: vi.fn().mockReturnValue(52000),
    calculateConfidence: vi.fn().mockReturnValue(70),
    calculateRiskReward: vi.fn().mockReturnValue(2.0),
  },
  entryCalculator: {
    calculateEntryPrice: vi.fn().mockReturnValue({
      price: 50050,
      orderType: 'MARKET',
      expirationBars: 0,
    }),
  },
};

vi.mock('../IndicatorEngine', () => ({
  IndicatorEngine: class MockIndicatorEngine {
    computeIndicators = mockMethods.indicatorEngine.computeIndicators;
    resolveIndicatorValue = mockMethods.indicatorEngine.resolveIndicatorValue;
    clearCache = mockMethods.indicatorEngine.clearCache;
  },
}));

vi.mock('../ConditionEvaluator', () => ({
  ConditionEvaluator: class MockConditionEvaluator {
    evaluate = mockMethods.conditionEvaluator.evaluate;
  },
}));

vi.mock('../ExitCalculator', () => ({
  ExitCalculator: class MockExitCalculator {
    calculateStopLoss = mockMethods.exitCalculator.calculateStopLoss;
    calculateTakeProfit = mockMethods.exitCalculator.calculateTakeProfit;
    calculateConfidence = mockMethods.exitCalculator.calculateConfidence;
    calculateRiskReward = mockMethods.exitCalculator.calculateRiskReward;
  },
}));

vi.mock('../EntryCalculator', () => ({
  EntryCalculator: class MockEntryCalculator {
    calculateEntryPrice = mockMethods.entryCalculator.calculateEntryPrice;
  },
}));

import { StrategyInterpreter, type StrategyInterpreterConfig } from '../StrategyInterpreter';

describe('StrategyInterpreter', () => {
  const createMockKlines = (count: number): Kline[] => {
    const klines: Kline[] = [];
    for (let i = 0; i < count; i++) {
      klines.push({
        openTime: Date.now() - (count - i) * 3600000,
        open: (50000 + i * 100).toString(),
        high: (50100 + i * 100).toString(),
        low: (49900 + i * 100).toString(),
        close: (50050 + i * 100).toString(),
        volume: '1000000',
        closeTime: Date.now() - (count - i - 1) * 3600000,
        quoteVolume: '50000000',
        trades: 1000,
        takerBuyBaseVolume: '500000',
        takerBuyQuoteVolume: '25000000',
      });
    }
    return klines;
  };

  const createMockStrategy = (overrides: Partial<StrategyDefinition> = {}): StrategyDefinition => ({
    id: 'test-strategy',
    name: 'Test Strategy',
    version: '1.0.0',
    description: 'A test strategy for unit testing',
    parameters: {
      emaPeriod: { default: 20, min: 5, max: 50, step: 1 },
      atrMultiplier: { default: 2, min: 1, max: 5, step: 0.5 },
    },
    indicators: {
      ema: { type: 'ema', params: { period: 20, source: 'close' } },
      atr: { type: 'atr', params: { period: 14 } },
    },
    entry: {
      long: {
        operator: 'AND',
        conditions: [{ left: 'close', op: '>', right: 'ema' }],
      },
      short: {
        operator: 'AND',
        conditions: [{ left: 'close', op: '<', right: 'ema' }],
      },
    },
    exit: {
      stopLoss: { type: 'atr', multiplier: 2 },
      takeProfit: { type: 'riskReward', multiplier: 2 },
    },
    ...overrides,
  });

  let interpreter: StrategyInterpreter;

  beforeEach(() => {
    vi.clearAllMocks();
    mockMethods.conditionEvaluator.evaluate.mockReturnValue(false);
    mockMethods.exitCalculator.calculateConfidence.mockReturnValue(70);
    mockMethods.exitCalculator.calculateRiskReward.mockReturnValue(2.0);
    mockMethods.exitCalculator.calculateStopLoss.mockReturnValue(49000);
    mockMethods.exitCalculator.calculateTakeProfit.mockReturnValue(52000);
    mockMethods.entryCalculator.calculateEntryPrice.mockReturnValue({
      price: 50050,
      orderType: 'MARKET',
      expirationBars: 0,
    });
  });

  describe('constructor', () => {
    it('should create interpreter with default config', () => {
      const config: StrategyInterpreterConfig = {
        strategy: createMockStrategy(),
        enabled: true,
        minConfidence: 50,
        minRiskReward: 1.5,
      };

      interpreter = new StrategyInterpreter(config);

      expect(interpreter).toBeDefined();
      expect(interpreter.getStrategy()).toEqual(config.strategy);
    });

    it('should resolve parameters with defaults', () => {
      const config: StrategyInterpreterConfig = {
        strategy: createMockStrategy(),
        enabled: true,
        minConfidence: 50,
        minRiskReward: 1.5,
      };

      interpreter = new StrategyInterpreter(config);

      const params = interpreter.getResolvedParams();
      expect(params.emaPeriod).toBe(20);
      expect(params.atrMultiplier).toBe(2);
    });

    it('should apply parameter overrides', () => {
      const config: StrategyInterpreterConfig = {
        strategy: createMockStrategy(),
        enabled: true,
        minConfidence: 50,
        minRiskReward: 1.5,
        parameterOverrides: {
          emaPeriod: 30,
          atrMultiplier: 3,
        },
      };

      interpreter = new StrategyInterpreter(config);

      const params = interpreter.getResolvedParams();
      expect(params.emaPeriod).toBe(30);
      expect(params.atrMultiplier).toBe(3);
    });
  });

  describe('detect', () => {
    it('should return null setup when disabled', () => {
      const config: StrategyInterpreterConfig = {
        strategy: createMockStrategy(),
        enabled: false,
        minConfidence: 50,
        minRiskReward: 1.5,
      };

      interpreter = new StrategyInterpreter(config);
      const klines = createMockKlines(50);

      const result = interpreter.detect(klines, 49);

      expect(result.setup).toBeNull();
      expect(result.confidence).toBe(0);
    });

    it('should return null when no entry conditions triggered', () => {
      const config: StrategyInterpreterConfig = {
        strategy: createMockStrategy(),
        enabled: true,
        minConfidence: 50,
        minRiskReward: 1.5,
      };

      mockMethods.conditionEvaluator.evaluate.mockReturnValue(false);

      interpreter = new StrategyInterpreter(config);
      const klines = createMockKlines(50);

      const result = interpreter.detect(klines, 49);

      expect(result.setup).toBeNull();
    });

    it('should detect LONG setup when conditions are met', () => {
      const config: StrategyInterpreterConfig = {
        strategy: createMockStrategy(),
        enabled: true,
        minConfidence: 50,
        minRiskReward: 1.0,
      };

      mockMethods.conditionEvaluator.evaluate.mockReturnValueOnce(true);

      interpreter = new StrategyInterpreter(config);
      const klines = createMockKlines(50);

      const result = interpreter.detect(klines, 49);

      expect(result.setup).not.toBeNull();
      expect(result.setup?.direction).toBe('LONG');
    });

    it('should detect SHORT setup when conditions are met', () => {
      const config: StrategyInterpreterConfig = {
        strategy: createMockStrategy(),
        enabled: true,
        minConfidence: 50,
        minRiskReward: 1.0,
      };

      mockMethods.conditionEvaluator.evaluate
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);

      interpreter = new StrategyInterpreter(config);
      const klines = createMockKlines(50);

      const result = interpreter.detect(klines, 49);

      expect(result.setup).not.toBeNull();
      expect(result.setup?.direction).toBe('SHORT');
    });
  });

  describe('filters', () => {
    it('should reject setup when confidence below minConfidence filter', () => {
      const strategy = createMockStrategy({
        filters: { minConfidence: 80 },
      });
      const config: StrategyInterpreterConfig = {
        strategy,
        enabled: true,
        minConfidence: 30,
        minRiskReward: 1.0,
      };

      mockMethods.conditionEvaluator.evaluate.mockReturnValueOnce(true);
      mockMethods.exitCalculator.calculateConfidence.mockReturnValue(70);

      interpreter = new StrategyInterpreter(config);
      const klines = createMockKlines(50);

      const result = interpreter.detect(klines, 49);

      expect(result.setup).toBeNull();
    });

    it('should pass when no filters defined', () => {
      const strategy = createMockStrategy();
      delete (strategy as any).filters;

      const config: StrategyInterpreterConfig = {
        strategy,
        enabled: true,
        minConfidence: 50,
        minRiskReward: 1.0,
      };

      mockMethods.conditionEvaluator.evaluate.mockReturnValueOnce(true);

      interpreter = new StrategyInterpreter(config);
      const klines = createMockKlines(50);

      const result = interpreter.detect(klines, 49);

      expect(result.setup).not.toBeNull();
    });
  });

  describe('getStrategy', () => {
    it('should return the strategy definition', () => {
      const strategy = createMockStrategy();
      const config: StrategyInterpreterConfig = {
        strategy,
        enabled: true,
        minConfidence: 50,
        minRiskReward: 1.5,
      };

      interpreter = new StrategyInterpreter(config);

      expect(interpreter.getStrategy()).toEqual(strategy);
    });
  });

  describe('getResolvedParams', () => {
    it('should return a copy of resolved parameters', () => {
      const config: StrategyInterpreterConfig = {
        strategy: createMockStrategy(),
        enabled: true,
        minConfidence: 50,
        minRiskReward: 1.5,
      };

      interpreter = new StrategyInterpreter(config);
      const params1 = interpreter.getResolvedParams();
      const params2 = interpreter.getResolvedParams();

      expect(params1).toEqual(params2);
      expect(params1).not.toBe(params2);
    });
  });

  describe('updateParameters', () => {
    it('should update existing parameters', () => {
      const config: StrategyInterpreterConfig = {
        strategy: createMockStrategy(),
        enabled: true,
        minConfidence: 50,
        minRiskReward: 1.5,
      };

      interpreter = new StrategyInterpreter(config);
      interpreter.updateParameters({ emaPeriod: 30 });

      const params = interpreter.getResolvedParams();
      expect(params.emaPeriod).toBe(30);
    });

    it('should ignore non-existent parameters', () => {
      const config: StrategyInterpreterConfig = {
        strategy: createMockStrategy(),
        enabled: true,
        minConfidence: 50,
        minRiskReward: 1.5,
      };

      interpreter = new StrategyInterpreter(config);
      interpreter.updateParameters({ nonExistent: 999 });

      const params = interpreter.getResolvedParams();
      expect(params.nonExistent).toBeUndefined();
    });

    it('should clear indicator cache after update', () => {
      const config: StrategyInterpreterConfig = {
        strategy: createMockStrategy(),
        enabled: true,
        minConfidence: 50,
        minRiskReward: 1.5,
      };

      interpreter = new StrategyInterpreter(config);
      interpreter.updateParameters({ emaPeriod: 30 });

      expect(mockMethods.indicatorEngine.clearCache).toHaveBeenCalled();
    });
  });

  describe('getParameterRanges', () => {
    it('should return parameter ranges from strategy', () => {
      const config: StrategyInterpreterConfig = {
        strategy: createMockStrategy(),
        enabled: true,
        minConfidence: 50,
        minRiskReward: 1.5,
      };

      interpreter = new StrategyInterpreter(config);
      const ranges = interpreter.getParameterRanges();

      expect(ranges.emaPeriod).toEqual({
        min: 5,
        max: 50,
        step: 1,
        default: 20,
      });
      expect(ranges.atrMultiplier).toEqual({
        min: 1,
        max: 5,
        step: 0.5,
        default: 2,
      });
    });

    it('should calculate default ranges when not specified', () => {
      const strategy = createMockStrategy();
      strategy.parameters = {
        period: { default: 10 },
      };
      const config: StrategyInterpreterConfig = {
        strategy,
        enabled: true,
        minConfidence: 50,
        minRiskReward: 1.5,
      };

      interpreter = new StrategyInterpreter(config);
      const ranges = interpreter.getParameterRanges();

      expect(ranges.period!.min).toBe(5);
      expect(ranges.period!.max).toBe(20);
      expect(ranges.period!.step).toBe(1);
      expect(ranges.period!.default).toBe(10);
    });
  });

  describe('setup creation', () => {
    it('should include strategy metadata in setup', () => {
      const config: StrategyInterpreterConfig = {
        strategy: createMockStrategy(),
        enabled: true,
        minConfidence: 50,
        minRiskReward: 1.0,
      };

      mockMethods.conditionEvaluator.evaluate.mockReturnValueOnce(true);

      interpreter = new StrategyInterpreter(config);
      const klines = createMockKlines(50);

      const result = interpreter.detect(klines, 49);

      expect(result.setup).not.toBeNull();
      const setupData = result.setup?.setupData as Record<string, unknown>;
      expect(setupData?.strategyId).toBe('test-strategy');
      expect(setupData?.strategyVersion).toBe('1.0.0');
      expect(setupData?.strategyName).toBe('Test Strategy');
    });

    it('should set entryOrderType to MARKET', () => {
      const config: StrategyInterpreterConfig = {
        strategy: createMockStrategy(),
        enabled: true,
        minConfidence: 50,
        minRiskReward: 1.0,
      };

      mockMethods.conditionEvaluator.evaluate.mockReturnValueOnce(true);

      interpreter = new StrategyInterpreter(config);
      const klines = createMockKlines(50);

      const result = interpreter.detect(klines, 49);

      expect(result.setup?.entryOrderType).toBe('MARKET');
    });

    it('should use LIMIT entry when entryCalculator returns LIMIT', () => {
      const config: StrategyInterpreterConfig = {
        strategy: createMockStrategy(),
        enabled: true,
        minConfidence: 50,
        minRiskReward: 1.0,
      };

      mockMethods.conditionEvaluator.evaluate.mockReturnValueOnce(true);
      mockMethods.entryCalculator.calculateEntryPrice.mockReturnValue({
        price: 49500,
        orderType: 'LIMIT',
        expirationBars: 3,
      });

      interpreter = new StrategyInterpreter(config);
      const klines = createMockKlines(50);

      const result = interpreter.detect(klines, 49);

      expect(result.setup).not.toBeNull();
      expect(mockMethods.exitCalculator.calculateStopLoss).toHaveBeenCalled();
    });
  });

  describe('entry and stop separation', () => {
    it('should reject setup when entry and stop are too close', () => {
      const config: StrategyInterpreterConfig = {
        strategy: createMockStrategy(),
        enabled: true,
        minConfidence: 50,
        minRiskReward: 1.0,
      };

      mockMethods.conditionEvaluator.evaluate.mockReturnValueOnce(true);
      mockMethods.exitCalculator.calculateStopLoss.mockReturnValue(54949);

      interpreter = new StrategyInterpreter(config);
      const klines = createMockKlines(50);

      const result = interpreter.detect(klines, 49);

      expect(result.setup).toBeNull();
    });

    it('should accept setup with proper entry-stop separation', () => {
      const config: StrategyInterpreterConfig = {
        strategy: createMockStrategy(),
        enabled: true,
        minConfidence: 50,
        minRiskReward: 1.0,
      };

      mockMethods.conditionEvaluator.evaluate.mockReturnValueOnce(true);
      mockMethods.exitCalculator.calculateStopLoss.mockReturnValue(49000);

      interpreter = new StrategyInterpreter(config);
      const klines = createMockKlines(50);

      const result = interpreter.detect(klines, 49);

      expect(result.setup).not.toBeNull();
    });
  });

  describe('minimum requirements', () => {
    it('should reject setup when confidence below minConfidence', () => {
      const config: StrategyInterpreterConfig = {
        strategy: createMockStrategy(),
        enabled: true,
        minConfidence: 80,
        minRiskReward: 1.0,
      };

      mockMethods.conditionEvaluator.evaluate.mockReturnValueOnce(true);
      mockMethods.exitCalculator.calculateConfidence.mockReturnValue(60);

      interpreter = new StrategyInterpreter(config);
      const klines = createMockKlines(50);

      const result = interpreter.detect(klines, 49);

      expect(result.setup).toBeNull();
      expect(result.confidence).toBe(60);
    });

    it('should reject setup when risk/reward below minRiskReward', () => {
      const config: StrategyInterpreterConfig = {
        strategy: createMockStrategy(),
        enabled: true,
        minConfidence: 50,
        minRiskReward: 3.0,
      };

      mockMethods.conditionEvaluator.evaluate.mockReturnValueOnce(true);
      mockMethods.exitCalculator.calculateRiskReward.mockReturnValue(1.5);

      interpreter = new StrategyInterpreter(config);
      const klines = createMockKlines(50);

      const result = interpreter.detect(klines, 49);

      expect(result.setup).toBeNull();
    });
  });

  describe('volume confirmation', () => {
    it('should check volume confirmation using indicator engine', () => {
      const config: StrategyInterpreterConfig = {
        strategy: createMockStrategy(),
        enabled: true,
        minConfidence: 50,
        minRiskReward: 1.0,
      };

      mockMethods.conditionEvaluator.evaluate.mockReturnValueOnce(true);

      interpreter = new StrategyInterpreter(config);
      const klines = createMockKlines(50);

      interpreter.detect(klines, 49);

      expect(mockMethods.indicatorEngine.resolveIndicatorValue).toHaveBeenCalledWith(
        expect.any(Object),
        'volume.current',
        49
      );
      expect(mockMethods.indicatorEngine.resolveIndicatorValue).toHaveBeenCalledWith(
        expect.any(Object),
        'volume.sma20',
        49
      );
    });
  });

  describe('Fibonacci entry progress validation', () => {
    it('should reject setup when entry is past 50% of Fibonacci target', async () => {
      const { calculateFibonacciProjection } = await import('@marketmind/indicators');
      const config: StrategyInterpreterConfig = {
        strategy: createMockStrategy(),
        enabled: true,
        minConfidence: 50,
        minRiskReward: 1.5,
      };

      vi.mocked(calculateFibonacciProjection).mockReturnValueOnce({
        swingLow: { price: 48000, index: 30, timestamp: Date.now() - 20 * 3600000 },
        swingHigh: { price: 50000, index: 45, timestamp: Date.now() - 5 * 3600000 },
        levels: [
          { level: 0, price: 48000, label: '0%' },
          { level: 1, price: 50000, label: '100%' },
          { level: 1.618, price: 51236, label: '161.8%' },
        ],
        range: 2000,
      });

      mockMethods.conditionEvaluator.evaluate.mockReturnValueOnce(true);

      interpreter = new StrategyInterpreter(config);
      const klines = createMockKlines(50);
      klines[49] = { ...klines[49]!, close: '50800' };

      const result = interpreter.detect(klines, 49);

      expect(result.setup).toBeNull();
    });

    it('should accept setup when entry is within 50% of Fibonacci target', async () => {
      const { calculateFibonacciProjection } = await import('@marketmind/indicators');
      const config: StrategyInterpreterConfig = {
        strategy: createMockStrategy(),
        enabled: true,
        minConfidence: 50,
        minRiskReward: 1.5,
      };

      vi.mocked(calculateFibonacciProjection).mockReturnValueOnce({
        swingLow: { price: 48000, index: 30, timestamp: Date.now() - 20 * 3600000 },
        swingHigh: { price: 50000, index: 45, timestamp: Date.now() - 5 * 3600000 },
        levels: [
          { level: 0, price: 48000, label: '0%' },
          { level: 1, price: 50000, label: '100%' },
          { level: 1.618, price: 51236, label: '161.8%' },
        ],
        range: 2000,
      });

      mockMethods.conditionEvaluator.evaluate.mockReturnValueOnce(true);
      mockMethods.exitCalculator.calculateStopLoss.mockReturnValueOnce(48500);

      interpreter = new StrategyInterpreter(config);
      const klines = createMockKlines(50);
      klines[49] = { ...klines[49]!, close: '49000' };

      const result = interpreter.detect(klines, 49);

      expect(result.setup).not.toBeNull();
      expect(result.setup?.direction).toBe('LONG');
    });

    it('should pass validation when no Fibonacci projection available', async () => {
      const { calculateFibonacciProjection } = await import('@marketmind/indicators');
      const config: StrategyInterpreterConfig = {
        strategy: createMockStrategy(),
        enabled: true,
        minConfidence: 50,
        minRiskReward: 1.5,
      };

      vi.mocked(calculateFibonacciProjection).mockReturnValueOnce(null);
      mockMethods.conditionEvaluator.evaluate.mockReturnValueOnce(true);

      interpreter = new StrategyInterpreter(config);
      const klines = createMockKlines(50);

      const result = interpreter.detect(klines, 49);

      expect(result.setup).not.toBeNull();
    });
  });
});
