import type { PositionSide } from '@marketmind/types';
import { calculateTotalFees } from '@marketmind/types';

export interface PnlCalculationParams {
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  side: PositionSide;
  marketType: 'FUTURES' | 'SPOT';
  leverage?: number;
  accumulatedFunding?: number;
  entryFee?: number;
  exitFee?: number;
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
  entryFee,
  exitFee,
}: PnlCalculationParams): PnlCalculationResult => {
  const grossPnl = side === 'LONG'
    ? (exitPrice - entryPrice) * quantity
    : (entryPrice - exitPrice) * quantity;

  const entryValue = entryPrice * quantity;
  const exitValue = exitPrice * quantity;

  const totalFees = (entryFee !== undefined && exitFee !== undefined)
    ? entryFee + exitFee
    : calculateTotalFees(entryValue, exitValue, { marketType }).totalFees;
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
