import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Kline } from '@marketmind/types';

vi.mock('@marketmind/indicators', () => ({
  calculateATR: vi.fn(() => []),
}));

vi.mock('../../../utils/id', () => ({
  generateShortId: vi.fn(() => 'test-trade-id'),
}));

vi.mock('../PositionSizer', () => ({
  PositionSizer: {
    calculatePositionSize: vi.fn(() => ({
      positionSize: 0.1,
      positionValue: 5000,
      rationale: 'Test position size',
    })),
  },
}));

import { TradeExecutor, type TradeExecutorConfig } from '../TradeExecutor';
import { calculateATR } from '@marketmind/indicators';
import { PositionSizer } from '../PositionSizer';

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

const createMockSetup = (direction: 'LONG' | 'SHORT', options?: {
  stopLoss?: number;
  takeProfit?: number;
  confidence?: number;
}) => ({
  id: 'setup-1',
  type: 'test-setup',
  direction,
  confidence: options?.confidence ?? 80,
  entryPrice: 50000,
  stopLoss: options?.stopLoss,
  takeProfit: options?.takeProfit,
  openTime: Date.now(),
});

const createMockTrade = (pnlPercent: number) => ({
  id: 'trade-1',
  pnlPercent,
  pnl: pnlPercent * 50,
});

describe('TradeExecutor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(calculateATR).mockReturnValue([]);
  });

  describe('constructor', () => {
    it('should create with default config', () => {
      const executor = new TradeExecutor({});
      expect(executor).toBeDefined();
    });

    it('should create with custom config', () => {
      const config: TradeExecutorConfig = {
        positionSizingMethod: 'risk-based',
        maxPositionSize: 20,
        riskPerTrade: 2,
        commission: 0.001,
        marketType: 'FUTURES',
      };
      const executor = new TradeExecutor(config);
      expect(executor).toBeDefined();
    });
  });

  describe('calculateRollingStats', () => {
    it('should return null for empty trades', () => {
      const executor = new TradeExecutor({});
      const result = executor.calculateRollingStats([]);
      expect(result).toBeNull();
    });

    it('should return null when no winners', () => {
      const executor = new TradeExecutor({});
      const trades = [
        createMockTrade(-5),
        createMockTrade(-3),
        createMockTrade(-2),
      ];
      const result = executor.calculateRollingStats(trades);
      expect(result).toBeNull();
    });

    it('should return null when no losers', () => {
      const executor = new TradeExecutor({});
      const trades = [
        createMockTrade(5),
        createMockTrade(3),
        createMockTrade(2),
      ];
      const result = executor.calculateRollingStats(trades);
      expect(result).toBeNull();
    });

    it('should calculate correct stats', () => {
      const executor = new TradeExecutor({});
      const trades = [
        createMockTrade(10),
        createMockTrade(8),
        createMockTrade(-5),
        createMockTrade(6),
        createMockTrade(-3),
      ];
      const result = executor.calculateRollingStats(trades);

      expect(result).not.toBeNull();
      expect(result!.winRate).toBe(0.6);
      expect(result!.avgWinPercent).toBe(8);
      expect(result!.avgLossPercent).toBe(4);
    });

    it('should respect lookback parameter', () => {
      const executor = new TradeExecutor({});
      const trades = [
        createMockTrade(100),
        createMockTrade(-50),
        createMockTrade(10),
        createMockTrade(-5),
        createMockTrade(8),
      ];
      const result = executor.calculateRollingStats(trades, 3);

      expect(result).not.toBeNull();
      expect(result!.winRate).toBeCloseTo(0.667, 2);
    });
  });

  describe('resolveEntryPrice', () => {
    it('should return close price of entry kline', () => {
      const executor = new TradeExecutor({});
      const setup = createMockSetup('LONG');
      const entryKline = createMockKline({
        openTime: Date.now(),
        open: '50000',
        high: '51000',
        low: '49500',
        close: '50500',
      });

      const result = executor.resolveEntryPrice(setup, entryKline, [], 0, 0);

      expect(result.entryPrice).toBe(50500);
      expect(result.actualEntryKlineIndex).toBe(0);
      expect(result.skipped).toBeNull();
    });
  });

  describe('resolveStopLossAndTakeProfit', () => {
    it('should use setup values when provided', () => {
      const executor = new TradeExecutor({});
      const setup = createMockSetup('LONG', { stopLoss: 49000, takeProfit: 52000 });

      const result = executor.resolveStopLossAndTakeProfit(setup, 50000, 1);

      expect(result.stopLoss).toBe(49000);
      expect(result.takeProfit).toBe(52000);
    });

    it('should use config percentages for LONG when setup values not provided', () => {
      const executor = new TradeExecutor({ stopLossPercent: 2, takeProfitPercent: 4 });
      const setup = createMockSetup('LONG');

      const result = executor.resolveStopLossAndTakeProfit(setup, 50000, 1);

      expect(result.stopLoss).toBe(49000);
      expect(result.takeProfit).toBe(52000);
    });

    it('should use config percentages for SHORT when setup values not provided', () => {
      const executor = new TradeExecutor({ stopLossPercent: 2, takeProfitPercent: 4 });
      const setup = createMockSetup('SHORT');

      const result = executor.resolveStopLossAndTakeProfit(setup, 50000, 1);

      expect(result.stopLoss).toBe(51000);
      expect(result.takeProfit).toBe(48000);
    });

    it('should return undefined when no values available', () => {
      const executor = new TradeExecutor({});
      const setup = createMockSetup('LONG');

      const result = executor.resolveStopLossAndTakeProfit(setup, 50000, 1);

      expect(result.stopLoss).toBeUndefined();
      expect(result.takeProfit).toBeUndefined();
    });
  });

  describe('calculatePositionSize', () => {
    it('should use fixed-fractional method by default', () => {
      const executor = new TradeExecutor({ maxPositionSize: 10 });

      const result = executor.calculatePositionSize(10000, 50000, 49000, [], 0);

      expect(result.positionSize).toBe(0.02);
      expect(result.positionValue).toBe(1000);
    });

    it('should use PositionSizer for other methods', () => {
      const executor = new TradeExecutor({ positionSizingMethod: 'risk-based' });

      const result = executor.calculatePositionSize(10000, 50000, 49000, [], 0);

      expect(PositionSizer.calculatePositionSize).toHaveBeenCalled();
      expect(result.positionSize).toBe(0.1);
    });

    it('should pass rolling stats to PositionSizer for kelly method', () => {
      const executor = new TradeExecutor({ positionSizingMethod: 'kelly' });
      const trades = [
        createMockTrade(10),
        createMockTrade(-5),
        createMockTrade(8),
        createMockTrade(-3),
      ];

      executor.calculatePositionSize(10000, 50000, 49000, trades, 4);

      expect(PositionSizer.calculatePositionSize).toHaveBeenCalledWith(
        10000,
        50000,
        49000,
        expect.objectContaining({
          method: 'kelly',
          winRate: expect.any(Number),
          avgWinPercent: expect.any(Number),
          avgLossPercent: expect.any(Number),
        })
      );
    });
  });

  describe('applyVolatilityAdjustment', () => {
    it('should not adjust when insufficient klines', () => {
      const executor = new TradeExecutor({});
      const klines: Kline[] = [];

      const result = executor.applyVolatilityAdjustment(0.1, 50000, klines, 5, 0);

      expect(result.positionSize).toBe(0.1);
      expect(result.positionValue).toBe(5000);
    });

    it('should not adjust when no ATR available', () => {
      vi.mocked(calculateATR).mockReturnValue([]);
      const executor = new TradeExecutor({});
      const klines = Array(20).fill(null).map((_, i) =>
        createMockKline({ openTime: Date.now() + i * 3600000, open: '50000', high: '51000', low: '49000', close: '50000' })
      );

      const result = executor.applyVolatilityAdjustment(0.1, 50000, klines, 15, 0);

      expect(result.positionSize).toBe(0.1);
    });

    it('should reduce position size in high volatility', () => {
      vi.mocked(calculateATR).mockReturnValue([2000]);
      const executor = new TradeExecutor({});
      const klines = Array(20).fill(null).map((_, i) =>
        createMockKline({ openTime: Date.now() + i * 3600000, open: '50000', high: '52000', low: '48000', close: '50000' })
      );

      const result = executor.applyVolatilityAdjustment(0.1, 50000, klines, 15, 0);

      expect(result.positionSize).toBeCloseTo(0.07, 5);
    });

    it('should not reduce in normal volatility', () => {
      vi.mocked(calculateATR).mockReturnValue([500]);
      const executor = new TradeExecutor({});
      const klines = Array(20).fill(null).map((_, i) =>
        createMockKline({ openTime: Date.now() + i * 3600000, open: '50000', high: '50500', low: '49500', close: '50000' })
      );

      const result = executor.applyVolatilityAdjustment(0.1, 50000, klines, 15, 0);

      expect(result.positionSize).toBe(0.1);
    });
  });

  describe('checkMinNotional', () => {
    it('should return true for sufficient position value', () => {
      const executor = new TradeExecutor({});

      const result = executor.checkMinNotional(100);

      expect(result).toBe(true);
    });

    it('should return false for insufficient position value', () => {
      const executor = new TradeExecutor({});

      const result = executor.checkMinNotional(0.5);

      expect(result).toBe(false);
    });
  });

  describe('checkMinProfit', () => {
    it('should return true when no minProfitPercent configured', () => {
      const executor = new TradeExecutor({});

      const result = executor.checkMinProfit(50000, 52000, 'LONG', undefined, 0.001);

      expect(result).toBe(true);
    });

    it('should return true when no takeProfit', () => {
      const executor = new TradeExecutor({ minProfitPercent: 1 });

      const result = executor.checkMinProfit(50000, undefined, 'LONG', 1, 0.001);

      expect(result).toBe(true);
    });

    it('should return true for LONG with sufficient profit', () => {
      const executor = new TradeExecutor({});

      const result = executor.checkMinProfit(50000, 53000, 'LONG', 1, 0.001);

      expect(result).toBe(true);
    });

    it('should return true for SHORT with sufficient profit', () => {
      const executor = new TradeExecutor({});

      const result = executor.checkMinProfit(50000, 47000, 'SHORT', 1, 0.001);

      expect(result).toBe(true);
    });

    it('should return false when profit below minimum', () => {
      const executor = new TradeExecutor({});

      const result = executor.checkMinProfit(50000, 50100, 'LONG', 5, 0.001);

      expect(result).toBe(false);
    });
  });

  describe('checkRiskReward', () => {
    it('should return true when no stopLoss', () => {
      const executor = new TradeExecutor({ minRiskRewardRatio: 2 });

      const result = executor.checkRiskReward(50000, undefined, 52000, 'LONG', 0);

      expect(result).toBe(true);
    });

    it('should return true when no takeProfit', () => {
      const executor = new TradeExecutor({ minRiskRewardRatio: 2 });

      const result = executor.checkRiskReward(50000, 49000, undefined, 'LONG', 0);

      expect(result).toBe(true);
    });

    it('should return true for LONG with good R:R', () => {
      const executor = new TradeExecutor({ minRiskRewardRatio: 2 });

      const result = executor.checkRiskReward(50000, 49000, 52000, 'LONG', 0);

      expect(result).toBe(true);
    });

    it('should return false for LONG with poor R:R', () => {
      const executor = new TradeExecutor({ minRiskRewardRatio: 2 });

      const result = executor.checkRiskReward(50000, 49000, 50500, 'LONG', 0);

      expect(result).toBe(false);
    });

    it('should return true for SHORT with good R:R', () => {
      const executor = new TradeExecutor({ minRiskRewardRatio: 2 });

      const result = executor.checkRiskReward(50000, 51000, 48000, 'SHORT', 0);

      expect(result).toBe(true);
    });

    it('should return false for SHORT with poor R:R', () => {
      const executor = new TradeExecutor({ minRiskRewardRatio: 2 });

      const result = executor.checkRiskReward(50000, 51000, 49500, 'SHORT', 0);

      expect(result).toBe(false);
    });

    it('should return true when risk is zero or negative', () => {
      const executor = new TradeExecutor({ minRiskRewardRatio: 2 });

      const result = executor.checkRiskReward(50000, 50000, 52000, 'LONG', 0);

      expect(result).toBe(true);
    });
  });

  describe('createTrade', () => {
    it('should create LONG trade with correct PnL', () => {
      const executor = new TradeExecutor({ commission: 0.001, marketType: 'SPOT' });
      const setup = createMockSetup('LONG');
      const entryTime = Date.now();

      const result = executor.createTrade(
        setup,
        entryTime,
        50000,
        new Date(entryTime + 3600000).toISOString(),
        51000,
        0.1,
        49000,
        52000,
        'TAKE_PROFIT'
      );

      expect(result.id).toBe('test-trade-id');
      expect(result.setupType).toBe('test-setup');
      expect(result.side).toBe('LONG');
      expect(result.entryPrice).toBe(50000);
      expect(result.exitPrice).toBe(51000);
      expect(result.quantity).toBe(0.1);
      expect(result.pnl).toBe(100);
      expect(result.commission).toBeCloseTo(10.1, 1);
      expect(result.netPnl).toBeCloseTo(89.9, 1);
      expect(result.exitReason).toBe('TAKE_PROFIT');
      expect(result.status).toBe('CLOSED');
    });

    it('should create SHORT trade with correct PnL', () => {
      const executor = new TradeExecutor({ commission: 0.001, marketType: 'FUTURES' });
      const setup = createMockSetup('SHORT');
      const entryTime = Date.now();

      const result = executor.createTrade(
        setup,
        entryTime,
        50000,
        new Date(entryTime + 3600000).toISOString(),
        49000,
        0.1,
        51000,
        48000,
        'STOP_LOSS'
      );

      expect(result.side).toBe('SHORT');
      expect(result.pnl).toBe(100);
      expect(result.exitReason).toBe('STOP_LOSS');
    });

    it('should calculate negative PnL for losing trade', () => {
      const executor = new TradeExecutor({ commission: 0.001 });
      const setup = createMockSetup('LONG');
      const entryTime = Date.now();

      const result = executor.createTrade(
        setup,
        entryTime,
        50000,
        new Date(entryTime + 3600000).toISOString(),
        49000,
        0.1,
        48000,
        52000,
        'STOP_LOSS'
      );

      expect(result.pnl).toBe(-100);
      expect(result.netPnl).toBeLessThan(-100);
    });

    it('should include setup confidence', () => {
      const executor = new TradeExecutor({});
      const setup = createMockSetup('LONG', { confidence: 85 });
      const entryTime = Date.now();

      const result = executor.createTrade(
        setup,
        entryTime,
        50000,
        new Date(entryTime + 3600000).toISOString(),
        51000,
        0.1,
        49000,
        52000,
        'TAKE_PROFIT'
      );

      expect(result.setupConfidence).toBe(85);
    });

    it('should handle EXIT_CONDITION reason', () => {
      const executor = new TradeExecutor({});
      const setup = createMockSetup('LONG');
      const entryTime = Date.now();

      const result = executor.createTrade(
        setup,
        entryTime,
        50000,
        new Date(entryTime + 3600000).toISOString(),
        50500,
        0.1,
        49000,
        52000,
        'EXIT_CONDITION'
      );

      expect(result.exitReason).toBe('EXIT_CONDITION');
    });

    it('should handle MAX_BARS reason', () => {
      const executor = new TradeExecutor({});
      const setup = createMockSetup('SHORT');
      const entryTime = Date.now();

      const result = executor.createTrade(
        setup,
        entryTime,
        50000,
        new Date(entryTime + 3600000).toISOString(),
        49800,
        0.1,
        51000,
        48000,
        'MAX_BARS'
      );

      expect(result.exitReason).toBe('MAX_BARS');
    });

    it('should handle END_OF_PERIOD reason', () => {
      const executor = new TradeExecutor({});
      const setup = createMockSetup('LONG');
      const entryTime = Date.now();

      const result = executor.createTrade(
        setup,
        entryTime,
        50000,
        new Date(entryTime + 3600000).toISOString(),
        50200,
        0.1,
        49000,
        52000,
        'END_OF_PERIOD'
      );

      expect(result.exitReason).toBe('END_OF_PERIOD');
    });
  });
});
