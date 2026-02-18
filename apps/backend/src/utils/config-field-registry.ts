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
  { key: 'useProfitLockDistance' },
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
  { key: 'maxFibonacciEntryProgressPercent', transform: (v) => String(v) },
  { key: 'maxDrawdownEnabled' },
  { key: 'maxDrawdownPercent' },
  { key: 'marginTopUpEnabled' },
  { key: 'marginTopUpThreshold' },
  { key: 'marginTopUpPercent' },
  { key: 'marginTopUpMaxCount' },
  { key: 'positionMode' },
];

export const applyConfigFieldsToUpdate = (
  input: Record<string, unknown>,
  updateData: Record<string, unknown>,
): void => {
  for (const field of CONFIG_FIELDS) {
    if (input[field.key] !== undefined) {
      updateData[field.key] = field.transform
        ? field.transform(input[field.key])
        : input[field.key];
    }
  }
};
