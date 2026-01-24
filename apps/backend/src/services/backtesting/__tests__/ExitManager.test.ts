import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComputedIndicators, Kline, StrategyDefinition } from '@marketmind/types';

const mockEvaluate = vi.fn();

vi.mock('../../setup-detection/dynamic', () => ({
  ConditionEvaluator: class MockConditionEvaluator {
    evaluate = mockEvaluate;
  },
}));

import { ExitManager } from '../ExitManager';
import { ConditionEvaluator } from '../../setup-detection/dynamic';

const createMockKline = (options: {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
}): Kline => ({
  openTime: options.openTime,
  closeTime: options.openTime + 3600000,
  open: options.open,
  high: options.high,
  low: options.low,
  close: options.close,
  volume: '1000',
  quoteVolume: '50000000',
  trades: 1000,
  takerBuyBaseVolume: '500',
  takerBuyQuoteVolume: '25000000',
});

const createMockSetup = (direction: 'LONG' | 'SHORT', entryPrice: number) => ({
  type: 'test-setup',
  direction,
  entryPrice,
  stopLoss: direction === 'LONG' ? entryPrice * 0.98 : entryPrice * 1.02,
  takeProfit: direction === 'LONG' ? entryPrice * 1.04 : entryPrice * 0.96,
  openTime: Date.now(),
});

describe('ExitManager', () => {
  let conditionEvaluator: ConditionEvaluator;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEvaluate.mockReturnValue(false);
    conditionEvaluator = new ConditionEvaluator({} as any);
  });

  describe('constructor', () => {
    it('should create with default config', () => {
      const manager = new ExitManager({}, conditionEvaluator);
      expect(manager).toBeDefined();
    });

    it('should create with SPOT market type', () => {
      const manager = new ExitManager({ marketType: 'SPOT' }, conditionEvaluator);
      expect(manager).toBeDefined();
    });

    it('should create with FUTURES market type', () => {
      const manager = new ExitManager({ marketType: 'FUTURES' }, conditionEvaluator);
      expect(manager).toBeDefined();
    });

    it('should apply BNB discount when configured', () => {
      const manager = new ExitManager({ useBnbDiscount: true }, conditionEvaluator);
      expect(manager).toBeDefined();
    });
  });

  describe('checkExitCondition', () => {
    it('should return false when no exit condition', () => {
      const manager = new ExitManager({}, conditionEvaluator);
      const klines: Kline[] = [createMockKline({ openTime: Date.now(), open: '50000', high: '51000', low: '49000', close: '50500' })];
      const indicators: ComputedIndicators = {};

      const result = manager.checkExitCondition(null, klines, 0, indicators, {});

      expect(result).toBe(false);
    });

    it('should return false when exit condition undefined', () => {
      const manager = new ExitManager({}, conditionEvaluator);
      const klines: Kline[] = [createMockKline({ openTime: Date.now(), open: '50000', high: '51000', low: '49000', close: '50500' })];

      const result = manager.checkExitCondition(undefined, klines, 0, {}, {});

      expect(result).toBe(false);
    });

    it('should evaluate exit condition and return true', () => {
      mockEvaluate.mockReturnValue(true);
      const manager = new ExitManager({}, conditionEvaluator);
      const klines: Kline[] = [createMockKline({ openTime: Date.now(), open: '50000', high: '51000', low: '49000', close: '50500' })];
      const exitCondition = { type: 'and', conditions: [] };

      const result = manager.checkExitCondition(exitCondition, klines, 0, {}, {});

      expect(result).toBe(true);
      expect(mockEvaluate).toHaveBeenCalled();
    });
  });

  describe('checkStopLossAndTakeProfit', () => {
    it('should detect stop loss hit for LONG position', () => {
      const manager = new ExitManager({}, conditionEvaluator);

      const result = manager.checkStopLossAndTakeProfit(
        'LONG', 50500, 48500, 50000, 49000, 49000, 52000
      );

      expect(result.hit).toBe('SL');
      expect(result.price).toBe(49000);
    });

    it('should detect stop loss hit for SHORT position', () => {
      const manager = new ExitManager({}, conditionEvaluator);

      const result = manager.checkStopLossAndTakeProfit(
        'SHORT', 51500, 50000, 50500, 51000, 51000, 48000
      );

      expect(result.hit).toBe('SL');
      expect(result.price).toBe(51000);
    });

    it('should detect take profit hit for LONG position', () => {
      const manager = new ExitManager({}, conditionEvaluator);

      const result = manager.checkStopLossAndTakeProfit(
        'LONG', 52500, 50500, 50500, 52000, 49000, 52000
      );

      expect(result.hit).toBe('TP');
      expect(result.price).toBe(52000);
    });

    it('should detect take profit hit for SHORT position', () => {
      const manager = new ExitManager({}, conditionEvaluator);

      const result = manager.checkStopLossAndTakeProfit(
        'SHORT', 50000, 47500, 49500, 48000, 51000, 48000
      );

      expect(result.hit).toBe('TP');
      expect(result.price).toBe(48000);
    });

    it('should return null when neither SL nor TP hit', () => {
      const manager = new ExitManager({}, conditionEvaluator);

      const result = manager.checkStopLossAndTakeProfit(
        'LONG', 51000, 49500, 50000, 50500, 49000, 52000
      );

      expect(result.hit).toBeNull();
      expect(result.price).toBeUndefined();
    });

    it('should prefer TP on bullish candle for LONG when both hit', () => {
      const manager = new ExitManager({}, conditionEvaluator);

      const result = manager.checkStopLossAndTakeProfit(
        'LONG', 53000, 48000, 49000, 52000, 49000, 52000
      );

      expect(result.hit).toBe('TP');
      expect(result.price).toBe(52000);
    });

    it('should prefer SL on bearish candle for LONG when both hit', () => {
      const manager = new ExitManager({}, conditionEvaluator);

      const result = manager.checkStopLossAndTakeProfit(
        'LONG', 53000, 48000, 52000, 48500, 49000, 52000
      );

      expect(result.hit).toBe('SL');
      expect(result.price).toBe(49000);
    });
  });

  describe('applySlippage', () => {
    it('should not apply slippage for EXIT_CONDITION', () => {
      const manager = new ExitManager({ slippagePercent: 0.1 }, conditionEvaluator);

      const result = manager.applySlippage(50000, 'EXIT_CONDITION', 'LONG');

      expect(result).toBe(50000);
    });

    it('should not apply slippage for MAX_BARS', () => {
      const manager = new ExitManager({ slippagePercent: 0.1 }, conditionEvaluator);

      const result = manager.applySlippage(50000, 'MAX_BARS', 'SHORT');

      expect(result).toBe(50000);
    });

    it('should apply slippage for STOP_LOSS LONG', () => {
      const manager = new ExitManager({ slippagePercent: 0.1 }, conditionEvaluator);

      const result = manager.applySlippage(50000, 'STOP_LOSS', 'LONG');

      expect(result).toBe(49950);
    });

    it('should apply slippage for STOP_LOSS SHORT', () => {
      const manager = new ExitManager({ slippagePercent: 0.1 }, conditionEvaluator);

      const result = manager.applySlippage(50000, 'STOP_LOSS', 'SHORT');

      expect(result).toBe(50050);
    });

    it('should apply slippage for TAKE_PROFIT', () => {
      const manager = new ExitManager({ slippagePercent: 0.1 }, conditionEvaluator);

      const result = manager.applySlippage(50000, 'TAKE_PROFIT', 'LONG');

      expect(result).toBe(49950);
    });

    it('should use default slippage when not configured', () => {
      const manager = new ExitManager({}, conditionEvaluator);

      const result = manager.applySlippage(50000, 'STOP_LOSS', 'LONG');

      expect(result).toBe(49950);
    });
  });

  describe('findExit', () => {
    it('should return null when no klines available', () => {
      const manager = new ExitManager({}, conditionEvaluator);
      const setup = createMockSetup('LONG', 50000);

      const result = manager.findExit(
        setup, [], 0, 49000, 52000, undefined, null, {}
      );

      expect(result).toBeNull();
    });

    it('should exit on stop loss hit', () => {
      const manager = new ExitManager({}, conditionEvaluator);
      const setup = createMockSetup('LONG', 50000);
      const baseTime = Date.now();
      const klines = [
        createMockKline({ openTime: baseTime, open: '50000', high: '50500', low: '49800', close: '50200' }),
        createMockKline({ openTime: baseTime + 3600000, open: '50200', high: '50300', low: '48500', close: '49000' }),
      ];

      const result = manager.findExit(
        setup, klines, 0, 49000, 52000, undefined, null, {}
      );

      expect(result).not.toBeNull();
      expect(result!.exitReason).toBe('STOP_LOSS');
    });

    it('should exit on take profit hit', () => {
      const manager = new ExitManager({}, conditionEvaluator);
      const setup = createMockSetup('LONG', 50000);
      const baseTime = Date.now();
      const klines = [
        createMockKline({ openTime: baseTime, open: '50000', high: '50500', low: '50000', close: '50200' }),
        createMockKline({ openTime: baseTime + 3600000, open: '50200', high: '53000', low: '50100', close: '52500' }),
      ];

      const result = manager.findExit(
        setup, klines, 0, 49000, 52000, undefined, null, {}
      );

      expect(result).not.toBeNull();
      expect(result!.exitReason).toBe('TAKE_PROFIT');
    });

    it('should exit on exit condition met', () => {
      mockEvaluate.mockReturnValue(true);
      const manager = new ExitManager({}, conditionEvaluator);
      const setup = createMockSetup('LONG', 50000);
      const baseTime = Date.now();
      const klines = [
        createMockKline({ openTime: baseTime, open: '50000', high: '50500', low: '50000', close: '50200' }),
        createMockKline({ openTime: baseTime + 3600000, open: '50200', high: '51000', low: '50100', close: '50800' }),
      ];
      const strategy: StrategyDefinition = {
        id: 'test',
        name: 'Test',
        version: '1.0',
        description: 'Test',
        author: 'test',
        parameters: {},
        indicators: {},
        entry: {},
        exit: {
          stopLoss: { type: 'percent', value: 2 },
          takeProfit: { type: 'percent', value: 4 },
          conditions: { long: { operator: 'OR', conditions: [] } },
        },
      };

      const result = manager.findExit(
        setup, klines, 0, 49000, 52000, strategy, {}, {}
      );

      expect(result).not.toBeNull();
      expect(result!.exitReason).toBe('EXIT_CONDITION');
    });

    it('should exit on max bars reached', () => {
      const manager = new ExitManager({}, conditionEvaluator);
      const setup = createMockSetup('LONG', 50000);
      const baseTime = Date.now();
      const klines = [
        createMockKline({ openTime: baseTime, open: '50000', high: '50500', low: '50000', close: '50200' }),
        createMockKline({ openTime: baseTime + 3600000, open: '50200', high: '50400', low: '50100', close: '50300' }),
        createMockKline({ openTime: baseTime + 7200000, open: '50300', high: '50500', low: '50200', close: '50400' }),
      ];
      const strategy: StrategyDefinition = {
        id: 'test',
        name: 'Test',
        version: '1.0',
        description: 'Test',
        author: 'test',
        parameters: {},
        indicators: {},
        entry: {},
        exit: {
          stopLoss: { type: 'percent', value: 2 },
          takeProfit: { type: 'percent', value: 4 },
          maxBarsInTrade: 2,
        },
      };

      const result = manager.findExit(
        setup, klines, 0, 48000, 54000, strategy, null, {}
      );

      expect(result).not.toBeNull();
      expect(result!.exitReason).toBe('MAX_BARS');
    });

    it('should exit at end of period when no other exit', () => {
      const manager = new ExitManager({}, conditionEvaluator);
      const setup = createMockSetup('LONG', 50000);
      const baseTime = Date.now();
      const klines = [
        createMockKline({ openTime: baseTime, open: '50000', high: '50500', low: '50000', close: '50200' }),
        createMockKline({ openTime: baseTime + 3600000, open: '50200', high: '50400', low: '50100', close: '50300' }),
      ];

      const result = manager.findExit(
        setup, klines, 0, 48000, 54000, undefined, null, {}
      );

      expect(result).not.toBeNull();
      expect(result!.exitReason).toBe('END_OF_PERIOD');
      expect(result!.exitPrice).toBe(50300);
    });
  });

  describe('market type fee calculations', () => {
    it('should use SPOT fees by default', () => {
      const spotManager = new ExitManager({ marketType: 'SPOT' }, conditionEvaluator);
      expect(spotManager).toBeDefined();
    });

    it('should use FUTURES fees when configured', () => {
      const futuresManager = new ExitManager({ marketType: 'FUTURES' }, conditionEvaluator);
      expect(futuresManager).toBeDefined();
    });

    it('should apply BNB discount when enabled', () => {
      const discountManager = new ExitManager({ marketType: 'SPOT', useBnbDiscount: true }, conditionEvaluator);
      expect(discountManager).toBeDefined();
    });
  });
});
