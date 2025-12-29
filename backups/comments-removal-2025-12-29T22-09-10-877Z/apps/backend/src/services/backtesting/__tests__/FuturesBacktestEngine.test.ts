import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  calculateLiquidationPrice,
  calculateLeveragedPnl,
  FUTURES_DEFAULTS,
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
      high: (price * 1.01).toString(),
      low: (price * 0.99).toString(),
      close: price.toString(),
      volume: '1000',
    };
  });
};

const createMockTrade = (
  entryPrice: number,
  exitPrice: number,
  side: 'LONG' | 'SHORT',
  quantity: number = 0.1
): {
  id: string;
  setupId: string;
  setupType: string;
  entryTime: string;
  entryPrice: number;
  exitTime: string;
  exitPrice: number;
  side: 'LONG' | 'SHORT';
  quantity: number;
  stopLoss: number;
  takeProfit: number;
  pnl: number;
  pnlPercent: number;
  commission: number;
  netPnl: number;
  exitReason: 'TAKE_PROFIT' | 'STOP_LOSS' | 'MANUAL' | 'END_OF_PERIOD' | 'LIQUIDATION';
  status: 'OPEN' | 'CLOSED';
} => ({
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
  exitReason: 'TAKE_PROFIT',
  status: 'CLOSED',
});

describe('FuturesBacktestEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Spot mode passthrough', () => {
    it('should passthrough to spot engine when marketType is SPOT', async () => {
      const { FuturesBacktestEngine } = await import('../FuturesBacktestEngine');

      const config = {
        symbol: 'BTCUSDT',
        interval: '4h',
        startDate: '2024-01-01',
        endDate: '2024-02-01',
        initialCapital: 10000,
        marketType: 'SPOT' as const,
      };

      mockRunFn.mockResolvedValue({
        id: 'test-result',
        trades: [],
        metrics: {},
        equityCurve: [],
      });

      const engine = new FuturesBacktestEngine();
      await engine.run(config);

      expect(mockRunFn).toHaveBeenCalled();
    });

    it('should passthrough when leverage is 1', async () => {
      const { FuturesBacktestEngine } = await import('../FuturesBacktestEngine');

      const config = {
        symbol: 'BTCUSDT',
        interval: '4h',
        startDate: '2024-01-01',
        endDate: '2024-02-01',
        initialCapital: 10000,
        marketType: 'FUTURES' as const,
        leverage: 1,
      };

      mockRunFn.mockResolvedValue({
        id: 'test-result',
        trades: [],
        metrics: {},
        equityCurve: [],
      });

      const engine = new FuturesBacktestEngine();
      await engine.run(config);

      expect(mockRunFn).toHaveBeenCalled();
    });
  });

  describe('Leveraged PnL calculations', () => {
    it('should correctly calculate leveraged PnL for profitable LONG', () => {
      const entryPrice = 50000;
      const exitPrice = 52500;
      const leverage = 10;

      const result = calculateLeveragedPnl(entryPrice, exitPrice, leverage, 'LONG');

      expect(result.pnlPercent).toBeCloseTo(5, 2);
      expect(result.leveragedPnlPercent).toBeCloseTo(50, 2);
    });

    it('should correctly calculate leveraged PnL for losing LONG', () => {
      const entryPrice = 50000;
      const exitPrice = 47500;
      const leverage = 10;

      const result = calculateLeveragedPnl(entryPrice, exitPrice, leverage, 'LONG');

      expect(result.pnlPercent).toBeCloseTo(-5, 2);
      expect(result.leveragedPnlPercent).toBeCloseTo(-50, 2);
    });

    it('should correctly calculate leveraged PnL for profitable SHORT', () => {
      const entryPrice = 50000;
      const exitPrice = 47500;
      const leverage = 5;

      const result = calculateLeveragedPnl(entryPrice, exitPrice, leverage, 'SHORT');

      expect(result.pnlPercent).toBeCloseTo(5, 2);
      expect(result.leveragedPnlPercent).toBeCloseTo(25, 2);
    });
  });

  describe('Liquidation price calculations', () => {
    it('should calculate correct liquidation price for LONG', () => {
      const entryPrice = 50000;
      const leverage = 10;

      const liqPrice = calculateLiquidationPrice(entryPrice, leverage, 'LONG');

      expect(liqPrice).toBeLessThan(entryPrice);
      expect(liqPrice).toBeCloseTo(45950, 0);
    });

    it('should calculate correct liquidation price for SHORT', () => {
      const entryPrice = 50000;
      const leverage = 10;

      const liqPrice = calculateLiquidationPrice(entryPrice, leverage, 'SHORT');

      expect(liqPrice).toBeGreaterThan(entryPrice);
      expect(liqPrice).toBeCloseTo(54050, 0);
    });

    it('should have tighter liquidation with higher leverage', () => {
      const entryPrice = 50000;

      const liq5x = calculateLiquidationPrice(entryPrice, 5, 'LONG');
      const liq10x = calculateLiquidationPrice(entryPrice, 10, 'LONG');
      const liq20x = calculateLiquidationPrice(entryPrice, 20, 'LONG');

      expect(liq20x).toBeGreaterThan(liq10x);
      expect(liq10x).toBeGreaterThan(liq5x);
    });
  });

  describe('Futures defaults', () => {
    it('should have correct default values', () => {
      expect(FUTURES_DEFAULTS.LEVERAGE).toBe(1);
      expect(FUTURES_DEFAULTS.MARGIN_TYPE).toBe('ISOLATED');
      expect(FUTURES_DEFAULTS.TAKER_FEE).toBe(0.0004);
      expect(FUTURES_DEFAULTS.MAKER_FEE).toBe(0.0002);
      expect(FUTURES_DEFAULTS.LIQUIDATION_FEE).toBe(0.015);
      expect(FUTURES_DEFAULTS.MAINTENANCE_MARGIN_RATE).toBe(0.004);
    });

    it('should use lower fees for futures than spot', () => {
      const spotFee = 0.001;

      expect(FUTURES_DEFAULTS.TAKER_FEE).toBeLessThan(spotFee);
      expect(FUTURES_DEFAULTS.MAKER_FEE).toBeLessThan(spotFee);
    });
  });

  describe('Integration scenarios', () => {
    it('should process trades with leverage correctly', async () => {
      const { FuturesBacktestEngine } = await import('../FuturesBacktestEngine');

      const klines = createMockKlines(
        new Date('2024-01-01').getTime(),
        100,
        50000,
        100
      );

      const mockTrade = createMockTrade(50000, 52500, 'LONG', 0.1);

      mockRunFn.mockResolvedValue({
        id: 'test-result',
        trades: [mockTrade],
        metrics: {
          totalTrades: 1,
          winningTrades: 1,
          losingTrades: 0,
          winRate: 100,
          totalPnl: 250,
          totalPnlPercent: 2.5,
        },
        equityCurve: [{ time: '2024-01-01', equity: 10000, drawdown: 0, drawdownPercent: 0 }],
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

      expect(result.trades.length).toBe(1);
      expect(result.trades[0]?.marketType).toBe('FUTURES');
      expect(result.trades[0]?.leverage).toBe(10);
      expect(result.trades[0]?.liquidationPrice).toBeDefined();
    });

    it('should include liquidation price in futures trades', async () => {
      const { FuturesBacktestEngine } = await import('../FuturesBacktestEngine');

      const klines = createMockKlines(
        new Date('2024-01-01').getTime(),
        100,
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
        leverage: 20,
        simulateFundingRates: false,
        simulateLiquidation: false,
      };

      const result = await engine.run(config);

      const trade = result.trades[0];
      expect(trade?.liquidationPrice).toBeDefined();
      expect(trade?.liquidationPrice).toBeLessThan(50000);
    });
  });

  describe('Risk management', () => {
    it('should calculate metrics correctly for futures trades', async () => {
      const { FuturesBacktestEngine } = await import('../FuturesBacktestEngine');

      const klines = createMockKlines(
        new Date('2024-01-01').getTime(),
        100,
        50000,
        100
      );

      const winningTrade = createMockTrade(50000, 52500, 'LONG', 0.1);
      const losingTrade = createMockTrade(52500, 51000, 'LONG', 0.1);
      losingTrade.id = 'trade-2';
      losingTrade.entryTime = '2024-01-03T00:00:00Z';
      losingTrade.exitTime = '2024-01-04T00:00:00Z';
      losingTrade.exitReason = 'STOP_LOSS';

      mockRunFn.mockResolvedValue({
        id: 'test-result',
        trades: [winningTrade, losingTrade],
        metrics: {
          totalTrades: 2,
          winningTrades: 1,
          losingTrades: 1,
          winRate: 50,
        },
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

      expect(result.metrics.totalTrades).toBe(2);
      expect(result.trades.every(t => t.leverage === 10)).toBe(true);
      expect(result.trades.every(t => t.marketType === 'FUTURES')).toBe(true);
    });

    it('should handle maxDrawdown calculation for leveraged positions', async () => {
      const { FuturesBacktestEngine } = await import('../FuturesBacktestEngine');

      const klines = createMockKlines(
        new Date('2024-01-01').getTime(),
        100,
        50000,
        -200
      );

      const losingTrade = createMockTrade(50000, 45000, 'LONG', 0.1);
      losingTrade.exitReason = 'STOP_LOSS';

      mockRunFn.mockResolvedValue({
        id: 'test-result',
        trades: [losingTrade],
        metrics: {
          totalTrades: 1,
          losingTrades: 1,
        },
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

      expect(result.metrics.maxDrawdown).toBeGreaterThan(0);
      expect(result.metrics.maxDrawdownPercent).toBeGreaterThan(0);
    });
  });

  describe('Funding rate simulation', () => {
    it('should generate default funding rates when API fails', async () => {
      const { FuturesBacktestEngine } = await import('../FuturesBacktestEngine');

      const klines = createMockKlines(
        new Date('2024-01-01').getTime(),
        100,
        50000,
        100
      );

      const mockTrade = createMockTrade(50000, 52500, 'LONG', 0.1);

      mockRunFn.mockResolvedValue({
        id: 'test-result',
        trades: [mockTrade],
        metrics: {},
        equityCurve: [],
        klines,
      });

      mockFundingRatesFn.mockRejectedValue(new Error('API error'));

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

      expect(result.trades.length).toBe(1);
      expect(result.trades[0]?.fundingPayments).toBeDefined();
    });
  });
});
