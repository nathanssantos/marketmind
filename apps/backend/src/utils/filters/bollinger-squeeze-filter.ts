import { calculateBollingerBands, calculateBBWidth } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';

const DEFAULT_BB_PERIOD = 20;
const DEFAULT_BB_STD_DEV = 2;
const DEFAULT_SQUEEZE_THRESHOLD = 0.1;

export const BOLLINGER_SQUEEZE_FILTER = {
  DEFAULT_PERIOD: DEFAULT_BB_PERIOD,
  DEFAULT_STD_DEV: DEFAULT_BB_STD_DEV,
  DEFAULT_THRESHOLD: DEFAULT_SQUEEZE_THRESHOLD,
} as const;

export interface BollingerSqueezeFilterResult {
  isAllowed: boolean;
  bbWidth: number | null;
  isSqueezing: boolean;
  reason: string;
}

export const checkBollingerSqueezeCondition = (
  klines: Kline[],
  threshold: number = DEFAULT_SQUEEZE_THRESHOLD,
  period: number = DEFAULT_BB_PERIOD,
  stdDev: number = DEFAULT_BB_STD_DEV,
): BollingerSqueezeFilterResult => {
  if (klines.length < period) {
    return {
      isAllowed: true,
      bbWidth: null,
      isSqueezing: false,
      reason: `Insufficient klines (${klines.length} < ${period}) - allowing trade (soft pass)`,
    };
  }

  const bb = calculateBollingerBands(klines, period, stdDev);

  if (!bb) {
    return {
      isAllowed: true,
      bbWidth: null,
      isSqueezing: false,
      reason: 'Bollinger Bands calculation returned null - allowing trade (soft pass)',
    };
  }

  const bbWidth = calculateBBWidth(bb);
  const isSqueezing = bbWidth < threshold;

  if (isSqueezing) {
    return {
      isAllowed: false,
      bbWidth,
      isSqueezing,
      reason: `Trade blocked: BB Width=${(bbWidth * 100).toFixed(2)}% < ${(threshold * 100).toFixed(2)}% (volatility squeeze, waiting for breakout)`,
    };
  }

  return {
    isAllowed: true,
    bbWidth,
    isSqueezing,
    reason: `Trade allowed: BB Width=${(bbWidth * 100).toFixed(2)}% >= ${(threshold * 100).toFixed(2)}% (sufficient volatility)`,
  };
};
