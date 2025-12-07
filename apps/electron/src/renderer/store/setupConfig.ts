import type {
    BearTrapConfig,
    BreakoutRetestConfig,
    BullTrapConfig,
    Pattern123Config,
    Setup91Config,
    Setup92Config,
    Setup93Config,
    Setup94Config,
} from '@renderer/services/setupDetection';
import {
    createDefault123Config,
    createDefault91Config,
    createDefault92Config,
    createDefault93Config,
    createDefault94Config,
    createDefaultBearTrapConfig,
    createDefaultBreakoutRetestConfig,
    createDefaultBullTrapConfig,
} from '@renderer/services/setupDetection';

const DEFAULT_TREND_EMA_PERIOD = 200;
const DEFAULT_SETUP_COOLDOWN = 5;

// Version for config migration - increment when defaults change
export const SETUP_CONFIG_VERSION = 3; // Updated: removed unprofitable setups

/**
 * Deep merges setup configs, preserving user's enabled state but using new defaults
 * for numeric parameters. This ensures optimized values are applied on update.
 */
export const mergeSetupConfigs = (
  defaults: SetupDetectionConfig,
  persisted: Partial<SetupDetectionConfig> | undefined,
): SetupDetectionConfig => {
  if (!persisted) return defaults;

  const mergeStrategyConfig = <T extends { enabled: boolean }>(
    defaultConfig: T,
    persistedConfig: Partial<T> | undefined,
  ): T => {
    if (!persistedConfig) return defaultConfig;
    // Only preserve user's enabled preference, use new defaults for everything else
    return {
      ...defaultConfig,
      enabled: persistedConfig.enabled ?? defaultConfig.enabled,
    };
  };

  return {
    ...defaults,
    setup91: mergeStrategyConfig(defaults.setup91, persisted.setup91),
    setup92: mergeStrategyConfig(defaults.setup92, persisted.setup92),
    setup93: mergeStrategyConfig(defaults.setup93, persisted.setup93),
    setup94: mergeStrategyConfig(defaults.setup94, persisted.setup94),
    pattern123: mergeStrategyConfig(defaults.pattern123, persisted.pattern123),
    bullTrap: mergeStrategyConfig(defaults.bullTrap, persisted.bullTrap),
    bearTrap: mergeStrategyConfig(defaults.bearTrap, persisted.bearTrap),
    breakoutRetest: mergeStrategyConfig(defaults.breakoutRetest, persisted.breakoutRetest),
    // Preserve user's global preferences
    enableTrendFilter: persisted.enableTrendFilter ?? defaults.enableTrendFilter,
    allowCounterTrend: persisted.allowCounterTrend ?? defaults.allowCounterTrend,
    trendEmaPeriod: persisted.trendEmaPeriod ?? defaults.trendEmaPeriod,
    setupCooldownPeriod: persisted.setupCooldownPeriod ?? defaults.setupCooldownPeriod,
  };
};

export interface SetupDetectionConfig {
  setup91: Setup91Config;
  setup92: Setup92Config;
  setup93: Setup93Config;
  setup94: Setup94Config;
  pattern123: Pattern123Config;
  bullTrap: BullTrapConfig;
  bearTrap: BearTrapConfig;
  breakoutRetest: BreakoutRetestConfig;
  enableTrendFilter: boolean;
  allowCounterTrend: boolean;
  trendEmaPeriod: number;
  setupCooldownPeriod: number;
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
  enableTrendFilter: false,
  allowCounterTrend: true,
  trendEmaPeriod: DEFAULT_TREND_EMA_PERIOD,
  setupCooldownPeriod: DEFAULT_SETUP_COOLDOWN,
});
