import { calculateTotalFees } from '@marketmind/types';

export interface PnlCalculationParams {
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  side: 'LONG' | 'SHORT';
  marketType: 'FUTURES' | 'SPOT';
}

export interface PnlCalculationResult {
  grossPnl: number;
  totalFees: number;
  netPnl: number;
  pnlPercent: number;
}

export const calculatePnl = ({
  entryPrice,
  exitPrice,
  quantity,
  side,
  marketType,
}: PnlCalculationParams): PnlCalculationResult => {
  const grossPnl = side === 'LONG'
    ? (exitPrice - entryPrice) * quantity
    : (entryPrice - exitPrice) * quantity;

  const entryValue = entryPrice * quantity;
  const exitValue = exitPrice * quantity;

  const { totalFees } = calculateTotalFees(entryValue, exitValue, { marketType });
  const netPnl = grossPnl - totalFees;

  const pnlPercent = ((exitPrice - entryPrice) / entryPrice) * 100;
  const adjustedPnlPercent = side === 'LONG' ? pnlPercent : -pnlPercent;

  return {
    grossPnl,
    totalFees,
    netPnl,
    pnlPercent: adjustedPnlPercent,
  };
};
