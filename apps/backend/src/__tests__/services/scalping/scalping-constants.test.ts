import { describe, expect, it } from 'vitest';
import { SCALPING_DEFAULTS } from '@marketmind/types';
import { SCALPING_ENGINE, SCALPING_STRATEGY, SCALPING_STREAM, SCALPING_EXECUTION } from '../../../constants/scalping';

describe('Scalping Constants', () => {
  describe('SCALPING_DEFAULTS', () => {
    it('should have LARGE_TRADE_MULTIPLIER', () => {
      expect(SCALPING_DEFAULTS.LARGE_TRADE_MULTIPLIER).toBe(3.5);
    });

    it('should have MAX_SPREAD_PERCENT', () => {
      expect(SCALPING_DEFAULTS.MAX_SPREAD_PERCENT).toBe(0.05);
    });

    it('should have optimized MICRO_TRAILING_TICKS', () => {
      expect(SCALPING_DEFAULTS.MICRO_TRAILING_TICKS).toBe(10);
    });

    it('should have consecutive loss defaults', () => {
      expect(SCALPING_DEFAULTS.MAX_CONSECUTIVE_LOSSES).toBe(3);
      expect(SCALPING_DEFAULTS.CONSECUTIVE_LOSS_COOLDOWN_MS).toBe(30 * 60 * 1_000);
    });

    it('should have IMBALANCE_THRESHOLD', () => {
      expect(SCALPING_DEFAULTS.IMBALANCE_THRESHOLD).toBe(0.35);
    });

    it('should have VWAP_DEVIATION_SIGMA', () => {
      expect(SCALPING_DEFAULTS.VWAP_DEVIATION_SIGMA).toBe(1.8);
    });

    it('should have circuit breaker limits', () => {
      expect(SCALPING_DEFAULTS.CIRCUIT_BREAKER_LOSS_PERCENT).toBe(1.5);
      expect(SCALPING_DEFAULTS.CIRCUIT_BREAKER_MAX_TRADES).toBe(30);
      expect(SCALPING_DEFAULTS.MAX_DAILY_TRADES).toBe(30);
      expect(SCALPING_DEFAULTS.MAX_DAILY_LOSS_PERCENT).toBe(1.5);
    });

    it('should have valid tick/bar sizes', () => {
      expect(SCALPING_DEFAULTS.TICK_SIZE).toBe(233);
      expect(SCALPING_DEFAULTS.VOLUME_BAR_SIZE).toBe(1000);
    });

    it('should have agg trade buffer config', () => {
      expect(SCALPING_DEFAULTS.AGG_TRADE_BUFFER_SIZE).toBe(100);
      expect(SCALPING_DEFAULTS.AGG_TRADE_FLUSH_INTERVAL_MS).toBe(1_000);
      expect(SCALPING_DEFAULTS.AGG_TRADE_RETENTION_DAYS).toBe(30);
    });
  });

  describe('SCALPING_ENGINE', () => {
    it('should have SIGNAL_COOLDOWN_MS', () => {
      expect(SCALPING_ENGINE.SIGNAL_COOLDOWN_MS).toBe(15_000);
    });

    it('should inherit consecutive loss constants from SCALPING_DEFAULTS', () => {
      expect(SCALPING_ENGINE.MAX_CONSECUTIVE_LOSSES).toBe(SCALPING_DEFAULTS.MAX_CONSECUTIVE_LOSSES);
      expect(SCALPING_ENGINE.CONSECUTIVE_LOSS_COOLDOWN_MS).toBe(SCALPING_DEFAULTS.CONSECUTIVE_LOSS_COOLDOWN_MS);
    });

    it('should have valid CVD and metrics config', () => {
      expect(SCALPING_ENGINE.CVD_HISTORY_BARS).toBe(300);
      expect(SCALPING_ENGINE.METRICS_HISTORY_SIZE).toBe(1_500);
      expect(SCALPING_ENGINE.VOLUME_PROFILE_MAX_LEVELS).toBe(500);
    });

    it('should have exhaustion detection params', () => {
      expect(SCALPING_ENGINE.EXHAUSTION_LOOKBACK).toBe(20);
      expect(SCALPING_ENGINE.EXHAUSTION_THRESHOLD).toBe(0.4);
      expect(SCALPING_ENGINE.EXHAUSTION_MIN_DELTA).toBe(0.001);
    });

    it('should have value area coverage at 70%', () => {
      expect(SCALPING_ENGINE.VALUE_AREA_COVERAGE).toBe(0.7);
    });

    it('should have micro-trailing min interval', () => {
      expect(SCALPING_ENGINE.MICRO_TRAILING_MIN_INTERVAL_MS).toBe(3_000);
    });

    it('should have micro-trailing error backoff', () => {
      expect(SCALPING_ENGINE.MICRO_TRAILING_ERROR_BACKOFF_MS).toBe(10_000);
      expect(SCALPING_ENGINE.MICRO_TRAILING_MAX_BACKOFF_MS).toBe(60_000);
    });

    it('should have IP ban pause', () => {
      expect(SCALPING_ENGINE.IP_BAN_PAUSE_MS).toBe(300_000);
    });

    it('should have balance cache TTL', () => {
      expect(SCALPING_ENGINE.BALANCE_CACHE_TTL_MS).toBe(10_000);
    });

    it('should have signal eval throttle', () => {
      expect(SCALPING_ENGINE.SIGNAL_EVAL_THROTTLE_MS).toBe(500);
    });
  });

  describe('SCALPING_STRATEGY', () => {
    it('should have optimized CVD_DIVERGENCE_TP_PERCENT', () => {
      expect(SCALPING_STRATEGY.CVD_DIVERGENCE_TP_PERCENT).toBe(0.0045);
    });

    it('should have MOMENTUM_BURST_MIN_IMBALANCE', () => {
      expect(SCALPING_STRATEGY.MOMENTUM_BURST_MIN_IMBALANCE).toBe(0.20);
    });

    it('should have SL/TP for all strategies', () => {
      expect(SCALPING_STRATEGY.IMBALANCE_SL_PERCENT).toBe(0.0015);
      expect(SCALPING_STRATEGY.IMBALANCE_TP_PERCENT).toBe(0.0025);

      expect(SCALPING_STRATEGY.CVD_DIVERGENCE_SL_PERCENT).toBe(0.0025);
      expect(SCALPING_STRATEGY.CVD_DIVERGENCE_TP_PERCENT).toBe(0.0045);

      expect(SCALPING_STRATEGY.MEAN_REVERSION_SL_PERCENT).toBe(0.0025);
      expect(SCALPING_STRATEGY.MEAN_REVERSION_TP_RATIO).toBe(0.6);

      expect(SCALPING_STRATEGY.MOMENTUM_BURST_SL_PERCENT).toBe(0.002);
      expect(SCALPING_STRATEGY.MOMENTUM_BURST_TP_PERCENT).toBe(0.004);

      expect(SCALPING_STRATEGY.ABSORPTION_SL_PERCENT).toBe(0.0018);
      expect(SCALPING_STRATEGY.ABSORPTION_TP_PERCENT).toBe(0.0035);
    });

    it('should have valid confidence ranges', () => {
      expect(SCALPING_STRATEGY.IMBALANCE_BASE_CONFIDENCE).toBeLessThan(SCALPING_STRATEGY.IMBALANCE_MAX_CONFIDENCE);
      expect(SCALPING_STRATEGY.MEAN_REVERSION_BASE_CONFIDENCE).toBeLessThan(SCALPING_STRATEGY.MEAN_REVERSION_MAX_CONFIDENCE);
    });

    it('should maintain positive R:R ratios for all strategies', () => {
      expect(SCALPING_STRATEGY.IMBALANCE_TP_PERCENT / SCALPING_STRATEGY.IMBALANCE_SL_PERCENT).toBeGreaterThan(1);
      expect(SCALPING_STRATEGY.CVD_DIVERGENCE_TP_PERCENT / SCALPING_STRATEGY.CVD_DIVERGENCE_SL_PERCENT).toBeGreaterThan(1);
      expect(SCALPING_STRATEGY.MOMENTUM_BURST_TP_PERCENT / SCALPING_STRATEGY.MOMENTUM_BURST_SL_PERCENT).toBeGreaterThan(1);
      expect(SCALPING_STRATEGY.ABSORPTION_TP_PERCENT / SCALPING_STRATEGY.ABSORPTION_SL_PERCENT).toBeGreaterThan(1);
    });
  });

  describe('SCALPING_STREAM', () => {
    it('should have reconnect config', () => {
      expect(SCALPING_STREAM.RECONNECT_DELAY_MS).toBe(5_000);
      expect(SCALPING_STREAM.MAX_RECONNECT_ATTEMPTS).toBe(10);
    });

    it('should have subscription check interval', () => {
      expect(SCALPING_STREAM.SUBSCRIPTION_CHECK_INTERVAL_MS).toBe(30_000);
    });

    it('should have price throttle', () => {
      expect(SCALPING_STREAM.PRICE_THROTTLE_MS).toBe(50);
    });
  });

  describe('SCALPING_EXECUTION', () => {
    it('should have order timeout', () => {
      expect(SCALPING_EXECUTION.ORDER_TIMEOUT_MS).toBe(5_000);
    });

    it('should have cancel retry config', () => {
      expect(SCALPING_EXECUTION.CANCEL_RETRY_ATTEMPTS).toBe(3);
      expect(SCALPING_EXECUTION.CANCEL_RETRY_DELAY_MS).toBe(200);
    });

    it('should have position verify delay', () => {
      expect(SCALPING_EXECUTION.POSITION_VERIFY_DELAY_MS).toBe(500);
    });

    it('should have margin retry delay', () => {
      expect(SCALPING_EXECUTION.MARGIN_RETRY_DELAY_MS).toBe(500);
    });
  });
});
