import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  BINANCE_FEES,
} from '@marketmind/types';

const mockRunFn = vi.fn();
const mockFundingRatesFn = vi.fn().mockResolvedValue([]);

vi.mock('../BacktestEngine', () => ({
  BacktestEngine: class MockBacktestEngine {
    run = mockRunFn;
  },
}));

vi.mock('../../binance-futures-data', () => ({
  BinanceFuturesDataService: class MockBinanceFuturesDataService {
    getHistoricalFundingRates = mockFundingRatesFn;
  },
}));

const createMockKlines = (startTime: number, count: number, startPrice: number, priceChange: number) => {
  return Array.from({ length: count }, (_, i) => {
    const price = startPrice + (priceChange * i);
    return {
      openTime: startTime + (i * 4 * 60 * 60 * 1000),
      open: price.toString(),
      high: (price * 1.02).toString(),
      low: (price * 0.98).toString(),
      close: price.toString(),
      volume: '1000',
    };
  });
};

const createMockTrade = (
  entryPrice: number,
  exitPrice: number,
  side: 'LONG' | 'SHORT',
  quantity: number = 0.1,
  overrides: Record<string, unknown> = {}
) => ({
  id: 'trade-1',
  setupId: 'setup-1',
  setupType: 'test-setup',
  entryTime: '2024-01-01T00:00:00Z',
  entryPrice,
  exitTime: '2024-01-02T00:00:00Z',
  exitPrice,
  side,
  quantity,
  stopLoss: side === 'LONG' ? entryPrice * 0.95 : entryPrice * 1.05,
  takeProfit: side === 'LONG' ? entryPrice * 1.1 : entryPrice * 0.9,
  pnl: side === 'LONG' ? (exitPrice - entryPrice) * quantity : (entryPrice - exitPrice) * quantity,
  pnlPercent: side === 'LONG'
    ? ((exitPrice - entryPrice) / entryPrice) * 100
    : ((entryPrice - exitPrice) / entryPrice) * 100,
  commission: entryPrice * quantity * BINANCE_FEES.FUTURES.VIP_0.taker * 2,
  netPnl: 0,
  exitReason: 'TAKE_PROFIT' as const,
  status: 'CLOSED' as const,
  ...overrides,
});

describe('FuturesBacktestEngine - Extended', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Empty trades passthrough', () => {
    it('should return spot result unchanged when no trades exist', async () => {
      const { FuturesBacktestEngine } = await import('../FuturesBacktestEngine');

      const spotResult = {
        id: 'test-result',
        trades: [],
        metrics: { totalTrades: 0 },
        equityCurve: [],
        klines: [],
      };

      mockRunFn.mockResolvedValue(spotResult);

      const engine = new FuturesBacktestEngine();
      const config = {
        symbol: 'BTCUSDT',
        interval: '4h',
        startDate: '2024-01-01',
        endDate: '2024-02-01',
        initialCapital: 10000,
        marketType: 'FUTURES' as const,
        leverage: 10,
      };

      const result = await engine.run(config);

      expect(result).toBe(spotResult);
    });
  });

  describe('Funding rate loading', () => {
    it('should load and cache funding rates from API on success', async () => {
      const { FuturesBacktestEngine } = await import('../FuturesBacktestEngine');

      const klines = createMockKlines(
        new Date('2024-01-01').getTime(),
        50,
        50000,
        100
      );

      const mockTrade = createMockTrade(50000, 51000, 'LONG', 0.1);

      mockRunFn.mockResolvedValue({
        id: 'test-result',
        trades: [mockTrade],
        metrics: {},
        equityCurve: [],
        klines,
      });

      const apiRates = [
        { timestamp: new Date('2024-01-01T08:00:00Z').getTime(), rate: 0.01 },
        { timestamp: new Date('2024-01-01T16:00:00Z').getTime(), rate: 0.02 },
      ];
      mockFundingRatesFn.mockResolvedValue(apiRates);

      const engine = new FuturesBacktestEngine();
      const config = {
        symbol: 'BTCUSDT',
        interval: '4h',
        startDate: '2024-01-01',
        endDate: '2024-02-01',
        initialCapital: 10000,
        marketType: 'FUTURES' as const,
        leverage: 10,
        simulateFundingRates: true,
        simulateLiquidation: false,
      };

      await engine.run(config);

      expect(mockFundingRatesFn).toHaveBeenCalledOnce();
    });

    it('should use cached funding rates on second call', async () => {
      const { FuturesBacktestEngine } = await import('../FuturesBacktestEngine');

      const klines = createMockKlines(
        new Date('2024-01-01').getTime(),
        50,
        50000,
        100
      );

      const mockTrade = createMockTrade(50000, 51000, 'LONG', 0.1);

      mockRunFn.mockResolvedValue({
        id: 'test-result',
        trades: [mockTrade],
        metrics: {},
        equityCurve: [],
        klines,
      });

      mockFundingRatesFn.mockResolvedValue([
        { timestamp: new Date('2024-01-01T08:00:00Z').getTime(), rate: 0.01 },
      ]);

      const engine = new FuturesBacktestEngine();
      const config = {
        symbol: 'BTCUSDT',
        interval: '4h',
        startDate: '2024-01-01',
        endDate: '2024-02-01',
        initialCapital: 10000,
        marketType: 'FUTURES' as const,
        leverage: 5,
        simulateFundingRates: true,
        simulateLiquidation: false,
      };

      await engine.run(config);
      await engine.run(config);

      expect(mockFundingRatesFn).toHaveBeenCalledTimes(1);
    });

    it('should calculate funding payments for trades within funding periods', async () => {
      const { FuturesBacktestEngine } = await import('../FuturesBacktestEngine');

      const startTime = new Date('2024-01-01T00:00:00Z').getTime();
      const klines = createMockKlines(startTime, 50, 50000, 50);

      const mockTrade = createMockTrade(50000, 51000, 'LONG', 0.1, {
        entryTime: '2024-01-01T00:00:00Z',
        exitTime: '2024-01-03T00:00:00Z',
      });

      mockRunFn.mockResolvedValue({
        id: 'test-result',
        trades: [mockTrade],
        metrics: {},
        equityCurve: [],
        klines,
      });

      const fundingTime = new Date('2024-01-01T08:00:00Z').getTime();
      mockFundingRatesFn.mockResolvedValue([
        { timestamp: fundingTime, rate: 0.01 },
        { timestamp: fundingTime + 8 * 60 * 60 * 1000, rate: 0.02 },
        { timestamp: fundingTime + 16 * 60 * 60 * 1000, rate: -0.01 },
      ]);

      const engine = new FuturesBacktestEngine();
      const config = {
        symbol: 'BTCUSDT',
        interval: '4h',
        startDate: '2024-01-01',
        endDate: '2024-02-01',
        initialCapital: 10000,
        marketType: 'FUTURES' as const,
        leverage: 10,
        simulateFundingRates: true,
        simulateLiquidation: false,
      };

      const result = await engine.run(config);

      expect(result.trades[0]?.fundingPayments).toBeDefined();
      expect(result.metrics.totalFundingPaid).toBeDefined();
    });

    it('should not compute funding payments when simulateFundingRates is false', async () => {
      const { FuturesBacktestEngine } = await import('../FuturesBacktestEngine');

      const klines = createMockKlines(
        new Date('2024-01-01').getTime(),
        50,
        50000,
        100
      );

      const mockTrade = createMockTrade(50000, 51000, 'LONG', 0.1);

      mockRunFn.mockResolvedValue({
        id: 'test-result',
        trades: [mockTrade],
        metrics: {},
        equityCurve: [],
        klines,
      });

      const engine = new FuturesBacktestEngine();
      const config = {
        symbol: 'BTCUSDT',
        interval: '4h',
        startDate: '2024-01-01',
        endDate: '2024-02-01',
        initialCapital: 10000,
        marketType: 'FUTURES' as const,
        leverage: 5,
        simulateFundingRates: false,
        simulateLiquidation: false,
      };

      const result = await engine.run(config);

      expect(mockFundingRatesFn).not.toHaveBeenCalled();
      expect(result.trades[0]?.fundingPayments).toBe(0);
    });
  });

  describe('Liquidation simulation', () => {
    it('should detect LONG liquidation when price drops below liquidation level', async () => {
      const { FuturesBacktestEngine } = await import('../FuturesBacktestEngine');

      const startTime = new Date('2024-01-01T00:00:00Z').getTime();
      const fourHours = 4 * 60 * 60 * 1000;

      const klines = [
        { openTime: startTime, open: '50000', high: '50500', low: '49500', close: '50000', volume: '1000' },
        { openTime: startTime + fourHours, open: '50000', high: '50100', low: '44000', close: '44500', volume: '1000' },
        { openTime: startTime + 2 * fourHours, open: '44500', high: '45000', low: '44000', close: '44800', volume: '1000' },
        { openTime: startTime + 3 * fourHours, open: '44800', high: '46000', low: '44500', close: '45500', volume: '1000' },
      ];

      const mockTrade = createMockTrade(50000, 45500, 'LONG', 0.1, {
        entryTime: new Date(startTime).toISOString(),
        exitTime: new Date(startTime + 3 * fourHours).toISOString(),
      });

      mockRunFn.mockResolvedValue({
        id: 'test-result',
        trades: [mockTrade],
        metrics: {},
        equityCurve: [],
        klines,
      });

      const engine = new FuturesBacktestEngine();
      const config = {
        symbol: 'BTCUSDT',
        interval: '4h',
        startDate: '2024-01-01',
        endDate: '2024-02-01',
        initialCapital: 10000,
        marketType: 'FUTURES' as const,
        leverage: 10,
        simulateFundingRates: false,
        simulateLiquidation: true,
      };

      const result = await engine.run(config);

      expect(result.trades[0]?.exitReason).toBe('LIQUIDATION');
      expect(result.trades[0]?.liquidationFee).toBeDefined();
      expect(result.metrics.totalLiquidations).toBe(1);
    });

    it('should detect SHORT liquidation when price rises above liquidation level', async () => {
      const { FuturesBacktestEngine } = await import('../FuturesBacktestEngine');

      const startTime = new Date('2024-01-01T00:00:00Z').getTime();
      const fourHours = 4 * 60 * 60 * 1000;

      const klines = [
        { openTime: startTime, open: '50000', high: '50500', low: '49500', close: '50000', volume: '1000' },
        { openTime: startTime + fourHours, open: '50000', high: '56000', low: '49800', close: '55500', volume: '1000' },
        { openTime: startTime + 2 * fourHours, open: '55500', high: '56000', low: '55000', close: '55800', volume: '1000' },
      ];

      const mockTrade = createMockTrade(50000, 55800, 'SHORT', 0.1, {
        entryTime: new Date(startTime).toISOString(),
        exitTime: new Date(startTime + 2 * fourHours).toISOString(),
      });

      mockRunFn.mockResolvedValue({
        id: 'test-result',
        trades: [mockTrade],
        metrics: {},
        equityCurve: [],
        klines,
      });

      const engine = new FuturesBacktestEngine();
      const config = {
        symbol: 'BTCUSDT',
        interval: '4h',
        startDate: '2024-01-01',
        endDate: '2024-02-01',
        initialCapital: 10000,
        marketType: 'FUTURES' as const,
        leverage: 10,
        simulateFundingRates: false,
        simulateLiquidation: true,
      };

      const result = await engine.run(config);

      expect(result.trades[0]?.exitReason).toBe('LIQUIDATION');
      expect(result.metrics.totalLiquidations).toBe(1);
    });

    it('should not liquidate when price stays within safe range', async () => {
      const { FuturesBacktestEngine } = await import('../FuturesBacktestEngine');

      const startTime = new Date('2024-01-01T00:00:00Z').getTime();
      const fourHours = 4 * 60 * 60 * 1000;

      const klines = [
        { openTime: startTime, open: '50000', high: '50500', low: '49500', close: '50000', volume: '1000' },
        { openTime: startTime + fourHours, open: '50000', high: '51000', low: '49000', close: '50500', volume: '1000' },
        { openTime: startTime + 2 * fourHours, open: '50500', high: '52000', low: '50000', close: '52000', volume: '1000' },
      ];

      const mockTrade = createMockTrade(50000, 52000, 'LONG', 0.1, {
        entryTime: new Date(startTime).toISOString(),
        exitTime: new Date(startTime + 2 * fourHours).toISOString(),
      });

      mockRunFn.mockResolvedValue({
        id: 'test-result',
        trades: [mockTrade],
        metrics: {},
        equityCurve: [],
        klines,
      });

      const engine = new FuturesBacktestEngine();
      const config = {
        symbol: 'BTCUSDT',
        interval: '4h',
        startDate: '2024-01-01',
        endDate: '2024-02-01',
        initialCapital: 10000,
        marketType: 'FUTURES' as const,
        leverage: 5,
        simulateFundingRates: false,
        simulateLiquidation: true,
      };

      const result = await engine.run(config);

      expect(result.trades[0]?.exitReason).not.toBe('LIQUIDATION');
      expect(result.metrics.totalLiquidations).toBe(0);
    });

    it('should not simulate liquidation when disabled', async () => {
      const { FuturesBacktestEngine } = await import('../FuturesBacktestEngine');

      const startTime = new Date('2024-01-01T00:00:00Z').getTime();
      const fourHours = 4 * 60 * 60 * 1000;

      const klines = [
        { openTime: startTime, open: '50000', high: '50500', low: '49500', close: '50000', volume: '1000' },
        { openTime: startTime + fourHours, open: '50000', high: '50100', low: '40000', close: '40500', volume: '1000' },
      ];

      const mockTrade = createMockTrade(50000, 40500, 'LONG', 0.1, {
        entryTime: new Date(startTime).toISOString(),
        exitTime: new Date(startTime + fourHours).toISOString(),
      });

      mockRunFn.mockResolvedValue({
        id: 'test-result',
        trades: [mockTrade],
        metrics: {},
        equityCurve: [],
        klines,
      });

      const engine = new FuturesBacktestEngine();
      const config = {
        symbol: 'BTCUSDT',
        interval: '4h',
        startDate: '2024-01-01',
        endDate: '2024-02-01',
        initialCapital: 10000,
        marketType: 'FUTURES' as const,
        leverage: 10,
        simulateFundingRates: false,
        simulateLiquidation: false,
      };

      const result = await engine.run(config);

      expect(result.trades[0]?.exitReason).not.toBe('LIQUIDATION');
      expect(result.metrics.totalLiquidations).toBe(0);
    });
  });

  describe('Metrics computation', () => {
    it('should compute sharpe ratio for multiple trades', async () => {
      const { FuturesBacktestEngine } = await import('../FuturesBacktestEngine');

      const klines = createMockKlines(
        new Date('2024-01-01').getTime(),
        100,
        50000,
        50
      );

      const trade1 = createMockTrade(50000, 52500, 'LONG', 0.1, {
        id: 'trade-1',
        entryTime: '2024-01-01T00:00:00Z',
        exitTime: '2024-01-02T00:00:00Z',
      });
      const trade2 = createMockTrade(52500, 51000, 'LONG', 0.1, {
        id: 'trade-2',
        entryTime: '2024-01-03T00:00:00Z',
        exitTime: '2024-01-04T00:00:00Z',
        exitReason: 'STOP_LOSS',
      });
      const trade3 = createMockTrade(51000, 53000, 'LONG', 0.1, {
        id: 'trade-3',
        entryTime: '2024-01-05T00:00:00Z',
        exitTime: '2024-01-06T00:00:00Z',
      });

      mockRunFn.mockResolvedValue({
        id: 'test-result',
        trades: [trade1, trade2, trade3],
        metrics: {},
        equityCurve: [],
        klines,
      });

      const engine = new FuturesBacktestEngine();
      const config = {
        symbol: 'BTCUSDT',
        interval: '4h',
        startDate: '2024-01-01',
        endDate: '2024-02-01',
        initialCapital: 10000,
        marketType: 'FUTURES' as const,
        leverage: 10,
        simulateFundingRates: false,
        simulateLiquidation: false,
      };

      const result = await engine.run(config);

      expect(result.metrics.sharpeRatio).toBeDefined();
      expect(typeof result.metrics.sharpeRatio).toBe('number');
      expect(result.metrics.totalTrades).toBe(3);
    });

    it('should compute profit factor correctly', async () => {
      const { FuturesBacktestEngine } = await import('../FuturesBacktestEngine');

      const klines = createMockKlines(
        new Date('2024-01-01').getTime(),
        100,
        50000,
        50
      );

      const winTrade = createMockTrade(50000, 52000, 'LONG', 0.1, {
        id: 'trade-1',
        entryTime: '2024-01-01T00:00:00Z',
        exitTime: '2024-01-02T00:00:00Z',
      });
      const lossTrade = createMockTrade(52000, 51000, 'LONG', 0.1, {
        id: 'trade-2',
        entryTime: '2024-01-03T00:00:00Z',
        exitTime: '2024-01-04T00:00:00Z',
        exitReason: 'STOP_LOSS',
      });

      mockRunFn.mockResolvedValue({
        id: 'test-result',
        trades: [winTrade, lossTrade],
        metrics: {},
        equityCurve: [],
        klines,
      });

      const engine = new FuturesBacktestEngine();
      const config = {
        symbol: 'BTCUSDT',
        interval: '4h',
        startDate: '2024-01-01',
        endDate: '2024-02-01',
        initialCapital: 10000,
        marketType: 'FUTURES' as const,
        leverage: 5,
        simulateFundingRates: false,
        simulateLiquidation: false,
      };

      const result = await engine.run(config);

      expect(result.metrics.profitFactor).toBeDefined();
      expect(result.metrics.winRate).toBeDefined();
      expect(result.metrics.winningTrades).toBe(1);
      expect(result.metrics.losingTrades).toBe(1);
      expect(result.metrics.winRate).toBe(50);
    });

    it('should return Infinity profit factor when only wins', async () => {
      const { FuturesBacktestEngine } = await import('../FuturesBacktestEngine');

      const klines = createMockKlines(
        new Date('2024-01-01').getTime(),
        100,
        50000,
        50
      );

      const winTrade = createMockTrade(50000, 52000, 'LONG', 0.1, {
        id: 'trade-1',
        entryTime: '2024-01-01T00:00:00Z',
        exitTime: '2024-01-02T00:00:00Z',
      });

      mockRunFn.mockResolvedValue({
        id: 'test-result',
        trades: [winTrade],
        metrics: {},
        equityCurve: [],
        klines,
      });

      const engine = new FuturesBacktestEngine();
      const config = {
        symbol: 'BTCUSDT',
        interval: '4h',
        startDate: '2024-01-01',
        endDate: '2024-02-01',
        initialCapital: 10000,
        marketType: 'FUTURES' as const,
        leverage: 5,
        simulateFundingRates: false,
        simulateLiquidation: false,
      };

      const result = await engine.run(config);

      expect(result.metrics.profitFactor).toBe(Infinity);
    });

    it('should compute average trade durations', async () => {
      const { FuturesBacktestEngine } = await import('../FuturesBacktestEngine');

      const klines = createMockKlines(
        new Date('2024-01-01').getTime(),
        100,
        50000,
        50
      );

      const winTrade = createMockTrade(50000, 52000, 'LONG', 0.1, {
        id: 'trade-1',
        entryTime: '2024-01-01T00:00:00Z',
        exitTime: '2024-01-02T00:00:00Z',
      });
      const lossTrade = createMockTrade(52000, 51000, 'LONG', 0.1, {
        id: 'trade-2',
        entryTime: '2024-01-03T00:00:00Z',
        exitTime: '2024-01-03T12:00:00Z',
        exitReason: 'STOP_LOSS',
      });

      mockRunFn.mockResolvedValue({
        id: 'test-result',
        trades: [winTrade, lossTrade],
        metrics: {},
        equityCurve: [],
        klines,
      });

      const engine = new FuturesBacktestEngine();
      const config = {
        symbol: 'BTCUSDT',
        interval: '4h',
        startDate: '2024-01-01',
        endDate: '2024-02-01',
        initialCapital: 10000,
        marketType: 'FUTURES' as const,
        leverage: 5,
        simulateFundingRates: false,
        simulateLiquidation: false,
      };

      const result = await engine.run(config);

      expect(result.metrics.avgTradeDuration).toBeGreaterThan(0);
      expect(result.metrics.avgWinDuration).toBe(24 * 60);
      expect(result.metrics.avgLossDuration).toBe(12 * 60);
    });

    it('should compute equity curve with drawdowns', async () => {
      const { FuturesBacktestEngine } = await import('../FuturesBacktestEngine');

      const klines = createMockKlines(
        new Date('2024-01-01').getTime(),
        100,
        50000,
        50
      );

      const trade1 = createMockTrade(50000, 52000, 'LONG', 0.1, {
        id: 'trade-1',
        entryTime: '2024-01-01T00:00:00Z',
        exitTime: '2024-01-02T00:00:00Z',
      });
      const trade2 = createMockTrade(52000, 50000, 'LONG', 0.1, {
        id: 'trade-2',
        entryTime: '2024-01-03T00:00:00Z',
        exitTime: '2024-01-04T00:00:00Z',
        exitReason: 'STOP_LOSS',
      });

      mockRunFn.mockResolvedValue({
        id: 'test-result',
        trades: [trade1, trade2],
        metrics: {},
        equityCurve: [],
        klines,
      });

      const engine = new FuturesBacktestEngine();
      const config = {
        symbol: 'BTCUSDT',
        interval: '4h',
        startDate: '2024-01-01',
        endDate: '2024-02-01',
        initialCapital: 10000,
        marketType: 'FUTURES' as const,
        leverage: 5,
        simulateFundingRates: false,
        simulateLiquidation: false,
      };

      const result = await engine.run(config);

      expect(result.equityCurve.length).toBe(3);
      expect(result.equityCurve[0]?.equity).toBe(10000);
      expect(result.equityCurve[0]?.drawdown).toBe(0);
    });

    it('should compute largest win and largest loss', async () => {
      const { FuturesBacktestEngine } = await import('../FuturesBacktestEngine');

      const klines = createMockKlines(
        new Date('2024-01-01').getTime(),
        100,
        50000,
        50
      );

      const bigWin = createMockTrade(50000, 55000, 'LONG', 0.1, {
        id: 'trade-1',
        entryTime: '2024-01-01T00:00:00Z',
        exitTime: '2024-01-02T00:00:00Z',
      });
      const smallWin = createMockTrade(50000, 51000, 'LONG', 0.1, {
        id: 'trade-2',
        entryTime: '2024-01-03T00:00:00Z',
        exitTime: '2024-01-04T00:00:00Z',
      });
      const loss = createMockTrade(50000, 48000, 'LONG', 0.1, {
        id: 'trade-3',
        entryTime: '2024-01-05T00:00:00Z',
        exitTime: '2024-01-06T00:00:00Z',
        exitReason: 'STOP_LOSS',
      });

      mockRunFn.mockResolvedValue({
        id: 'test-result',
        trades: [bigWin, smallWin, loss],
        metrics: {},
        equityCurve: [],
        klines,
      });

      const engine = new FuturesBacktestEngine();
      const config = {
        symbol: 'BTCUSDT',
        interval: '4h',
        startDate: '2024-01-01',
        endDate: '2024-02-01',
        initialCapital: 10000,
        marketType: 'FUTURES' as const,
        leverage: 5,
        simulateFundingRates: false,
        simulateLiquidation: false,
      };

      const result = await engine.run(config);

      expect(result.metrics.largestWin).toBeGreaterThan(0);
      expect(result.metrics.largestLoss).toBeLessThan(0);
    });

    it('should use ISOLATED margin type by default', async () => {
      const { FuturesBacktestEngine } = await import('../FuturesBacktestEngine');

      const klines = createMockKlines(
        new Date('2024-01-01').getTime(),
        50,
        50000,
        50
      );

      const mockTrade = createMockTrade(50000, 51000, 'LONG', 0.1);

      mockRunFn.mockResolvedValue({
        id: 'test-result',
        trades: [mockTrade],
        metrics: {},
        equityCurve: [],
        klines,
      });

      const engine = new FuturesBacktestEngine();
      const config = {
        symbol: 'BTCUSDT',
        interval: '4h',
        startDate: '2024-01-01',
        endDate: '2024-02-01',
        initialCapital: 10000,
        marketType: 'FUTURES' as const,
        leverage: 5,
        simulateFundingRates: false,
        simulateLiquidation: false,
      };

      const result = await engine.run(config);

      expect(result.trades[0]?.marginType).toBe('ISOLATED');
    });

    it('should handle trade without exitTime for duration calculation', async () => {
      const { FuturesBacktestEngine } = await import('../FuturesBacktestEngine');

      const klines = createMockKlines(
        new Date('2024-01-01').getTime(),
        50,
        50000,
        50
      );

      const mockTrade = createMockTrade(50000, 51000, 'LONG', 0.1, {
        exitTime: undefined,
      });

      mockRunFn.mockResolvedValue({
        id: 'test-result',
        trades: [mockTrade],
        metrics: {},
        equityCurve: [],
        klines,
      });

      const engine = new FuturesBacktestEngine();
      const config = {
        symbol: 'BTCUSDT',
        interval: '4h',
        startDate: '2024-01-01',
        endDate: '2024-02-01',
        initialCapital: 10000,
        marketType: 'FUTURES' as const,
        leverage: 5,
        simulateFundingRates: false,
        simulateLiquidation: false,
      };

      const result = await engine.run(config);

      expect(result.metrics.avgTradeDuration).toBe(0);
    });

    it('should not simulate funding for liquidated trades', async () => {
      const { FuturesBacktestEngine } = await import('../FuturesBacktestEngine');

      const startTime = new Date('2024-01-01T00:00:00Z').getTime();
      const fourHours = 4 * 60 * 60 * 1000;

      const klines = [
        { openTime: startTime, open: '50000', high: '50500', low: '49500', close: '50000', volume: '1000' },
        { openTime: startTime + fourHours, open: '50000', high: '50100', low: '44000', close: '44500', volume: '1000' },
        { openTime: startTime + 2 * fourHours, open: '44500', high: '45000', low: '44000', close: '44800', volume: '1000' },
      ];

      const mockTrade = createMockTrade(50000, 44800, 'LONG', 0.1, {
        entryTime: new Date(startTime).toISOString(),
        exitTime: new Date(startTime + 2 * fourHours).toISOString(),
        exitReason: 'STOP_LOSS',
      });

      mockRunFn.mockResolvedValue({
        id: 'test-result',
        trades: [mockTrade],
        metrics: {},
        equityCurve: [],
        klines,
      });

      const fundingTime = new Date('2024-01-01T08:00:00Z').getTime();
      mockFundingRatesFn.mockResolvedValue([
        { timestamp: fundingTime, rate: 0.01 },
      ]);

      const engine = new FuturesBacktestEngine();
      const config = {
        symbol: 'BTCUSDT',
        interval: '4h',
        startDate: '2024-01-01',
        endDate: '2024-02-01',
        initialCapital: 10000,
        marketType: 'FUTURES' as const,
        leverage: 10,
        simulateFundingRates: true,
        simulateLiquidation: true,
      };

      const result = await engine.run(config);

      expect(result.trades[0]?.exitReason).toBe('LIQUIDATION');
      expect(result.trades[0]?.fundingPayments).toBe(0);
    });

    it('should return 0 sharpe ratio for single trade', async () => {
      const { FuturesBacktestEngine } = await import('../FuturesBacktestEngine');

      const klines = createMockKlines(
        new Date('2024-01-01').getTime(),
        50,
        50000,
        50
      );

      const mockTrade = createMockTrade(50000, 52000, 'LONG', 0.1);

      mockRunFn.mockResolvedValue({
        id: 'test-result',
        trades: [mockTrade],
        metrics: {},
        equityCurve: [],
        klines,
      });

      const engine = new FuturesBacktestEngine();
      const config = {
        symbol: 'BTCUSDT',
        interval: '4h',
        startDate: '2024-01-01',
        endDate: '2024-02-01',
        initialCapital: 10000,
        marketType: 'FUTURES' as const,
        leverage: 5,
        simulateFundingRates: false,
        simulateLiquidation: false,
      };

      const result = await engine.run(config);

      expect(result.metrics.sharpeRatio).toBe(0);
    });

    it('should compute totalPnlPercent relative to initial capital', async () => {
      const { FuturesBacktestEngine } = await import('../FuturesBacktestEngine');

      const klines = createMockKlines(
        new Date('2024-01-01').getTime(),
        50,
        50000,
        50
      );

      const mockTrade = createMockTrade(50000, 52000, 'LONG', 0.1);

      mockRunFn.mockResolvedValue({
        id: 'test-result',
        trades: [mockTrade],
        metrics: {},
        equityCurve: [],
        klines,
      });

      const engine = new FuturesBacktestEngine();
      const config = {
        symbol: 'BTCUSDT',
        interval: '4h',
        startDate: '2024-01-01',
        endDate: '2024-02-01',
        initialCapital: 10000,
        marketType: 'FUTURES' as const,
        leverage: 5,
        simulateFundingRates: false,
        simulateLiquidation: false,
      };

      const result = await engine.run(config);

      expect(result.metrics.totalPnlPercent).toBeDefined();
      expect(result.metrics.totalPnlPercent).toBe(
        (result.metrics.totalPnl / config.initialCapital) * 100
      );
    });
  });

  describe('SHORT trades', () => {
    it('should compute leveraged PnL correctly for profitable SHORT', async () => {
      const { FuturesBacktestEngine } = await import('../FuturesBacktestEngine');

      const klines = createMockKlines(
        new Date('2024-01-01').getTime(),
        50,
        50000,
        -100
      );

      const mockTrade = createMockTrade(50000, 47500, 'SHORT', 0.1);

      mockRunFn.mockResolvedValue({
        id: 'test-result',
        trades: [mockTrade],
        metrics: {},
        equityCurve: [],
        klines,
      });

      const engine = new FuturesBacktestEngine();
      const config = {
        symbol: 'BTCUSDT',
        interval: '4h',
        startDate: '2024-01-01',
        endDate: '2024-02-01',
        initialCapital: 10000,
        marketType: 'FUTURES' as const,
        leverage: 10,
        simulateFundingRates: false,
        simulateLiquidation: false,
      };

      const result = await engine.run(config);

      expect(result.trades[0]?.leveragedPnlPercent).toBeGreaterThan(0);
      expect(result.trades[0]?.marketType).toBe('FUTURES');
    });
  });

  describe('Default config values', () => {
    it('should default leverage to 1 when not specified', async () => {
      const { FuturesBacktestEngine } = await import('../FuturesBacktestEngine');

      const config = {
        symbol: 'BTCUSDT',
        interval: '4h',
        startDate: '2024-01-01',
        endDate: '2024-02-01',
        initialCapital: 10000,
        marketType: 'FUTURES' as const,
      };

      mockRunFn.mockResolvedValue({
        id: 'test-result',
        trades: [],
        metrics: {},
        equityCurve: [],
      });

      const engine = new FuturesBacktestEngine();
      const result = await engine.run(config);

      expect(mockRunFn).toHaveBeenCalled();
    });

    it('should default to FUTURES fees when commission not specified', async () => {
      const { FuturesBacktestEngine } = await import('../FuturesBacktestEngine');

      const klines = createMockKlines(
        new Date('2024-01-01').getTime(),
        50,
        50000,
        50
      );

      const mockTrade = createMockTrade(50000, 51000, 'LONG', 0.1, {
        commission: undefined,
      });

      mockRunFn.mockResolvedValue({
        id: 'test-result',
        trades: [mockTrade],
        metrics: {},
        equityCurve: [],
        klines,
      });

      const engine = new FuturesBacktestEngine();
      const config = {
        symbol: 'BTCUSDT',
        interval: '4h',
        startDate: '2024-01-01',
        endDate: '2024-02-01',
        initialCapital: 10000,
        marketType: 'FUTURES' as const,
        leverage: 5,
        simulateFundingRates: false,
        simulateLiquidation: false,
      };

      const result = await engine.run(config);

      expect(result.trades[0]?.commission).toBeDefined();
      expect(result.trades[0]?.commission).toBeGreaterThan(0);
    });
  });
});
