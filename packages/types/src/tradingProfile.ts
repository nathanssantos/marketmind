export const FIB_LEVELS = ['auto', '1', '1.272', '1.382', '1.618', '2', '2.618', '3', '3.618', '4.236'] as const;
export type FibLevel = (typeof FIB_LEVELS)[number];

export interface ProfileConfigOverrides {
  tradingMode?: 'auto' | 'semi_assisted' | null;
  directionMode?: 'auto' | 'long_only' | 'short_only' | null;
  positionSizePercent?: number | null;
  useTrendFilter?: boolean | null;
  useAdxFilter?: boolean | null;
  useChoppinessFilter?: boolean | null;
  useVwapFilter?: boolean | null;
  useStochasticFilter?: boolean | null;
  useStochasticRecoveryFilter?: boolean | null;
  useMomentumTimingFilter?: boolean | null;
  useBtcCorrelationFilter?: boolean | null;
  useVolumeFilter?: boolean | null;
  useDirectionFilter?: boolean | null;
  useSuperTrendFilter?: boolean | null;
  useMarketRegimeFilter?: boolean | null;
  useBollingerSqueezeFilter?: boolean | null;
  useMtfFilter?: boolean | null;
  useStochasticHtfFilter?: boolean | null;
  useStochasticRecoveryHtfFilter?: boolean | null;
  useFundingFilter?: boolean | null;
  useFvgFilter?: boolean | null;
  useConfluenceScoring?: boolean | null;
  confluenceMinScore?: number | null;
  useCooldown?: boolean | null;
  cooldownMinutes?: number | null;
  fibonacciTargetLevelLong?: FibLevel | null;
  fibonacciTargetLevelShort?: FibLevel | null;
  fibonacciSwingRange?: 'nearest' | 'extended' | null;
  maxFibonacciEntryProgressPercentLong?: number | null;
  maxFibonacciEntryProgressPercentShort?: number | null;
  initialStopMode?: 'fibo_target' | 'nearest_swing' | null;
  tpCalculationMode?: 'default' | 'fibonacci' | null;
  minRiskRewardRatioLong?: number | null;
  minRiskRewardRatioShort?: number | null;
  trailingStopEnabled?: boolean | null;
  trailingStopMode?: 'local' | 'binance' | null;
  trailingActivationPercentLong?: number | null;
  trailingActivationPercentShort?: number | null;
  trailingDistancePercentLong?: number | null;
  trailingDistancePercentShort?: number | null;
  trailingDistanceMode?: 'auto' | 'fixed' | null;
  trailingStopOffsetPercent?: number | null;
  trailingActivationModeLong?: 'auto' | 'manual' | null;
  trailingActivationModeShort?: 'auto' | 'manual' | null;
  useAdaptiveTrailing?: boolean | null;
  maxDrawdownEnabled?: boolean | null;
  maxDrawdownPercent?: number | null;
  dailyLossLimit?: number | null;
  maxRiskPerStopEnabled?: boolean | null;
  maxRiskPerStopPercent?: number | null;
  choppinessThresholdHigh?: number | null;
  choppinessThresholdLow?: number | null;
  volumeFilterObvLookbackLong?: number | null;
  volumeFilterObvLookbackShort?: number | null;
  useObvCheckLong?: boolean | null;
  useObvCheckShort?: boolean | null;
}

export type ChecklistConditionOp =
  | 'gt'
  | 'lt'
  | 'between'
  | 'outside'
  | 'crossAbove'
  | 'crossBelow'
  | 'oversold'
  | 'overbought'
  | 'rising'
  | 'falling'
  | 'priceAbove'
  | 'priceBelow';

export interface ChecklistConditionDto {
  id: string;
  userIndicatorId: string;
  timeframe: string;
  op: ChecklistConditionOp;
  threshold?: number | [number, number];
  tier: 'required' | 'preferred';
  side: 'LONG' | 'SHORT' | 'BOTH';
  weight: number;
  enabled: boolean;
  order: number;
}

export const CHECKLIST_TIMEFRAME_WEIGHTS: Record<string, number> = {
  current: 1,
  '1m': 0.5,
  '5m': 0.75,
  '15m': 1,
  '30m': 1.25,
  '1h': 1.5,
  '2h': 1.75,
  '4h': 2,
  '6h': 2.25,
  '8h': 2.5,
  '12h': 2.75,
  '1d': 3,
  '3d': 3.5,
  '1w': 4,
};

export const CHECKLIST_WEIGHT_MIN = 0.1;
export const CHECKLIST_WEIGHT_MAX = 5;
export const CHECKLIST_WEIGHT_STEP = 0.25;

export const getDefaultChecklistWeight = (timeframe: string): number =>
  CHECKLIST_TIMEFRAME_WEIGHTS[timeframe] ?? 1;

export interface TradingProfile extends ProfileConfigOverrides {
  id: string;
  userId: string;
  name: string;
  description?: string | null;
  enabledSetupTypes: string[];
  checklistConditions: ChecklistConditionDto[];
  maxPositionSize?: number | null;
  maxConcurrentPositions?: number | null;
  isDefault: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CreateTradingProfileInput extends ProfileConfigOverrides {
  name?: string;
  description?: string;
  enabledSetupTypes?: string[];
  maxPositionSize?: number;
  maxConcurrentPositions?: number;
  isDefault?: boolean;
}

export interface UpdateTradingProfileInput extends Partial<ProfileConfigOverrides> {
  name?: string;
  description?: string | null;
  enabledSetupTypes?: string[];
  maxPositionSize?: number | null;
  maxConcurrentPositions?: number | null;
  isDefault?: boolean;
}

export interface WatcherWithProfile {
  id: string;
  symbol: string;
  interval: string;
  walletId: string;
  profileId?: string | null;
  profileName?: string | null;
  enabledSetupTypes: string[];
  startedAt: Date;
  createdAt: Date;
}

export const PROFILE_CONFIG_KEYS: (keyof ProfileConfigOverrides)[] = [
  'tradingMode', 'directionMode', 'positionSizePercent',
  'useTrendFilter', 'useAdxFilter', 'useChoppinessFilter', 'useVwapFilter',
  'useStochasticFilter', 'useStochasticRecoveryFilter', 'useMomentumTimingFilter',
  'useBtcCorrelationFilter', 'useVolumeFilter', 'useDirectionFilter',
  'useSuperTrendFilter', 'useMarketRegimeFilter', 'useBollingerSqueezeFilter',
  'useMtfFilter', 'useStochasticHtfFilter', 'useStochasticRecoveryHtfFilter',
  'useFundingFilter', 'useFvgFilter',
  'useConfluenceScoring', 'confluenceMinScore', 'useCooldown', 'cooldownMinutes',
  'fibonacciTargetLevelLong', 'fibonacciTargetLevelShort', 'fibonacciSwingRange',
  'maxFibonacciEntryProgressPercentLong', 'maxFibonacciEntryProgressPercentShort',
  'initialStopMode', 'tpCalculationMode',
  'minRiskRewardRatioLong', 'minRiskRewardRatioShort',
  'trailingStopEnabled', 'trailingStopMode',
  'trailingActivationPercentLong', 'trailingActivationPercentShort',
  'trailingDistancePercentLong', 'trailingDistancePercentShort',
  'trailingDistanceMode', 'trailingStopOffsetPercent',
  'trailingActivationModeLong', 'trailingActivationModeShort',
  'useAdaptiveTrailing',
  'maxDrawdownEnabled', 'maxDrawdownPercent', 'dailyLossLimit',
  'maxRiskPerStopEnabled', 'maxRiskPerStopPercent',
  'choppinessThresholdHigh', 'choppinessThresholdLow',
  'volumeFilterObvLookbackLong', 'volumeFilterObvLookbackShort',
  'useObvCheckLong', 'useObvCheckShort',
];
