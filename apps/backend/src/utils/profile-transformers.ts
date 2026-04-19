import type { FibLevel } from '@marketmind/types';
import { getDefaultChecklistWeight } from '@marketmind/types';
import type { ChecklistCondition, IndicatorParamValue } from '@marketmind/trading-core';
import type { tradingProfiles, autoTradingConfig } from '../db/schema';

type TradingProfileRow = typeof tradingProfiles.$inferSelect;
type AutoTradingConfigRow = typeof autoTradingConfig.$inferSelect;

export interface TransformedTradingProfile extends Omit<TradingProfileRow,
  | 'enabledSetupTypes' | 'maxPositionSize' | 'positionSizePercent'
  | 'maxFibonacciEntryProgressPercentLong' | 'maxFibonacciEntryProgressPercentShort'
  | 'minRiskRewardRatioLong' | 'minRiskRewardRatioShort'
  | 'trailingActivationPercentLong' | 'trailingActivationPercentShort'
  | 'trailingDistancePercentLong' | 'trailingDistancePercentShort'
  | 'trailingStopOffsetPercent'
  | 'maxDrawdownPercent' | 'dailyLossLimit' | 'maxRiskPerStopPercent'
  | 'choppinessThresholdHigh' | 'choppinessThresholdLow'
  | 'fibonacciTargetLevelLong' | 'fibonacciTargetLevelShort'
  | 'fibonacciSwingRange' | 'initialStopMode' | 'tpCalculationMode'
  | 'trailingStopMode' | 'trailingDistanceMode'
  | 'trailingActivationModeLong' | 'trailingActivationModeShort'
  | 'tradingMode' | 'directionMode'
  | 'checklistConditions'
> {
  enabledSetupTypes: string[];
  checklistConditions: ChecklistCondition[];
  maxPositionSize: number | null;
  positionSizePercent: number | null;
  maxFibonacciEntryProgressPercentLong: number | null;
  maxFibonacciEntryProgressPercentShort: number | null;
  minRiskRewardRatioLong: number | null;
  minRiskRewardRatioShort: number | null;
  trailingActivationPercentLong: number | null;
  trailingActivationPercentShort: number | null;
  trailingDistancePercentLong: number | null;
  trailingDistancePercentShort: number | null;
  trailingStopOffsetPercent: number | null;
  maxDrawdownPercent: number | null;
  dailyLossLimit: number | null;
  maxRiskPerStopPercent: number | null;
  choppinessThresholdHigh: number | null;
  choppinessThresholdLow: number | null;
  fibonacciTargetLevelLong: FibLevel | null;
  fibonacciTargetLevelShort: FibLevel | null;
  fibonacciSwingRange: 'nearest' | 'extended' | null;
  initialStopMode: 'fibo_target' | 'nearest_swing' | null;
  tpCalculationMode: 'default' | 'fibonacci' | null;
  trailingStopMode: 'local' | 'binance' | null;
  trailingDistanceMode: 'auto' | 'fixed' | null;
  trailingActivationModeLong: 'auto' | 'manual' | null;
  trailingActivationModeShort: 'auto' | 'manual' | null;
  tradingMode: 'auto' | 'semi_assisted' | null;
  directionMode: 'auto' | 'long_only' | 'short_only' | null;
}

export interface TransformedAutoTradingConfig extends Omit<AutoTradingConfigRow, 'enabledSetupTypes' | 'dynamicSymbolExcluded'> {
  enabledSetupTypes: string[];
  dynamicSymbolExcluded: string[];
}

export const parseEnabledSetupTypes = (json: string): string[] => {
  return JSON.parse(json) as string[];
};

export const stringifyEnabledSetupTypes = (types: string[]): string => {
  return JSON.stringify(types);
};

export const parseChecklistConditions = (json: string | null | undefined): ChecklistCondition[] => {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return [];
    return (parsed as ChecklistCondition[]).map((c) => ({
      ...c,
      weight:
        typeof c.weight === 'number' && Number.isFinite(c.weight) && c.weight > 0
          ? c.weight
          : getDefaultChecklistWeight(c.timeframe),
    }));
  } catch {
    return [];
  }
};

export const stringifyChecklistConditions = (conditions: ChecklistCondition[]): string => {
  return JSON.stringify(conditions);
};

export const parseIndicatorParams = (
  raw: string | null | undefined,
): Record<string, IndicatorParamValue> => {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, IndicatorParamValue>;
    }
    return {};
  } catch {
    return {};
  }
};

export const stringifyIndicatorParams = (
  params: Record<string, IndicatorParamValue>,
): string => JSON.stringify(params);

const parseNumericField = (value: string | null | undefined): number | null => {
  if (value == null || value === '') return null;
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? null : parsed;
};

export const transformTradingProfile = (profile: TradingProfileRow): TransformedTradingProfile => ({
  ...profile,
  enabledSetupTypes: parseEnabledSetupTypes(profile.enabledSetupTypes),
  checklistConditions: parseChecklistConditions(profile.checklistConditions),
  maxPositionSize: parseNumericField(profile.maxPositionSize),
  positionSizePercent: parseNumericField(profile.positionSizePercent),
  maxFibonacciEntryProgressPercentLong: parseNumericField(profile.maxFibonacciEntryProgressPercentLong),
  maxFibonacciEntryProgressPercentShort: parseNumericField(profile.maxFibonacciEntryProgressPercentShort),
  minRiskRewardRatioLong: parseNumericField(profile.minRiskRewardRatioLong),
  minRiskRewardRatioShort: parseNumericField(profile.minRiskRewardRatioShort),
  trailingActivationPercentLong: parseNumericField(profile.trailingActivationPercentLong),
  trailingActivationPercentShort: parseNumericField(profile.trailingActivationPercentShort),
  trailingDistancePercentLong: parseNumericField(profile.trailingDistancePercentLong),
  trailingDistancePercentShort: parseNumericField(profile.trailingDistancePercentShort),
  trailingStopOffsetPercent: parseNumericField(profile.trailingStopOffsetPercent),
  maxDrawdownPercent: parseNumericField(profile.maxDrawdownPercent),
  dailyLossLimit: parseNumericField(profile.dailyLossLimit),
  maxRiskPerStopPercent: parseNumericField(profile.maxRiskPerStopPercent),
  choppinessThresholdHigh: parseNumericField(profile.choppinessThresholdHigh),
  choppinessThresholdLow: parseNumericField(profile.choppinessThresholdLow),
  fibonacciTargetLevelLong: profile.fibonacciTargetLevelLong as FibLevel | null,
  fibonacciTargetLevelShort: profile.fibonacciTargetLevelShort as FibLevel | null,
  fibonacciSwingRange: profile.fibonacciSwingRange as 'nearest' | 'extended' | null,
  initialStopMode: profile.initialStopMode as 'fibo_target' | 'nearest_swing' | null,
  tpCalculationMode: profile.tpCalculationMode as 'default' | 'fibonacci' | null,
  trailingStopMode: profile.trailingStopMode as 'local' | 'binance' | null,
  trailingDistanceMode: profile.trailingDistanceMode as 'auto' | 'fixed' | null,
  trailingActivationModeLong: profile.trailingActivationModeLong as 'auto' | 'manual' | null,
  trailingActivationModeShort: profile.trailingActivationModeShort as 'auto' | 'manual' | null,
  tradingMode: profile.tradingMode,
  directionMode: profile.directionMode,
});

export const parseDynamicSymbolExcluded = (json: string | null): string[] => {
  if (!json) return [];
  try {
    return JSON.parse(json) as string[];
  } catch {
    return [];
  }
};

export const stringifyDynamicSymbolExcluded = (symbols: string[]): string => {
  return JSON.stringify(symbols);
};

export const transformAutoTradingConfig = (config: AutoTradingConfigRow): TransformedAutoTradingConfig => ({
  ...config,
  enabledSetupTypes: parseEnabledSetupTypes(config.enabledSetupTypes),
  dynamicSymbolExcluded: parseDynamicSymbolExcluded(config.dynamicSymbolExcluded),
});
