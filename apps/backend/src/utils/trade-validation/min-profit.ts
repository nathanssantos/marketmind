import type { MinProfitInput, TradeValidationResult } from './types';

export const validateMinProfit = (input: MinProfitInput): TradeValidationResult => {
  const { entryPrice, takeProfit, direction, minProfitPercent, commissionRate } = input;

  if (!minProfitPercent || !takeProfit) {
    return { isValid: true };
  }

  const expectedProfitPercent = direction === 'LONG'
    ? ((takeProfit - entryPrice) / entryPrice) * 100
    : ((entryPrice - takeProfit) / entryPrice) * 100;

  const roundTripCommission = commissionRate * 200;
  const profitAfterFees = expectedProfitPercent - roundTripCommission;

  if (profitAfterFees < minProfitPercent) {
    return {
      isValid: false,
      reason: `Expected profit after fees ${profitAfterFees.toFixed(2)}% below minimum ${minProfitPercent}%`,
    };
  }

  return { isValid: true };
};
