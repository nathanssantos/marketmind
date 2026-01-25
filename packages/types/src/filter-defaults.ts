export const FILTER_DEFAULTS = {
  useTrendFilter: false,
  trendFilterPeriod: 21,
  useStochasticFilter: false,
  useMomentumTimingFilter: true,
  useAdxFilter: false,

  useMtfFilter: true,
  useBtcCorrelationFilter: true,
  useMarketRegimeFilter: true,
  useVolumeFilter: false,
  useFundingFilter: true,

  useConfluenceScoring: true,
  confluenceMinScore: 60,

  exposureMultiplier: 1.5,
  minRiskRewardRatioLong: 1.0,
  minRiskRewardRatioShort: 0.8,

  fibonacciTargetLevelLong: '2' as const,
  fibonacciTargetLevelShort: '1.272' as const,
  maxFibonacciEntryProgressPercent: 61.8,

  useCooldown: true,
  cooldownMinutes: 15,
} as const;

export type FilterDefaults = typeof FILTER_DEFAULTS;
