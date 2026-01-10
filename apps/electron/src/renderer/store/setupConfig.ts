import { TRADING_DEFAULTS } from '@marketmind/types';

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
  minRiskReward: TRADING_DEFAULTS.MIN_RISK_REWARD_RATIO,
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

