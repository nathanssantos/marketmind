import { describe, expect, it, beforeEach, vi } from 'vitest';
import { SignalEngine, type SignalEngineConfig } from '../../../services/scalping/signal-engine';
import { SCALPING_ENGINE, SCALPING_STRATEGY } from '../../../constants/scalping';
import { SCALPING_DEFAULTS } from '@marketmind/types';
import type { ScalpingMetrics } from '@marketmind/types';
import type { CVDState, StrategyContext } from '../../../services/scalping/types';

vi.mock('../../../services/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), trace: vi.fn(), error: vi.fn() },
}));

const defaultConfig: SignalEngineConfig = {
  enabledStrategies: ['imbalance', 'cvd-divergence', 'mean-reversion', 'momentum-burst', 'absorption-reversal'],
  imbalanceThreshold: SCALPING_DEFAULTS.IMBALANCE_THRESHOLD,
  cvdDivergenceBars: SCALPING_DEFAULTS.CVD_DIVERGENCE_BARS,
  vwapDeviationSigma: SCALPING_DEFAULTS.VWAP_DEVIATION_SIGMA,
  largeTradeMult: SCALPING_DEFAULTS.LARGE_TRADE_MULTIPLIER,
  absorptionThreshold: SCALPING_DEFAULTS.ABSORPTION_VOLUME_THRESHOLD,
  maxSpreadPercent: SCALPING_DEFAULTS.MAX_SPREAD_PERCENT,
  circuitBreakerEnabled: true,
  circuitBreakerLossPercent: SCALPING_DEFAULTS.CIRCUIT_BREAKER_LOSS_PERCENT,
  circuitBreakerMaxTrades: SCALPING_DEFAULTS.CIRCUIT_BREAKER_MAX_TRADES,
  maxDailyTrades: SCALPING_DEFAULTS.MAX_DAILY_TRADES,
  maxDailyLossPercent: SCALPING_DEFAULTS.MAX_DAILY_LOSS_PERCENT,
};

const makeMetrics = (overrides: Partial<ScalpingMetrics> = {}): ScalpingMetrics => ({
  cvd: 0,
  imbalanceRatio: 0,
  microprice: 50000,
  spread: 0.1,
  spreadPercent: 0.0002,
  largeBuyVol: 0,
  largeSellVol: 0,
  absorptionScore: 0,
  exhaustionScore: 0,
  timestamp: Date.now(),
  ...overrides,
});

const makeCVDState = (overrides: Partial<CVDState> = {}): CVDState => ({
  value: 100,
  history: [],
  priceHistory: [],
  ...overrides,
});

const makeContext = (overrides: Partial<StrategyContext> = {}): StrategyContext => ({
  symbol: 'BTCUSDT',
  metrics: makeMetrics(),
  cvdState: makeCVDState(),
  currentPrice: 50000,
  vwap: 50000,
  avgVolume: 100,
  walletBalance: 10000,
  ...overrides,
});

describe('SignalEngine', () => {
  let engine: SignalEngine;

  beforeEach(() => {
    engine = new SignalEngine({ ...defaultConfig });
  });

  describe('constructor and state', () => {
    it('should initialize with clean circuit breaker state', () => {
      const state = engine.getCircuitBreakerState();
      expect(state.tripped).toBe(false);
      expect(state.tradeCount).toBe(0);
      expect(state.sessionPnl).toBe(0);
      expect(state.winCount).toBe(0);
      expect(state.lossCount).toBe(0);
      expect(state.dailyTradeCount).toBe(0);
      expect(state.dailyPnl).toBe(0);
      expect(state.consecutiveLosses).toBe(0);
      expect(state.cooldownUntil).toBe(0);
    });

    it('should return a copy of circuit breaker state', () => {
      const state1 = engine.getCircuitBreakerState();
      state1.tripped = true;
      const state2 = engine.getCircuitBreakerState();
      expect(state2.tripped).toBe(false);
    });
  });

  describe('evaluate - spread filter', () => {
    it('should return null when spread exceeds max', () => {
      const ctx = makeContext({
        metrics: makeMetrics({ spreadPercent: 0.1, imbalanceRatio: 0.9 }),
      });
      const signal = engine.evaluate(ctx);
      expect(signal).toBeNull();
    });

    it('should allow signals when spread is within limit', () => {
      const ctx = makeContext({
        metrics: makeMetrics({ spreadPercent: 0.01, imbalanceRatio: 0.9 }),
      });
      const signal = engine.evaluate(ctx);
      expect(signal).not.toBeNull();
    });
  });

  describe('evaluate - imbalance strategy', () => {
    it('should generate LONG signal when bid imbalance > threshold', () => {
      const ctx = makeContext({
        metrics: makeMetrics({ imbalanceRatio: 0.7, spreadPercent: 0.001 }),
      });
      const signal = engine.evaluate(ctx);
      expect(signal).not.toBeNull();
      expect(signal!.direction).toBe('LONG');
      expect(signal!.strategy).toBe('imbalance');
      expect(signal!.symbol).toBe('BTCUSDT');
    });

    it('should generate SHORT signal when ask imbalance > threshold', () => {
      const ctx = makeContext({
        metrics: makeMetrics({ imbalanceRatio: -0.7, spreadPercent: 0.001 }),
      });
      const signal = engine.evaluate(ctx);
      expect(signal).not.toBeNull();
      expect(signal!.direction).toBe('SHORT');
      expect(signal!.strategy).toBe('imbalance');
    });

    it('should not generate signal when imbalance is below threshold', () => {
      const singleStrategyEngine = new SignalEngine({
        ...defaultConfig,
        enabledStrategies: ['imbalance'],
      });
      const ctx = makeContext({
        metrics: makeMetrics({ imbalanceRatio: 0.3, spreadPercent: 0.001 }),
      });
      const signal = singleStrategyEngine.evaluate(ctx);
      expect(signal).toBeNull();
    });

    it('should set SL and TP correctly for LONG imbalance', () => {
      const price = 50000;
      const ctx = makeContext({
        currentPrice: price,
        metrics: makeMetrics({ imbalanceRatio: 0.8, spreadPercent: 0.001 }),
      });
      const signal = engine.evaluate(ctx);
      expect(signal).not.toBeNull();
      expect(signal!.stopLoss).toBeCloseTo(price - price * SCALPING_STRATEGY.IMBALANCE_SL_PERCENT);
      expect(signal!.takeProfit).toBeCloseTo(price + price * SCALPING_STRATEGY.IMBALANCE_TP_PERCENT);
    });

    it('should set SL and TP correctly for SHORT imbalance', () => {
      const price = 50000;
      const ctx = makeContext({
        currentPrice: price,
        metrics: makeMetrics({ imbalanceRatio: -0.8, spreadPercent: 0.001 }),
      });
      const signal = engine.evaluate(ctx);
      expect(signal).not.toBeNull();
      expect(signal!.stopLoss).toBeCloseTo(price + price * SCALPING_STRATEGY.IMBALANCE_SL_PERCENT);
      expect(signal!.takeProfit).toBeCloseTo(price - price * SCALPING_STRATEGY.IMBALANCE_TP_PERCENT);
    });

    it('should cap confidence at max', () => {
      const ctx = makeContext({
        metrics: makeMetrics({ imbalanceRatio: 0.99, spreadPercent: 0.001 }),
      });
      const signal = engine.evaluate(ctx);
      expect(signal).not.toBeNull();
      expect(signal!.confidence).toBeLessThanOrEqual(SCALPING_STRATEGY.IMBALANCE_MAX_CONFIDENCE);
    });
  });

  describe('evaluate - cvd-divergence strategy', () => {
    const makeDivergentContext = (priceUp: boolean, cvdUp: boolean): StrategyContext => {
      const bars = defaultConfig.cvdDivergenceBars;
      const history = Array.from({ length: bars }, (_, i) => ({
        value: cvdUp ? i * 10 : -i * 10,
        timestamp: Date.now() - (bars - i) * 1000,
      }));
      const priceHistory = Array.from({ length: bars }, (_, i) => ({
        price: priceUp ? 50000 + i * 10 : 50000 - i * 10,
        timestamp: Date.now() - (bars - i) * 1000,
      }));

      return makeContext({
        cvdState: makeCVDState({ history, priceHistory }),
        metrics: makeMetrics({ spreadPercent: 0.001 }),
      });
    };

    it('should detect bullish divergence (price down, CVD up) → LONG', () => {
      const eng = new SignalEngine({ ...defaultConfig, enabledStrategies: ['cvd-divergence'] });
      const ctx = makeDivergentContext(false, true);
      const signal = eng.evaluate(ctx);
      expect(signal).not.toBeNull();
      expect(signal!.direction).toBe('LONG');
      expect(signal!.strategy).toBe('cvd-divergence');
    });

    it('should detect bearish divergence (price up, CVD down) → SHORT', () => {
      const eng = new SignalEngine({ ...defaultConfig, enabledStrategies: ['cvd-divergence'] });
      const ctx = makeDivergentContext(true, false);
      const signal = eng.evaluate(ctx);
      expect(signal).not.toBeNull();
      expect(signal!.direction).toBe('SHORT');
    });

    it('should not signal when price and CVD agree', () => {
      const eng = new SignalEngine({ ...defaultConfig, enabledStrategies: ['cvd-divergence'] });
      const ctx = makeDivergentContext(true, true);
      const signal = eng.evaluate(ctx);
      expect(signal).toBeNull();
    });

    it('should not signal with insufficient history', () => {
      const eng = new SignalEngine({ ...defaultConfig, enabledStrategies: ['cvd-divergence'] });
      const ctx = makeContext({
        cvdState: makeCVDState({
          history: [{ value: 1, timestamp: Date.now() }],
          priceHistory: [{ price: 50000, timestamp: Date.now() }],
        }),
        metrics: makeMetrics({ spreadPercent: 0.001 }),
      });
      const signal = eng.evaluate(ctx);
      expect(signal).toBeNull();
    });
  });

  describe('evaluate - mean-reversion strategy', () => {
    it('should SHORT when price is above VWAP by sigma', () => {
      const sigma = defaultConfig.vwapDeviationSigma / 100;
      const vwap = 50000;
      const price = vwap * (1 + sigma * 1.5);
      const eng = new SignalEngine({ ...defaultConfig, enabledStrategies: ['mean-reversion'] });
      const ctx = makeContext({
        currentPrice: price,
        vwap,
        metrics: makeMetrics({ spreadPercent: 0.001 }),
      });
      const signal = eng.evaluate(ctx);
      expect(signal).not.toBeNull();
      expect(signal!.direction).toBe('SHORT');
      expect(signal!.strategy).toBe('mean-reversion');
    });

    it('should LONG when price is below VWAP by sigma', () => {
      const sigma = defaultConfig.vwapDeviationSigma / 100;
      const vwap = 50000;
      const price = vwap * (1 - sigma * 1.5);
      const eng = new SignalEngine({ ...defaultConfig, enabledStrategies: ['mean-reversion'] });
      const ctx = makeContext({
        currentPrice: price,
        vwap,
        metrics: makeMetrics({ spreadPercent: 0.001 }),
      });
      const signal = eng.evaluate(ctx);
      expect(signal).not.toBeNull();
      expect(signal!.direction).toBe('LONG');
    });

    it('should not signal when price is within sigma band', () => {
      const eng = new SignalEngine({ ...defaultConfig, enabledStrategies: ['mean-reversion'] });
      const ctx = makeContext({
        currentPrice: 50000,
        vwap: 50000,
        metrics: makeMetrics({ spreadPercent: 0.001 }),
      });
      const signal = eng.evaluate(ctx);
      expect(signal).toBeNull();
    });

    it('should not signal when vwap is zero', () => {
      const eng = new SignalEngine({ ...defaultConfig, enabledStrategies: ['mean-reversion'] });
      const ctx = makeContext({
        currentPrice: 50000,
        vwap: 0,
        metrics: makeMetrics({ spreadPercent: 0.001 }),
      });
      const signal = eng.evaluate(ctx);
      expect(signal).toBeNull();
    });

    it('should use price-to-vwap distance for TP', () => {
      const sigma = defaultConfig.vwapDeviationSigma / 100;
      const vwap = 50000;
      const price = vwap * (1 + sigma * 2);
      const eng = new SignalEngine({ ...defaultConfig, enabledStrategies: ['mean-reversion'] });
      const ctx = makeContext({
        currentPrice: price,
        vwap,
        metrics: makeMetrics({ spreadPercent: 0.001 }),
      });
      const signal = eng.evaluate(ctx);
      expect(signal).not.toBeNull();
      const expectedTpDistance = Math.abs(price - vwap) * SCALPING_STRATEGY.MEAN_REVERSION_TP_RATIO;
      expect(signal!.takeProfit).toBeCloseTo(price - expectedTpDistance);
    });
  });

  describe('evaluate - momentum-burst strategy', () => {
    it('should signal LONG on large buy volume with positive imbalance', () => {
      const avgVolume = 100;
      const eng = new SignalEngine({ ...defaultConfig, enabledStrategies: ['momentum-burst'] });
      const ctx = makeContext({
        avgVolume,
        metrics: makeMetrics({
          spreadPercent: 0.001,
          imbalanceRatio: 0.5,
          largeBuyVol: avgVolume * SCALPING_DEFAULTS.LARGE_TRADE_MULTIPLIER + 1,
          largeSellVol: 0,
        }),
      });
      const signal = eng.evaluate(ctx);
      expect(signal).not.toBeNull();
      expect(signal!.direction).toBe('LONG');
      expect(signal!.strategy).toBe('momentum-burst');
    });

    it('should signal SHORT on large sell volume with negative imbalance', () => {
      const avgVolume = 100;
      const eng = new SignalEngine({ ...defaultConfig, enabledStrategies: ['momentum-burst'] });
      const ctx = makeContext({
        avgVolume,
        metrics: makeMetrics({
          spreadPercent: 0.001,
          imbalanceRatio: -0.5,
          largeBuyVol: 0,
          largeSellVol: avgVolume * SCALPING_DEFAULTS.LARGE_TRADE_MULTIPLIER + 1,
        }),
      });
      const signal = eng.evaluate(ctx);
      expect(signal).not.toBeNull();
      expect(signal!.direction).toBe('SHORT');
    });

    it('should not signal when volume is below threshold', () => {
      const eng = new SignalEngine({ ...defaultConfig, enabledStrategies: ['momentum-burst'] });
      const ctx = makeContext({
        avgVolume: 100,
        metrics: makeMetrics({
          spreadPercent: 0.001,
          imbalanceRatio: 0.5,
          largeBuyVol: 50,
          largeSellVol: 0,
        }),
      });
      const signal = eng.evaluate(ctx);
      expect(signal).toBeNull();
    });

    it('should not signal when imbalance is below MOMENTUM_BURST_MIN_IMBALANCE', () => {
      const eng = new SignalEngine({ ...defaultConfig, enabledStrategies: ['momentum-burst'] });
      const ctx = makeContext({
        avgVolume: 100,
        metrics: makeMetrics({
          spreadPercent: 0.001,
          imbalanceRatio: 0.2,
          largeBuyVol: 600,
          largeSellVol: 0,
        }),
      });
      const signal = eng.evaluate(ctx);
      expect(signal).toBeNull();
    });

    it('should not signal when avgVolume is zero', () => {
      const eng = new SignalEngine({ ...defaultConfig, enabledStrategies: ['momentum-burst'] });
      const ctx = makeContext({
        avgVolume: 0,
        metrics: makeMetrics({ spreadPercent: 0.001, imbalanceRatio: 0.8, largeBuyVol: 500, largeSellVol: 0 }),
      });
      const signal = eng.evaluate(ctx);
      expect(signal).toBeNull();
    });
  });

  describe('evaluate - absorption-reversal strategy', () => {
    it('should signal when absorptionScore exceeds threshold', () => {
      const eng = new SignalEngine({ ...defaultConfig, enabledStrategies: ['absorption-reversal'] });
      const ctx = makeContext({
        metrics: makeMetrics({
          spreadPercent: 0.001,
          absorptionScore: 4.0,
          imbalanceRatio: 0.5,
        }),
      });
      const signal = eng.evaluate(ctx);
      expect(signal).not.toBeNull();
      expect(signal!.strategy).toBe('absorption-reversal');
      expect(signal!.direction).toBe('LONG');
    });

    it('should not signal when absorptionScore is below threshold', () => {
      const eng = new SignalEngine({ ...defaultConfig, enabledStrategies: ['absorption-reversal'] });
      const ctx = makeContext({
        metrics: makeMetrics({
          spreadPercent: 0.001,
          absorptionScore: 2.0,
          imbalanceRatio: 0.5,
        }),
      });
      const signal = eng.evaluate(ctx);
      expect(signal).toBeNull();
    });
  });

  describe('signal cooldown', () => {
    it('should respect per-symbol-strategy cooldown', () => {
      const ctx = makeContext({
        metrics: makeMetrics({ imbalanceRatio: 0.8, spreadPercent: 0.001 }),
      });
      const signal1 = engine.evaluate(ctx);
      expect(signal1).not.toBeNull();

      const signal2 = engine.evaluate(ctx);
      expect(signal2).toBeNull();
    });

    it('should allow signal after cooldown expires', () => {
      vi.useFakeTimers();
      const ctx = makeContext({
        metrics: makeMetrics({ imbalanceRatio: 0.8, spreadPercent: 0.001 }),
      });

      const signal1 = engine.evaluate(ctx);
      expect(signal1).not.toBeNull();

      vi.advanceTimersByTime(SCALPING_ENGINE.SIGNAL_COOLDOWN_MS + 1);

      const signal2 = engine.evaluate(ctx);
      expect(signal2).not.toBeNull();

      vi.useRealTimers();
    });

    it('should allow different symbols concurrently', () => {
      const ctx1 = makeContext({
        symbol: 'BTCUSDT',
        metrics: makeMetrics({ imbalanceRatio: 0.8, spreadPercent: 0.001 }),
      });
      const ctx2 = makeContext({
        symbol: 'ETHUSDT',
        metrics: makeMetrics({ imbalanceRatio: 0.8, spreadPercent: 0.001 }),
      });

      const signal1 = engine.evaluate(ctx1);
      expect(signal1).not.toBeNull();

      const signal2 = engine.evaluate(ctx2);
      expect(signal2).not.toBeNull();
    });
  });

  describe('signal handlers', () => {
    it('should call registered handlers on signal', () => {
      const handler = vi.fn();
      engine.onSignal(handler);

      const ctx = makeContext({
        metrics: makeMetrics({ imbalanceRatio: 0.8, spreadPercent: 0.001 }),
      });
      engine.evaluate(ctx);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ strategy: 'imbalance' }));
    });

    it('should return unsubscribe function', () => {
      const handler = vi.fn();
      const unsub = engine.onSignal(handler);

      unsub();

      const ctx = makeContext({
        metrics: makeMetrics({ imbalanceRatio: 0.8, spreadPercent: 0.001 }),
      });
      engine.evaluate(ctx);
      expect(handler).not.toHaveBeenCalled();
    });

    it('should not propagate handler errors to caller', () => {
      engine.onSignal(() => { throw new Error('handler crash'); });

      const ctx = makeContext({
        metrics: makeMetrics({ imbalanceRatio: 0.8, spreadPercent: 0.001 }),
      });
      expect(() => engine.evaluate(ctx)).not.toThrow();
    });
  });

  describe('signal structure', () => {
    it('should produce a well-formed ScalpingSignal', () => {
      const ctx = makeContext({
        metrics: makeMetrics({ imbalanceRatio: 0.8, spreadPercent: 0.001 }),
      });
      const signal = engine.evaluate(ctx);
      expect(signal).not.toBeNull();
      expect(signal!.id).toBeDefined();
      expect(typeof signal!.id).toBe('string');
      expect(signal!.symbol).toBe('BTCUSDT');
      expect(['LONG', 'SHORT']).toContain(signal!.direction);
      expect(signal!.entryPrice).toBe(ctx.currentPrice);
      expect(signal!.stopLoss).toBeGreaterThan(0);
      expect(signal!.takeProfit).toBeGreaterThan(0);
      expect(signal!.confidence).toBeGreaterThanOrEqual(0);
      expect(signal!.confidence).toBeLessThanOrEqual(100);
      expect(signal!.timestamp).toBeGreaterThan(0);
      expect(signal!.metrics).toBeDefined();
    });
  });

  describe('recordTrade', () => {
    it('should increment trade count and session PnL', () => {
      engine.recordTrade(50, 10000);
      const state = engine.getCircuitBreakerState();
      expect(state.tradeCount).toBe(1);
      expect(state.sessionPnl).toBe(50);
      expect(state.dailyTradeCount).toBe(1);
      expect(state.dailyPnl).toBe(50);
      expect(state.winCount).toBe(1);
      expect(state.lossCount).toBe(0);
    });

    it('should count losses separately', () => {
      engine.recordTrade(-30, 10000);
      const state = engine.getCircuitBreakerState();
      expect(state.lossCount).toBe(1);
      expect(state.winCount).toBe(0);
      expect(state.sessionPnl).toBe(-30);
    });

    it('should accumulate multiple trades', () => {
      engine.recordTrade(50, 10000);
      engine.recordTrade(-20, 10000);
      engine.recordTrade(30, 10000);
      const state = engine.getCircuitBreakerState();
      expect(state.tradeCount).toBe(3);
      expect(state.sessionPnl).toBe(60);
      expect(state.winCount).toBe(2);
      expect(state.lossCount).toBe(1);
    });
  });

  describe('consecutive loss cooldown', () => {
    it('should track consecutive losses', () => {
      engine.recordTrade(-10, 10000);
      expect(engine.getCircuitBreakerState().consecutiveLosses).toBe(1);
      engine.recordTrade(-10, 10000);
      expect(engine.getCircuitBreakerState().consecutiveLosses).toBe(2);
    });

    it('should reset consecutive losses on win', () => {
      engine.recordTrade(-10, 10000);
      engine.recordTrade(-10, 10000);
      engine.recordTrade(10, 10000);
      expect(engine.getCircuitBreakerState().consecutiveLosses).toBe(0);
    });

    it('should activate cooldown after MAX_CONSECUTIVE_LOSSES', () => {
      vi.useFakeTimers({ now: Date.now() });

      for (let i = 0; i < SCALPING_ENGINE.MAX_CONSECUTIVE_LOSSES; i++) {
        engine.recordTrade(-10, 10000);
      }

      const state = engine.getCircuitBreakerState();
      expect(state.cooldownUntil).toBeGreaterThan(Date.now());
      expect(state.consecutiveLosses).toBe(0);

      vi.useRealTimers();
    });

    it('should block signals during cooldown', () => {
      vi.useFakeTimers({ now: Date.now() });

      for (let i = 0; i < SCALPING_ENGINE.MAX_CONSECUTIVE_LOSSES; i++) {
        engine.recordTrade(-10, 10000);
      }

      const ctx = makeContext({
        metrics: makeMetrics({ imbalanceRatio: 0.9, spreadPercent: 0.001 }),
      });
      const signal = engine.evaluate(ctx);
      expect(signal).toBeNull();

      vi.useRealTimers();
    });

    it('should allow signals after cooldown expires', () => {
      vi.useFakeTimers({ now: Date.now() });

      for (let i = 0; i < SCALPING_ENGINE.MAX_CONSECUTIVE_LOSSES; i++) {
        engine.recordTrade(-10, 10000);
      }

      vi.advanceTimersByTime(SCALPING_ENGINE.CONSECUTIVE_LOSS_COOLDOWN_MS + 1);

      const ctx = makeContext({
        metrics: makeMetrics({ imbalanceRatio: 0.9, spreadPercent: 0.001 }),
      });
      const signal = engine.evaluate(ctx);
      expect(signal).not.toBeNull();

      vi.useRealTimers();
    });
  });

  describe('circuit breaker - session limits', () => {
    it('should trip on max session trades', () => {
      for (let i = 0; i < defaultConfig.circuitBreakerMaxTrades; i++) {
        engine.recordTrade(1, 10000);
      }
      const state = engine.getCircuitBreakerState();
      expect(state.tripped).toBe(true);
    });

    it('should trip on session loss limit', () => {
      const lossThreshold = 10000 * defaultConfig.circuitBreakerLossPercent / 100;
      engine.recordTrade(-lossThreshold, 10000);
      const state = engine.getCircuitBreakerState();
      expect(state.tripped).toBe(true);
    });

    it('should block signals when tripped', () => {
      engine.recordTrade(-10000, 10000);
      const ctx = makeContext({
        metrics: makeMetrics({ imbalanceRatio: 0.9, spreadPercent: 0.001 }),
      });
      const signal = engine.evaluate(ctx);
      expect(signal).toBeNull();
    });
  });

  describe('circuit breaker - daily limits', () => {
    it('should trip on daily trade limit in evaluate', () => {
      const eng = new SignalEngine({
        ...defaultConfig,
        maxDailyTrades: 3,
        circuitBreakerMaxTrades: 100,
      });

      for (let i = 0; i < 3; i++) {
        eng.recordTrade(1, 10000);
      }

      const ctx = makeContext({
        metrics: makeMetrics({ imbalanceRatio: 0.9, spreadPercent: 0.001 }),
      });
      const signal = eng.evaluate(ctx);
      expect(signal).toBeNull();
      expect(eng.getCircuitBreakerState().tripped).toBe(true);
    });

    it('should trip on daily loss limit in evaluate', () => {
      const eng = new SignalEngine({
        ...defaultConfig,
        maxDailyLossPercent: 1.0,
        circuitBreakerLossPercent: 100,
        circuitBreakerMaxTrades: 100,
      });

      const ctx = makeContext({
        walletBalance: 10000,
        metrics: makeMetrics({ imbalanceRatio: 0.9, spreadPercent: 0.001 }),
      });

      eng.recordTrade(-100, 10000);

      const signal = eng.evaluate(ctx);
      expect(signal).toBeNull();
    });
  });

  describe('circuit breaker - daily reset', () => {
    it('should reset daily counters at midnight UTC', () => {
      vi.useFakeTimers({ now: new Date('2026-03-14T23:59:59Z').getTime() });

      const eng = new SignalEngine({ ...defaultConfig });
      eng.recordTrade(-10, 10000);
      expect(eng.getCircuitBreakerState().dailyTradeCount).toBe(1);

      vi.setSystemTime(new Date('2026-03-15T00:00:01Z').getTime());

      const ctx = makeContext({
        metrics: makeMetrics({ imbalanceRatio: 0.1, spreadPercent: 0.001 }),
      });
      eng.evaluate(ctx);

      const state = eng.getCircuitBreakerState();
      expect(state.dailyTradeCount).toBe(0);
      expect(state.dailyPnl).toBe(0);

      vi.useRealTimers();
    });

    it('should clear trip on daily reset if tripped', () => {
      vi.useFakeTimers({ now: new Date('2026-03-14T12:00:00Z').getTime() });

      const eng = new SignalEngine({ ...defaultConfig, maxDailyTrades: 1 });
      eng.recordTrade(1, 10000);

      const ctx = makeContext({
        metrics: makeMetrics({ imbalanceRatio: 0.9, spreadPercent: 0.001 }),
      });
      eng.evaluate(ctx);
      expect(eng.getCircuitBreakerState().tripped).toBe(true);

      vi.setSystemTime(new Date('2026-03-15T00:00:01Z').getTime());

      eng.evaluate(ctx);
      expect(eng.getCircuitBreakerState().tripped).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('circuit breaker - disabled', () => {
    it('should not trip when circuit breaker is disabled', () => {
      const eng = new SignalEngine({
        ...defaultConfig,
        circuitBreakerEnabled: false,
      });

      for (let i = 0; i < 100; i++) {
        eng.recordTrade(-50, 10000);
      }
      expect(eng.getCircuitBreakerState().tripped).toBe(false);
    });
  });

  describe('resetCircuitBreaker', () => {
    it('should fully reset circuit breaker state', () => {
      engine.recordTrade(-100, 10000);
      engine.recordTrade(-100, 10000);
      engine.recordTrade(-100, 10000);
      engine.resetCircuitBreaker();

      const state = engine.getCircuitBreakerState();
      expect(state.tripped).toBe(false);
      expect(state.tradeCount).toBe(0);
      expect(state.sessionPnl).toBe(0);
      expect(state.winCount).toBe(0);
      expect(state.lossCount).toBe(0);
      expect(state.dailyTradeCount).toBe(0);
      expect(state.dailyPnl).toBe(0);
      expect(state.consecutiveLosses).toBe(0);
      expect(state.cooldownUntil).toBe(0);
    });
  });

  describe('updateConfig', () => {
    it('should update partial config', () => {
      const eng = new SignalEngine({ ...defaultConfig, enabledStrategies: ['imbalance'] });
      eng.updateConfig({ imbalanceThreshold: 0.9 });

      const ctx = makeContext({
        metrics: makeMetrics({ imbalanceRatio: 0.85, spreadPercent: 0.001 }),
      });
      const signal = eng.evaluate(ctx);
      expect(signal).toBeNull();
    });
  });

  describe('strategy priority', () => {
    it('should return the first matching strategy signal', () => {
      const eng = new SignalEngine({
        ...defaultConfig,
        enabledStrategies: ['imbalance', 'absorption-reversal'],
      });

      const ctx = makeContext({
        metrics: makeMetrics({
          imbalanceRatio: 0.8,
          absorptionScore: 5.0,
          spreadPercent: 0.001,
        }),
      });
      const signal = eng.evaluate(ctx);
      expect(signal).not.toBeNull();
      expect(signal!.strategy).toBe('imbalance');
    });
  });
});
