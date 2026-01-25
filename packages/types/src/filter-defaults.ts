export const FILTER_DEFAULTS = {
  useTrendFilter: true,
  trendFilterPeriod: 21,
  useStochasticFilter: false,
  useMomentumTimingFilter: false,
  useAdxFilter: false,

  useMtfFilter: false,
  useBtcCorrelationFilter: true,
  useMarketRegimeFilter: false,
  useVolumeFilter: false,
  volumeFilterObvLookbackLong: 7,
  volumeFilterObvLookbackShort: 5,
  useObvCheckLong: false,
  useObvCheckShort: true,
  useFundingFilter: false,

  useConfluenceScoring: false,
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

  useChoppinessFilter: false,
  choppinessThresholdHigh: 61.8,
  choppinessThresholdLow: 38.2,
  choppinessPeriod: 14,

  useSessionFilter: false,
  sessionStartUtc: 13,
  sessionEndUtc: 16,

  useBollingerSqueezeFilter: false,
  bollingerSqueezeThreshold: 0.1,
  bollingerSqueezePeriod: 20,
  bollingerSqueezeStdDev: 2.0,

  useVwapFilter: false,

  useSuperTrendFilter: false,
  superTrendPeriod: 10,
  superTrendMultiplier: 3.0,
} as const;

export type FilterDefaults = typeof FILTER_DEFAULTS;
