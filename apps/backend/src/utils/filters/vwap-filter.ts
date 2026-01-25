import { calculateIntradayVWAP } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';

const MIN_KLINES_REQUIRED = 5;

export const VWAP_FILTER = {
  MIN_KLINES_REQUIRED,
} as const;

export interface VwapFilterResult {
  isAllowed: boolean;
  vwap: number | null;
  currentPrice: number | null;
  priceVsVwap: 'ABOVE' | 'BELOW' | 'AT' | null;
  reason: string;
}

export const checkVwapCondition = (
  klines: Kline[],
  direction: 'LONG' | 'SHORT',
): VwapFilterResult => {
  if (klines.length < MIN_KLINES_REQUIRED) {
    return {
      isAllowed: true,
      vwap: null,
      currentPrice: null,
      priceVsVwap: null,
      reason: `Insufficient klines (${klines.length} < ${MIN_KLINES_REQUIRED}) - allowing trade (soft pass)`,
    };
  }

  const vwapValues = calculateIntradayVWAP(klines);
  const lastVwap = vwapValues[vwapValues.length - 1];
  const lastKline = klines[klines.length - 1];

  if (!lastKline || lastVwap === undefined || isNaN(lastVwap)) {
    return {
      isAllowed: true,
      vwap: null,
      currentPrice: null,
      priceVsVwap: null,
      reason: 'VWAP calculation returned invalid value - allowing trade (soft pass)',
    };
  }

  const currentPrice = parseFloat(lastKline.close);
  const percentDiff = ((currentPrice - lastVwap) / lastVwap) * 100;

  let priceVsVwap: 'ABOVE' | 'BELOW' | 'AT';
  if (Math.abs(percentDiff) < 0.1) {
    priceVsVwap = 'AT';
  } else {
    priceVsVwap = currentPrice > lastVwap ? 'ABOVE' : 'BELOW';
  }

  if (direction === 'LONG') {
    if (priceVsVwap === 'BELOW') {
      return {
        isAllowed: false,
        vwap: lastVwap,
        currentPrice,
        priceVsVwap,
        reason: `LONG blocked: price (${currentPrice.toFixed(2)}) below VWAP (${lastVwap.toFixed(2)}) - ${percentDiff.toFixed(2)}%`,
      };
    }
    return {
      isAllowed: true,
      vwap: lastVwap,
      currentPrice,
      priceVsVwap,
      reason: `LONG allowed: price (${currentPrice.toFixed(2)}) ${priceVsVwap === 'AT' ? 'at' : 'above'} VWAP (${lastVwap.toFixed(2)}) - +${percentDiff.toFixed(2)}%`,
    };
  }

  if (direction === 'SHORT') {
    if (priceVsVwap === 'ABOVE') {
      return {
        isAllowed: false,
        vwap: lastVwap,
        currentPrice,
        priceVsVwap,
        reason: `SHORT blocked: price (${currentPrice.toFixed(2)}) above VWAP (${lastVwap.toFixed(2)}) - +${percentDiff.toFixed(2)}%`,
      };
    }
    return {
      isAllowed: true,
      vwap: lastVwap,
      currentPrice,
      priceVsVwap,
      reason: `SHORT allowed: price (${currentPrice.toFixed(2)}) ${priceVsVwap === 'AT' ? 'at' : 'below'} VWAP (${lastVwap.toFixed(2)}) - ${percentDiff.toFixed(2)}%`,
    };
  }

  return {
    isAllowed: true,
    vwap: lastVwap,
    currentPrice,
    priceVsVwap,
    reason: 'Unknown direction',
  };
};
