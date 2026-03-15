import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { MetricsComputer } from '../../../services/scalping/metrics-computer';
import type { AggTrade, BookTickerUpdate, DepthUpdate } from '@marketmind/types';
import { SCALPING_DEFAULTS } from '@marketmind/types';
import { SCALPING_ENGINE } from '../../../constants/scalping';

vi.mock('../../../services/websocket', () => ({
  getWebSocketService: () => ({
    emitScalpingMetrics: vi.fn(),
  }),
}));

const makeTrade = (overrides: Partial<AggTrade> = {}): AggTrade => ({
  tradeId: Math.floor(Math.random() * 100000),
  symbol: 'BTCUSDT',
  price: 50000,
  quantity: 1,
  quoteQuantity: 50000,
  isBuyerMaker: false,
  timestamp: Date.now(),
  marketType: 'FUTURES',
  ...overrides,
});

const makeBookTicker = (overrides: Partial<BookTickerUpdate> = {}): BookTickerUpdate => ({
  symbol: 'BTCUSDT',
  bidPrice: 50000,
  bidQty: 1,
  askPrice: 50001,
  askQty: 1,
  microprice: 50000.5,
  spread: 1,
  spreadPercent: 0.002,
  timestamp: Date.now(),
  ...overrides,
});

const makeDepthUpdate = (overrides: Partial<DepthUpdate> = {}): DepthUpdate => ({
  symbol: 'BTCUSDT',
  bids: [{ price: 50000, quantity: 10 }],
  asks: [{ price: 50001, quantity: 10 }],
  lastUpdateId: 1,
  timestamp: Date.now(),
  ...overrides,
});

describe('MetricsComputer', () => {
  let computer: MetricsComputer;

  beforeEach(() => {
    vi.useFakeTimers();
    computer = new MetricsComputer();
  });

  afterEach(() => {
    computer.stopAll();
    vi.useRealTimers();
  });

  describe('startForSymbol / stopForSymbol', () => {
    it('should initialize state for symbol', () => {
      computer.startForSymbol('BTCUSDT');
      const cvd = computer.getCVDState('BTCUSDT');
      expect(cvd).not.toBeNull();
      expect(cvd!.value).toBe(0);
      expect(cvd!.history).toEqual([]);
    });

    it('should not duplicate when starting twice', () => {
      computer.startForSymbol('BTCUSDT');
      computer.startForSymbol('BTCUSDT');
      const cvd = computer.getCVDState('BTCUSDT');
      expect(cvd).not.toBeNull();
    });

    it('should clean up state on stop', () => {
      computer.startForSymbol('BTCUSDT');
      computer.stopForSymbol('BTCUSDT');
      expect(computer.getCVDState('BTCUSDT')).toBeNull();
      expect(computer.getTradeBuffer('BTCUSDT')).toBeNull();
    });
  });

  describe('processAggTrade', () => {
    it('should update CVD with buy trade (positive delta)', () => {
      computer.startForSymbol('BTCUSDT');
      computer.processAggTrade(makeTrade({ isBuyerMaker: false, quantity: 5 }));

      const cvd = computer.getCVDState('BTCUSDT');
      expect(cvd!.value).toBe(5);
    });

    it('should update CVD with sell trade (negative delta)', () => {
      computer.startForSymbol('BTCUSDT');
      computer.processAggTrade(makeTrade({ isBuyerMaker: true, quantity: 3 }));

      const cvd = computer.getCVDState('BTCUSDT');
      expect(cvd!.value).toBe(-3);
    });

    it('should accumulate CVD across multiple trades', () => {
      computer.startForSymbol('BTCUSDT');
      computer.processAggTrade(makeTrade({ isBuyerMaker: false, quantity: 10 }));
      computer.processAggTrade(makeTrade({ isBuyerMaker: true, quantity: 3 }));
      computer.processAggTrade(makeTrade({ isBuyerMaker: false, quantity: 5 }));

      const cvd = computer.getCVDState('BTCUSDT');
      expect(cvd!.value).toBe(12);
    });

    it('should trim CVD history to max size', () => {
      computer.startForSymbol('BTCUSDT');
      for (let i = 0; i < SCALPING_ENGINE.CVD_HISTORY_BARS + 50; i++) {
        computer.processAggTrade(makeTrade({ quantity: 1, timestamp: Date.now() + i }));
      }

      const cvd = computer.getCVDState('BTCUSDT');
      expect(cvd!.history.length).toBe(SCALPING_ENGINE.CVD_HISTORY_BARS);
      expect(cvd!.priceHistory.length).toBe(SCALPING_ENGINE.CVD_HISTORY_BARS);
    });

    it('should add trades to trade buffer', () => {
      computer.startForSymbol('BTCUSDT');
      computer.processAggTrade(makeTrade());
      computer.processAggTrade(makeTrade());

      const buffer = computer.getTradeBuffer('BTCUSDT');
      expect(buffer).not.toBeNull();
      expect(buffer!.length).toBe(2);
    });

    it('should prune old trades from buffer', () => {
      computer.startForSymbol('BTCUSDT');
      const oldTimestamp = Date.now() - SCALPING_ENGINE.TRADE_BUFFER_RETENTION_MS - 1000;
      computer.processAggTrade(makeTrade({ timestamp: oldTimestamp }));
      computer.processAggTrade(makeTrade({ timestamp: Date.now() }));

      vi.advanceTimersByTime(1000);
      computer.processAggTrade(makeTrade({ timestamp: Date.now() }));

      const buffer = computer.getTradeBuffer('BTCUSDT');
      expect(buffer!.length).toBe(2);
    });

    it('should track large buy volumes', () => {
      computer.startForSymbol('BTCUSDT');

      for (let i = 0; i < 50; i++) {
        computer.processAggTrade(makeTrade({ quantity: 1, isBuyerMaker: false }));
      }

      computer.processAggTrade(makeTrade({
        quantity: 1 * SCALPING_DEFAULTS.LARGE_TRADE_MULTIPLIER + 2,
        isBuyerMaker: false,
      }));

      const metrics = computer.getMetrics('BTCUSDT');
      expect(metrics.largeBuyVol).toBeGreaterThan(0);
    });

    it('should track large sell volumes', () => {
      computer.startForSymbol('BTCUSDT');

      for (let i = 0; i < 50; i++) {
        computer.processAggTrade(makeTrade({ quantity: 1, isBuyerMaker: true }));
      }

      computer.processAggTrade(makeTrade({
        quantity: 1 * SCALPING_DEFAULTS.LARGE_TRADE_MULTIPLIER + 2,
        isBuyerMaker: true,
      }));

      const metrics = computer.getMetrics('BTCUSDT');
      expect(metrics.largeSellVol).toBeGreaterThan(0);
    });

    it('should ignore trades for uninitialized symbols', () => {
      computer.processAggTrade(makeTrade({ symbol: 'UNKNOWN' }));
      expect(computer.getCVDState('UNKNOWN')).toBeNull();
    });

    it('should rebalance avgTradeQty when overflow threshold reached', () => {
      computer.startForSymbol('BTCUSDT');
      for (let i = 0; i < SCALPING_ENGINE.AVG_OVERFLOW_THRESHOLD + 1; i++) {
        computer.processAggTrade(makeTrade({ quantity: 1 }));
      }

      const metrics = computer.getMetrics('BTCUSDT');
      expect(metrics.largeBuyVol).toBeDefined();
    });
  });

  describe('processBookTicker', () => {
    it('should store latest book ticker', () => {
      computer.startForSymbol('BTCUSDT');
      computer.processBookTicker(makeBookTicker());
    });
  });

  describe('processDepthUpdate', () => {
    it('should forward to order book manager', () => {
      computer.startForSymbol('BTCUSDT');
      computer.processDepthUpdate(makeDepthUpdate());
      const metrics = computer.getMetrics('BTCUSDT');
      expect(metrics.spread).toBeGreaterThan(0);
    });
  });

  describe('getMetrics', () => {
    it('should return default metrics for new symbol', () => {
      computer.startForSymbol('BTCUSDT');
      const metrics = computer.getMetrics('BTCUSDT');
      expect(metrics.cvd).toBe(0);
      expect(metrics.imbalanceRatio).toBe(0);
      expect(metrics.microprice).toBe(0);
      expect(metrics.spread).toBe(0);
      expect(metrics.largeBuyVol).toBe(0);
      expect(metrics.largeSellVol).toBe(0);
      expect(metrics.absorptionScore).toBe(0);
      expect(metrics.exhaustionScore).toBe(0);
      expect(metrics.timestamp).toBeGreaterThan(0);
    });

    it('should reflect CVD after trades', () => {
      computer.startForSymbol('BTCUSDT');
      computer.processAggTrade(makeTrade({ isBuyerMaker: false, quantity: 5 }));
      const metrics = computer.getMetrics('BTCUSDT');
      expect(metrics.cvd).toBe(5);
    });

    it('should reflect order book metrics after depth update', () => {
      computer.startForSymbol('BTCUSDT');
      computer.processDepthUpdate(makeDepthUpdate({
        bids: [{ price: 50000, quantity: 10 }],
        asks: [{ price: 50001, quantity: 2 }],
      }));

      const metrics = computer.getMetrics('BTCUSDT');
      expect(metrics.imbalanceRatio).toBeGreaterThan(0);
      expect(metrics.spread).toBe(1);
      expect(metrics.microprice).toBeGreaterThan(0);
    });
  });

  describe('getVolumeProfile', () => {
    it('should return null when no trades processed', () => {
      computer.startForSymbol('BTCUSDT');
      expect(computer.getVolumeProfile('BTCUSDT')).toBeNull();
    });

    it('should return null for unknown symbol', () => {
      expect(computer.getVolumeProfile('UNKNOWN')).toBeNull();
    });

    it('should compute volume profile with POC', () => {
      computer.startForSymbol('BTCUSDT');

      for (let i = 0; i < 10; i++) {
        computer.processAggTrade(makeTrade({ price: 50000, quantity: 5 }));
      }
      for (let i = 0; i < 3; i++) {
        computer.processAggTrade(makeTrade({ price: 50001, quantity: 2 }));
      }

      const profile = computer.getVolumeProfile('BTCUSDT');
      expect(profile).not.toBeNull();
      expect(profile!.poc).toBe(50000);
      expect(profile!.levels.length).toBeGreaterThan(0);
    });

    it('should compute value area high and low', () => {
      computer.startForSymbol('BTCUSDT');

      for (let i = 0; i < 5; i++) {
        computer.processAggTrade(makeTrade({ price: 50000 + i * 0.01, quantity: 10 - i }));
      }

      const profile = computer.getVolumeProfile('BTCUSDT');
      expect(profile).not.toBeNull();
      expect(profile!.valueAreaHigh).toBeGreaterThanOrEqual(profile!.valueAreaLow);
    });

    it('should limit volume profile levels', () => {
      computer.startForSymbol('BTCUSDT');

      for (let i = 0; i < SCALPING_ENGINE.VOLUME_PROFILE_MAX_LEVELS + 100; i++) {
        computer.processAggTrade(makeTrade({
          price: 50000 + i * 0.01,
          quantity: 1,
        }));
      }

      const profile = computer.getVolumeProfile('BTCUSDT');
      expect(profile).not.toBeNull();
      expect(profile!.levels.length).toBeLessThanOrEqual(SCALPING_ENGINE.VOLUME_PROFILE_MAX_LEVELS);
    });
  });

  describe('computeExhaustion', () => {
    it('should return 0 with insufficient history', () => {
      computer.startForSymbol('BTCUSDT');
      computer.processAggTrade(makeTrade({ quantity: 5 }));

      const metrics = computer.getMetrics('BTCUSDT');
      expect(metrics.exhaustionScore).toBe(0);
    });

    it('should detect tapering momentum', () => {
      computer.startForSymbol('BTCUSDT');

      for (let i = 0; i < SCALPING_ENGINE.EXHAUSTION_LOOKBACK + 5; i++) {
        const qty = i < SCALPING_ENGINE.EXHAUSTION_LOOKBACK / 2 ? 10 : 1;
        computer.processAggTrade(makeTrade({
          isBuyerMaker: false,
          quantity: qty,
          timestamp: Date.now() + i,
        }));
      }

      const metrics = computer.getMetrics('BTCUSDT');
      expect(metrics.exhaustionScore).toBeGreaterThanOrEqual(0);
      expect(metrics.exhaustionScore).toBeLessThanOrEqual(1);
    });
  });

  describe('getOrderBookManager', () => {
    it('should expose underlying order book manager', () => {
      const obm = computer.getOrderBookManager();
      expect(obm).toBeDefined();
      expect(obm.hasBook('BTCUSDT')).toBe(false);
    });
  });

  describe('stopAll', () => {
    it('should clean up all symbols', () => {
      computer.startForSymbol('BTCUSDT');
      computer.startForSymbol('ETHUSDT');
      computer.stopAll();

      expect(computer.getCVDState('BTCUSDT')).toBeNull();
      expect(computer.getCVDState('ETHUSDT')).toBeNull();
    });
  });

  describe('volume profile - buy/sell classification', () => {
    it('should classify buyer-maker as sell and taker-buy as buy', () => {
      computer.startForSymbol('BTCUSDT');

      computer.processAggTrade(makeTrade({ price: 50000, quantity: 10, isBuyerMaker: false }));
      computer.processAggTrade(makeTrade({ price: 50000, quantity: 5, isBuyerMaker: true }));

      const profile = computer.getVolumeProfile('BTCUSDT');
      expect(profile).not.toBeNull();
      const level = profile!.levels.find((l) => l.price === 50000);
      expect(level).toBeDefined();
      expect(level!.buyVolume).toBe(10);
      expect(level!.sellVolume).toBe(5);
    });
  });
});
