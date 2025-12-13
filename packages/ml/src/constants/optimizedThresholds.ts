import type { TimeframeThreshold } from '@marketmind/types';

export const ML_THRESHOLDS_BY_TIMEFRAME: Record<string, TimeframeThreshold> = {
  '1m': { minProbability: 0.10, minConfidence: 70 },
  '5m': { minProbability: 0.08, minConfidence: 65 },
  '15m': { minProbability: 0.07, minConfidence: 60 },
  '30m': { minProbability: 0.06, minConfidence: 55 },
  '1h': { minProbability: 0.05, minConfidence: 50 },
  '4h': { minProbability: 0.05, minConfidence: 50 },
  '1d': { minProbability: 0.04, minConfidence: 45 },
  '1w': { minProbability: 0.03, minConfidence: 40 },
};

const DEFAULT_THRESHOLD: TimeframeThreshold = {
  minProbability: 0.05,
  minConfidence: 50,
};

export const getThresholdForTimeframe = (interval: string): TimeframeThreshold => {
  return ML_THRESHOLDS_BY_TIMEFRAME[interval] ?? DEFAULT_THRESHOLD;
};

export const updateThresholdForTimeframe = (
  interval: string,
  threshold: TimeframeThreshold
): void => {
  ML_THRESHOLDS_BY_TIMEFRAME[interval] = threshold;
};

export const setThresholdsFromOptimization = (
  thresholds: Record<string, TimeframeThreshold>
): void => {
  for (const [interval, threshold] of Object.entries(thresholds)) {
    ML_THRESHOLDS_BY_TIMEFRAME[interval] = threshold;
  }
};

export const getAllThresholds = (): Record<string, TimeframeThreshold> => {
  return { ...ML_THRESHOLDS_BY_TIMEFRAME };
};
