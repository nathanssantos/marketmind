import { PineIndicatorService } from '../../services/pine/PineIndicatorService';
import type { BollingerSqueezeFilterResult, Kline } from '@marketmind/types';

const pineService = new PineIndicatorService();

const DEFAULT_BB_PERIOD = 20;
const DEFAULT_BB_STD_DEV = 2;
const DEFAULT_SQUEEZE_THRESHOLD = 0.1;

export const BOLLINGER_SQUEEZE_FILTER = {
  DEFAULT_PERIOD: DEFAULT_BB_PERIOD,
  DEFAULT_STD_DEV: DEFAULT_BB_STD_DEV,
  DEFAULT_THRESHOLD: DEFAULT_SQUEEZE_THRESHOLD,
} as const;

export type { BollingerSqueezeFilterResult };

export const checkBollingerSqueezeCondition = async (
  klines: Kline[],
  threshold: number = DEFAULT_SQUEEZE_THRESHOLD,
  period: number = DEFAULT_BB_PERIOD,
  stdDev: number = DEFAULT_BB_STD_DEV,
): Promise<BollingerSqueezeFilterResult> => {
  if (klines.length < period) {
    return {
      isAllowed: true,
      bbWidth: null,
      isSqueezing: false,
      reason: `Insufficient klines (${klines.length} < ${period}) - allowing trade (soft pass)`,
    };
  }

  const bbResult = await pineService.computeMulti('bb', klines, { period, stdDev });
  const upperValues = bbResult['upper'] ?? [];
  const middleValues = bbResult['middle'] ?? [];
  const lowerValues = bbResult['lower'] ?? [];

  const lastIndex = upperValues.length - 1;
  const upper = upperValues[lastIndex] ?? null;
  const middle = middleValues[lastIndex] ?? null;
  const lower = lowerValues[lastIndex] ?? null;

  if (upper === null || middle === null || lower === null || middle === 0) {
    return {
      isAllowed: true,
      bbWidth: null,
      isSqueezing: false,
      reason: 'Bollinger Bands calculation returned null - allowing trade (soft pass)',
    };
  }

  const bbWidth = (upper - lower) / middle;
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
