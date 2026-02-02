import type { MarketType } from '@marketmind/types';
import { CAPITAL_RULES, TRADING_DEFAULTS } from '@marketmind/types';

export interface CapitalLimitsInput {
  walletBalance: number;
  leverage: number;
  positionSizePercent?: number;
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

export const calculateMaxCapitalPerPosition = (
  availableCapital: number,
  positionSizePercent: number
): number => (availableCapital * positionSizePercent) / 100;

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
  positionSizePercent: number,
  minRequiredPerPosition: number
): number => {
  const capitalPerPosition = (availableCapital * positionSizePercent) / 100;
  if (capitalPerPosition < minRequiredPerPosition) return 0;
  return Math.floor(100 / positionSizePercent);
};

export const calculateEffectiveMinRequired = (
  maxCapitalPerPosition: number,
  defaultMinNotional: number
): number =>
  Math.max(defaultMinNotional, maxCapitalPerPosition / CAPITAL_RULES.SAFETY_MARGIN);

export const calculateCapitalLimits = (input: CapitalLimitsInput): CapitalLimitsResult => {
  const positionSizePercent = input.positionSizePercent ?? TRADING_DEFAULTS.POSITION_SIZE_PERCENT;
  const availableCapital = calculateAvailableCapital(input.walletBalance, input.leverage);
  const maxCapitalPerPosition = calculateMaxCapitalPerPosition(availableCapital, positionSizePercent);
  const defaultMinNotional = getDefaultMinNotional(input.marketType);
  const effectiveMinRequired = calculateEffectiveMinRequired(maxCapitalPerPosition, defaultMinNotional);

  const maxAffordableWatchers = calculateMaxAffordableWatchers(
    availableCapital,
    positionSizePercent,
    effectiveMinRequired
  );

  const capitalPerWatcher = maxCapitalPerPosition;

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
  positionSizePercent: number,
  maxCapitalPerPosition: number
): string =>
  `$${walletBalance.toFixed(2)} × ${leverage}x × ${positionSizePercent}% | Per position: $${maxCapitalPerPosition.toFixed(2)}`;
