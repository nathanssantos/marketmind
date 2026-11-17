import { PineIndicatorService } from '../../services/pine/PineIndicatorService';
import type { Kline } from '@marketmind/types';
import { INDICATOR_PERIODS, FILTER_THRESHOLDS } from '@marketmind/types';

const pineService = new PineIndicatorService();

export interface AdxFilterResult {
  isAllowed: boolean;
  adx: number | null;
  plusDI: number | null;
  minusDI: number | null;
  isBullish: boolean;
  isBearish: boolean;
  isStrongTrend: boolean;
  reason: string;
}

export const ADX_FILTER = {
  PERIOD: INDICATOR_PERIODS.ADX_DEFAULT,
  TREND_THRESHOLD: FILTER_THRESHOLDS.ADX_TREND,
  MIN_KLINES_REQUIRED: INDICATOR_PERIODS.ADX_DEFAULT * 2 + 7,
} as const;

export const checkAdxCondition = async (
  klines: Kline[],
  direction: 'LONG' | 'SHORT'
): Promise<AdxFilterResult> => {
  const { PERIOD, TREND_THRESHOLD, MIN_KLINES_REQUIRED } = ADX_FILTER;

  if (klines.length < MIN_KLINES_REQUIRED) {
    return {
      isAllowed: true,
      adx: null,
      plusDI: null,
      minusDI: null,
      isBullish: false,
      isBearish: false,
      isStrongTrend: false,
      reason: 'Insufficient klines for calculation',
    };
  }

  const dmiResult = await pineService.computeMulti('dmi', klines, { period: PERIOD });
  const adxValues = dmiResult['adx'] ?? [];
  const plusDIValues = dmiResult['plusDI'] ?? [];
  const minusDIValues = dmiResult['minusDI'] ?? [];

  const adx = adxValues[adxValues.length - 1] ?? null;
  const plusDI = plusDIValues[plusDIValues.length - 1] ?? null;
  const minusDI = minusDIValues[minusDIValues.length - 1] ?? null;

  if (adx == null || plusDI == null || minusDI == null) {
    return {
      isAllowed: true,
      adx: null,
      plusDI: null,
      minusDI: null,
      isBullish: false,
      isBearish: false,
      isStrongTrend: false,
      reason: 'ADX calculation returned null values',
    };
  }

  const isBullish = plusDI > minusDI;
  const isBearish = minusDI > plusDI;
  const isStrongTrend = adx >= TREND_THRESHOLD;

  const isLongAllowed = direction === 'LONG' && isBullish && isStrongTrend;
  const isShortAllowed = direction === 'SHORT' && isBearish && isStrongTrend;
  const isAllowed = isLongAllowed || isShortAllowed;

  let reason: string;
  if (isAllowed) {
    reason = direction === 'LONG'
      ? `+DI (${plusDI.toFixed(2)}) > -DI (${minusDI.toFixed(2)}) with ADX (${adx.toFixed(2)}) >= ${TREND_THRESHOLD}`
      : `-DI (${minusDI.toFixed(2)}) > +DI (${plusDI.toFixed(2)}) with ADX (${adx.toFixed(2)}) >= ${TREND_THRESHOLD}`;
  } else if (!isStrongTrend) {
    reason = `ADX (${adx.toFixed(2)}) below threshold (${TREND_THRESHOLD}) - weak trend`;
  } else if (direction === 'LONG') {
    reason = `+DI (${plusDI.toFixed(2)}) <= -DI (${minusDI.toFixed(2)}) - bearish bias`;
  } else {
    reason = `-DI (${minusDI.toFixed(2)}) <= +DI (${plusDI.toFixed(2)}) - bullish bias`;
  }

  return {
    isAllowed,
    adx,
    plusDI,
    minusDI,
    isBullish,
    isBearish,
    isStrongTrend,
    reason,
  };
};
