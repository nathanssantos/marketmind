import { stringifyDynamicSymbolExcluded, stringifyEnabledSetupTypes } from './profile-transformers';

interface ConfigFieldDef {
  key: string;
  transform?: (value: unknown) => unknown;
}

const CONFIG_FIELDS: ConfigFieldDef[] = [
  { key: 'isEnabled' },
  { key: 'maxConcurrentPositions' },
  { key: 'maxPositionSize' },
  { key: 'dailyLossLimit' },
  { key: 'enabledSetupTypes', transform: (v) => stringifyEnabledSetupTypes(v as string[]) },
  { key: 'positionSizing' },
  { key: 'useLimitOrders' },
  { key: 'volumeFilterObvLookbackLong' },
  { key: 'volumeFilterObvLookbackShort' },
  { key: 'useObvCheckLong' },
  { key: 'useObvCheckShort' },
  { key: 'positionSizePercent' },
  { key: 'maxGlobalExposurePercent' },
  { key: 'tpCalculationMode' },
  { key: 'fibonacciTargetLevel' },
  { key: 'fibonacciTargetLevelLong' },
  { key: 'fibonacciTargetLevelShort' },
  { key: 'fibonacciSwingRange' },
  { key: 'useDynamicSymbolSelection' },
  { key: 'dynamicSymbolRotationInterval' },
  { key: 'dynamicSymbolExcluded', transform: (v) => stringifyDynamicSymbolExcluded(v as string[]) },
  { key: 'enableAutoRotation' },
  { key: 'trailingStopMode' },
  { key: 'trailingStopEnabled' },
  { key: 'trailingActivationPercentLong' },
  { key: 'trailingActivationPercentShort' },
  { key: 'trailingDistancePercentLong' },
  { key: 'trailingDistancePercentShort' },
  { key: 'useAdaptiveTrailing' },
  { key: 'trailingDistanceMode' },
  { key: 'trailingStopOffsetPercent' },
  { key: 'trailingActivationModeLong' },
  { key: 'trailingActivationModeShort' },
  { key: 'leverage' },
  { key: 'marginType' },
  { key: 'opportunityCostEnabled' },
  { key: 'maxHoldingPeriodBars' },
  { key: 'stalePriceThresholdPercent' },
  { key: 'staleTradeAction' },
  { key: 'timeBasedStopTighteningEnabled' },
  { key: 'timeTightenAfterBars' },
  { key: 'timeTightenPercentPerBar' },
  { key: 'pyramidingEnabled' },
  { key: 'pyramidingMode' },
  { key: 'maxPyramidEntries' },
  { key: 'pyramidProfitThreshold' },
  { key: 'pyramidScaleFactor' },
  { key: 'pyramidMinDistance' },
  { key: 'pyramidUseAtr' },
  { key: 'pyramidUseAdx' },
  { key: 'pyramidUseRsi' },
  { key: 'pyramidAdxThreshold' },
  { key: 'pyramidRsiLowerBound' },
  { key: 'pyramidRsiUpperBound' },
  { key: 'pyramidFiboLevels', transform: (v) => JSON.stringify(v) },
  { key: 'leverageAwarePyramid' },
  { key: 'directionMode' },
  { key: 'minRiskRewardRatioLong' },
  { key: 'minRiskRewardRatioShort' },
  { key: 'maxFibonacciEntryProgressPercentLong', transform: (v) => String(v) },
  { key: 'maxFibonacciEntryProgressPercentShort', transform: (v) => String(v) },
  { key: 'maxDrawdownEnabled' },
  { key: 'maxDrawdownPercent' },
  { key: 'maxRiskPerStopEnabled' },
  { key: 'maxRiskPerStopPercent' },
  { key: 'marginTopUpEnabled' },
  { key: 'marginTopUpThreshold' },
  { key: 'marginTopUpPercent' },
  { key: 'marginTopUpMaxCount' },
  { key: 'positionMode' },
];

const applyFieldsToUpdate = (
  fields: ConfigFieldDef[],
  input: Record<string, unknown>,
  updateData: Record<string, unknown>,
): void => {
  for (const field of fields) {
    if (input[field.key] !== undefined) {
      updateData[field.key] = field.transform
        ? field.transform(input[field.key])
        : input[field.key];
    }
  }
};

export const applyConfigFieldsToUpdate = (
  input: Record<string, unknown>,
  updateData: Record<string, unknown>,
): void => applyFieldsToUpdate(CONFIG_FIELDS, input, updateData);

const TRADING_PROFILE_FIELDS: ConfigFieldDef[] = [
  { key: 'name' },
  { key: 'description' },
  { key: 'enabledSetupTypes', transform: (v) => stringifyEnabledSetupTypes(v as string[]) },
  { key: 'maxPositionSize', transform: (v) => v != null ? String(v) : null },
  { key: 'maxConcurrentPositions' },
  { key: 'isDefault' },
];

export const applyProfileFieldsToUpdate = (
  input: Record<string, unknown>,
  updateData: Record<string, unknown>,
): void => applyFieldsToUpdate(TRADING_PROFILE_FIELDS, input, updateData);
