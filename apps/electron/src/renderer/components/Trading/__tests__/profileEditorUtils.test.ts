import type { TradingProfile } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import { extractConfigOverrides, ovBool, ovNum, ovStr } from '../profileEditorUtils';

describe('ovNum', () => {
  it('returns the value when it is a number', () => {
    expect(ovNum({ leverage: 10 }, 'leverage', 1)).toBe(10);
  });

  it('returns the fallback when the key is missing', () => {
    expect(ovNum({}, 'leverage', 5)).toBe(5);
  });

  it('returns the fallback when the value is a string', () => {
    expect(ovNum({ leverage: '10' }, 'leverage', 5)).toBe(5);
  });

  it('returns the fallback when the value is null', () => {
    expect(ovNum({ leverage: null }, 'leverage', 5)).toBe(5);
  });

  it('returns 0 when value is 0', () => {
    expect(ovNum({ val: 0 }, 'val', 99)).toBe(0);
  });
});

describe('ovStr', () => {
  it('returns the value when it is a string', () => {
    expect(ovStr({ mode: 'aggressive' }, 'mode', 'default')).toBe('aggressive');
  });

  it('returns the fallback when the key is missing', () => {
    expect(ovStr({}, 'mode', 'conservative')).toBe('conservative');
  });

  it('returns the fallback when the value is a number', () => {
    expect(ovStr({ mode: 42 }, 'mode', 'default')).toBe('default');
  });

  it('returns empty string when value is empty string', () => {
    expect(ovStr({ mode: '' }, 'mode', 'fallback')).toBe('');
  });
});

describe('ovBool', () => {
  it('returns true when value is true', () => {
    expect(ovBool({ enabled: true }, 'enabled')).toBe(true);
  });

  it('returns false when value is false', () => {
    expect(ovBool({ enabled: false }, 'enabled')).toBe(false);
  });

  it('returns false when key is missing', () => {
    expect(ovBool({}, 'enabled')).toBe(false);
  });

  it('returns false when value is truthy but not true', () => {
    expect(ovBool({ enabled: 1 }, 'enabled')).toBe(false);
    expect(ovBool({ enabled: 'yes' }, 'enabled')).toBe(false);
  });
});

describe('extractConfigOverrides', () => {
  it('extracts non-null config keys from a profile', () => {
    const profile = {
      useTrendFilter: true,
      positionSizePercent: 5,
      tradingMode: 'aggressive',
    } as unknown as TradingProfile;

    const result = extractConfigOverrides(profile);
    expect(result.useTrendFilter).toBe(true);
    expect(result.positionSizePercent).toBe(5);
    expect(result.tradingMode).toBe('aggressive');
  });

  it('skips null and undefined values', () => {
    const profile = {
      useTrendFilter: null,
      useAdxFilter: undefined,
      positionSizePercent: 10,
    } as unknown as TradingProfile;

    const result = extractConfigOverrides(profile);
    expect(result).not.toHaveProperty('useTrendFilter');
    expect(result).not.toHaveProperty('useAdxFilter');
    expect(result.positionSizePercent).toBe(10);
  });

  it('returns empty object when all config keys are null', () => {
    const profile = {} as unknown as TradingProfile;
    const result = extractConfigOverrides(profile);
    expect(Object.keys(result)).toHaveLength(0);
  });

  it('includes false boolean values', () => {
    const profile = { useTrendFilter: false } as unknown as TradingProfile;
    const result = extractConfigOverrides(profile);
    expect(result.useTrendFilter).toBe(false);
  });

  it('includes zero numeric values', () => {
    const profile = { positionSizePercent: 0 } as unknown as TradingProfile;
    const result = extractConfigOverrides(profile);
    expect(result.positionSizePercent).toBe(0);
  });
});
