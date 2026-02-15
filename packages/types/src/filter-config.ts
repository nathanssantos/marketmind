export interface UnifiedFilterConfig {
  useTrendFilter?: boolean;
  trendFilterPeriod?: number;
  useStochasticFilter?: boolean;
  useStochasticRecoveryFilter?: boolean;
  useStochasticHtfFilter?: boolean;
  useStochasticRecoveryHtfFilter?: boolean;
  useMomentumTimingFilter?: boolean;
  useAdxFilter?: boolean;

  useMtfFilter?: boolean;
  useBtcCorrelationFilter?: boolean;
  useMarketRegimeFilter?: boolean;
  useVolumeFilter?: boolean;
  useFundingFilter?: boolean;

  useConfluenceScoring?: boolean;
  confluenceMinScore?: number;

  useCooldown?: boolean;
  cooldownMinutes?: number;

  useDirectionFilter?: boolean;
  enableLongInBearMarket?: boolean;
  enableShortInBullMarket?: boolean;
}
