import { calculateTotalFees } from '@marketmind/types';

export interface PnlCalculationParams {
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  side: 'LONG' | 'SHORT';
  marketType: 'FUTURES' | 'SPOT';
  leverage?: number;
  accumulatedFunding?: number;
}

export interface PnlCalculationResult {
  grossPnl: number;
  totalFees: number;
  netPnl: number;
  pnlPercent: number;
  marginValue: number;
}

export const calculatePnl = ({
  entryPrice,
  exitPrice,
  quantity,
  side,
  marketType,
  leverage = 1,
  accumulatedFunding = 0,
}: PnlCalculationParams): PnlCalculationResult => {
  const grossPnl = side === 'LONG'
    ? (exitPrice - entryPrice) * quantity
    : (entryPrice - exitPrice) * quantity;

  const entryValue = entryPrice * quantity;
  const exitValue = exitPrice * quantity;

  const { totalFees } = calculateTotalFees(entryValue, exitValue, { marketType });
  const netPnl = grossPnl - totalFees + accumulatedFunding;

  const marginValue = entryValue / leverage;
  const pnlPercent = marginValue > 0 ? (netPnl / marginValue) * 100 : 0;

  return {
    grossPnl,
    totalFees,
    netPnl,
    pnlPercent,
    marginValue,
  };
};
