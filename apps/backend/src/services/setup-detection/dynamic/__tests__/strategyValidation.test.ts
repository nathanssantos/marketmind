import { describe, it, expect } from 'vitest';
import type { StrategyValidationError } from '@marketmind/types';

import {
  validateRequired,
  validateIndicators,
  validateConditionGroup,
  validateEntry,
  validateExitLevel,
  validateExitConditions,
  validateExit,
  validateStrategyDefinition,
} from '../strategyValidation';

describe('strategyValidation', () => {
  describe('validateRequired', () => {
    it('should add error when field is missing', () => {
      const errors: StrategyValidationError[] = [];
      validateRequired({}, 'name', 'string', errors);
      expect(errors).toHaveLength(1);
      expect(errors[0]?.message).toContain('Missing required field');
    });

    it('should add error when field has wrong type', () => {
      const errors: StrategyValidationError[] = [];
      validateRequired({ name: 123 }, 'name', 'string', errors);
      expect(errors).toHaveLength(1);
      expect(errors[0]?.message).toContain('must be a string');
    });

    it('should not add error when field exists with correct type', () => {
      const errors: StrategyValidationError[] = [];
      validateRequired({ name: 'test' }, 'name', 'string', errors);
      expect(errors).toHaveLength(0);
    });

    it('should validate object type', () => {
      const errors: StrategyValidationError[] = [];
      validateRequired({ params: {} }, 'params', 'object', errors);
      expect(errors).toHaveLength(0);
    });

    it('should reject string when object expected', () => {
      const errors: StrategyValidationError[] = [];
      validateRequired({ params: 'not-an-object' }, 'params', 'object', errors);
      expect(errors).toHaveLength(1);
    });
  });

  describe('validateIndicators', () => {
    it('should accept valid indicators', () => {
      const errors: StrategyValidationError[] = [];
      const warnings: StrategyValidationError[] = [];
      validateIndicators({
        rsi: { type: 'rsi', params: { period: 14 } },
        ema: { type: 'ema', params: { period: 20 } },
      }, errors, warnings);
      expect(errors).toHaveLength(0);
    });

    it('should add error when indicator is not an object', () => {
      const errors: StrategyValidationError[] = [];
      const warnings: StrategyValidationError[] = [];
      validateIndicators({ rsi: 'invalid' }, errors, warnings);
      expect(errors).toHaveLength(1);
      expect(errors[0]?.message).toContain('must be an object');
    });

    it('should add error when indicator is null', () => {
      const errors: StrategyValidationError[] = [];
      const warnings: StrategyValidationError[] = [];
      validateIndicators({ rsi: null }, errors, warnings);
      expect(errors).toHaveLength(1);
    });

    it('should add error when indicator type is missing', () => {
      const errors: StrategyValidationError[] = [];
      const warnings: StrategyValidationError[] = [];
      validateIndicators({ rsi: { params: { period: 14 } } }, errors, warnings);
      expect(errors).toHaveLength(1);
      expect(errors[0]?.message).toContain('type is required');
    });

    it('should add error for unknown indicator type', () => {
      const errors: StrategyValidationError[] = [];
      const warnings: StrategyValidationError[] = [];
      validateIndicators({ x: { type: 'unknownIndicator', params: {} } }, errors, warnings);
      expect(errors).toHaveLength(1);
      expect(errors[0]?.message).toContain('Unknown indicator type');
    });

    it('should add warning when params is missing', () => {
      const errors: StrategyValidationError[] = [];
      const warnings: StrategyValidationError[] = [];
      validateIndicators({ rsi: { type: 'rsi' } }, errors, warnings);
      expect(errors).toHaveLength(0);
      expect(warnings).toHaveLength(1);
      expect(warnings[0]?.message).toContain('params should be an object');
    });

    it('should validate all supported indicator types', () => {
      const supportedTypes = ['sma', 'ema', 'rsi', 'macd', 'bollingerBands', 'atr', 'adx', 'supertrend', 'hma', 'fvg', 'fibonacci'];
      const indicators: Record<string, unknown> = {};
      supportedTypes.forEach((t, i) => { indicators[`ind${i}`] = { type: t, params: {} }; });
      const errors: StrategyValidationError[] = [];
      const warnings: StrategyValidationError[] = [];
      validateIndicators(indicators, errors, warnings);
      expect(errors).toHaveLength(0);
    });
  });

  describe('validateConditionGroup', () => {
    it('should accept valid condition group', () => {
      const errors: StrategyValidationError[] = [];
      validateConditionGroup({
        operator: 'AND',
        conditions: [{ left: 'rsi', op: '>', right: 70 }],
      }, 'entry.long', errors);
      expect(errors).toHaveLength(0);
    });

    it('should add error when group is null', () => {
      const errors: StrategyValidationError[] = [];
      validateConditionGroup(null, 'entry.long', errors);
      expect(errors).toHaveLength(1);
      expect(errors[0]?.message).toContain('must be an object');
    });

    it('should add error when group is not an object', () => {
      const errors: StrategyValidationError[] = [];
      validateConditionGroup('invalid', 'entry.long', errors);
      expect(errors).toHaveLength(1);
    });

    it('should add error when operator is invalid', () => {
      const errors: StrategyValidationError[] = [];
      validateConditionGroup({
        operator: 'XOR',
        conditions: [{ left: 'rsi', op: '>', right: 70 }],
      }, 'entry.long', errors);
      expect(errors).toHaveLength(1);
      expect(errors[0]?.message).toContain('operator must be "AND" or "OR"');
    });

    it('should add error when operator is missing', () => {
      const errors: StrategyValidationError[] = [];
      validateConditionGroup({
        conditions: [{ left: 'rsi', op: '>', right: 70 }],
      }, 'entry.long', errors);
      expect(errors).toHaveLength(1);
    });

    it('should add error when conditions is empty array', () => {
      const errors: StrategyValidationError[] = [];
      validateConditionGroup({ operator: 'AND', conditions: [] }, 'entry.long', errors);
      expect(errors).toHaveLength(1);
      expect(errors[0]?.message).toContain('at least one condition');
    });

    it('should add error when conditions is not an array', () => {
      const errors: StrategyValidationError[] = [];
      validateConditionGroup({ operator: 'AND', conditions: 'invalid' }, 'entry.long', errors);
      expect(errors).toHaveLength(1);
    });

    it('should accept OR operator', () => {
      const errors: StrategyValidationError[] = [];
      validateConditionGroup({
        operator: 'OR',
        conditions: [{ left: 'rsi', op: '>', right: 70 }],
      }, 'entry.long', errors);
      expect(errors).toHaveLength(0);
    });
  });

  describe('validateEntry', () => {
    it('should accept entry with long conditions', () => {
      const errors: StrategyValidationError[] = [];
      validateEntry({
        long: { operator: 'AND', conditions: [{ left: 'rsi', op: '<', right: 30 }] },
      }, errors);
      expect(errors).toHaveLength(0);
    });

    it('should accept entry with short conditions', () => {
      const errors: StrategyValidationError[] = [];
      validateEntry({
        short: { operator: 'AND', conditions: [{ left: 'rsi', op: '>', right: 70 }] },
      }, errors);
      expect(errors).toHaveLength(0);
    });

    it('should accept entry with both long and short', () => {
      const errors: StrategyValidationError[] = [];
      validateEntry({
        long: { operator: 'AND', conditions: [{ left: 'rsi', op: '<', right: 30 }] },
        short: { operator: 'AND', conditions: [{ left: 'rsi', op: '>', right: 70 }] },
      }, errors);
      expect(errors).toHaveLength(0);
    });

    it('should add error when neither long nor short specified', () => {
      const errors: StrategyValidationError[] = [];
      validateEntry({}, errors);
      expect(errors).toHaveLength(1);
      expect(errors[0]?.message).toContain('At least one of entry.long or entry.short');
    });

    it('should validate long condition group structure', () => {
      const errors: StrategyValidationError[] = [];
      validateEntry({ long: { operator: 'INVALID', conditions: [] } }, errors);
      expect(errors.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('validateExitLevel', () => {
    it('should accept valid exit level types', () => {
      const validTypes = ['atr', 'percent', 'fixed', 'indicator', 'riskReward', 'swingHighLow', 'pivotBased'];
      validTypes.forEach(type => {
        const errors: StrategyValidationError[] = [];
        validateExitLevel({ type }, 'exit.stopLoss', errors);
        expect(errors).toHaveLength(0);
      });
    });

    it('should add error for null level', () => {
      const errors: StrategyValidationError[] = [];
      validateExitLevel(null, 'exit.stopLoss', errors);
      expect(errors).toHaveLength(1);
      expect(errors[0]?.message).toContain('must be an object');
    });

    it('should add error for non-object level', () => {
      const errors: StrategyValidationError[] = [];
      validateExitLevel('string', 'exit.stopLoss', errors);
      expect(errors).toHaveLength(1);
    });

    it('should add error for invalid exit level type', () => {
      const errors: StrategyValidationError[] = [];
      validateExitLevel({ type: 'invalidType' }, 'exit.stopLoss', errors);
      expect(errors).toHaveLength(1);
      expect(errors[0]?.message).toContain('Exit level type must be one of');
    });

    it('should add error when type is missing', () => {
      const errors: StrategyValidationError[] = [];
      validateExitLevel({ value: 10 }, 'exit.stopLoss', errors);
      expect(errors).toHaveLength(1);
    });
  });

  describe('validateExitConditions', () => {
    it('should accept valid exit conditions with long', () => {
      const errors: StrategyValidationError[] = [];
      validateExitConditions({
        long: { operator: 'AND', conditions: [{ left: 'rsi', op: '>', right: 80 }] },
      }, errors);
      expect(errors).toHaveLength(0);
    });

    it('should accept valid exit conditions with short', () => {
      const errors: StrategyValidationError[] = [];
      validateExitConditions({
        short: { operator: 'AND', conditions: [{ left: 'rsi', op: '<', right: 20 }] },
      }, errors);
      expect(errors).toHaveLength(0);
    });

    it('should add error when conditions is null', () => {
      const errors: StrategyValidationError[] = [];
      validateExitConditions(null, errors);
      expect(errors).toHaveLength(1);
      expect(errors[0]?.message).toContain('must be an object');
    });

    it('should add error when neither long nor short in conditions', () => {
      const errors: StrategyValidationError[] = [];
      validateExitConditions({}, errors);
      expect(errors).toHaveLength(1);
      expect(errors[0]?.message).toContain('must have at least long or short');
    });
  });

  describe('validateExit', () => {
    it('should accept exit with stopLoss and takeProfit', () => {
      const errors: StrategyValidationError[] = [];
      validateExit({
        stopLoss: { type: 'atr' },
        takeProfit: { type: 'percent' },
      }, errors);
      expect(errors).toHaveLength(0);
    });

    it('should accept exit with conditions only', () => {
      const errors: StrategyValidationError[] = [];
      validateExit({
        conditions: {
          long: { operator: 'AND', conditions: [{ left: 'rsi', op: '>', right: 80 }] },
        },
      }, errors);
      expect(errors).toHaveLength(0);
    });

    it('should add error when no stopLoss and no conditions', () => {
      const errors: StrategyValidationError[] = [];
      validateExit({ takeProfit: { type: 'percent' } }, errors);
      expect(errors).toHaveLength(1);
      expect(errors[0]?.message).toContain('stopLoss or conditions');
    });

    it('should add error when no takeProfit and no conditions', () => {
      const errors: StrategyValidationError[] = [];
      validateExit({ stopLoss: { type: 'atr' } }, errors);
      expect(errors).toHaveLength(1);
      expect(errors[0]?.message).toContain('takeProfit or conditions');
    });

    it('should add two errors when exit is completely empty', () => {
      const errors: StrategyValidationError[] = [];
      validateExit({}, errors);
      expect(errors).toHaveLength(2);
    });

    it('should validate stopLoss level structure', () => {
      const errors: StrategyValidationError[] = [];
      validateExit({
        stopLoss: { type: 'invalidType' },
        takeProfit: { type: 'percent' },
      }, errors);
      expect(errors.some(e => e.path === 'exit.stopLoss.type')).toBe(true);
    });

    it('should validate takeProfit level structure', () => {
      const errors: StrategyValidationError[] = [];
      validateExit({
        stopLoss: { type: 'atr' },
        takeProfit: { type: 'invalidType' },
      }, errors);
      expect(errors.some(e => e.path === 'exit.takeProfit.type')).toBe(true);
    });

    it('should validate exit conditions structure', () => {
      const errors: StrategyValidationError[] = [];
      validateExit({ conditions: 'invalid' }, errors);
      expect(errors.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('validateStrategyDefinition', () => {
    const validStrategy = {
      id: 'test-strategy',
      name: 'Test Strategy',
      version: '1.0.0',
      parameters: {},
      indicators: {
        rsi: { type: 'rsi', params: { period: 14 } },
      },
      entry: {
        long: { operator: 'AND', conditions: [{ left: 'rsi', op: '<', right: 30 }] },
      },
      exit: {
        stopLoss: { type: 'atr' },
        takeProfit: { type: 'percent' },
      },
    };

    it('should validate a correct strategy definition', () => {
      const result = validateStrategyDefinition(validStrategy);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return invalid for null input', () => {
      const result = validateStrategyDefinition(null);
      expect(result.valid).toBe(false);
      expect(result.errors[0]?.message).toContain('must be an object');
    });

    it('should return invalid for undefined input', () => {
      const result = validateStrategyDefinition(undefined);
      expect(result.valid).toBe(false);
    });

    it('should return invalid for non-object input', () => {
      const result = validateStrategyDefinition('string');
      expect(result.valid).toBe(false);
    });

    it('should detect missing required fields', () => {
      const result = validateStrategyDefinition({});
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(7);
    });

    it('should validate id format (kebab-case)', () => {
      const strategy = { ...validStrategy, id: 'InvalidID' };
      const result = validateStrategyDefinition(strategy);
      expect(result.errors.some(e => e.message.includes('kebab-case'))).toBe(true);
    });

    it('should accept valid kebab-case id', () => {
      const strategy = { ...validStrategy, id: 'my-strategy-123' };
      const result = validateStrategyDefinition(strategy);
      expect(result.errors.some(e => e.path === 'id')).toBe(false);
    });

    it('should warn about non-semver version', () => {
      const strategy = { ...validStrategy, version: 'v1' };
      const result = validateStrategyDefinition(strategy);
      expect(result.warnings.some(w => w.message.includes('semantic versioning'))).toBe(true);
    });

    it('should accept valid semver version', () => {
      const strategy = { ...validStrategy, version: '2.1.0' };
      const result = validateStrategyDefinition(strategy);
      expect(result.warnings.some(w => w.path === 'version')).toBe(false);
    });

    it('should validate indicators within the strategy', () => {
      const strategy = {
        ...validStrategy,
        indicators: { bad: { type: 'unknownType', params: {} } },
      };
      const result = validateStrategyDefinition(strategy);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('Unknown indicator type'))).toBe(true);
    });

    it('should validate entry within the strategy', () => {
      const strategy = { ...validStrategy, entry: {} };
      const result = validateStrategyDefinition(strategy);
      expect(result.valid).toBe(false);
    });

    it('should validate exit within the strategy', () => {
      const strategy = { ...validStrategy, exit: {} };
      const result = validateStrategyDefinition(strategy);
      expect(result.valid).toBe(false);
    });

    it('should handle wrong type for indicators field', () => {
      const strategy = { ...validStrategy, indicators: 'not-an-object' };
      const result = validateStrategyDefinition(strategy);
      expect(result.valid).toBe(false);
    });

    it('should handle wrong type for entry field', () => {
      const strategy = { ...validStrategy, entry: 'not-an-object' };
      const result = validateStrategyDefinition(strategy);
      expect(result.valid).toBe(false);
    });

    it('should handle wrong type for exit field', () => {
      const strategy = { ...validStrategy, exit: 'not-an-object' };
      const result = validateStrategyDefinition(strategy);
      expect(result.valid).toBe(false);
    });

    it('should collect both errors and warnings', () => {
      const strategy = {
        ...validStrategy,
        version: 'v1',
        indicators: { rsi: { type: 'rsi' } },
      };
      const result = validateStrategyDefinition(strategy);
      expect(result.warnings.length).toBeGreaterThanOrEqual(1);
    });
  });
});
