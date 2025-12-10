/**
 * Centralized Setup Detection Configuration
 *
 * Single source of truth for all setup detector default parameters.
 * Used by both frontend (electron) and backend services.
 *
 * Only includes profitable strategies validated through backtesting:
 * - pattern123: +7.06% PnL
 * - bearTrap: +3.53% PnL
 * - meanReversion: +1.34% PnL
 *
 * @package @marketmind/types
 */


export interface BaseSetupConfig {
  enabled: boolean;
  minConfidence: number;
  minRiskReward: number;
}


export interface Pattern123Config extends BaseSetupConfig {
  pivotLookback: number;
  breakoutThreshold: number;
  targetMultiplier: number;
}

export const PATTERN_123_DEFAULTS = {
  PIVOT_LOOKBACK: 6,
  BREAKOUT_THRESHOLD: 0.001,
  TARGET_MULTIPLIER: 1.5,
  MIN_CONFIDENCE: 75,
  MIN_RISK_REWARD: 0,
} as const;

export const createDefault123Config = (): Pattern123Config => ({
  enabled: false,
  minConfidence: PATTERN_123_DEFAULTS.MIN_CONFIDENCE,
  minRiskReward: PATTERN_123_DEFAULTS.MIN_RISK_REWARD,
  pivotLookback: PATTERN_123_DEFAULTS.PIVOT_LOOKBACK,
  breakoutThreshold: PATTERN_123_DEFAULTS.BREAKOUT_THRESHOLD,
  targetMultiplier: PATTERN_123_DEFAULTS.TARGET_MULTIPLIER,
});


export interface BearTrapConfig extends BaseSetupConfig {
  volumeMultiplier: number;
  lookbackPeriod: number;
  emaPeriod: number;
}

export const BEAR_TRAP_DEFAULTS = {
  VOLUME_MULTIPLIER: 1.3,
  LOOKBACK_PERIOD: 20,
  EMA_PERIOD: 20,
  MIN_CONFIDENCE: 70,
  MIN_RISK_REWARD: 2.5,
  DEFAULT_RR_MULTIPLIER: 2.5,
  BASE_CONFIDENCE: 60,
  REVERSAL_CONFIDENCE_WEIGHT: 15,
} as const;

export const createDefaultBearTrapConfig = (): BearTrapConfig => ({
  enabled: false,
  minConfidence: BEAR_TRAP_DEFAULTS.MIN_CONFIDENCE,
  minRiskReward: BEAR_TRAP_DEFAULTS.MIN_RISK_REWARD,
  volumeMultiplier: BEAR_TRAP_DEFAULTS.VOLUME_MULTIPLIER,
  lookbackPeriod: BEAR_TRAP_DEFAULTS.LOOKBACK_PERIOD,
  emaPeriod: BEAR_TRAP_DEFAULTS.EMA_PERIOD,
});


export interface MeanReversionConfig extends BaseSetupConfig {
  bbPeriod: number;
  bbStdDev: number;
  rsiPeriod: number;
  rsiOversold: number;
  rsiOverbought: number;
  volumeMultiplier: number;
}

export const MEAN_REVERSION_DEFAULTS = {
  BB_PERIOD: 20,
  BB_STD_DEV: 2,
  RSI_PERIOD: 14,
  RSI_OVERSOLD: 30,
  RSI_OVERBOUGHT: 70,
  VOLUME_MULTIPLIER: 1.0,
  MIN_CONFIDENCE: 65,
  MIN_RISK_REWARD: 1.5,
} as const;

export const createDefaultMeanReversionConfig = (): MeanReversionConfig => ({
  enabled: false,
  minConfidence: MEAN_REVERSION_DEFAULTS.MIN_CONFIDENCE,
  minRiskReward: MEAN_REVERSION_DEFAULTS.MIN_RISK_REWARD,
  bbPeriod: MEAN_REVERSION_DEFAULTS.BB_PERIOD,
  bbStdDev: MEAN_REVERSION_DEFAULTS.BB_STD_DEV,
  rsiPeriod: MEAN_REVERSION_DEFAULTS.RSI_PERIOD,
  rsiOversold: MEAN_REVERSION_DEFAULTS.RSI_OVERSOLD,
  rsiOverbought: MEAN_REVERSION_DEFAULTS.RSI_OVERBOUGHT,
  volumeMultiplier: MEAN_REVERSION_DEFAULTS.VOLUME_MULTIPLIER,
});


export interface SetupDetectionConfig {
  pattern123: Pattern123Config;
  bearTrap: BearTrapConfig;
  meanReversion: MeanReversionConfig;
}

export const createDefaultSetupDetectionConfig = (): SetupDetectionConfig => ({
  pattern123: createDefault123Config(),
  bearTrap: createDefaultBearTrapConfig(),
  meanReversion: createDefaultMeanReversionConfig(),
});


export const SETUP_STRATEGY_KEYS = [
  'pattern123',
  'bearTrap',
  'meanReversion',
] as const;

export type SetupStrategyKey = (typeof SETUP_STRATEGY_KEYS)[number];

export const isValidStrategyKey = (key: string): key is SetupStrategyKey =>
  SETUP_STRATEGY_KEYS.includes(key as SetupStrategyKey);
