import type { StrategyDefinition } from '@marketmind/types';
import { beforeEach, describe, expect, it } from 'vitest';
import { StrategyLoader, StrategyValidationException } from '../StrategyLoader';

describe('StrategyLoader', () => {
  let loader: StrategyLoader;

  beforeEach(() => {
    loader = new StrategyLoader([]);
  });

  const validStrategy: StrategyDefinition = {
    id: 'test-strategy',
    name: 'Test Strategy',
    version: '1.0.0',
    description: 'A test strategy',
    tags: ['test'],
    parameters: {
      period: { default: 14, min: 5, max: 50, step: 1 },
    },
    indicators: {
      rsi: { type: 'rsi', params: { period: '$period' } },
    },
    entry: {
      long: {
        operator: 'AND',
        conditions: [{ left: 'rsi', op: '<', right: 30 }],
      },
    },
    exit: {
      stopLoss: { type: 'percent', value: 2 },
      takeProfit: { type: 'riskReward', multiplier: 2 },
    },
  };

  describe('loadFromString', () => {
    it('should load valid JSON strategy', () => {
      const json = JSON.stringify(validStrategy);
      const result = loader.loadFromString(json);

      expect(result.id).toBe('test-strategy');
      expect(result.name).toBe('Test Strategy');
      expect(result.version).toBe('1.0.0');
    });

    it('should throw error for invalid JSON', () => {
      expect(() => loader.loadFromString('invalid json')).toThrow('Failed to parse JSON');
    });

    it('should throw StrategyValidationException for missing required fields', () => {
      const invalid = { id: 'test' };
      expect(() => loader.loadFromString(JSON.stringify(invalid))).toThrow(StrategyValidationException);
    });
  });

  describe('validateStrategy', () => {
    it('should return valid for complete strategy', () => {
      const result = loader.validateStrategy(validStrategy);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing id', () => {
      const invalid = { ...validStrategy, id: undefined };
      const result = loader.validateStrategy(invalid);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path === 'id')).toBe(true);
    });

    it('should detect missing name', () => {
      const invalid = { ...validStrategy, name: undefined };
      const result = loader.validateStrategy(invalid);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path === 'name')).toBe(true);
    });

    it('should detect missing version', () => {
      const invalid = { ...validStrategy, version: undefined };
      const result = loader.validateStrategy(invalid);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path === 'version')).toBe(true);
    });

    it('should detect missing parameters', () => {
      const invalid = { ...validStrategy, parameters: undefined };
      const result = loader.validateStrategy(invalid);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path === 'parameters')).toBe(true);
    });

    it('should detect missing indicators', () => {
      const invalid = { ...validStrategy, indicators: undefined };
      const result = loader.validateStrategy(invalid);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path === 'indicators')).toBe(true);
    });

    it('should detect missing entry', () => {
      const invalid = { ...validStrategy, entry: undefined };
      const result = loader.validateStrategy(invalid);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path === 'entry')).toBe(true);
    });

    it('should detect missing exit', () => {
      const invalid = { ...validStrategy, exit: undefined };
      const result = loader.validateStrategy(invalid);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path === 'exit')).toBe(true);
    });

    it('should detect invalid id format (not kebab-case)', () => {
      const invalid = { ...validStrategy, id: 'TestStrategy' };
      const result = loader.validateStrategy(invalid);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('kebab-case'))).toBe(true);
    });

    it('should warn for non-semver version', () => {
      const nonSemver = { ...validStrategy, version: '1.0' };
      const result = loader.validateStrategy(nonSemver);

      expect(result.warnings.some(w => w.message.includes('semantic versioning'))).toBe(true);
    });

    it('should detect unknown indicator type', () => {
      const invalid = {
        ...validStrategy,
        indicators: {
          custom: { type: 'unknown_type', params: {} },
        },
      };
      const result = loader.validateStrategy(invalid);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('Unknown indicator type'))).toBe(true);
    });

    it('should detect missing indicator type', () => {
      const invalid = {
        ...validStrategy,
        indicators: {
          custom: { params: {} },
        },
      };
      const result = loader.validateStrategy(invalid);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('type is required'))).toBe(true);
    });

    it('should detect missing entry conditions', () => {
      const invalid = {
        ...validStrategy,
        entry: {},
      };
      const result = loader.validateStrategy(invalid);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('entry.long or entry.short'))).toBe(true);
    });

    it('should detect invalid condition group operator', () => {
      const invalid = {
        ...validStrategy,
        entry: {
          long: {
            operator: 'INVALID',
            conditions: [{ left: 'rsi', op: '<', right: 30 }],
          },
        },
      };
      const result = loader.validateStrategy(invalid);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('AND" or "OR'))).toBe(true);
    });

    it('should detect empty conditions array', () => {
      const invalid = {
        ...validStrategy,
        entry: {
          long: {
            operator: 'AND',
            conditions: [],
          },
        },
      };
      const result = loader.validateStrategy(invalid);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('at least one condition'))).toBe(true);
    });

    it('should detect missing stopLoss when no conditions provided', () => {
      const invalid = {
        ...validStrategy,
        exit: {
          takeProfit: { type: 'riskReward', multiplier: 2 },
        },
      };
      const result = loader.validateStrategy(invalid);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path === 'exit' && e.message.includes('stopLoss or conditions'))).toBe(true);
    });

    it('should detect missing takeProfit when no conditions provided', () => {
      const invalid = {
        ...validStrategy,
        exit: {
          stopLoss: { type: 'percent', value: 2 },
        },
      };
      const result = loader.validateStrategy(invalid);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path === 'exit' && e.message.includes('takeProfit or conditions'))).toBe(true);
    });

    it('should detect invalid exit level type', () => {
      const invalid = {
        ...validStrategy,
        exit: {
          stopLoss: { type: 'invalid_type' },
          takeProfit: { type: 'riskReward', multiplier: 2 },
        },
      };
      const result = loader.validateStrategy(invalid);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('atr, percent, fixed'))).toBe(true);
    });

    it('should validate all supported indicator types', () => {
      const indicatorTypes = ['sma', 'ema', 'rsi', 'macd', 'bollingerBands', 'atr', 'stochastic', 'vwap', 'pivotPoints'];

      for (const type of indicatorTypes) {
        const strategy = {
          ...validStrategy,
          indicators: {
            test: { type, params: { period: 14 } },
          },
        };
        const result = loader.validateStrategy(strategy);

        expect(result.errors.filter(e => e.path.includes('type'))).toHaveLength(0);
      }
    });

    it('should validate all supported exit types', () => {
      const exitTypes = ['atr', 'percent', 'fixed', 'indicator', 'riskReward'];

      for (const type of exitTypes) {
        const strategy = {
          ...validStrategy,
          exit: {
            stopLoss: { type, value: 2, multiplier: 2 },
            takeProfit: { type, value: 4, multiplier: 2 },
          },
        };
        const result = loader.validateStrategy(strategy);

        expect(result.errors.filter(e => e.path.includes('stopLoss.type'))).toHaveLength(0);
        expect(result.errors.filter(e => e.path.includes('takeProfit.type'))).toHaveLength(0);
      }
    });

    it('should return error for non-object strategy', () => {
      const result = loader.validateStrategy(null);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('must be an object'))).toBe(true);
    });

    it('should return error for string strategy', () => {
      const result = loader.validateStrategy('not an object');

      expect(result.valid).toBe(false);
    });
  });

  describe('getStrategy', () => {
    it('should return undefined for non-loaded strategy', () => {
      const result = loader.getStrategy('non-existent');

      expect(result).toBeUndefined();
    });
  });

  describe('getLoadedStrategies', () => {
    it('should return empty array initially', () => {
      const result = loader.getLoadedStrategies();

      expect(result).toHaveLength(0);
    });
  });
});
