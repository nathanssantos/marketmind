import type { IndicatorParamValue } from '@marketmind/trading-core';
import { sanitizeIndicatorParams } from '@marketmind/trading-core';
import type { IndicatorId, IndicatorParams } from './indicatorStore';

interface LegacyMapping {
  catalogType: string;
  baseLabel: string;
  baseParams: Record<string, IndicatorParamValue>;
}

export const LEGACY_TO_CATALOG: Partial<Record<IndicatorId, LegacyMapping>> = {
  'ema-7':   { catalogType: 'ema', baseLabel: 'EMA 7',   baseParams: { period: 7,   color: '#00bfff', lineWidth: 1 } },
  'ema-8':   { catalogType: 'ema', baseLabel: 'EMA 8',   baseParams: { period: 8,   color: '#00bcd4', lineWidth: 1 } },
  'ema-9':   { catalogType: 'ema', baseLabel: 'EMA 9',   baseParams: { period: 9,   color: '#ff00ff', lineWidth: 1 } },
  'ema-10':  { catalogType: 'ema', baseLabel: 'EMA 10',  baseParams: { period: 10,  color: '#14b8a6', lineWidth: 1 } },
  'ema-19':  { catalogType: 'ema', baseLabel: 'EMA 19',  baseParams: { period: 19,  color: '#ff00ff', lineWidth: 1 } },
  'ema-20':  { catalogType: 'ema', baseLabel: 'EMA 20',  baseParams: { period: 20,  color: '#2196f3', lineWidth: 1 } },
  'ema-21':  { catalogType: 'ema', baseLabel: 'EMA 21',  baseParams: { period: 21,  color: '#00e676', lineWidth: 1 } },
  'ema-50':  { catalogType: 'ema', baseLabel: 'EMA 50',  baseParams: { period: 50,  color: '#607d8b', lineWidth: 1 } },
  'ema-70':  { catalogType: 'ema', baseLabel: 'EMA 70',  baseParams: { period: 70,  color: '#9c27b0', lineWidth: 1 } },
  'ema-100': { catalogType: 'ema', baseLabel: 'EMA 100', baseParams: { period: 100, color: '#607d8b', lineWidth: 2 } },
  'ema-200': { catalogType: 'ema', baseLabel: 'EMA 200', baseParams: { period: 200, color: '#607d8b', lineWidth: 3 } },
  volume:           { catalogType: 'volume',           baseLabel: 'Volume',              baseParams: { color: '#607d8b' } },
  rsi:              { catalogType: 'rsi',              baseLabel: 'RSI 14',              baseParams: { period: 14, color: '#2196f3', lineWidth: 1 } },
  rsi14:            { catalogType: 'rsi',              baseLabel: 'RSI 14',              baseParams: { period: 14, color: '#2196f3', lineWidth: 1 } },
  stochastic:       { catalogType: 'stoch',            baseLabel: 'Stoch 14',            baseParams: { period: 14, smoothK: 3, smoothD: 3, color: '#2196f3', lineWidth: 1 } },
  bollingerBands:   { catalogType: 'bollingerBands',   baseLabel: 'BB 20 / 2σ',          baseParams: { period: 20, stdDev: 2, color: '#9c27b0', lineWidth: 1 } },
  atr:              { catalogType: 'atr',              baseLabel: 'ATR 14',              baseParams: { period: 14, color: '#ff9800', lineWidth: 1 } },
  dailyVwap:        { catalogType: 'dailyVwap',        baseLabel: 'Daily VWAP',          baseParams: { color: '#03a9f4', lineWidth: 1 } },
  weeklyVwap:       { catalogType: 'weeklyVwap',       baseLabel: 'Weekly VWAP',         baseParams: { color: '#7c4dff', lineWidth: 1 } },
  vwap:             { catalogType: 'vwap',             baseLabel: 'VWAP',                baseParams: { color: '#ffc107', lineWidth: 1 } },
  macd:             { catalogType: 'macd',             baseLabel: 'MACD',                baseParams: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, color: '#2962ff', lineWidth: 1 } },
  adx:              { catalogType: 'adx',              baseLabel: 'ADX 14',              baseParams: { period: 14, color: '#7c4dff', lineWidth: 1 } },
  williamsR:        { catalogType: 'williamsR',        baseLabel: 'Williams %R 14',      baseParams: { period: 14, color: '#ff9800', lineWidth: 1 } },
  cci:              { catalogType: 'cci',              baseLabel: 'CCI 14',              baseParams: { period: 14, color: '#8bc34a', lineWidth: 1 } },
  stochRsi:         { catalogType: 'stochRsi',         baseLabel: 'Stoch RSI',           baseParams: { rsiPeriod: 14, stochPeriod: 14, kPeriod: 3, dPeriod: 3, color: '#2196f3', lineWidth: 1 } },
  cmo:              { catalogType: 'cmo',              baseLabel: 'CMO 14',              baseParams: { period: 14, color: '#3f51b5', lineWidth: 1 } },
  mfi:              { catalogType: 'mfi',              baseLabel: 'MFI 14',              baseParams: { period: 14, color: '#00bcd4', lineWidth: 1 } },
  ultimateOsc:      { catalogType: 'ultimateOsc',      baseLabel: 'Ultimate Osc',        baseParams: { shortPeriod: 7, midPeriod: 14, longPeriod: 28, color: '#673ab7', lineWidth: 1 } },
  tsi:              { catalogType: 'tsi',              baseLabel: 'TSI',                 baseParams: { longPeriod: 25, shortPeriod: 13, signalPeriod: 13, color: '#009688', lineWidth: 1 } },
  ppo:              { catalogType: 'ppo',              baseLabel: 'PPO',                 baseParams: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, color: '#f44336', lineWidth: 1 } },
  roc:              { catalogType: 'roc',              baseLabel: 'ROC 12',              baseParams: { period: 12, color: '#795548', lineWidth: 1 } },
  ao:               { catalogType: 'ao',               baseLabel: 'Awesome Osc',         baseParams: { fastPeriod: 5, slowPeriod: 34, color: '#26a69a', lineWidth: 1 } },
  aroon:            { catalogType: 'aroon',            baseLabel: 'Aroon 25',            baseParams: { period: 25, color: '#26a69a', lineWidth: 1 } },
  vortex:           { catalogType: 'vortex',           baseLabel: 'Vortex 14',           baseParams: { period: 14, color: '#26a69a', lineWidth: 1 } },
  ichimoku:         { catalogType: 'ichimoku',         baseLabel: 'Ichimoku 9/26/52',    baseParams: { tenkanPeriod: 9, kijunPeriod: 26, senkouPeriod: 52, displacement: 26, tenkanColor: '#2962ff', kijunColor: '#b71c1c', chikouColor: '#7c4dff', lineWidth: 1 } },
  supertrend:       { catalogType: 'supertrend',       baseLabel: 'Supertrend',          baseParams: { period: 10, multiplier: 3, color: '#009688', lineWidth: 2 } },
  parabolicSar:     { catalogType: 'parabolicSar',     baseLabel: 'Parabolic SAR',       baseParams: { start: 0.02, increment: 0.02, max: 0.2, color: '#ff5722' } },
  keltner:          { catalogType: 'keltner',          baseLabel: 'Keltner 20/2',        baseParams: { period: 20, multiplier: 2, color: '#00bcd4', lineWidth: 1 } },
  donchian:         { catalogType: 'donchian',         baseLabel: 'Donchian 20',         baseParams: { period: 20, color: '#607d8b', lineWidth: 1 } },
  obv:              { catalogType: 'obv',              baseLabel: 'OBV',                 baseParams: { color: '#2196f3', lineWidth: 1 } },
  cmf:              { catalogType: 'cmf',              baseLabel: 'CMF 20',              baseParams: { period: 20, color: '#4caf50', lineWidth: 1 } },
  klinger:          { catalogType: 'klinger',          baseLabel: 'Klinger',             baseParams: { fastPeriod: 34, slowPeriod: 55, signalPeriod: 13, color: '#9c27b0', lineWidth: 1 } },
  elderRay:         { catalogType: 'elderRay',         baseLabel: 'Elder Ray 13',        baseParams: { period: 13, color: '#4caf50', lineWidth: 1 } },
  pivotPoints:      { catalogType: 'pivotPoints',      baseLabel: 'Pivot Points',        baseParams: { lookback: 5, lookahead: 2, highColor: '#ef4444', lowColor: '#22c55e' } },
  fibonacci:        { catalogType: 'fibonacci',        baseLabel: 'Fibonacci',           baseParams: { color: '#ffc107' } },
  fvg:              { catalogType: 'fvg',              baseLabel: 'FVG',                 baseParams: { color: '#4caf50' } },
  liquidityLevels:  { catalogType: 'liquidityLevels',  baseLabel: 'Liquidity Levels',    baseParams: { color: '#ffeb3b' } },
  dema:             { catalogType: 'dema',             baseLabel: 'DEMA 20',             baseParams: { period: 20, color: '#ff9800', lineWidth: 1 } },
  tema:             { catalogType: 'tema',             baseLabel: 'TEMA 20',             baseParams: { period: 20, color: '#e91e63', lineWidth: 1 } },
  wma:              { catalogType: 'wma',              baseLabel: 'WMA 20',              baseParams: { period: 20, color: '#9c27b0', lineWidth: 1 } },
  hma:              { catalogType: 'hma',              baseLabel: 'HMA 20',              baseParams: { period: 20, color: '#ff5722', lineWidth: 1 } },
  volumeProfile:    { catalogType: 'volumeProfile',    baseLabel: 'Volume Profile',      baseParams: { numBuckets: 100, maxBarWidth: 120, opacity: 30 } },
  footprint:        { catalogType: 'footprint',        baseLabel: 'Footprint',           baseParams: {} },
  liquidityHeatmap: { catalogType: 'liquidityHeatmap', baseLabel: 'Liquidity Heatmap',   baseParams: {} },
  liquidationMarkers:{ catalogType: 'liquidationMarkers', baseLabel: 'Liquidation Markers', baseParams: {} },
  orb:              { catalogType: 'orb',              baseLabel: 'ORB 15m',             baseParams: { orbPeriodMinutes: 15 } },
};

export const LEGACY_PARAM_REMAPS: Record<string, Record<string, string>> = {
  macd: { fast: 'fastPeriod', slow: 'slowPeriod', signal: 'signalPeriod' },
  ppo: { fast: 'fastPeriod', slow: 'slowPeriod', signal: 'signalPeriod' },
  ichimoku: { tenkan: 'tenkanPeriod', kijun: 'kijunPeriod', senkou: 'senkouPeriod' },
  parabolicSar: { step: 'increment' },
  klinger: { shortPeriod: 'fastPeriod', longPeriod: 'slowPeriod' },
  ultimateOsc: { period1: 'shortPeriod', period2: 'midPeriod', period3: 'longPeriod' },
};

export interface ExistingUserIndicator {
  id: string;
  catalogType: string;
  label: string;
  params: Record<string, IndicatorParamValue>;
}

export interface CreatedUserIndicator {
  id: string;
  catalogType: string;
  params: Record<string, IndicatorParamValue>;
}

export interface MigrationDeps {
  legacyActive: IndicatorId[];
  legacyParams: IndicatorParams;
  existingIndicators: ExistingUserIndicator[];
  createIndicator: (input: {
    catalogType: string;
    label: string;
    params: Record<string, IndicatorParamValue>;
  }) => Promise<CreatedUserIndicator>;
}

export interface PreparedInstance {
  userIndicatorId: string;
  catalogType: string;
  params: Record<string, IndicatorParamValue>;
  visible: boolean;
}

export interface MigrationResult {
  instancesCreated: PreparedInstance[];
  legacyIdsHandled: IndicatorId[];
  legacyIdsSkipped: IndicatorId[];
}

const isParamValue = (v: unknown): v is IndicatorParamValue => {
  if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return true;
  return Array.isArray(v) && v.every((x) => typeof x === 'number');
};

const remapLegacyParams = (
  catalogType: string,
  raw: Record<string, unknown>,
): Record<string, IndicatorParamValue> => {
  const remap = LEGACY_PARAM_REMAPS[catalogType];
  const out: Record<string, IndicatorParamValue> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!isParamValue(v)) continue;
    const canonical = remap?.[k] ?? k;
    out[canonical] = v;
  }
  return out;
};

const paramsEqual = (
  a: Record<string, IndicatorParamValue>,
  b: Record<string, IndicatorParamValue>,
): boolean => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) return false;
  }
  return true;
};

export const migrateLegacyToInstances = async (
  deps: MigrationDeps,
): Promise<MigrationResult> => {
  const { legacyActive, legacyParams, existingIndicators, createIndicator } = deps;
  const instances: PreparedInstance[] = [];
  const handled: IndicatorId[] = [];
  const skipped: IndicatorId[] = [];
  const seenUserIndicatorIds = new Set<string>();

  for (const legacyId of legacyActive) {
    const mapping = LEGACY_TO_CATALOG[legacyId];
    if (!mapping) {
      skipped.push(legacyId);
      continue;
    }

    const userParams = legacyParams[legacyId as keyof IndicatorParams] as
      | Record<string, unknown>
      | undefined;
    const remapped = userParams ? remapLegacyParams(mapping.catalogType, userParams) : {};
    const merged: Record<string, IndicatorParamValue> = { ...mapping.baseParams, ...remapped };
    const { params: finalParams } = sanitizeIndicatorParams(mapping.catalogType, merged);

    const existing = existingIndicators.find(
      (ui) => ui.catalogType === mapping.catalogType && paramsEqual(ui.params, finalParams),
    );

    let userIndicator: CreatedUserIndicator;
    if (existing) {
      userIndicator = { id: existing.id, catalogType: existing.catalogType, params: existing.params };
    } else {
      try {
        userIndicator = await createIndicator({
          catalogType: mapping.catalogType,
          label: mapping.baseLabel,
          params: finalParams,
        });
      } catch {
        skipped.push(legacyId);
        continue;
      }
    }

    if (seenUserIndicatorIds.has(userIndicator.id)) {
      handled.push(legacyId);
      continue;
    }
    seenUserIndicatorIds.add(userIndicator.id);

    instances.push({
      userIndicatorId: userIndicator.id,
      catalogType: userIndicator.catalogType,
      params: userIndicator.params,
      visible: true,
    });
    handled.push(legacyId);
  }

  return { instancesCreated: instances, legacyIdsHandled: handled, legacyIdsSkipped: skipped };
};
