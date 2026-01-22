import { describe, expect, it } from 'vitest';
import { TRADING_DEFAULTS } from '@marketmind/types';
import { buildMultiWatcherConfigFromWatchers } from '../../services/backtesting/configLoader';
import type { WatcherConfig } from '@marketmind/types';

describe('configLoader', () => {
  describe('buildMultiWatcherConfigFromWatchers', () => {
    it('should build config from watcher configs', () => {
      const watchers: WatcherConfig[] = [
        { symbol: 'BTCUSDT', interval: '4h', setupTypes: ['larry-williams-9.1'] },
        { symbol: 'ETHUSDT', interval: '1h', setupTypes: ['engulfing'] },
      ];

      const config = buildMultiWatcherConfigFromWatchers(watchers, {
        startDate: '2024-01-01',
        endDate: '2024-06-01',
        initialCapital: 10000,
      });

      expect(config.watchers).toEqual(watchers);
      expect(config.startDate).toBe('2024-01-01');
      expect(config.endDate).toBe('2024-06-01');
      expect(config.initialCapital).toBe(10000);
    });

    it('should merge all setupTypes from watchers', () => {
      const watchers: WatcherConfig[] = [
        { symbol: 'BTCUSDT', interval: '4h', setupTypes: ['larry-williams-9.1', 'engulfing'] },
        { symbol: 'ETHUSDT', interval: '1h', setupTypes: ['engulfing', 'hammer'] },
      ];

      const config = buildMultiWatcherConfigFromWatchers(watchers, {
        startDate: '2024-01-01',
        endDate: '2024-06-01',
        initialCapital: 10000,
      });

      expect(config.setupTypes).toContain('larry-williams-9.1');
      expect(config.setupTypes).toContain('engulfing');
      expect(config.setupTypes).toContain('hammer');
      expect(config.setupTypes).toHaveLength(3);
    });

    it('should use default values when not provided', () => {
      const watchers: WatcherConfig[] = [
        { symbol: 'BTCUSDT', interval: '4h' },
      ];

      const config = buildMultiWatcherConfigFromWatchers(watchers, {
        startDate: '2024-01-01',
        endDate: '2024-06-01',
        initialCapital: 10000,
      });

      expect(config.exposureMultiplier).toBe(TRADING_DEFAULTS.EXPOSURE_MULTIPLIER);
      expect(config.useStochasticFilter).toBe(false);
      expect(config.useAdxFilter).toBe(false);
      expect(config.onlyWithTrend).toBe(false);
      expect(config.minRiskRewardRatio).toBe(TRADING_DEFAULTS.MIN_RISK_REWARD_RATIO);
      expect(config.cooldownMinutes).toBe(15);
      expect(config.useSharedExposure).toBe(true);
      expect(config.marketType).toBe('SPOT');
      expect(config.leverage).toBe(1);
      expect(config.tpCalculationMode).toBe('default');
    });

    it('should override defaults with provided options', () => {
      const watchers: WatcherConfig[] = [
        { symbol: 'BTCUSDT', interval: '4h' },
      ];

      const config = buildMultiWatcherConfigFromWatchers(watchers, {
        startDate: '2024-01-01',
        endDate: '2024-06-01',
        initialCapital: 10000,
        exposureMultiplier: 2.0,
        useStochasticFilter: false,
        useAdxFilter: false,
        onlyWithTrend: false,
        minRiskRewardRatio: 2.0,
        cooldownMinutes: 30,
        marketType: 'FUTURES',
        leverage: 10,
        tpCalculationMode: 'fibonacci',
      });

      expect(config.exposureMultiplier).toBe(2.0);
      expect(config.useStochasticFilter).toBe(false);
      expect(config.useAdxFilter).toBe(false);
      expect(config.onlyWithTrend).toBe(false);
      expect(config.minRiskRewardRatio).toBe(2.0);
      expect(config.cooldownMinutes).toBe(30);
      expect(config.marketType).toBe('FUTURES');
      expect(config.leverage).toBe(10);
      expect(config.tpCalculationMode).toBe('fibonacci');
    });

    it('should handle watchers without setupTypes', () => {
      const watchers: WatcherConfig[] = [
        { symbol: 'BTCUSDT', interval: '4h' },
        { symbol: 'ETHUSDT', interval: '1h' },
      ];

      const config = buildMultiWatcherConfigFromWatchers(watchers, {
        startDate: '2024-01-01',
        endDate: '2024-06-01',
        initialCapital: 10000,
      });

      expect(config.setupTypes).toEqual([]);
    });

    it('should always set useSharedExposure to true', () => {
      const watchers: WatcherConfig[] = [
        { symbol: 'BTCUSDT', interval: '4h' },
      ];

      const config = buildMultiWatcherConfigFromWatchers(watchers, {
        startDate: '2024-01-01',
        endDate: '2024-06-01',
        initialCapital: 10000,
      });

      expect(config.useSharedExposure).toBe(true);
    });

    it('should always set useCooldown to true', () => {
      const watchers: WatcherConfig[] = [
        { symbol: 'BTCUSDT', interval: '4h' },
      ];

      const config = buildMultiWatcherConfigFromWatchers(watchers, {
        startDate: '2024-01-01',
        endDate: '2024-06-01',
        initialCapital: 10000,
      });

      expect(config.useCooldown).toBe(true);
    });
  });
});
