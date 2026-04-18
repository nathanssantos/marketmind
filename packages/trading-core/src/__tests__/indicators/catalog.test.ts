import { describe, expect, it } from 'vitest';
import {
  INDICATOR_CATALOG,
  INDICATOR_TYPES,
  getIndicatorDefinition,
  getDefaultParamsForType,
} from '../../indicators/catalog';
import { DEFAULT_USER_INDICATOR_SEEDS } from '../../indicators/defaults';

describe('INDICATOR_CATALOG', () => {
  it('has entries for the core indicators', () => {
    expect(INDICATOR_CATALOG['ema']).toBeDefined();
    expect(INDICATOR_CATALOG['rsi']).toBeDefined();
    expect(INDICATOR_CATALOG['macd']).toBeDefined();
    expect(INDICATOR_CATALOG['bollingerBands']).toBeDefined();
    expect(INDICATOR_CATALOG['volume']).toBeDefined();
  });

  it('every entry has matching outputKey when evaluator.outputKey is set', () => {
    for (const def of Object.values(INDICATOR_CATALOG)) {
      if (def.evaluator.outputKey) {
        const keys = def.outputs.map((o) => o.key);
        expect(keys).toContain(def.evaluator.outputKey);
      }
    }
  });

  it('INDICATOR_TYPES lists all catalog types', () => {
    expect(INDICATOR_TYPES.length).toBe(Object.keys(INDICATOR_CATALOG).length);
    for (const type of INDICATOR_TYPES) {
      expect(INDICATOR_CATALOG[type]).toBeDefined();
    }
  });

  it('getIndicatorDefinition returns undefined for unknown type', () => {
    expect(getIndicatorDefinition('nonexistent')).toBeUndefined();
  });

  it('getDefaultParamsForType returns all param defaults for a known type', () => {
    const defaults = getDefaultParamsForType('rsi');
    expect(defaults).toHaveProperty('period', 14);
    expect(defaults).toHaveProperty('color');
    expect(defaults).toHaveProperty('lineWidth');
  });

  it('defaultLabel produces a human label from params', () => {
    expect(INDICATOR_CATALOG['ema']!.defaultLabel({ period: 50 })).toBe('EMA 50');
    expect(INDICATOR_CATALOG['rsi']!.defaultLabel({ period: 21 })).toBe('RSI 21');
  });
});

describe('DEFAULT_USER_INDICATOR_SEEDS', () => {
  it('every seed references a valid catalog type', () => {
    for (const seed of DEFAULT_USER_INDICATOR_SEEDS) {
      expect(INDICATOR_CATALOG[seed.catalogType], `missing catalog entry for ${seed.catalogType}`).toBeDefined();
    }
  });

  it('seed params only contain keys declared in the catalog', () => {
    for (const seed of DEFAULT_USER_INDICATOR_SEEDS) {
      const def = INDICATOR_CATALOG[seed.catalogType]!;
      const declared = new Set(def.params.map((p) => p.key));
      for (const key of Object.keys(seed.params)) {
        expect(declared.has(key), `${seed.label}: param ${key} not in catalog`).toBe(true);
      }
    }
  });

  it('has at least one EMA, RSI, and Volume seed', () => {
    const hasEma = DEFAULT_USER_INDICATOR_SEEDS.some((s) => s.catalogType === 'ema');
    const hasRsi = DEFAULT_USER_INDICATOR_SEEDS.some((s) => s.catalogType === 'rsi');
    const hasVolume = DEFAULT_USER_INDICATOR_SEEDS.some((s) => s.catalogType === 'volume');
    expect(hasEma && hasRsi && hasVolume).toBe(true);
  });
});
