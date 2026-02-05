import { IB_COMMISSION_RATES } from './constants';

export type IBAccountType = 'PRO' | 'LITE';

export interface IBCommissionResult {
  commission: number;
  perShareRate: number;
  tier: string;
  shares: number;
  tradeValue: number;
  effectiveRate: number;
}

const MAX_COMMISSION_PCT = 0.01;

export const calculateTieredCommission = (
  shares: number,
  pricePerShare: number,
  monthlyVolume = 0,
  accountType: IBAccountType = 'PRO'
): IBCommissionResult => {
  if (accountType === 'LITE') {
    return {
      commission: 0,
      perShareRate: 0,
      tier: 'LITE',
      shares,
      tradeValue: shares * pricePerShare,
      effectiveRate: 0,
    };
  }

  const tradeValue = shares * pricePerShare;
  const rawCommission = calculateBlendedCommission(shares, monthlyVolume);

  const minCommission = IB_COMMISSION_RATES.TIERED.TIER_1.minCommission;
  const maxCommission = tradeValue * MAX_COMMISSION_PCT;

  const commission = Math.max(minCommission, Math.min(rawCommission, maxCommission));
  const effectiveRate = tradeValue > 0 ? commission / tradeValue : 0;
  const tier = getTierForVolume(monthlyVolume + shares);

  return {
    commission,
    perShareRate: shares > 0 ? commission / shares : 0,
    tier,
    shares,
    tradeValue,
    effectiveRate,
  };
};

export const calculateRoundTripCommission = (
  shares: number,
  entryPrice: number,
  exitPrice: number,
  monthlyVolume = 0,
  accountType: IBAccountType = 'PRO'
): { entry: IBCommissionResult; exit: IBCommissionResult; total: number } => {
  const entry = calculateTieredCommission(shares, entryPrice, monthlyVolume, accountType);
  const exit = calculateTieredCommission(shares, exitPrice, monthlyVolume + shares, accountType);

  return {
    entry,
    exit,
    total: entry.commission + exit.commission,
  };
};

export const estimateCommissionRate = (
  monthlyVolume = 0,
  accountType: IBAccountType = 'PRO'
): number => {
  if (accountType === 'LITE') return 0;

  const tier = getTierForVolume(monthlyVolume);
  return getTierRate(tier);
};

const TIER_BRACKETS = [
  { maxShares: IB_COMMISSION_RATES.TIERED.TIER_1.maxShares, rate: IB_COMMISSION_RATES.TIERED.TIER_1.rate },
  { maxShares: IB_COMMISSION_RATES.TIERED.TIER_2.maxShares, rate: IB_COMMISSION_RATES.TIERED.TIER_2.rate },
  { maxShares: IB_COMMISSION_RATES.TIERED.TIER_3.maxShares, rate: IB_COMMISSION_RATES.TIERED.TIER_3.rate },
  { maxShares: Infinity, rate: IB_COMMISSION_RATES.TIERED.TIER_4.rate },
];

const calculateBlendedCommission = (shares: number, monthlyVolume: number): number => {
  let remaining = shares;
  let commission = 0;
  let volumeSoFar = monthlyVolume;

  for (const bracket of TIER_BRACKETS) {
    if (remaining <= 0) break;

    const bracketCapacity = Math.max(0, bracket.maxShares - volumeSoFar);
    const sharesInBracket = Math.min(remaining, bracketCapacity);

    if (sharesInBracket > 0) {
      commission += sharesInBracket * bracket.rate;
      remaining -= sharesInBracket;
      volumeSoFar += sharesInBracket;
    }
  }

  return commission;
};

const getTierForVolume = (totalShares: number): string => {
  const { TIER_1, TIER_2, TIER_3 } = IB_COMMISSION_RATES.TIERED;

  if (totalShares <= TIER_1.maxShares) return 'TIER_1';
  if (totalShares <= TIER_2.maxShares) return 'TIER_2';
  if (totalShares <= TIER_3.maxShares) return 'TIER_3';
  return 'TIER_4';
};

const getTierRate = (tier: string): number => {
  const rates: Record<string, number> = {
    TIER_1: IB_COMMISSION_RATES.TIERED.TIER_1.rate,
    TIER_2: IB_COMMISSION_RATES.TIERED.TIER_2.rate,
    TIER_3: IB_COMMISSION_RATES.TIERED.TIER_3.rate,
    TIER_4: IB_COMMISSION_RATES.TIERED.TIER_4.rate,
  };
  return rates[tier] ?? IB_COMMISSION_RATES.TIERED.TIER_1.rate;
};
