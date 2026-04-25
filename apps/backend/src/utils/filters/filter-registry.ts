import type { Kline, PositionSide } from '@marketmind/types';
import type { VolumeFilterConfig } from './volume-filter';
import { checkAdxCondition } from './adx-filter';
import { checkBollingerSqueezeCondition } from './bollinger-squeeze-filter';
import { checkChoppinessCondition } from './choppiness-filter';
import { checkDirectionFilter } from './direction-filter';
import { checkMarketRegime } from './market-regime-filter';
import { checkMomentumTiming } from './momentum-timing-filter';
import { checkSessionCondition } from './session-filter';
import { checkStochasticCondition } from './stochastic-filter';
import { checkStochasticRecoveryCondition } from './stochastic-recovery-filter';
import { checkSupertrendCondition } from './supertrend-filter';
import { checkTrendCondition } from './trend-filter';
import { checkVolumeCondition } from './volume-filter';
import { checkVwapCondition } from './vwap-filter';

export interface BaseFilterResult {
  isAllowed: boolean;
  reason?: string;
}

export interface FilterParam {
  key: string;
  default: number | boolean | string;
  parseFromDb?: boolean;
}

export interface FilterDef {
  id: string;
  enableKey: string;
  displayName: string;
  statsKey: string;
  params: FilterParam[];
  run?: (
    klines: Kline[],
    direction: PositionSide,
    setupType: string,
    config: Record<string, unknown>
  ) => Promise<BaseFilterResult>;
}

export const FILTER_REGISTRY: FilterDef[] = [
  {
    id: 'stochastic',
    enableKey: 'useStochasticFilter',
    displayName: 'Stochastic',
    statsKey: 'skippedStochastic',
    params: [],
    run: (klines, direction) => checkStochasticCondition(klines, direction),
  },
  {
    id: 'stochasticRecovery',
    enableKey: 'useStochasticRecoveryFilter',
    displayName: 'Stochastic Recovery',
    statsKey: 'skippedStochasticRecovery',
    params: [],
    run: (klines, direction) => checkStochasticRecoveryCondition(klines, direction),
  },
  {
    id: 'stochasticHtf',
    enableKey: 'useStochasticHtfFilter',
    displayName: 'HTF Stochastic',
    statsKey: 'skippedStochasticHtf',
    params: [],
  },
  {
    id: 'stochasticRecoveryHtf',
    enableKey: 'useStochasticRecoveryHtfFilter',
    displayName: 'HTF Stochastic Recovery',
    statsKey: 'skippedStochasticRecoveryHtf',
    params: [],
  },
  {
    id: 'momentum',
    enableKey: 'useMomentumTimingFilter',
    displayName: 'Momentum',
    statsKey: 'skippedMomentumTiming',
    params: [],
    run: (klines, direction, setupType) =>
      checkMomentumTiming(klines, direction, setupType),
  },
  {
    id: 'adx',
    enableKey: 'useAdxFilter',
    displayName: 'ADX',
    statsKey: 'skippedAdx',
    params: [],
    run: (klines, direction) => checkAdxCondition(klines, direction),
  },
  {
    id: 'trend',
    enableKey: 'useTrendFilter',
    displayName: 'Trend (EMA21)',
    statsKey: 'skippedTrend',
    params: [],
    run: (klines, direction) => checkTrendCondition(klines, direction),
  },
  {
    id: 'choppiness',
    enableKey: 'useChoppinessFilter',
    displayName: 'Choppiness',
    statsKey: 'skippedChoppiness',
    params: [
      { key: 'choppinessThresholdHigh', default: 61.8, parseFromDb: true },
      { key: 'choppinessThresholdLow', default: 38.2, parseFromDb: true },
      { key: 'choppinessPeriod', default: 14 },
    ],
    run: (klines, _direction, _setupType, cfg) =>
      checkChoppinessCondition(
        klines,
        cfg['choppinessThresholdHigh'] as number,
        cfg['choppinessThresholdLow'] as number,
        cfg['choppinessPeriod'] as number,
      ),
  },
  {
    id: 'session',
    enableKey: 'useSessionFilter',
    displayName: 'Session',
    statsKey: 'skippedSession',
    params: [
      { key: 'sessionStartUtc', default: 13 },
      { key: 'sessionEndUtc', default: 16 },
    ],
    run: (_klines, _direction, _setupType, cfg) =>
      Promise.resolve(checkSessionCondition(
        Date.now(),
        cfg['sessionStartUtc'] as number,
        cfg['sessionEndUtc'] as number,
      )),
  },
  {
    id: 'bollingerSqueeze',
    enableKey: 'useBollingerSqueezeFilter',
    displayName: 'Bollinger Squeeze',
    statsKey: 'skippedBollingerSqueeze',
    params: [
      { key: 'bollingerSqueezeThreshold', default: 0.1, parseFromDb: true },
      { key: 'bollingerSqueezePeriod', default: 20 },
      { key: 'bollingerSqueezeStdDev', default: 2.0, parseFromDb: true },
    ],
    run: (klines, _direction, _setupType, cfg) =>
      checkBollingerSqueezeCondition(
        klines,
        cfg['bollingerSqueezeThreshold'] as number,
        cfg['bollingerSqueezePeriod'] as number,
        cfg['bollingerSqueezeStdDev'] as number,
      ),
  },
  {
    id: 'vwap',
    enableKey: 'useVwapFilter',
    displayName: 'VWAP',
    statsKey: 'skippedVwap',
    params: [],
    run: (klines, direction) => checkVwapCondition(klines, direction),
  },
  {
    id: 'supertrend',
    enableKey: 'useSuperTrendFilter',
    displayName: 'SuperTrend',
    statsKey: 'skippedSupertrend',
    params: [
      { key: 'superTrendPeriod', default: 10 },
      { key: 'superTrendMultiplier', default: 3.0, parseFromDb: true },
    ],
    run: (klines, direction, _setupType, cfg) =>
      checkSupertrendCondition(
        klines,
        direction,
        cfg['superTrendPeriod'] as number,
        cfg['superTrendMultiplier'] as number,
      ),
  },
  {
    id: 'direction',
    enableKey: 'useDirectionFilter',
    displayName: 'Direction (EMA200)',
    statsKey: 'skippedDirection',
    params: [
      { key: 'enableLongInBearMarket', default: false },
      { key: 'enableShortInBullMarket', default: false },
    ],
    run: (klines, direction, _setupType, cfg) =>
      checkDirectionFilter(klines, direction, {
        enableLongInBearMarket: cfg['enableLongInBearMarket'] as boolean,
        enableShortInBullMarket: cfg['enableShortInBullMarket'] as boolean,
      }),
  },
  {
    id: 'marketRegime',
    enableKey: 'useMarketRegimeFilter',
    displayName: 'Market Regime',
    statsKey: 'skippedMarketRegime',
    params: [],
    run: (klines, _direction, setupType) =>
      checkMarketRegime(klines, setupType),
  },
  {
    id: 'volume',
    enableKey: 'useVolumeFilter',
    displayName: 'Volume',
    statsKey: 'skippedVolume',
    params: [],
    run: (klines, direction, setupType, cfg) =>
      checkVolumeCondition(
        klines,
        direction,
        setupType,
        cfg['volumeFilterConfig'] as VolumeFilterConfig | undefined,
      ),
  },
  {
    id: 'btcCorrelation',
    enableKey: 'useBtcCorrelationFilter',
    displayName: 'BTC Correlation',
    statsKey: 'skippedBtcCorrelation',
    params: [],
  },
  {
    id: 'funding',
    enableKey: 'useFundingFilter',
    displayName: 'Funding Rate',
    statsKey: 'skippedFunding',
    params: [],
  },
  {
    id: 'mtf',
    enableKey: 'useMtfFilter',
    displayName: 'MTF Trend',
    statsKey: 'skippedMtf',
    params: [],
  },
  {
    id: 'confluence',
    enableKey: 'useConfluenceScoring',
    displayName: 'Confluence',
    statsKey: 'skippedConfluence',
    params: [
      { key: 'confluenceMinScore', default: 60 },
    ],
  },
];

const FILTER_VALIDATOR_EXCLUDED_IDS = new Set([
  'trend', 'marketRegime', 'volume', 'btcCorrelation', 'funding',
  'mtf', 'stochasticHtf', 'stochasticRecoveryHtf', 'confluence',
]);

export const getFilterValidatorSyncFilters = (): FilterDef[] =>
  FILTER_REGISTRY.filter(f => f.run != null && !FILTER_VALIDATOR_EXCLUDED_IDS.has(f.id));

export const getSyncFilters = (): FilterDef[] =>
  FILTER_REGISTRY.filter(f => f.run != null);

export const createFilterStatsInit = (): Record<string, number> =>
  Object.fromEntries(FILTER_REGISTRY.map(f => [f.statsKey, 0]));

export const createDisabledFilterConfig = (): Record<string, unknown> => {
  const config: Record<string, unknown> = {};
  for (const f of FILTER_REGISTRY) {
    config[f.enableKey] = false;
    for (const p of f.params) config[p.key] = p.default;
  }
  return config;
};

export const buildFilterConfigFromDb = (
  dbConfig: Record<string, unknown>,
): Record<string, unknown> => {
  const config: Record<string, unknown> = {};
  for (const f of FILTER_REGISTRY) {
    config[f.enableKey] = dbConfig[f.enableKey];
    for (const p of f.params) {
      const raw = dbConfig[p.key];
      config[p.key] = p.parseFromDb && typeof raw === 'string'
        ? parseFloat(raw) : raw ?? p.default;
    }
  }
  return config;
};

export const applyFilterDefaults = (
  config: Record<string, unknown>,
  defaults: Record<string, unknown>,
): Record<string, unknown> => {
  const result = { ...config };
  for (const f of FILTER_REGISTRY) {
    if (result[f.enableKey] === undefined || result[f.enableKey] === null) {
      result[f.enableKey] = defaults[f.enableKey] ?? false;
    }
    for (const p of f.params) {
      if (result[p.key] === undefined || result[p.key] === null) {
        result[p.key] = defaults[p.key] ?? p.default;
      }
    }
  }
  return result;
};

export const applyFilterInputToUpdate = (
  input: Record<string, unknown>,
  updateData: Record<string, unknown>,
): void => {
  for (const f of FILTER_REGISTRY) {
    if (input[f.enableKey] !== undefined) updateData[f.enableKey] = input[f.enableKey];
    for (const p of f.params) {
      if (input[p.key] !== undefined) updateData[p.key] = input[p.key];
    }
  }
};
