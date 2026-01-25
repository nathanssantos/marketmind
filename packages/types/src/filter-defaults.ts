export const FILTER_DEFAULTS = {
  useTrendFilter: false,
  trendFilterPeriod: 21,
  useStochasticFilter: false,
  useMomentumTimingFilter: true,
  useAdxFilter: false,

  useMtfFilter: true,
  useBtcCorrelationFilter: true,
  useMarketRegimeFilter: true,
  useVolumeFilter: true,
  volumeFilterObvLookbackLong: 7,
  volumeFilterObvLookbackShort: 5,
  useFundingFilter: true,

  useConfluenceScoring: true,
  confluenceMinScore: 60,

  exposureMultiplier: 1.5,
  minRiskRewardRatioLong: 1.0,
  minRiskRewardRatioShort: 1.0,

  fibonacciTargetLevelLong: '1' as const,
  fibonacciTargetLevelShort: '1.272' as const,
  maxFibonacciEntryProgressPercent: 61.8,

  useCooldown: true,
  cooldownMinutes: 15,

  useDirectionFilter: false,
  enableLongInBearMarket: false,
  enableShortInBullMarket: false,
} as const;

export type FilterDefaults = typeof FILTER_DEFAULTS;
