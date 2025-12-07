/**
 * Centralized Setup Detection Configuration
 *
 * Single source of truth for all setup detector default parameters.
 * Used by both frontend (electron) and backend services.
 *
 * @package @marketmind/types
 */

// =============================================================================
// Base Configuration Interface
// =============================================================================

export interface BaseSetupConfig {
  enabled: boolean;
  minConfidence: number;
  minRiskReward: number;
}

// =============================================================================
// Setup 9.1 - EMA9 Reversal
// =============================================================================

export interface Setup91Config extends BaseSetupConfig {
  emaPeriod: number;
  atrPeriod: number;
  atrStopMultiplier: number;
  atrTargetMultiplier: number;
  volumeMultiplier: number;
}

export const SETUP_91_DEFAULTS = {
  EMA_PERIOD: 9,
  ATR_PERIOD: 12,
  ATR_STOP_MULTIPLIER: 2,
  ATR_TARGET_MULTIPLIER: 4,
  VOLUME_MULTIPLIER: 1.0,
  MIN_CONFIDENCE: 70,
  MIN_RISK_REWARD: 2.5,
} as const;

export const createDefault91Config = (): Setup91Config => ({
  enabled: false,
  minConfidence: SETUP_91_DEFAULTS.MIN_CONFIDENCE,
  minRiskReward: SETUP_91_DEFAULTS.MIN_RISK_REWARD,
  emaPeriod: SETUP_91_DEFAULTS.EMA_PERIOD,
  atrPeriod: SETUP_91_DEFAULTS.ATR_PERIOD,
  atrStopMultiplier: SETUP_91_DEFAULTS.ATR_STOP_MULTIPLIER,
  atrTargetMultiplier: SETUP_91_DEFAULTS.ATR_TARGET_MULTIPLIER,
  volumeMultiplier: SETUP_91_DEFAULTS.VOLUME_MULTIPLIER,
});

// =============================================================================
// Setup 9.2 - EMA9 Pullback
// =============================================================================

export interface Setup92Config extends BaseSetupConfig {
  emaPeriod: number;
  atrPeriod: number;
  atrStopMultiplier: number;
  atrTargetMultiplier: number;
  volumeMultiplier: number;
}

export const SETUP_92_DEFAULTS = {
  EMA_PERIOD: 9,
  ATR_PERIOD: 12,
  ATR_STOP_MULTIPLIER: 2,
  ATR_TARGET_MULTIPLIER: 4,
  VOLUME_MULTIPLIER: 1.0,
  MIN_CONFIDENCE: 70,
  MIN_RISK_REWARD: 2.0,
} as const;

export const createDefault92Config = (): Setup92Config => ({
  enabled: false,
  minConfidence: SETUP_92_DEFAULTS.MIN_CONFIDENCE,
  minRiskReward: SETUP_92_DEFAULTS.MIN_RISK_REWARD,
  emaPeriod: SETUP_92_DEFAULTS.EMA_PERIOD,
  atrPeriod: SETUP_92_DEFAULTS.ATR_PERIOD,
  atrStopMultiplier: SETUP_92_DEFAULTS.ATR_STOP_MULTIPLIER,
  atrTargetMultiplier: SETUP_92_DEFAULTS.ATR_TARGET_MULTIPLIER,
  volumeMultiplier: SETUP_92_DEFAULTS.VOLUME_MULTIPLIER,
});

// =============================================================================
// Setup 9.3 - EMA9 Double Pullback (Optimized from backtesting)
// PnL: +4.45%, Profit Factor: 1.09, Sharpe: 0.49
// =============================================================================

export interface Setup93Config extends BaseSetupConfig {
  emaPeriod: number;
  atrPeriod: number;
  atrStopMultiplier: number;
  atrTargetMultiplier: number;
  volumeMultiplier: number;
}

export const SETUP_93_DEFAULTS = {
  EMA_PERIOD: 12, // Optimized (was 9)
  ATR_PERIOD: 16, // Optimized (was 12)
  ATR_STOP_MULTIPLIER: 2,
  ATR_TARGET_MULTIPLIER: 4,
  VOLUME_MULTIPLIER: 1.0,
  MIN_CONFIDENCE: 70,
  MIN_RISK_REWARD: 2.0,
} as const;

export const createDefault93Config = (): Setup93Config => ({
  enabled: false,
  minConfidence: SETUP_93_DEFAULTS.MIN_CONFIDENCE,
  minRiskReward: SETUP_93_DEFAULTS.MIN_RISK_REWARD,
  emaPeriod: SETUP_93_DEFAULTS.EMA_PERIOD,
  atrPeriod: SETUP_93_DEFAULTS.ATR_PERIOD,
  atrStopMultiplier: SETUP_93_DEFAULTS.ATR_STOP_MULTIPLIER,
  atrTargetMultiplier: SETUP_93_DEFAULTS.ATR_TARGET_MULTIPLIER,
  volumeMultiplier: SETUP_93_DEFAULTS.VOLUME_MULTIPLIER,
});

// =============================================================================
// Setup 9.4 - EMA9 Continuation
// =============================================================================

export interface Setup94Config extends BaseSetupConfig {
  emaPeriod: number;
  atrPeriod: number;
  atrStopMultiplier: number;
  atrTargetMultiplier: number;
  volumeMultiplier: number;
}

export const SETUP_94_DEFAULTS = {
  EMA_PERIOD: 9,
  ATR_PERIOD: 12,
  ATR_STOP_MULTIPLIER: 2,
  ATR_TARGET_MULTIPLIER: 4,
  VOLUME_MULTIPLIER: 1.0,
  MIN_CONFIDENCE: 70,
  MIN_RISK_REWARD: 2.0,
} as const;

export const createDefault94Config = (): Setup94Config => ({
  enabled: false,
  minConfidence: SETUP_94_DEFAULTS.MIN_CONFIDENCE,
  minRiskReward: SETUP_94_DEFAULTS.MIN_RISK_REWARD,
  emaPeriod: SETUP_94_DEFAULTS.EMA_PERIOD,
  atrPeriod: SETUP_94_DEFAULTS.ATR_PERIOD,
  atrStopMultiplier: SETUP_94_DEFAULTS.ATR_STOP_MULTIPLIER,
  atrTargetMultiplier: SETUP_94_DEFAULTS.ATR_TARGET_MULTIPLIER,
  volumeMultiplier: SETUP_94_DEFAULTS.VOLUME_MULTIPLIER,
});

// =============================================================================
// Pattern 123 - Reversal Pattern (Best performer from backtesting)
// PnL: +642.91%, Profit Factor: 5.91, Sharpe: 2.84, Max DD: 5.50%
// =============================================================================

export interface Pattern123Config extends BaseSetupConfig {
  pivotLookback: number;
  breakoutThreshold: number;
  targetMultiplier: number;
}

export const PATTERN_123_DEFAULTS = {
  // Optimized values from backtesting (PnL +642.91%, Sharpe 2.84, PF 5.91)
  PIVOT_LOOKBACK: 6,
  BREAKOUT_THRESHOLD: 0.001,
  TARGET_MULTIPLIER: 1.5,
  MIN_CONFIDENCE: 75,
  MIN_RISK_REWARD: 0, // Set to 0 for backtesting - RR filtering done at trade level
} as const;

export const createDefault123Config = (): Pattern123Config => ({
  enabled: false,
  minConfidence: PATTERN_123_DEFAULTS.MIN_CONFIDENCE,
  minRiskReward: PATTERN_123_DEFAULTS.MIN_RISK_REWARD,
  pivotLookback: PATTERN_123_DEFAULTS.PIVOT_LOOKBACK,
  breakoutThreshold: PATTERN_123_DEFAULTS.BREAKOUT_THRESHOLD,
  targetMultiplier: PATTERN_123_DEFAULTS.TARGET_MULTIPLIER,
});

// =============================================================================
// Bull Trap - Counter-trend reversal (SHORT)
// =============================================================================

export interface BullTrapConfig extends BaseSetupConfig {
  volumeMultiplier: number;
  lookbackPeriod: number;
  emaPeriod: number;
}

export const BULL_TRAP_DEFAULTS = {
  VOLUME_MULTIPLIER: 1.3,
  LOOKBACK_PERIOD: 20,
  EMA_PERIOD: 20,
  MIN_CONFIDENCE: 70,
  MIN_RISK_REWARD: 2.5,
  // Internal calculation constants
  DEFAULT_RR_MULTIPLIER: 2.5,
  BASE_CONFIDENCE: 60,
  REVERSAL_CONFIDENCE_WEIGHT: 15,
} as const;

export const createDefaultBullTrapConfig = (): BullTrapConfig => ({
  enabled: false,
  minConfidence: BULL_TRAP_DEFAULTS.MIN_CONFIDENCE,
  minRiskReward: BULL_TRAP_DEFAULTS.MIN_RISK_REWARD,
  volumeMultiplier: BULL_TRAP_DEFAULTS.VOLUME_MULTIPLIER,
  lookbackPeriod: BULL_TRAP_DEFAULTS.LOOKBACK_PERIOD,
  emaPeriod: BULL_TRAP_DEFAULTS.EMA_PERIOD,
});

// =============================================================================
// Bear Trap - Counter-trend reversal (LONG)
// =============================================================================

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
  // Internal calculation constants
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

// =============================================================================
// Breakout Retest - Momentum + Retest
// =============================================================================

export interface BreakoutRetestConfig extends BaseSetupConfig {
  volumeMultiplier: number;
  lookbackPeriod: number;
  emaPeriod: number;
  retestTolerance: number;
}

export const BREAKOUT_RETEST_DEFAULTS = {
  VOLUME_MULTIPLIER: 1.4,
  LOOKBACK_PERIOD: 30,
  EMA_PERIOD: 20,
  RETEST_TOLERANCE: 0.005,
  MIN_CONFIDENCE: 70,
  MIN_RISK_REWARD: 2.5,
} as const;

export const createDefaultBreakoutRetestConfig = (): BreakoutRetestConfig => ({
  enabled: false,
  minConfidence: BREAKOUT_RETEST_DEFAULTS.MIN_CONFIDENCE,
  minRiskReward: BREAKOUT_RETEST_DEFAULTS.MIN_RISK_REWARD,
  volumeMultiplier: BREAKOUT_RETEST_DEFAULTS.VOLUME_MULTIPLIER,
  lookbackPeriod: BREAKOUT_RETEST_DEFAULTS.LOOKBACK_PERIOD,
  emaPeriod: BREAKOUT_RETEST_DEFAULTS.EMA_PERIOD,
  retestTolerance: BREAKOUT_RETEST_DEFAULTS.RETEST_TOLERANCE,
});

// =============================================================================
// Aggregated Setup Detection Configuration
// =============================================================================

export interface SetupDetectionConfig {
  setup91: Setup91Config;
  setup92: Setup92Config;
  setup93: Setup93Config;
  setup94: Setup94Config;
  pattern123: Pattern123Config;
  bullTrap: BullTrapConfig;
  bearTrap: BearTrapConfig;
  breakoutRetest: BreakoutRetestConfig;
}

export const createDefaultSetupDetectionConfig = (): SetupDetectionConfig => ({
  setup91: createDefault91Config(),
  setup92: createDefault92Config(),
  setup93: createDefault93Config(),
  setup94: createDefault94Config(),
  pattern123: createDefault123Config(),
  bullTrap: createDefaultBullTrapConfig(),
  bearTrap: createDefaultBearTrapConfig(),
  breakoutRetest: createDefaultBreakoutRetestConfig(),
});

// =============================================================================
// Strategy Keys (for iteration and validation)
// =============================================================================

export const SETUP_STRATEGY_KEYS = [
  'setup91',
  'setup92',
  'setup93',
  'setup94',
  'pattern123',
  'bullTrap',
  'bearTrap',
  'breakoutRetest',
] as const;

export type SetupStrategyKey = (typeof SETUP_STRATEGY_KEYS)[number];

export const isValidStrategyKey = (key: string): key is SetupStrategyKey =>
  SETUP_STRATEGY_KEYS.includes(key as SetupStrategyKey);
