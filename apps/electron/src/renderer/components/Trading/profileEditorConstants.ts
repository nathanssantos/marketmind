export const FIB_LEVEL_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: '1', label: '100% (1.0)' },
  { value: '1.272', label: '127.2% (1.272)' },
  { value: '1.382', label: '138.2% (1.382)' },
  { value: '1.618', label: '161.8% (1.618)' },
  { value: '2', label: '200% (2.0)' },
  { value: '2.618', label: '261.8% (2.618)' },
  { value: '3', label: '300% (3.0)' },
  { value: '3.618', label: '361.8% (3.618)' },
  { value: '4.236', label: '423.6% (4.236)' },
];

export const TRADING_MODE_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 'semi_assisted', label: 'Semi-Assisted' },
];

export const DIRECTION_MODE_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 'long_only', label: 'Long Only' },
  { value: 'short_only', label: 'Short Only' },
];

export const SWING_RANGE_OPTIONS = [
  { value: 'nearest', label: 'Nearest' },
  { value: 'extended', label: 'Extended' },
];

export const STOP_MODE_OPTIONS = [
  { value: 'fibo_target', label: 'Fibonacci Target' },
  { value: 'nearest_swing', label: 'Nearest Swing' },
];

export const TP_MODE_OPTIONS = [
  { value: 'default', label: 'Default (ATR)' },
  { value: 'fibonacci', label: 'Fibonacci' },
];

export const TRAILING_MODE_OPTIONS = [
  { value: 'local', label: 'Local' },
  { value: 'binance', label: 'Binance' },
];

export const TRAILING_DISTANCE_MODE_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 'fixed', label: 'Fixed' },
];

export const ACTIVATION_MODE_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 'manual', label: 'Manual' },
];

export const ALL_FILTER_KEYS = [
  'useTrendFilter', 'useAdxFilter', 'useDirectionFilter', 'useSuperTrendFilter',
  'useStochasticFilter', 'useStochasticRecoveryFilter', 'useMomentumTimingFilter', 'useStochasticHtfFilter', 'useStochasticRecoveryHtfFilter',
  'useChoppinessFilter', 'choppinessThresholdHigh', 'choppinessThresholdLow', 'useVwapFilter', 'useMarketRegimeFilter', 'useBollingerSqueezeFilter', 'useFvgFilter',
  'useVolumeFilter', 'useObvCheckLong', 'useObvCheckShort', 'volumeFilterObvLookbackLong', 'volumeFilterObvLookbackShort',
  'useBtcCorrelationFilter', 'useFundingFilter', 'useMtfFilter',
  'useConfluenceScoring', 'confluenceMinScore', 'useCooldown', 'cooldownMinutes',
];

export const FIB_ENTRY_KEYS = ['fibonacciTargetLevelLong', 'fibonacciTargetLevelShort', 'fibonacciSwingRange', 'maxFibonacciEntryProgressPercentLong', 'maxFibonacciEntryProgressPercentShort', 'initialStopMode', 'tpCalculationMode'];
export const RR_KEYS = ['minRiskRewardRatioLong', 'minRiskRewardRatioShort'];
export const TRAILING_KEYS = ['trailingStopEnabled', 'trailingStopMode', 'trailingActivationPercentLong', 'trailingActivationPercentShort', 'trailingDistancePercentLong', 'trailingDistancePercentShort', 'trailingDistanceMode', 'trailingStopOffsetPercent', 'trailingActivationModeLong', 'trailingActivationModeShort', 'useAdaptiveTrailing'];
export const RISK_KEYS = ['positionSizePercent', 'maxDrawdownEnabled', 'maxDrawdownPercent', 'dailyLossLimit', 'maxRiskPerStopEnabled', 'maxRiskPerStopPercent'];
export const MODE_KEYS = ['tradingMode', 'directionMode'];
