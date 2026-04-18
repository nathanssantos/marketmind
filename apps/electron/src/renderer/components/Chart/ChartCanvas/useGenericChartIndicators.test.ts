import { describe, expect, it } from 'vitest';

import { buildBatches, stableSerialize, COSMETIC_PARAM_KEYS } from './useGenericChartIndicators';
import type { IndicatorInstance } from '@renderer/store/indicatorStore';

const makeInstance = (overrides: Partial<IndicatorInstance>): IndicatorInstance => ({
  id: 'i-default',
  userIndicatorId: 'u-default',
  catalogType: 'sma',
  params: { period: 20 },
  visible: true,
  ...overrides,
});

describe('stableSerialize', () => {
  it('serializes params alphabetically by key', () => {
    expect(stableSerialize({ b: 2, a: 1, c: 3 })).toBe('a=1|b=2|c=3');
  });

  it('excludes cosmetic params (color, lineWidth)', () => {
    expect(stableSerialize({ period: 20, color: '#fff', lineWidth: 2 })).toBe('period=20');
  });

  it('returns empty string when only cosmetic params', () => {
    expect(stableSerialize({ color: '#fff', lineWidth: 1 })).toBe('');
  });

  it('declares cosmetic param keys', () => {
    expect(COSMETIC_PARAM_KEYS.has('color')).toBe(true);
    expect(COSMETIC_PARAM_KEYS.has('lineWidth')).toBe(true);
    expect(COSMETIC_PARAM_KEYS.has('period')).toBe(false);
  });
});

describe('buildBatches', () => {
  it('returns empty when instances list empty', () => {
    expect(buildBatches([])).toEqual([]);
  });

  it('skips invisible instances', () => {
    const batches = buildBatches([makeInstance({ id: 'a', visible: false })]);
    expect(batches).toHaveLength(0);
  });

  it('skips unknown catalog types', () => {
    const batches = buildBatches([makeInstance({ id: 'a', catalogType: 'nope-not-real' })]);
    expect(batches).toHaveLength(0);
  });

  it('skips custom-render indicators (e.g. fibonacci)', () => {
    const batches = buildBatches([
      makeInstance({ id: 'a', catalogType: 'fibonacci', params: {} }),
    ]);
    expect(batches).toHaveLength(0);
  });

  it('builds one batch per unique (scriptId, params) pair', () => {
    const batches = buildBatches([
      makeInstance({ id: 'sma1', catalogType: 'sma', params: { period: 20 } }),
      makeInstance({ id: 'sma2', catalogType: 'sma', params: { period: 50 } }),
      makeInstance({ id: 'ema1', catalogType: 'ema', params: { period: 20 } }),
    ]);
    expect(batches).toHaveLength(3);
  });

  it('batches instances with identical params (cosmetic differences ignored)', () => {
    const batches = buildBatches([
      makeInstance({ id: 'sma-a', catalogType: 'sma', params: { period: 20, color: '#fff', lineWidth: 1 } }),
      makeInstance({ id: 'sma-b', catalogType: 'sma', params: { period: 20, color: '#000', lineWidth: 2 } }),
    ]);
    expect(batches).toHaveLength(1);
    expect(batches[0]?.instanceIds).toEqual(['sma-a', 'sma-b']);
  });

  it('does not batch when non-cosmetic params differ', () => {
    const batches = buildBatches([
      makeInstance({ id: 'sma-a', catalogType: 'sma', params: { period: 20 } }),
      makeInstance({ id: 'sma-b', catalogType: 'sma', params: { period: 50 } }),
    ]);
    expect(batches).toHaveLength(2);
  });

  it('routes pine indicators to service=pine', () => {
    const batches = buildBatches([makeInstance({ id: 'sma1', catalogType: 'sma' })]);
    expect(batches[0]?.service).toBe('pine');
    expect(batches[0]?.scriptId).toBe('sma');
  });

  it('routes native indicators to service=native', () => {
    const batches = buildBatches([
      makeInstance({ id: 'don1', catalogType: 'donchian', params: { period: 20 } }),
    ]);
    expect(batches[0]?.service).toBe('native');
    expect(batches[0]?.scriptId).toBe('donchian');
  });

  it('merges catalog defaults into batch params', () => {
    const batches = buildBatches([makeInstance({ id: 'sma1', catalogType: 'sma', params: {} })]);
    expect(batches[0]?.params['period']).toBeDefined();
  });
});
