import type { IndicatorParamValue } from '@marketmind/trading-core';
import { describe, expect, it, vi } from 'vitest';
import type { IndicatorId, IndicatorParams } from './indicatorStore';
import {
  type ExistingUserIndicator,
  LEGACY_PARAM_REMAPS,
  LEGACY_TO_CATALOG,
  migrateLegacyToInstances,
} from './indicatorStoreMigration';

const makeCreate = () =>
  vi.fn(async (input: { catalogType: string; label: string; params: Record<string, IndicatorParamValue> }) => ({
    id: `created_${input.catalogType}_${input.label}`,
    catalogType: input.catalogType,
    params: input.params,
  }));

describe('migrateLegacyToInstances', () => {
  it('reuses an existing userIndicator when catalogType + params match', async () => {
    const existing: ExistingUserIndicator[] = [
      { id: 'ui_ema9', catalogType: 'ema', label: 'EMA 9', params: { period: 9, color: '#ff00ff', lineWidth: 1 } },
    ];
    const create = makeCreate();

    const result = await migrateLegacyToInstances({
      legacyActive: ['ema-9'],
      legacyParams: {} as IndicatorParams,
      existingIndicators: existing,
      createIndicator: create,
    });

    expect(create).not.toHaveBeenCalled();
    expect(result.instancesCreated).toEqual([
      { userIndicatorId: 'ui_ema9', catalogType: 'ema', params: { period: 9, color: '#ff00ff', lineWidth: 1 }, visible: true },
    ]);
    expect(result.legacyIdsHandled).toEqual(['ema-9']);
    expect(result.legacyIdsSkipped).toEqual([]);
  });

  it('creates a new userIndicator when none matches', async () => {
    const create = makeCreate();
    const result = await migrateLegacyToInstances({
      legacyActive: ['rsi'],
      legacyParams: {} as IndicatorParams,
      existingIndicators: [],
      createIndicator: create,
    });

    expect(create).toHaveBeenCalledWith({
      catalogType: 'rsi',
      label: 'RSI 14',
      params: { period: 14, color: '#2196f3', lineWidth: 1 },
    });
    expect(result.instancesCreated).toHaveLength(1);
    expect(result.instancesCreated[0]?.catalogType).toBe('rsi');
  });

  it('remaps legacy macd keys (fast → fastPeriod) before sanitizing', async () => {
    const create = makeCreate();
    await migrateLegacyToInstances({
      legacyActive: ['macd'],
      legacyParams: { macd: { fast: 5, slow: 13, signal: 4 } } as IndicatorParams,
      existingIndicators: [],
      createIndicator: create,
    });

    expect(create).toHaveBeenCalledTimes(1);
    const call = create.mock.calls[0]?.[0];
    expect(call?.params['fastPeriod']).toBe(5);
    expect(call?.params['slowPeriod']).toBe(13);
    expect(call?.params['signalPeriod']).toBe(4);
    expect(call?.params).not.toHaveProperty('fast');
  });

  it('remaps parabolicSar step → increment', async () => {
    const create = makeCreate();
    await migrateLegacyToInstances({
      legacyActive: ['parabolicSar'],
      legacyParams: { parabolicSar: { step: 0.05, max: 0.4 } } as IndicatorParams,
      existingIndicators: [],
      createIndicator: create,
    });

    const call = create.mock.calls[0]?.[0];
    expect(call?.params['increment']).toBe(0.05);
    expect(call?.params['max']).toBe(0.4);
    expect(call?.params).not.toHaveProperty('step');
    expect(call?.params).toHaveProperty('start');
  });

  it('remaps ichimoku tenkan/kijun/senkou → tenkanPeriod/kijunPeriod/senkouPeriod', async () => {
    const create = makeCreate();
    await migrateLegacyToInstances({
      legacyActive: ['ichimoku'],
      legacyParams: { ichimoku: { tenkan: 7, kijun: 22, senkou: 44 } } as IndicatorParams,
      existingIndicators: [],
      createIndicator: create,
    });

    const call = create.mock.calls[0]?.[0];
    expect(call?.params['tenkanPeriod']).toBe(7);
    expect(call?.params['kijunPeriod']).toBe(22);
    expect(call?.params['senkouPeriod']).toBe(44);
  });

  it('strips unknown params via sanitize (e.g. obv.smaPeriod)', async () => {
    const create = makeCreate();
    await migrateLegacyToInstances({
      legacyActive: ['obv'],
      legacyParams: { obv: { smaPeriod: 20 } } as IndicatorParams,
      existingIndicators: [],
      createIndicator: create,
    });

    const call = create.mock.calls[0]?.[0];
    expect(call?.params).not.toHaveProperty('smaPeriod');
    expect(call?.params).toHaveProperty('color');
    expect(call?.params).toHaveProperty('lineWidth');
  });

  it('skips legacy IDs with no catalog mapping', async () => {
    const create = makeCreate();
    const result = await migrateLegacyToInstances({
      legacyActive: ['cvd', 'bookImbalance', 'activityIndicator'] as IndicatorId[],
      legacyParams: {} as IndicatorParams,
      existingIndicators: [],
      createIndicator: create,
    });

    expect(create).not.toHaveBeenCalled();
    expect(result.instancesCreated).toEqual([]);
    expect(result.legacyIdsSkipped).toEqual(['cvd', 'bookImbalance', 'activityIndicator']);
  });

  it('treats stochastic legacy ID as the catalog stoch type with smoothK/smoothD', async () => {
    const create = makeCreate();
    await migrateLegacyToInstances({
      legacyActive: ['stochastic'],
      legacyParams: {} as IndicatorParams,
      existingIndicators: [],
      createIndicator: create,
    });

    const call = create.mock.calls[0]?.[0];
    expect(call?.catalogType).toBe('stoch');
    expect(call?.params['period']).toBe(14);
    expect(call?.params['smoothK']).toBe(3);
    expect(call?.params['smoothD']).toBe(3);
  });

  it('skips a legacy ID when createIndicator throws (e.g. backend rejects)', async () => {
    const create = vi.fn().mockRejectedValueOnce(new Error('boom'));
    const result = await migrateLegacyToInstances({
      legacyActive: ['rsi'],
      legacyParams: {} as IndicatorParams,
      existingIndicators: [],
      createIndicator: create as unknown as MigrationCreate,
    });

    expect(result.instancesCreated).toEqual([]);
    expect(result.legacyIdsSkipped).toEqual(['rsi']);
  });

  it('does not duplicate instances when two legacy IDs map to the same userIndicator (e.g. rsi + rsi14)', async () => {
    const existing: ExistingUserIndicator[] = [
      { id: 'ui_rsi14', catalogType: 'rsi', label: 'RSI 14', params: { period: 14, color: '#2196f3', lineWidth: 1 } },
    ];
    const create = makeCreate();

    const result = await migrateLegacyToInstances({
      legacyActive: ['rsi', 'rsi14'],
      legacyParams: {} as IndicatorParams,
      existingIndicators: existing,
      createIndicator: create,
    });

    expect(create).not.toHaveBeenCalled();
    expect(result.instancesCreated).toHaveLength(1);
    expect(result.legacyIdsHandled).toEqual(['rsi', 'rsi14']);
  });

  it('every legacy IndicatorId in LEGACY_TO_CATALOG references a known catalog type', () => {
    for (const [legacyId, mapping] of Object.entries(LEGACY_TO_CATALOG)) {
      expect(mapping, `mapping for ${legacyId}`).toBeDefined();
      expect(mapping?.catalogType, `catalogType for ${legacyId}`).toMatch(/.+/);
    }
  });

  it('every remap target key exists in baseParams of the corresponding catalog mapping', () => {
    for (const [catalogType, remap] of Object.entries(LEGACY_PARAM_REMAPS)) {
      const mapping = Object.values(LEGACY_TO_CATALOG).find((m) => m?.catalogType === catalogType);
      expect(mapping, `mapping for catalog type ${catalogType}`).toBeDefined();
      for (const target of Object.values(remap)) {
        expect(mapping?.baseParams, `${catalogType}.${target} present`).toHaveProperty(target);
      }
    }
  });
});

type MigrationCreate = Parameters<typeof migrateLegacyToInstances>[0]['createIndicator'];
