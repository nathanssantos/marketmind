import { describe, expect, it } from 'vitest';
import { TRADING_DEFAULTS } from '@marketmind/types';
import {
  createDefaultSetupDetectionConfig,
  getRegisteredSetupKeys,
  getSetupDefaultConfig,
  mergeSetupConfigs,
  SETUP_CONFIG_VERSION,
} from './setupConfig';

describe('setupConfig', () => {
  describe('SETUP_CONFIG_VERSION', () => {
    it('should have correct version', () => {
      expect(SETUP_CONFIG_VERSION).toBe(4);
    });
  });

  describe('createDefaultSetupDetectionConfig', () => {
    it('should create default config', () => {
      const config = createDefaultSetupDetectionConfig();
      expect(config.enabledStrategies).toEqual([]);
      expect(config.minConfidence).toBe(50);
      expect(config.minRiskReward).toBe(TRADING_DEFAULTS.MIN_RISK_REWARD_RATIO);
    });

    it('should create new object each time', () => {
      const config1 = createDefaultSetupDetectionConfig();
      const config2 = createDefaultSetupDetectionConfig();
      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });
  });

  describe('mergeSetupConfigs', () => {
    it('should return defaults when persisted is undefined', () => {
      const defaults = createDefaultSetupDetectionConfig();
      const result = mergeSetupConfigs(defaults, undefined);
      expect(result).toEqual(defaults);
    });

    it('should merge partial persisted config', () => {
      const defaults = createDefaultSetupDetectionConfig();
      const persisted = { minConfidence: 75 };
      const result = mergeSetupConfigs(defaults, persisted);
      expect(result.minConfidence).toBe(75);
      expect(result.minRiskReward).toBe(TRADING_DEFAULTS.MIN_RISK_REWARD_RATIO);
      expect(result.enabledStrategies).toEqual([]);
    });

    it('should use persisted enabledStrategies', () => {
      const defaults = createDefaultSetupDetectionConfig();
      const persisted = { enabledStrategies: ['strategy1', 'strategy2'] };
      const result = mergeSetupConfigs(defaults, persisted);
      expect(result.enabledStrategies).toEqual(['strategy1', 'strategy2']);
    });

    it('should merge all fields correctly', () => {
      const defaults = createDefaultSetupDetectionConfig();
      const persisted = {
        enabledStrategies: ['test-strategy'],
        minConfidence: 80,
        minRiskReward: 2.5,
      };
      const result = mergeSetupConfigs(defaults, persisted);
      expect(result.enabledStrategies).toEqual(['test-strategy']);
      expect(result.minConfidence).toBe(80);
      expect(result.minRiskReward).toBe(2.5);
    });
  });

  describe('getRegisteredSetupKeys', () => {
    it('should return empty array', () => {
      const keys = getRegisteredSetupKeys();
      expect(keys).toEqual([]);
    });
  });

  describe('getSetupDefaultConfig', () => {
    it('should return null for any key', () => {
      expect(getSetupDefaultConfig('any-key')).toBeNull();
      expect(getSetupDefaultConfig('another-key')).toBeNull();
    });
  });
});
