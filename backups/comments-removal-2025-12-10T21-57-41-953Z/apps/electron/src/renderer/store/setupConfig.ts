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

export const SETUP_CONFIG_VERSION = 3;

export interface BaseSetupConfig {
  enabled: boolean;
}

type SetupConfigFactory<T extends BaseSetupConfig> = () => T;

interface SetupRegistryEntry<T extends BaseSetupConfig = BaseSetupConfig> {
  createDefault: SetupConfigFactory<T>;
}

const setupRegistry: Record<string, SetupRegistryEntry> = {
  setup91: { createDefault: createDefault91Config },
  setup92: { createDefault: createDefault92Config },
  setup93: { createDefault: createDefault93Config },
  setup94: { createDefault: createDefault94Config },
  pattern123: { createDefault: createDefault123Config },
  bullTrap: { createDefault: createDefaultBullTrapConfig },
  bearTrap: { createDefault: createDefaultBearTrapConfig },
  breakoutRetest: { createDefault: createDefaultBreakoutRetestConfig },
};

export const getRegisteredSetupKeys = (): string[] => Object.keys(setupRegistry);

export const getSetupDefaultConfig = (key: string): BaseSetupConfig | null => {
  const entry = setupRegistry[key];
  return entry ? entry.createDefault() : null;
};

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
    return {
      ...defaultConfig,
      enabled: persistedConfig.enabled ?? defaultConfig.enabled,
    };
  };

  const result: Record<string, unknown> = {
    enableTrendFilter: persisted.enableTrendFilter ?? defaults.enableTrendFilter,
    allowCounterTrend: persisted.allowCounterTrend ?? defaults.allowCounterTrend,
    trendEmaPeriod: persisted.trendEmaPeriod ?? defaults.trendEmaPeriod,
    setupCooldownPeriod: persisted.setupCooldownPeriod ?? defaults.setupCooldownPeriod,
  };

  for (const key of getRegisteredSetupKeys()) {
    const defaultConfig = defaults[key as keyof SetupDetectionConfig];
    const persistedConfig = persisted[key as keyof SetupDetectionConfig];
    if (typeof defaultConfig === 'object' && defaultConfig !== null && 'enabled' in defaultConfig) {
      result[key] = mergeStrategyConfig(
        defaultConfig as BaseSetupConfig,
        persistedConfig as Partial<BaseSetupConfig> | undefined
      );
    }
  }

  return result as unknown as SetupDetectionConfig;
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

export const createDefaultSetupDetectionConfig = (): SetupDetectionConfig => {
  const config: Record<string, unknown> = {
    enableTrendFilter: false,
    allowCounterTrend: true,
    trendEmaPeriod: DEFAULT_TREND_EMA_PERIOD,
    setupCooldownPeriod: DEFAULT_SETUP_COOLDOWN,
  };

  for (const [key, entry] of Object.entries(setupRegistry)) {
    config[key] = entry.createDefault();
  }

  return config as unknown as SetupDetectionConfig;
};
