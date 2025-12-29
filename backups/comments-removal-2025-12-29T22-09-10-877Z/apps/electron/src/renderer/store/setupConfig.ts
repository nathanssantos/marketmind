export const SETUP_CONFIG_VERSION = 4;

export interface BaseSetupConfig {
  enabled: boolean;
}

export interface SetupDetectionConfig {
  enabledStrategies: string[];
  minConfidence: number;
  minRiskReward: number;
}

export const createDefaultSetupDetectionConfig = (): SetupDetectionConfig => ({
  enabledStrategies: [],
  minConfidence: 50,
  minRiskReward: 1.0,
});

export const mergeSetupConfigs = (
  defaults: SetupDetectionConfig,
  persisted: Partial<SetupDetectionConfig> | undefined,
): SetupDetectionConfig => {
  if (!persisted) return defaults;

  return {
    enabledStrategies: persisted.enabledStrategies ?? defaults.enabledStrategies,
    minConfidence: persisted.minConfidence ?? defaults.minConfidence,
    minRiskReward: persisted.minRiskReward ?? defaults.minRiskReward,
  };
};

export const getRegisteredSetupKeys = (): string[] => [];

export const getSetupDefaultConfig = (_key: string): BaseSetupConfig | null => null;

