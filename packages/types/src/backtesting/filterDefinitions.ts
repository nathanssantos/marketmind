import type { SimpleBacktestInput } from './backtestInput';

export type FilterFieldKind = 'toggle' | 'number' | 'integer' | 'percent' | 'enum';

export type FilterGroup =
  | 'trend'
  | 'momentum'
  | 'volume'
  | 'volatility'
  | 'session'
  | 'confluence';

export interface FilterFieldDefinition {
  key: keyof SimpleBacktestInput;
  labelKey: string;
  kind: FilterFieldKind;
  default: boolean | number | string;
  min?: number;
  max?: number;
  step?: number;
  enumValues?: readonly string[];
}

export interface FilterDefinition {
  id: string;
  labelKey: string;
  descriptionKey?: string;
  group: FilterGroup;
  toggle: FilterFieldDefinition;
  params?: FilterFieldDefinition[];
}

export const FILTER_DEFINITIONS: readonly FilterDefinition[] = [
  {
    id: 'trend',
    labelKey: 'backtest.filters.trend.label',
    descriptionKey: 'backtest.filters.trend.description',
    group: 'trend',
    toggle: { key: 'useTrendFilter', labelKey: 'backtest.filters.trend.enable', kind: 'toggle', default: true },
    params: [
      { key: 'trendFilterPeriod', labelKey: 'backtest.filters.trend.period', kind: 'integer', default: 21, min: 5, max: 200, step: 1 },
    ],
  },
  {
    id: 'mtf',
    labelKey: 'backtest.filters.mtf.label',
    group: 'trend',
    toggle: { key: 'useMtfFilter', labelKey: 'backtest.filters.mtf.enable', kind: 'toggle', default: false },
  },
  {
    id: 'marketRegime',
    labelKey: 'backtest.filters.marketRegime.label',
    group: 'trend',
    toggle: { key: 'useMarketRegimeFilter', labelKey: 'backtest.filters.marketRegime.enable', kind: 'toggle', default: false },
  },
  {
    id: 'supertrend',
    labelKey: 'backtest.filters.supertrend.label',
    group: 'trend',
    toggle: { key: 'useSuperTrendFilter', labelKey: 'backtest.filters.supertrend.enable', kind: 'toggle', default: false },
    params: [
      { key: 'superTrendPeriod', labelKey: 'backtest.filters.supertrend.period', kind: 'integer', default: 10, min: 1, max: 100, step: 1 },
      { key: 'superTrendMultiplier', labelKey: 'backtest.filters.supertrend.multiplier', kind: 'number', default: 3.0, min: 0.5, max: 10, step: 0.1 },
    ],
  },
  {
    id: 'btcCorrelation',
    labelKey: 'backtest.filters.btcCorrelation.label',
    group: 'trend',
    toggle: { key: 'useBtcCorrelationFilter', labelKey: 'backtest.filters.btcCorrelation.enable', kind: 'toggle', default: false },
  },
  {
    id: 'direction',
    labelKey: 'backtest.filters.direction.label',
    group: 'trend',
    toggle: { key: 'useDirectionFilter', labelKey: 'backtest.filters.direction.enable', kind: 'toggle', default: false },
    params: [
      { key: 'enableLongInBearMarket', labelKey: 'backtest.filters.direction.longInBear', kind: 'toggle', default: false },
      { key: 'enableShortInBullMarket', labelKey: 'backtest.filters.direction.shortInBull', kind: 'toggle', default: false },
    ],
  },
  {
    id: 'stochastic',
    labelKey: 'backtest.filters.stochastic.label',
    group: 'momentum',
    toggle: { key: 'useStochasticFilter', labelKey: 'backtest.filters.stochastic.enable', kind: 'toggle', default: false },
  },
  {
    id: 'stochasticRecovery',
    labelKey: 'backtest.filters.stochasticRecovery.label',
    group: 'momentum',
    toggle: { key: 'useStochasticRecoveryFilter', labelKey: 'backtest.filters.stochasticRecovery.enable', kind: 'toggle', default: false },
  },
  {
    id: 'stochasticHtf',
    labelKey: 'backtest.filters.stochasticHtf.label',
    group: 'momentum',
    toggle: { key: 'useStochasticHtfFilter', labelKey: 'backtest.filters.stochasticHtf.enable', kind: 'toggle', default: false },
  },
  {
    id: 'stochasticRecoveryHtf',
    labelKey: 'backtest.filters.stochasticRecoveryHtf.label',
    group: 'momentum',
    toggle: { key: 'useStochasticRecoveryHtfFilter', labelKey: 'backtest.filters.stochasticRecoveryHtf.enable', kind: 'toggle', default: false },
  },
  {
    id: 'momentum',
    labelKey: 'backtest.filters.momentum.label',
    group: 'momentum',
    toggle: { key: 'useMomentumTimingFilter', labelKey: 'backtest.filters.momentum.enable', kind: 'toggle', default: false },
  },
  {
    id: 'adx',
    labelKey: 'backtest.filters.adx.label',
    group: 'momentum',
    toggle: { key: 'useAdxFilter', labelKey: 'backtest.filters.adx.enable', kind: 'toggle', default: true },
  },
  {
    id: 'volume',
    labelKey: 'backtest.filters.volume.label',
    group: 'volume',
    toggle: { key: 'useVolumeFilter', labelKey: 'backtest.filters.volume.enable', kind: 'toggle', default: false },
  },
  {
    id: 'funding',
    labelKey: 'backtest.filters.funding.label',
    group: 'volume',
    toggle: { key: 'useFundingFilter', labelKey: 'backtest.filters.funding.enable', kind: 'toggle', default: false },
  },
  {
    id: 'vwap',
    labelKey: 'backtest.filters.vwap.label',
    group: 'volume',
    toggle: { key: 'useVwapFilter', labelKey: 'backtest.filters.vwap.enable', kind: 'toggle', default: true },
  },
  {
    id: 'fvg',
    labelKey: 'backtest.filters.fvg.label',
    group: 'volume',
    toggle: { key: 'useFvgFilter', labelKey: 'backtest.filters.fvg.enable', kind: 'toggle', default: false },
    params: [
      { key: 'fvgFilterProximityPercent', labelKey: 'backtest.filters.fvg.proximityPercent', kind: 'percent', default: 0.5, min: 0, max: 5, step: 0.1 },
    ],
  },
  {
    id: 'bollingerSqueeze',
    labelKey: 'backtest.filters.bollingerSqueeze.label',
    group: 'volatility',
    toggle: { key: 'useBollingerSqueezeFilter', labelKey: 'backtest.filters.bollingerSqueeze.enable', kind: 'toggle', default: false },
    params: [
      { key: 'bollingerSqueezeThreshold', labelKey: 'backtest.filters.bollingerSqueeze.threshold', kind: 'number', default: 0.1, min: 0, max: 1, step: 0.01 },
      { key: 'bollingerSqueezePeriod', labelKey: 'backtest.filters.bollingerSqueeze.period', kind: 'integer', default: 20, min: 5, max: 100, step: 1 },
      { key: 'bollingerSqueezeStdDev', labelKey: 'backtest.filters.bollingerSqueeze.stdDev', kind: 'number', default: 2.0, min: 0.5, max: 5, step: 0.1 },
    ],
  },
  {
    id: 'choppiness',
    labelKey: 'backtest.filters.choppiness.label',
    group: 'volatility',
    toggle: { key: 'useChoppinessFilter', labelKey: 'backtest.filters.choppiness.enable', kind: 'toggle', default: true },
    params: [
      { key: 'choppinessThresholdHigh', labelKey: 'backtest.filters.choppiness.thresholdHigh', kind: 'number', default: 61.8, min: 0, max: 100, step: 0.1 },
      { key: 'choppinessThresholdLow', labelKey: 'backtest.filters.choppiness.thresholdLow', kind: 'number', default: 38.2, min: 0, max: 100, step: 0.1 },
      { key: 'choppinessPeriod', labelKey: 'backtest.filters.choppiness.period', kind: 'integer', default: 14, min: 5, max: 100, step: 1 },
    ],
  },
  {
    id: 'session',
    labelKey: 'backtest.filters.session.label',
    group: 'session',
    toggle: { key: 'useSessionFilter', labelKey: 'backtest.filters.session.enable', kind: 'toggle', default: false },
    params: [
      { key: 'sessionStartUtc', labelKey: 'backtest.filters.session.startUtc', kind: 'integer', default: 13, min: 0, max: 23, step: 1 },
      { key: 'sessionEndUtc', labelKey: 'backtest.filters.session.endUtc', kind: 'integer', default: 16, min: 0, max: 23, step: 1 },
    ],
  },
  {
    id: 'confluence',
    labelKey: 'backtest.filters.confluence.label',
    group: 'confluence',
    toggle: { key: 'useConfluenceScoring', labelKey: 'backtest.filters.confluence.enable', kind: 'toggle', default: false },
    params: [
      { key: 'confluenceMinScore', labelKey: 'backtest.filters.confluence.minScore', kind: 'integer', default: 60, min: 0, max: 100, step: 1 },
    ],
  },
];

export const FILTER_GROUPS: readonly FilterGroup[] = [
  'trend',
  'momentum',
  'volume',
  'volatility',
  'session',
  'confluence',
];
