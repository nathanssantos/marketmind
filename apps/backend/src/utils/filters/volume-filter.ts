import { calculateOBV } from '@marketmind/indicators';
import type {
  Kline,
  ObvTrend,
  SetupVolumeType,
  VolumeFilterConfig,
  VolumeFilterResult,
} from '@marketmind/types';
import { getStrategyVolumeType } from './strategy-filter-types';

const VOLUME_AVG_PERIOD = 20;
const BREAKOUT_MULTIPLIER = 1.5;
const PULLBACK_MULTIPLIER = 1.0;
const OBV_LOOKBACK = 5;
const MIN_KLINES_REQUIRED = 25;

export const VOLUME_FILTER = {
  VOLUME_AVG_PERIOD,
  BREAKOUT_MULTIPLIER,
  PULLBACK_MULTIPLIER,
  OBV_LOOKBACK,
  MIN_KLINES_REQUIRED,
} as const;

export type { ObvTrend, SetupVolumeType, VolumeFilterConfig, VolumeFilterResult };

const getDirectionalConfig = (
  direction: 'LONG' | 'SHORT',
  config?: VolumeFilterConfig
): { breakoutMult: number; pullbackMult: number; useObv: boolean; obvLookback: number } => {
  const directionalConfig = direction === 'LONG' ? config?.longConfig : config?.shortConfig;

  return {
    breakoutMult: directionalConfig?.breakoutMultiplier ?? config?.breakoutMultiplier ?? BREAKOUT_MULTIPLIER,
    pullbackMult: directionalConfig?.pullbackMultiplier ?? config?.pullbackMultiplier ?? PULLBACK_MULTIPLIER,
    useObv: directionalConfig?.useObvCheck ?? config?.useObvCheck ?? true,
    obvLookback: directionalConfig?.obvLookback ?? config?.obvLookback ?? OBV_LOOKBACK,
  };
};

export const getSetupVolumeType = (setupType: string): SetupVolumeType => {
  return getStrategyVolumeType(setupType);
};

const calculateVolumeAverage = (klines: Kline[], period: number): number | null => {
  if (klines.length < period) return null;

  let sum = 0;
  const startIdx = klines.length - period - 1;
  for (let i = startIdx; i < klines.length - 1; i++) {
    const kline = klines[i];
    if (!kline) continue;
    sum += parseFloat(String(kline.volume));
  }

  return sum / period;
};

const getObvTrend = (obvValues: number[], lookback: number): ObvTrend => {
  if (obvValues.length < lookback + 1) return 'FLAT';

  const recent = obvValues.slice(-lookback);
  const prev = obvValues.slice(-lookback - 1, -1);

  if (recent.length === 0 || prev.length === 0) return 'FLAT';

  let risingCount = 0;
  let fallingCount = 0;

  for (let i = 0; i < Math.min(recent.length, prev.length); i++) {
    const r = recent[i];
    const p = prev[i];
    if (r === undefined || p === undefined) continue;
    if (r > p) risingCount++;
    else if (r < p) fallingCount++;
  }

  if (risingCount > fallingCount) return 'RISING';
  if (fallingCount > risingCount) return 'FALLING';
  return 'FLAT';
};

export const checkVolumeCondition = (
  klines: Kline[],
  direction: 'LONG' | 'SHORT',
  setupType: string,
  config?: VolumeFilterConfig
): VolumeFilterResult => {
  const { breakoutMult, pullbackMult, useObv, obvLookback } = getDirectionalConfig(direction, config);

  if (klines.length < MIN_KLINES_REQUIRED) {
    return {
      isAllowed: true,
      currentVolume: null,
      averageVolume: null,
      volumeRatio: null,
      isVolumeSpike: false,
      obvTrend: 'FLAT',
      reason: `Insufficient klines (${klines.length} < ${MIN_KLINES_REQUIRED}) - allowing trade (soft pass)`,
    };
  }

  const volumeType = getSetupVolumeType(setupType);
  const requiredMultiplier = volumeType === 'BREAKOUT' ? breakoutMult : pullbackMult;

  const lastKline = klines[klines.length - 1];
  if (!lastKline) {
    return {
      isAllowed: true,
      currentVolume: null,
      averageVolume: null,
      volumeRatio: null,
      isVolumeSpike: false,
      obvTrend: 'FLAT',
      reason: 'Last kline not found - allowing trade (soft pass)',
    };
  }

  const currentVolume = parseFloat(String(lastKline.volume));
  const averageVolume = calculateVolumeAverage(klines, VOLUME_AVG_PERIOD);

  if (averageVolume === null || averageVolume === 0) {
    return {
      isAllowed: true,
      currentVolume,
      averageVolume: null,
      volumeRatio: null,
      isVolumeSpike: false,
      obvTrend: 'FLAT',
      reason: 'Volume average calculation failed - allowing trade (soft pass)',
    };
  }

  const volumeRatio = currentVolume / averageVolume;
  const isVolumeSpike = requiredMultiplier > 0 ? volumeRatio >= requiredMultiplier : true;

  const obvResult = calculateOBV(klines);
  const obvTrend = getObvTrend(obvResult.values, obvLookback);

  const obvAligned = !useObv || (
    (direction === 'LONG' && obvTrend !== 'FALLING') ||
    (direction === 'SHORT' && obvTrend !== 'RISING')
  );

  if (volumeType === 'BREAKOUT' && requiredMultiplier > 0 && !isVolumeSpike) {
    return {
      isAllowed: false,
      currentVolume,
      averageVolume,
      volumeRatio,
      isVolumeSpike,
      obvTrend,
      reason: `Breakout blocked: volume ratio (${volumeRatio.toFixed(2)}x) < required (${requiredMultiplier}x)`,
    };
  }

  if (useObv && !obvAligned) {
    return {
      isAllowed: false,
      currentVolume,
      averageVolume,
      volumeRatio,
      isVolumeSpike,
      obvTrend,
      reason: `${direction} blocked: OBV trend (${obvTrend}) not aligned`,
    };
  }

  return {
    isAllowed: true,
    currentVolume,
    averageVolume,
    volumeRatio,
    isVolumeSpike,
    obvTrend,
    reason: `Volume confirmed: ratio ${volumeRatio.toFixed(2)}x, OBV ${obvTrend}${!useObv ? ' (OBV check disabled)' : ''}`,
  };
};
