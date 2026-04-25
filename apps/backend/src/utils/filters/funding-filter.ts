import type { PositionSide } from '@marketmind/types';
export const FUNDING_FILTER = {
  WARNING_THRESHOLD: 0.0005,
  BLOCK_THRESHOLD: 0.001,
} as const;

export type FundingLevel = 'NORMAL' | 'WARNING' | 'EXTREME';
export type FundingSignal = 'LONG_CONTRARIAN' | 'SHORT_CONTRARIAN' | 'NEUTRAL';

export interface FundingFilterResult {
  isAllowed: boolean;
  currentRate: number | null;
  fundingLevel: FundingLevel;
  signal: FundingSignal;
  nextFundingTime: Date | null;
  reason: string;
}

export const checkFundingRate = (
  fundingRate: number | null,
  direction: PositionSide,
  nextFundingTime?: Date
): FundingFilterResult => {
  if (fundingRate === null || fundingRate === undefined) {
    return {
      isAllowed: true,
      currentRate: null,
      fundingLevel: 'NORMAL',
      signal: 'NEUTRAL',
      nextFundingTime: nextFundingTime ?? null,
      reason: 'Funding rate not available - allowing trade (soft pass)',
    };
  }

  const absRate = Math.abs(fundingRate);
  let fundingLevel: FundingLevel = 'NORMAL';
  let signal: FundingSignal = 'NEUTRAL';

  if (absRate >= FUNDING_FILTER.BLOCK_THRESHOLD) {
    fundingLevel = 'EXTREME';
    signal = fundingRate > 0 ? 'SHORT_CONTRARIAN' : 'LONG_CONTRARIAN';
  } else if (absRate >= FUNDING_FILTER.WARNING_THRESHOLD) {
    fundingLevel = 'WARNING';
    signal = fundingRate > 0 ? 'SHORT_CONTRARIAN' : 'LONG_CONTRARIAN';
  }

  const formatRate = (r: number) => `${(r * 100).toFixed(4)}%`;

  if (fundingLevel === 'EXTREME') {
    if (direction === 'LONG' && fundingRate > 0) {
      return {
        isAllowed: false,
        currentRate: fundingRate,
        fundingLevel,
        signal,
        nextFundingTime: nextFundingTime ?? null,
        reason: `LONG blocked: extreme positive funding (${formatRate(fundingRate)}) - crowded long trade`,
      };
    }
    if (direction === 'SHORT' && fundingRate < 0) {
      return {
        isAllowed: false,
        currentRate: fundingRate,
        fundingLevel,
        signal,
        nextFundingTime: nextFundingTime ?? null,
        reason: `SHORT blocked: extreme negative funding (${formatRate(fundingRate)}) - crowded short trade`,
      };
    }
  }

  if (fundingLevel === 'WARNING') {
    const warningMsg =
      direction === 'LONG' && fundingRate > 0
        ? `WARNING: elevated positive funding (${formatRate(fundingRate)}) - potential long squeeze risk`
        : direction === 'SHORT' && fundingRate < 0
          ? `WARNING: elevated negative funding (${formatRate(fundingRate)}) - potential short squeeze risk`
          : `Funding rate ${formatRate(fundingRate)} within acceptable range`;

    return {
      isAllowed: true,
      currentRate: fundingRate,
      fundingLevel,
      signal,
      nextFundingTime: nextFundingTime ?? null,
      reason: warningMsg,
    };
  }

  return {
    isAllowed: true,
    currentRate: fundingRate,
    fundingLevel,
    signal,
    nextFundingTime: nextFundingTime ?? null,
    reason: `Funding rate ${formatRate(fundingRate)} within normal range`,
  };
};
