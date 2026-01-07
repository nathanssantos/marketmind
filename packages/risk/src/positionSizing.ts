import type { PositionLike } from './types';

export const calculateWeightedAvgPrice = (
  executions: PositionLike[]
): number => {
  let totalValue = 0;
  let totalQuantity = 0;

  for (const exec of executions) {
    totalValue += exec.entryPrice * exec.quantity;
    totalQuantity += exec.quantity;
  }

  return totalQuantity > 0 ? totalValue / totalQuantity : 0;
};

export const calculateTotalExposure = (
  executions: PositionLike[]
): number => {
  return executions.reduce((sum, exec) => sum + exec.entryPrice * exec.quantity, 0);
};

export const roundQuantity = (quantity: number): number => {
  if (quantity < 1) return Math.floor(quantity * 100000) / 100000;
  if (quantity < 10) return Math.floor(quantity * 1000) / 1000;
  return Math.floor(quantity * 100) / 100;
};

export const calculatePositionSize = (
  equity: number,
  entryPrice: number,
  exposurePercent: number
): { quantity: number; positionValue: number } => {
  const positionValue = (equity * exposurePercent) / 100;
  const quantity = positionValue / entryPrice;

  return {
    quantity: roundQuantity(quantity),
    positionValue,
  };
};

export const calculateRiskBasedPositionSize = (
  equity: number,
  entryPrice: number,
  stopLoss: number,
  riskPercent: number
): { quantity: number; positionValue: number } => {
  const riskAmount = (equity * riskPercent) / 100;
  const riskPerUnit = Math.abs(entryPrice - stopLoss);

  if (riskPerUnit <= 0) {
    return { quantity: 0, positionValue: 0 };
  }

  const quantity = riskAmount / riskPerUnit;
  const positionValue = quantity * entryPrice;

  return {
    quantity: roundQuantity(quantity),
    positionValue,
  };
};
