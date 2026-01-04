import type { TradingSetup } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import {
  calculateRiskRewardRatio,
  getSetupInfo,
  getUrgencyColor,
  getUrgencyLabel,
} from './useSetupInfo';

const createMockSetup = (overrides: Partial<TradingSetup> = {}): TradingSetup => ({
  id: '1',
  symbol: 'BTCUSDT',
  interval: '1h',
  type: 'larry-williams-9-1',
  direction: 'LONG',
  entryPrice: 100,
  stopLoss: 95,
  takeProfit: 115,
  confidence: 0.8,
  openTime: Date.now(),
  ...overrides,
});

describe('calculateRiskRewardRatio', () => {
  it('should calculate R:R for long setup', () => {
    const result = calculateRiskRewardRatio(100, 95, 115);

    expect(result).toBe(3);
  });

  it('should calculate R:R for short setup', () => {
    const result = calculateRiskRewardRatio(100, 105, 85);

    expect(result).toBe(3);
  });

  it('should return null when stopLoss is undefined', () => {
    const result = calculateRiskRewardRatio(100, undefined, 115);

    expect(result).toBeNull();
  });

  it('should return null when takeProfit is undefined', () => {
    const result = calculateRiskRewardRatio(100, 95, undefined);

    expect(result).toBeNull();
  });

  it('should return null when stopLoss is null', () => {
    const result = calculateRiskRewardRatio(100, null, 115);

    expect(result).toBeNull();
  });

  it('should return null when takeProfit is null', () => {
    const result = calculateRiskRewardRatio(100, 95, null);

    expect(result).toBeNull();
  });

  it('should return null when both are missing', () => {
    const result = calculateRiskRewardRatio(100, undefined, null);

    expect(result).toBeNull();
  });

  it('should return null when risk is zero', () => {
    const result = calculateRiskRewardRatio(100, 100, 115);

    expect(result).toBeNull();
  });

  it('should handle 1:1 ratio', () => {
    const result = calculateRiskRewardRatio(100, 95, 105);

    expect(result).toBe(1);
  });

  it('should handle small ratios', () => {
    const result = calculateRiskRewardRatio(100, 95, 102);

    expect(result).toBeCloseTo(0.4, 1);
  });

  it('should handle large ratios', () => {
    const result = calculateRiskRewardRatio(100, 99, 150);

    expect(result).toBe(50);
  });

  it('should handle decimal prices', () => {
    const result = calculateRiskRewardRatio(100.5, 99.5, 103.5);

    expect(result).toBe(3);
  });
});

describe('getSetupInfo', () => {
  it('should return default values for null setup', () => {
    const result = getSetupInfo(null);

    expect(result.isLong).toBe(false);
    expect(result.riskRewardRatio).toBeNull();
  });

  it('should return default values for undefined setup', () => {
    const result = getSetupInfo(undefined);

    expect(result.isLong).toBe(false);
    expect(result.riskRewardRatio).toBeNull();
  });

  it('should detect long setup', () => {
    const setup = createMockSetup({ direction: 'LONG' });
    const result = getSetupInfo(setup);

    expect(result.isLong).toBe(true);
  });

  it('should detect short setup', () => {
    const setup = createMockSetup({ direction: 'SHORT' });
    const result = getSetupInfo(setup);

    expect(result.isLong).toBe(false);
  });

  it('should calculate risk/reward ratio', () => {
    const setup = createMockSetup({
      entryPrice: 100,
      stopLoss: 95,
      takeProfit: 110,
    });
    const result = getSetupInfo(setup);

    expect(result.riskRewardRatio).toBe(2);
  });

  it('should return null R:R when stopLoss is missing', () => {
    const setup = createMockSetup({
      entryPrice: 100,
      stopLoss: undefined,
      takeProfit: 110,
    });
    const result = getSetupInfo(setup);

    expect(result.riskRewardRatio).toBeNull();
  });

  it('should return null R:R when takeProfit is missing', () => {
    const setup = createMockSetup({
      entryPrice: 100,
      stopLoss: 95,
      takeProfit: undefined,
    });
    const result = getSetupInfo(setup);

    expect(result.riskRewardRatio).toBeNull();
  });
});

describe('getUrgencyColor', () => {
  it('should return red for immediate', () => {
    expect(getUrgencyColor('immediate')).toBe('red');
  });

  it('should return orange for wait_for_pullback', () => {
    expect(getUrgencyColor('wait_for_pullback')).toBe('orange');
  });

  it('should return green for wait_for_confirmation', () => {
    expect(getUrgencyColor('wait_for_confirmation')).toBe('green');
  });

  it('should return green for undefined', () => {
    expect(getUrgencyColor(undefined)).toBe('green');
  });

  it('should return green for unknown values', () => {
    expect(getUrgencyColor('unknown')).toBe('green');
  });

  it('should return green for empty string', () => {
    expect(getUrgencyColor('')).toBe('green');
  });
});

describe('getUrgencyLabel', () => {
  it('should return Immediate for immediate', () => {
    expect(getUrgencyLabel('immediate')).toBe('Immediate');
  });

  it('should return Wait for Pullback for wait_for_pullback', () => {
    expect(getUrgencyLabel('wait_for_pullback')).toBe('Wait for Pullback');
  });

  it('should return Wait for Confirmation for wait_for_confirmation', () => {
    expect(getUrgencyLabel('wait_for_confirmation')).toBe('Wait for Confirmation');
  });

  it('should return Wait for Confirmation for undefined', () => {
    expect(getUrgencyLabel(undefined)).toBe('Wait for Confirmation');
  });

  it('should return Wait for Confirmation for unknown values', () => {
    expect(getUrgencyLabel('unknown')).toBe('Wait for Confirmation');
  });

  it('should return Wait for Confirmation for empty string', () => {
    expect(getUrgencyLabel('')).toBe('Wait for Confirmation');
  });
});
