import { calculateTotalFees } from '@marketmind/types';

export interface PnlCalculationParams {
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  side: 'LONG' | 'SHORT';
  marketType: 'FUTURES' | 'SPOT';
  leverage?: number;
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
  leverage = 1,
}: PnlCalculationParams): PnlCalculationResult => {
  const grossPnl = side === 'LONG'
    ? (exitPrice - entryPrice) * quantity
    : (entryPrice - exitPrice) * quantity;

  const entryValue = entryPrice * quantity;
  const exitValue = exitPrice * quantity;

  const { totalFees } = calculateTotalFees(entryValue, exitValue, { marketType });
  const netPnl = grossPnl - totalFees;

  const marginValue = entryValue / leverage;
  const pnlPercent = (netPnl / marginValue) * 100;

  return {
    grossPnl,
    totalFees,
    netPnl,
    pnlPercent,
  };
};
