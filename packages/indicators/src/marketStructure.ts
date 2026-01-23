import type { Kline } from '@marketmind/types';
import { calculateSwingPoints, type SwingPoint } from './swingPoints';

const DEFAULT_LOOKBACK = 50;
const MIN_SWINGS_FOR_TREND = 2;

export interface MarketStructureAnalysis {
  trend: 'UPTREND' | 'DOWNTREND' | 'RANGING';
  higherHighs: number;
  higherLows: number;
  lowerHighs: number;
  lowerLows: number;
  lastSwingHigh: SwingPoint | null;
  lastSwingLow: SwingPoint | null;
  confidence: number;
}

export interface StructureConfig {
  lookback?: number;
  minSwingsForTrend?: number;
}

export const MARKET_STRUCTURE_DEFAULTS = {
  LOOKBACK: DEFAULT_LOOKBACK,
  MIN_SWINGS_FOR_TREND: MIN_SWINGS_FOR_TREND,
} as const;

const getRequiredConfig = (config: StructureConfig) => ({
  lookback: config.lookback ?? DEFAULT_LOOKBACK,
  minSwingsForTrend: config.minSwingsForTrend ?? MIN_SWINGS_FOR_TREND,
});

export const analyzeMarketStructure = (
  klines: Kline[],
  config: StructureConfig = {},
): MarketStructureAnalysis => {
  const cfg = getRequiredConfig(config);
  const recentKlines = klines.slice(-cfg.lookback);

  if (recentKlines.length < 10) {
    return {
      trend: 'RANGING',
      higherHighs: 0,
      higherLows: 0,
      lowerHighs: 0,
      lowerLows: 0,
      lastSwingHigh: null,
      lastSwingLow: null,
      confidence: 0,
    };
  }

  const { swingPoints } = calculateSwingPoints(recentKlines, 5);

  const swingHighs = swingPoints.filter(s => s.type === 'high');
  const swingLows = swingPoints.filter(s => s.type === 'low');

  const recentHighs = swingHighs.slice(-4);
  const recentLows = swingLows.slice(-4);

  let higherHighs = 0;
  let lowerHighs = 0;
  let higherLows = 0;
  let lowerLows = 0;

  for (let i = 1; i < recentHighs.length; i++) {
    if (recentHighs[i]!.price > recentHighs[i - 1]!.price) higherHighs++;
    else lowerHighs++;
  }

  for (let i = 1; i < recentLows.length; i++) {
    if (recentLows[i]!.price > recentLows[i - 1]!.price) higherLows++;
    else lowerLows++;
  }

  let trend: 'UPTREND' | 'DOWNTREND' | 'RANGING';
  let confidence: number;

  const totalHighComparisons = recentHighs.length - 1;
  const totalLowComparisons = recentLows.length - 1;
  const totalComparisons = totalHighComparisons + totalLowComparisons;

  if (higherHighs >= cfg.minSwingsForTrend && higherLows >= cfg.minSwingsForTrend) {
    trend = 'UPTREND';
    confidence = totalComparisons > 0
      ? ((higherHighs + higherLows) / totalComparisons) * 100
      : 50;
  } else if (lowerHighs >= cfg.minSwingsForTrend && lowerLows >= cfg.minSwingsForTrend) {
    trend = 'DOWNTREND';
    confidence = totalComparisons > 0
      ? ((lowerHighs + lowerLows) / totalComparisons) * 100
      : 50;
  } else {
    trend = 'RANGING';
    confidence = 50;
  }

  return {
    trend,
    higherHighs,
    higherLows,
    lowerHighs,
    lowerLows,
    lastSwingHigh: recentHighs[recentHighs.length - 1] ?? null,
    lastSwingLow: recentLows[recentLows.length - 1] ?? null,
    confidence,
  };
};

export const isUptrendStructure = (
  klines: Kline[],
  config: StructureConfig = {},
): boolean => {
  const structure = analyzeMarketStructure(klines, config);
  return structure.trend === 'UPTREND';
};

export const isDowntrendStructure = (
  klines: Kline[],
  config: StructureConfig = {},
): boolean => {
  const structure = analyzeMarketStructure(klines, config);
  return structure.trend === 'DOWNTREND';
};

export const isRangingStructure = (
  klines: Kline[],
  config: StructureConfig = {},
): boolean => {
  const structure = analyzeMarketStructure(klines, config);
  return structure.trend === 'RANGING';
};

export const getStructureConfidence = (
  klines: Kline[],
  config: StructureConfig = {},
): number => {
  const structure = analyzeMarketStructure(klines, config);
  return structure.confidence;
};
