export const FILTER_DEFAULTS = {
  useTrendFilter: true,
  trendFilterPeriod: 21,
  useStochasticFilter: false,
  useStochasticRecoveryFilter: false,
  useStochasticHtfFilter: false,
  useStochasticRecoveryHtfFilter: false,
  useMomentumTimingFilter: false,
  useAdxFilter: true,

  useMtfFilter: false,
  useBtcCorrelationFilter: false,
  useMarketRegimeFilter: false,
  useVolumeFilter: false,
  volumeFilterObvLookbackLong: 7,
  volumeFilterObvLookbackShort: 5,
  useObvCheckLong: false,
  useObvCheckShort: true,
  useFundingFilter: false,

  useConfluenceScoring: false,
  confluenceMinScore: 60,

  positionSizePercent: 10,
  minRiskRewardRatioLong: 1,
  minRiskRewardRatioShort: 1,

  fibonacciTargetLevelLong: '1.272' as const,
  fibonacciTargetLevelShort: '1.272' as const,
  maxFibonacciEntryProgressPercent: 127.2,

  useCooldown: true,
  cooldownMinutes: 15,

  useDirectionFilter: false,
  enableLongInBearMarket: false,
  enableShortInBullMarket: false,

  useChoppinessFilter: true,
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

  useVwapFilter: true,

  useSuperTrendFilter: false,
  superTrendPeriod: 10,
  superTrendMultiplier: 3.0,
} as const;

export type FilterDefaults = typeof FILTER_DEFAULTS;
