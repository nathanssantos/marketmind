import type { MarketType } from '@marketmind/types';
import { CAPITAL_RULES, TRADING_DEFAULTS } from '@marketmind/types';

export interface CapitalLimitsInput {
  walletBalance: number;
  leverage: number;
  exposureMultiplier?: number;
  marketType: MarketType;
}

export interface CapitalLimitsResult {
  availableCapital: number;
  maxCapitalPerPosition: number;
  effectiveMinRequired: number;
  maxAffordableWatchers: number;
  capitalPerWatcher: number;
}

export interface SymbolMinRequired {
  minNotional: number;
  minQty: number;
  price: number;
}

export const calculateAvailableCapital = (walletBalance: number, leverage: number): number =>
  walletBalance * leverage;

export const calculateMaxCapitalPerPosition = (availableCapital: number): number =>
  availableCapital / CAPITAL_RULES.MAX_POSITION_CAPITAL_RATIO;

export const getDefaultMinNotional = (marketType: MarketType): number =>
  marketType === 'FUTURES' ? CAPITAL_RULES.MIN_NOTIONAL_FUTURES : CAPITAL_RULES.MIN_NOTIONAL_SPOT;

export const calculateMinRequiredForSymbol = (
  symbol: SymbolMinRequired,
  safetyMargin: number = CAPITAL_RULES.SAFETY_MARGIN
): { minRequired: number; source: 'minNotional' | 'minQty' } => {
  const minNotionalRequired = symbol.minNotional * safetyMargin;
  const minQtyRequired = symbol.minQty * symbol.price * safetyMargin;

  if (minQtyRequired > minNotionalRequired) {
    return { minRequired: minQtyRequired, source: 'minQty' };
  }
  return { minRequired: minNotionalRequired, source: 'minNotional' };
};

export const calculateMaxAffordableWatchers = (
  availableCapital: number,
  exposureMultiplier: number,
  minRequiredPerPosition: number
): number => {
  const requiredPerWatcher = minRequiredPerPosition * CAPITAL_RULES.SAFETY_MARGIN;
  const maxWatchers = Math.floor((availableCapital * exposureMultiplier) / requiredPerWatcher);
  return maxWatchers;
};

export const calculateEffectiveMinRequired = (
  maxCapitalPerPosition: number,
  defaultMinNotional: number
): number =>
  Math.max(defaultMinNotional, maxCapitalPerPosition / CAPITAL_RULES.SAFETY_MARGIN);

export const calculateCapitalLimits = (input: CapitalLimitsInput): CapitalLimitsResult => {
  const exposureMultiplier = input.exposureMultiplier ?? TRADING_DEFAULTS.EXPOSURE_MULTIPLIER;
  const availableCapital = calculateAvailableCapital(input.walletBalance, input.leverage);
  const maxCapitalPerPosition = calculateMaxCapitalPerPosition(availableCapital);
  const defaultMinNotional = getDefaultMinNotional(input.marketType);
  const effectiveMinRequired = calculateEffectiveMinRequired(maxCapitalPerPosition, defaultMinNotional);

  const maxAffordableWatchers = calculateMaxAffordableWatchers(
    availableCapital,
    exposureMultiplier,
    effectiveMinRequired
  );

  const effectiveWatchersCount = maxAffordableWatchers > 0 ? maxAffordableWatchers : 1;
  const capitalPerWatcher = (availableCapital * exposureMultiplier) / effectiveWatchersCount;

  return {
    availableCapital,
    maxCapitalPerPosition,
    effectiveMinRequired,
    maxAffordableWatchers,
    capitalPerWatcher,
  };
};

export const isSymbolAffordable = (
  symbolMinRequired: number,
  maxCapitalPerPosition: number
): boolean => symbolMinRequired <= maxCapitalPerPosition;

export const formatCapitalTooltip = (
  walletBalance: number,
  leverage: number,
  exposureMultiplier: number,
  maxCapitalPerPosition: number
): string =>
  `$${walletBalance.toFixed(2)} × ${leverage}x × ${exposureMultiplier}x | Max/pos: $${maxCapitalPerPosition.toFixed(2)} (1/${CAPITAL_RULES.MAX_POSITION_CAPITAL_RATIO} rule)`;
