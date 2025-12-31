import type { tradingProfiles, autoTradingConfig } from '../db/schema';

type TradingProfileRow = typeof tradingProfiles.$inferSelect;
type AutoTradingConfigRow = typeof autoTradingConfig.$inferSelect;

export interface TransformedTradingProfile extends Omit<TradingProfileRow, 'enabledSetupTypes' | 'maxPositionSize'> {
  enabledSetupTypes: string[];
  maxPositionSize: number | null;
}

export interface TransformedAutoTradingConfig extends Omit<AutoTradingConfigRow, 'enabledSetupTypes'> {
  enabledSetupTypes: string[];
}

export const parseEnabledSetupTypes = (json: string): string[] => {
  return JSON.parse(json) as string[];
};

export const stringifyEnabledSetupTypes = (types: string[]): string => {
  return JSON.stringify(types);
};

export const transformTradingProfile = (profile: TradingProfileRow): TransformedTradingProfile => ({
  ...profile,
  enabledSetupTypes: parseEnabledSetupTypes(profile.enabledSetupTypes),
  maxPositionSize: profile.maxPositionSize ? parseFloat(profile.maxPositionSize) : null,
});

export const transformAutoTradingConfig = (config: AutoTradingConfigRow): TransformedAutoTradingConfig => ({
  ...config,
  enabledSetupTypes: parseEnabledSetupTypes(config.enabledSetupTypes),
});
