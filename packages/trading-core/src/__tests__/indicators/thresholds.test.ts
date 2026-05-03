import { describe, expect, it } from 'vitest';
import { INDICATOR_CATALOG } from '../../indicators/catalog';
import {
  THRESHOLD_PARAM_KEYS,
  getEffectiveOscillatorThresholds,
  hasOscillatorThresholds,
} from '../../indicators/thresholds';

const RSI = INDICATOR_CATALOG['rsi']!;
const ADX = INDICATOR_CATALOG['adx']!;
const EMA = INDICATOR_CATALOG['ema']!;

describe('getEffectiveOscillatorThresholds', () => {
  it('returns catalog defaults when params have no overrides', () => {
    const result = getEffectiveOscillatorThresholds(RSI, {});
    expect(result.oversold).toBe(30);
    expect(result.overbought).toBe(70);
  });

  it('returns catalog defaults when params is undefined', () => {
    const result = getEffectiveOscillatorThresholds(RSI, undefined);
    expect(result.oversold).toBe(30);
    expect(result.overbought).toBe(70);
  });

  it('user overrides take precedence over catalog defaults', () => {
    const result = getEffectiveOscillatorThresholds(RSI, {
      [THRESHOLD_PARAM_KEYS.oversold]: 25,
      [THRESHOLD_PARAM_KEYS.overbought]: 75,
    });
    expect(result.oversold).toBe(25);
    expect(result.overbought).toBe(75);
  });

  it('partial override falls back to catalog default for the missing side', () => {
    const result = getEffectiveOscillatorThresholds(RSI, {
      [THRESHOLD_PARAM_KEYS.oversold]: 20,
    });
    expect(result.oversold).toBe(20);
    expect(result.overbought).toBe(70);
  });

  it('coerces numeric strings to numbers', () => {
    const result = getEffectiveOscillatorThresholds(RSI, {
      [THRESHOLD_PARAM_KEYS.oversold]: '15',
      [THRESHOLD_PARAM_KEYS.overbought]: '85',
    });
    expect(result.oversold).toBe(15);
    expect(result.overbought).toBe(85);
  });

  it('ignores non-finite overrides and falls back to defaults', () => {
    const result = getEffectiveOscillatorThresholds(RSI, {
      [THRESHOLD_PARAM_KEYS.oversold]: 'not-a-number',
      [THRESHOLD_PARAM_KEYS.overbought]: NaN,
    });
    expect(result.oversold).toBe(30);
    expect(result.overbought).toBe(70);
  });

  it('returns undefined for both when indicator has no defaultThresholds', () => {
    const result = getEffectiveOscillatorThresholds(EMA, {});
    expect(result.oversold).toBeUndefined();
    expect(result.overbought).toBeUndefined();
  });

  it('honors user overrides even when indicator catalog has no defaults', () => {
    const result = getEffectiveOscillatorThresholds(EMA, {
      [THRESHOLD_PARAM_KEYS.oversold]: 10,
      [THRESHOLD_PARAM_KEYS.overbought]: 90,
    });
    expect(result.oversold).toBe(10);
    expect(result.overbought).toBe(90);
  });

  it('handles indicators with single-threshold (gt) shape — returns undefined for oversold/overbought', () => {
    // ADX has defaultThresholds: { gt: 25 } only — no oversold/overbought.
    const result = getEffectiveOscillatorThresholds(ADX, {});
    expect(result.oversold).toBeUndefined();
    expect(result.overbought).toBeUndefined();
  });

  it('reserved keys are stable strings (storage contract)', () => {
    // Wire test — if these change, all persisted params on existing
    // user_indicators rows would silently lose their threshold overrides.
    expect(THRESHOLD_PARAM_KEYS.oversold).toBe('_thresholdOversold');
    expect(THRESHOLD_PARAM_KEYS.overbought).toBe('_thresholdOverbought');
  });
});

describe('hasOscillatorThresholds', () => {
  it('true when both oversold and overbought are defined', () => {
    expect(hasOscillatorThresholds(RSI)).toBe(true);
  });

  it('false when only one of the pair is defined (e.g. ADX with gt only)', () => {
    expect(hasOscillatorThresholds(ADX)).toBe(false);
  });

  it('false when no defaultThresholds at all', () => {
    expect(hasOscillatorThresholds(EMA)).toBe(false);
  });
});
