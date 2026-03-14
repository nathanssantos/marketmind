import { describe, it, expect } from 'vitest';
import {
  KELLY_CRITERION,
  VOLATILITY_ADJUSTMENT,
  TIMING,
  LIQUIDATION_THRESHOLDS,
  AUTO_TRADING_CACHE,
  AUTO_TRADING_ROTATION,
  AUTO_TRADING_BATCH,
  AUTO_TRADING_API,
  AUTO_TRADING_ORDER,
  AUTO_TRADING_RETRY,
  PROTECTION_ORDER_RETRY,
  TRADING_CORE_CONSTANTS,
} from '../constants';

describe('Trading Core Constants', () => {
  describe('KELLY_CRITERION', () => {
    it('should have valid default win rate', () => {
      expect(KELLY_CRITERION.DEFAULT_WIN_RATE).toBe(0.5);
    });

    it('should have valid default average R:R', () => {
      expect(KELLY_CRITERION.DEFAULT_AVG_RR).toBe(1.5);
    });

    it('should have valid fractional Kelly', () => {
      expect(KELLY_CRITERION.FRACTIONAL_KELLY).toBe(0.25);
    });

    it('should have minimum trades for stats', () => {
      expect(KELLY_CRITERION.MIN_TRADES_FOR_STATS).toBe(20);
    });
  });

  describe('VOLATILITY_ADJUSTMENT', () => {
    it('should have high volatility reduction factor', () => {
      expect(VOLATILITY_ADJUSTMENT.HIGH_VOLATILITY_REDUCTION_FACTOR).toBe(0.7);
    });

    it('should have ATR high threshold', () => {
      expect(VOLATILITY_ADJUSTMENT.ATR_HIGH_THRESHOLD).toBe(3.0);
    });
  });

  describe('TIMING', () => {
    it('should have candle close safety buffer', () => {
      expect(TIMING.CANDLE_CLOSE_SAFETY_BUFFER_MS).toBe(2000);
    });

    it('should have check interval', () => {
      expect(TIMING.CHECK_INTERVAL_MS).toBe(15_000);
    });

    it('should have trailing stop interval', () => {
      expect(TIMING.TRAILING_STOP_INTERVAL_MS).toBe(60_000);
    });

    it('should have opportunity cost interval', () => {
      expect(TIMING.OPPORTUNITY_COST_INTERVAL_MS).toBe(60_000);
    });

    it('should have margin check interval', () => {
      expect(TIMING.MARGIN_CHECK_INTERVAL_MS).toBe(60_000);
    });

    it('should have position check throttle', () => {
      expect(TIMING.POSITION_CHECK_THROTTLE_MS).toBe(500);
    });

    it('should have subscription check interval', () => {
      expect(TIMING.SUBSCRIPTION_CHECK_INTERVAL_MS).toBe(300_000);
    });
  });

  describe('LIQUIDATION_THRESHOLDS', () => {
    it('should have warning threshold', () => {
      expect(LIQUIDATION_THRESHOLDS.WARNING).toBe(0.5);
    });

    it('should have danger threshold', () => {
      expect(LIQUIDATION_THRESHOLDS.DANGER).toBe(0.25);
    });

    it('should have critical threshold', () => {
      expect(LIQUIDATION_THRESHOLDS.CRITICAL).toBe(0.1);
    });

    it('should have thresholds in correct order', () => {
      expect(LIQUIDATION_THRESHOLDS.WARNING).toBeGreaterThan(LIQUIDATION_THRESHOLDS.DANGER);
      expect(LIQUIDATION_THRESHOLDS.DANGER).toBeGreaterThan(LIQUIDATION_THRESHOLDS.CRITICAL);
    });
  });

  describe('AUTO_TRADING_CACHE', () => {
    it('should have default TTL', () => {
      expect(AUTO_TRADING_CACHE.DEFAULT_TTL_MS).toBe(60_000);
    });

    it('should have config TTL', () => {
      expect(AUTO_TRADING_CACHE.CONFIG_TTL_MS).toBe(30_000);
    });
  });

  describe('AUTO_TRADING_ROTATION', () => {
    it('should have valid anticipation range', () => {
      expect(AUTO_TRADING_ROTATION.MIN_ANTICIPATION_MS).toBeLessThan(AUTO_TRADING_ROTATION.MAX_ANTICIPATION_MS);
    });

    it('should have minimum preparation time', () => {
      expect(AUTO_TRADING_ROTATION.MIN_PREPARATION_TIME_MS).toBeGreaterThan(0);
    });
  });

  describe('AUTO_TRADING_BATCH', () => {
    it('should have watcher batch size', () => {
      expect(AUTO_TRADING_BATCH.WATCHER_BATCH_SIZE).toBe(6);
    });

    it('should have kline fetch batch size', () => {
      expect(AUTO_TRADING_BATCH.KLINE_FETCH_BATCH_SIZE).toBe(1000);
    });
  });

  describe('AUTO_TRADING_API', () => {
    it('should have rate limit delay', () => {
      expect(AUTO_TRADING_API.RATE_LIMIT_DELAY_MS).toBe(200);
    });

    it('should have gap tolerance multiplier', () => {
      expect(AUTO_TRADING_API.GAP_TOLERANCE_MULTIPLIER).toBe(1.5);
    });
  });

  describe('AUTO_TRADING_ORDER', () => {
    it('should have min notional buffer', () => {
      expect(AUTO_TRADING_ORDER.MIN_NOTIONAL_BUFFER).toBe(1.1);
    });

    it('should have default min notional', () => {
      expect(AUTO_TRADING_ORDER.DEFAULT_MIN_NOTIONAL).toBe(5);
    });
  });

  describe('AUTO_TRADING_RETRY', () => {
    it('should have max retries', () => {
      expect(AUTO_TRADING_RETRY.MAX_RETRIES).toBe(3);
    });

    it('should have valid delay range', () => {
      expect(AUTO_TRADING_RETRY.INITIAL_DELAY_MS).toBeLessThan(AUTO_TRADING_RETRY.MAX_DELAY_MS);
    });

    it('should have backoff multiplier', () => {
      expect(AUTO_TRADING_RETRY.BACKOFF_MULTIPLIER).toBe(2);
    });
  });

  describe('PROTECTION_ORDER_RETRY', () => {
    it('should have max attempts', () => {
      expect(PROTECTION_ORDER_RETRY.MAX_ATTEMPTS).toBe(3);
    });

    it('should have valid delay range', () => {
      expect(PROTECTION_ORDER_RETRY.INITIAL_DELAY_MS).toBeLessThan(PROTECTION_ORDER_RETRY.MAX_DELAY_MS);
    });
  });

  describe('TRADING_CORE_CONSTANTS', () => {
    it('should aggregate all constants', () => {
      expect(TRADING_CORE_CONSTANTS.KELLY).toBe(KELLY_CRITERION);
      expect(TRADING_CORE_CONSTANTS.VOLATILITY).toBe(VOLATILITY_ADJUSTMENT);
      expect(TRADING_CORE_CONSTANTS.TIMING).toBe(TIMING);
      expect(TRADING_CORE_CONSTANTS.LIQUIDATION).toBe(LIQUIDATION_THRESHOLDS);
    });
  });
});
