import type { TradingProfileRow, AutoTradingConfig } from '../db/schema';

const PROFILE_OVERRIDE_KEYS = [
  'directionMode',
  'positionSizePercent',
  'tradingMode',
  'useTrendFilter',
  'useAdxFilter',
  'useChoppinessFilter',
  'useVwapFilter',
  'useStochasticFilter',
  'useStochasticRecoveryFilter',
  'useMomentumTimingFilter',
  'useBtcCorrelationFilter',
  'useVolumeFilter',
  'useDirectionFilter',
  'useSuperTrendFilter',
  'useMarketRegimeFilter',
  'useBollingerSqueezeFilter',
  'useMtfFilter',
  'useStochasticHtfFilter',
  'useStochasticRecoveryHtfFilter',
  'useFundingFilter',
  'useConfluenceScoring',
  'confluenceMinScore',
  'fibonacciTargetLevelLong',
  'fibonacciTargetLevelShort',
  'fibonacciSwingRange',
  'maxFibonacciEntryProgressPercentLong',
  'maxFibonacciEntryProgressPercentShort',
  'initialStopMode',
  'tpCalculationMode',
  'minRiskRewardRatioLong',
  'minRiskRewardRatioShort',
  'trailingStopEnabled',
  'trailingStopMode',
  'trailingActivationPercentLong',
  'trailingActivationPercentShort',
  'trailingDistancePercentLong',
  'trailingDistancePercentShort',
  'trailingDistanceMode',
  'trailingStopOffsetPercent',
  'trailingActivationModeLong',
  'trailingActivationModeShort',
  'useAdaptiveTrailing',
  'maxDrawdownEnabled',
  'maxDrawdownPercent',
  'dailyLossLimit',
  'maxRiskPerStopEnabled',
  'maxRiskPerStopPercent',
  'choppinessThresholdHigh',
  'choppinessThresholdLow',
  'volumeFilterObvLookbackLong',
  'volumeFilterObvLookbackShort',
  'useObvCheckLong',
  'useObvCheckShort',
  'maxPositionSize',
  'maxConcurrentPositions',
] as const;

export const applyProfileOverrides = (
  baseConfig: AutoTradingConfig,
  profile: TradingProfileRow | null | undefined
): AutoTradingConfig => {
  if (!profile) return baseConfig;

  const merged = { ...baseConfig } as Record<string, unknown>;
  const profileRecord = profile as Record<string, unknown>;

  for (const key of PROFILE_OVERRIDE_KEYS) {
    const profileValue = profileRecord[key];
    if (profileValue != null) {
      merged[key] = profileValue;
    }
  }

  return merged as AutoTradingConfig;
};
