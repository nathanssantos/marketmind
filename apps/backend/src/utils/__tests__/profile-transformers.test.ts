import { describe, it, expect } from 'vitest';
import {
  parseEnabledSetupTypes,
  stringifyEnabledSetupTypes,
  transformTradingProfile,
  parseDynamicSymbolExcluded,
  stringifyDynamicSymbolExcluded,
  transformAutoTradingConfig,
} from '../profile-transformers';

describe('profile-transformers', () => {
  describe('parseEnabledSetupTypes', () => {
    it('should parse JSON string to string array', () => {
      expect(parseEnabledSetupTypes('["SETUP_1","SETUP_2"]')).toEqual(['SETUP_1', 'SETUP_2']);
    });

    it('should parse empty array', () => {
      expect(parseEnabledSetupTypes('[]')).toEqual([]);
    });
  });

  describe('stringifyEnabledSetupTypes', () => {
    it('should stringify string array to JSON', () => {
      expect(stringifyEnabledSetupTypes(['SETUP_1', 'SETUP_2'])).toBe('["SETUP_1","SETUP_2"]');
    });

    it('should stringify empty array', () => {
      expect(stringifyEnabledSetupTypes([])).toBe('[]');
    });
  });

  describe('parseDynamicSymbolExcluded', () => {
    it('should return empty array for null input', () => {
      expect(parseDynamicSymbolExcluded(null)).toEqual([]);
    });

    it('should parse valid JSON string', () => {
      expect(parseDynamicSymbolExcluded('["BTCUSDT","ETHUSDT"]')).toEqual(['BTCUSDT', 'ETHUSDT']);
    });

    it('should return empty array for invalid JSON', () => {
      expect(parseDynamicSymbolExcluded('not-valid-json')).toEqual([]);
    });

    it('should return empty array for empty string', () => {
      expect(parseDynamicSymbolExcluded('')).toEqual([]);
    });
  });

  describe('stringifyDynamicSymbolExcluded', () => {
    it('should stringify symbols array', () => {
      expect(stringifyDynamicSymbolExcluded(['BTCUSDT'])).toBe('["BTCUSDT"]');
    });

    it('should stringify empty array', () => {
      expect(stringifyDynamicSymbolExcluded([])).toBe('[]');
    });
  });

  describe('transformTradingProfile', () => {
    it('should transform enabledSetupTypes from JSON string to array', () => {
      const profile = createMockProfile({
        enabledSetupTypes: '["SETUP_1","SETUP_2"]',
        maxPositionSize: '100.50',
      });

      const result = transformTradingProfile(profile);

      expect(result.enabledSetupTypes).toEqual(['SETUP_1', 'SETUP_2']);
    });

    it('should parse maxPositionSize to number', () => {
      const profile = createMockProfile({ maxPositionSize: '250.75' });
      const result = transformTradingProfile(profile);
      expect(result.maxPositionSize).toBe(250.75);
    });

    it('should return null for falsy maxPositionSize', () => {
      const profile = createMockProfile({ maxPositionSize: null });
      const result = transformTradingProfile(profile);
      expect(result.maxPositionSize).toBeNull();
    });

    it('should return null for empty string maxPositionSize', () => {
      const profile = createMockProfile({ maxPositionSize: '' });
      const result = transformTradingProfile(profile);
      expect(result.maxPositionSize).toBeNull();
    });

    it('should preserve other profile fields', () => {
      const profile = createMockProfile({
        id: 'test-id',
        name: 'Test Profile',
      });
      const result = transformTradingProfile(profile);
      expect(result.id).toBe('test-id');
      expect(result.name).toBe('Test Profile');
    });
  });

  describe('transformAutoTradingConfig', () => {
    it('should transform enabledSetupTypes and dynamicSymbolExcluded', () => {
      const config = createMockAutoTradingConfig({
        enabledSetupTypes: '["SETUP_A"]',
        dynamicSymbolExcluded: '["BTCUSDT"]',
      });

      const result = transformAutoTradingConfig(config);

      expect(result.enabledSetupTypes).toEqual(['SETUP_A']);
      expect(result.dynamicSymbolExcluded).toEqual(['BTCUSDT']);
    });

    it('should handle null dynamicSymbolExcluded', () => {
      const config = createMockAutoTradingConfig({
        enabledSetupTypes: '[]',
        dynamicSymbolExcluded: null,
      });

      const result = transformAutoTradingConfig(config);
      expect(result.dynamicSymbolExcluded).toEqual([]);
    });

    it('should preserve other config fields', () => {
      const config = createMockAutoTradingConfig({ id: 'config-1' });
      const result = transformAutoTradingConfig(config);
      expect(result.id).toBe('config-1');
    });
  });
});

function createMockProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: 'profile-1',
    walletId: 'wallet-1',
    name: 'Default',
    isActive: true,
    enabledSetupTypes: '[]',
    maxPositionSize: null as string | null,
    positionSizePercent: '5',
    leverage: 10,
    trailingStopEnabled: false,
    trailingStopActivationPercent: '1.5',
    trailingStopCallbackPercent: '0.5',
    trailingStopBreakevenPercent: null as string | null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as never;
}

function createMockAutoTradingConfig(overrides: Record<string, unknown> = {}) {
  return {
    id: 'config-1',
    walletId: 'wallet-1',
    enabled: false,
    enabledSetupTypes: '[]',
    interval: '1h',
    dynamicSymbolEnabled: false,
    dynamicSymbolLimit: 10,
    dynamicSymbolExcluded: null as string | null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as never;
}
