import type { Kline, TradingSetup } from '@marketmind/types';
import type { BacktestConfig, BacktestTrade } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import { BacktestExecutor } from './BacktestExecutor';

describe('BacktestExecutor', () => {
  const executor = new BacktestExecutor();

  const createKline = (overrides: Partial<Kline> = {}): Kline => ({
    symbol: 'BTCUSDT',
    interval: '1h',
    openTime: 1704067200000,
    closeTime: 1704070800000,
    open: String(100),
    high: String(105),
    low: String(95),
    close: String(102),
    volume: String(1000),
    quoteVolume: String(100000),
    trades: 100,
    takerBaseVolume: String(500),
    takerQuoteVolume: String(50000),
    ...overrides,
  });

  const createSetup = (overrides: Partial<TradingSetup> = {}): TradingSetup => ({
    id: 'test-setup',
    type: 'MEAN_REVERSION',
    direction: 'LONG',
    openTime: 1704067200000,
    entryPrice: 100,
    confidence: 85,
    klineIndex: 0,
    stopLoss: 95,
    takeProfit: 110,
    riskRewardRatio: 3,
    volumeConfirmation: true,
    indicatorConfluence: 3,
    setupData: { type: 'MEAN_REVERSION' },
    visible: true,
    source: 'algorithm',
    ...overrides,
  });

  const createConfig = (overrides: Partial<BacktestConfig> = {}): BacktestConfig => ({
    symbol: 'BTCUSDT',
    interval: '1h',
    startDate: '2024-01-01',
    endDate: '2024-01-31',
    initialCapital: 10000,
    maxPositionSize: 10,
    commission: 0.001,
    ...overrides,
  });

  describe('openPosition', () => {
    it('should create a new trade with correct basic properties', () => {
      const setup = createSetup();
      const kline = createKline();
      const config = createConfig();
      const currentEquity = 10000;

      const trade = executor.openPosition(setup, kline, currentEquity, config);

      expect(trade).not.toBeNull();
      expect(trade?.side).toBe('LONG');
      expect(trade?.entryPrice).toBe(102);
      expect(trade?.status).toBe('OPEN');
      expect(trade?.setupId).toBe('test-setup');
      expect(trade?.setupType).toBe('MEAN_REVERSION');
      expect(trade?.setupConfidence).toBe(85);
    });

    it('should calculate position size based on maxPositionSize', () => {
      const setup = createSetup();
      const kline = createKline({ close: String(100) });
      const config = createConfig({ maxPositionSize: 10, initialCapital: 10000 });
      const currentEquity = 10000;

      const trade = executor.openPosition(setup, kline, currentEquity, config);

      const expectedValue = 10000 * 0.1;
      const expectedQuantity = expectedValue / 100;

      expect(trade?.quantity).toBe(expectedQuantity);
    });

    it('should use default maxPositionSize of 10% if not specified', () => {
      const setup = createSetup();
      const kline = createKline({ close: String(100) });
      const config = createConfig({ maxPositionSize: undefined });
      const currentEquity = 10000;

      const trade = executor.openPosition(setup, kline, currentEquity, config);

      expect(trade?.quantity).toBe(10);
    });

    it('should calculate commission correctly', () => {
      const setup = createSetup();
      const kline = createKline({ close: String(100) });
      const config = createConfig({ commission: 0.001 });
      const currentEquity = 10000;

      const trade = executor.openPosition(setup, kline, currentEquity, config);

      const expectedCommission = 100 * 10 * 0.001;
      expect(trade?.commission).toBe(expectedCommission);
    });

    it('should use algorithmic levels when useAlgorithmicLevels is true', () => {
      const setup = createSetup({ stopLoss: 95, takeProfit: 110 });
      const kline = createKline({ close: String(100) });
      const config = createConfig({ useAlgorithmicLevels: true });
      const currentEquity = 10000;

      const trade = executor.openPosition(setup, kline, currentEquity, config);

      expect(trade?.stopLoss).toBe(95);
      expect(trade?.takeProfit).toBe(110);
    });

    it('should calculate levels from percentages for LONG when not using algorithmic levels', () => {
      const setup = createSetup({ direction: 'LONG' });
      const kline = createKline({ close: String(100) });
      const config = createConfig({
        useAlgorithmicLevels: false,
        stopLossPercent: 2,
        takeProfitPercent: 6,
      });
      const currentEquity = 10000;

      const trade = executor.openPosition(setup, kline, currentEquity, config);

      expect(trade?.stopLoss).toBe(98);
      expect(trade?.takeProfit).toBe(106);
    });

    it('should calculate levels from percentages for SHORT when not using algorithmic levels', () => {
      const setup = createSetup({ direction: 'SHORT' });
      const kline = createKline({ close: String(100) });
      const config = createConfig({
        useAlgorithmicLevels: false,
        stopLossPercent: 2,
        takeProfitPercent: 6,
      });
      const currentEquity = 10000;

      const trade = executor.openPosition(setup, kline, currentEquity, config);

      expect(trade?.stopLoss).toBe(102);
      expect(trade?.takeProfit).toBe(94);
    });

    it('should reject trade if expected profit is below minProfitPercent', () => {
      const setup = createSetup({ stopLoss: 99, takeProfit: 100.5 });
      const kline = createKline({ close: String(100) });
      const config = createConfig({
        useAlgorithmicLevels: true,
        minProfitPercent: 10,
      });
      const currentEquity = 10000;

      const trade = executor.openPosition(setup, kline, currentEquity, config);

      expect(trade).toBeNull();
    });

    it('should accept trade if expected profit meets minProfitPercent', () => {
      const setup = createSetup({ stopLoss: 90, takeProfit: 120 });
      const kline = createKline({ close: String(100) });
      const config = createConfig({
        useAlgorithmicLevels: true,
        minProfitPercent: 5,
      });
      const currentEquity = 10000;

      const trade = executor.openPosition(setup, kline, currentEquity, config);

      expect(trade).not.toBeNull();
    });
  });

  describe('closePosition', () => {
    const createOpenTrade = (): BacktestTrade => ({
      id: 'test-trade',
      entryTime: '2024-01-01T00:00:00Z',
      entryPrice: 100,
      side: 'LONG',
      quantity: 10,
      stopLoss: 95,
      takeProfit: 110,
      commission: 1,
      status: 'OPEN',
    });

    it('should close LONG position with profit', () => {
      const trade = createOpenTrade();
      const exitKline = createKline({ close: String(110), openTime: 1704074400000 });

      const closedTrade = executor.closePosition(trade, exitKline, 'TAKE_PROFIT');

      expect(closedTrade.status).toBe('CLOSED');
      expect(closedTrade.exitPrice).toBe(110);
      expect(closedTrade.exitReason).toBe('TAKE_PROFIT');
      expect(closedTrade.pnl).toBe(100);
      expect(closedTrade.netPnl).toBeLessThan(100);
    });

    it('should close LONG position with loss', () => {
      const trade = createOpenTrade();
      const exitKline = createKline({ close: String(95) });

      const closedTrade = executor.closePosition(trade, exitKline, 'STOP_LOSS');

      expect(closedTrade.pnl).toBe(-50);
      expect(closedTrade.exitReason).toBe('STOP_LOSS');
    });

    it('should close SHORT position with profit', () => {
      const trade = { ...createOpenTrade(), side: 'SHORT' as const, entryPrice: 100 };
      const exitKline = createKline({ close: String(90) });

      const closedTrade = executor.closePosition(trade, exitKline, 'TAKE_PROFIT');

      expect(closedTrade.pnl).toBe(100);
    });

    it('should close SHORT position with loss', () => {
      const trade = { ...createOpenTrade(), side: 'SHORT' as const, entryPrice: 100 };
      const exitKline = createKline({ close: String(110) });

      const closedTrade = executor.closePosition(trade, exitKline, 'STOP_LOSS');

      expect(closedTrade.pnl).toBe(-100);
    });

    it('should include commission in netPnl', () => {
      const trade = createOpenTrade();
      const exitKline = createKline({ close: String(110) });

      const closedTrade = executor.closePosition(trade, exitKline, 'TAKE_PROFIT');

      expect(closedTrade.commission).toBeGreaterThan(1);
      expect(closedTrade.netPnl).toBe(closedTrade.pnl! - closedTrade.commission);
    });

    it('should calculate pnlPercent correctly', () => {
      const trade = createOpenTrade();
      const exitKline = createKline({ close: String(110) });

      const closedTrade = executor.closePosition(trade, exitKline, 'TAKE_PROFIT');

      expect(closedTrade.pnlPercent).toBe(10);
    });
  });

  describe('shouldTriggerStopLoss', () => {
    it('should trigger stop loss for LONG when low touches stop', () => {
      const trade: BacktestTrade = {
        id: 'test',
        entryTime: '2024-01-01T00:00:00Z',
        entryPrice: 100,
        side: 'LONG',
        quantity: 10,
        stopLoss: 95,
        commission: 1,
        status: 'OPEN',
      };
      const kline = createKline({ low: 94 });

      expect(executor.shouldTriggerStopLoss(trade, kline)).toBe(true);
    });

    it('should not trigger stop loss for LONG when low is above stop', () => {
      const trade: BacktestTrade = {
        id: 'test',
        entryTime: '2024-01-01T00:00:00Z',
        entryPrice: 100,
        side: 'LONG',
        quantity: 10,
        stopLoss: 95,
        commission: 1,
        status: 'OPEN',
      };
      const kline = createKline({ low: 96 });

      expect(executor.shouldTriggerStopLoss(trade, kline)).toBe(false);
    });

    it('should trigger stop loss for SHORT when high touches stop', () => {
      const trade: BacktestTrade = {
        id: 'test',
        entryTime: '2024-01-01T00:00:00Z',
        entryPrice: 100,
        side: 'SHORT',
        quantity: 10,
        stopLoss: 105,
        commission: 1,
        status: 'OPEN',
      };
      const kline = createKline({ high: 106 });

      expect(executor.shouldTriggerStopLoss(trade, kline)).toBe(true);
    });
  });

  describe('shouldTriggerTakeProfit', () => {
    it('should trigger take profit for LONG when high touches target', () => {
      const trade: BacktestTrade = {
        id: 'test',
        entryTime: '2024-01-01T00:00:00Z',
        entryPrice: 100,
        side: 'LONG',
        quantity: 10,
        takeProfit: 110,
        commission: 1,
        status: 'OPEN',
      };
      const kline = createKline({ high: 111 });

      expect(executor.shouldTriggerTakeProfit(trade, kline)).toBe(true);
    });

    it('should trigger take profit for SHORT when low touches target', () => {
      const trade: BacktestTrade = {
        id: 'test',
        entryTime: '2024-01-01T00:00:00Z',
        entryPrice: 100,
        side: 'SHORT',
        quantity: 10,
        takeProfit: 90,
        commission: 1,
        status: 'OPEN',
      };
      const kline = createKline({ low: 89 });

      expect(executor.shouldTriggerTakeProfit(trade, kline)).toBe(true);
    });
  });

  describe('calculateCurrentPnl', () => {
    it('should calculate current PnL for LONG position', () => {
      const trade: BacktestTrade = {
        id: 'test',
        entryTime: '2024-01-01T00:00:00Z',
        entryPrice: 100,
        side: 'LONG',
        quantity: 10,
        commission: 1,
        status: 'OPEN',
      };

      const pnl = executor.calculateCurrentPnl(trade, 105);
      expect(pnl).toBe(49);
    });

    it('should calculate current PnL for SHORT position', () => {
      const trade: BacktestTrade = {
        id: 'test',
        entryTime: '2024-01-01T00:00:00Z',
        entryPrice: 100,
        side: 'SHORT',
        quantity: 10,
        commission: 1,
        status: 'OPEN',
      };

      const pnl = executor.calculateCurrentPnl(trade, 95);
      expect(pnl).toBe(49);
    });
  });

  describe('calculateCurrentPnlPercent', () => {
    it('should calculate current PnL percent correctly', () => {
      const trade: BacktestTrade = {
        id: 'test',
        entryTime: '2024-01-01T00:00:00Z',
        entryPrice: 100,
        side: 'LONG',
        quantity: 10,
        commission: 1,
        status: 'OPEN',
      };

      const pnlPercent = executor.calculateCurrentPnlPercent(trade, 110);
      expect(pnlPercent).toBe(10);
    });
  });
});
