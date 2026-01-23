export interface SimplePositionResult {
  quantity: number;
  positionValue: number;
}

export const roundQuantity = (quantity: number): number => {
  if (quantity < 1) return Math.floor(quantity * 100000) / 100000;
  if (quantity < 10) return Math.floor(quantity * 1000) / 1000;
  return Math.floor(quantity * 100) / 100;
};

export const calculateFixedPositionSize = (
  equity: number,
  entryPrice: number,
  percentOfEquity: number
): SimplePositionResult => {
  const positionValue = (equity * percentOfEquity) / 100;
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
): SimplePositionResult => {
  const riskAmount = (equity * riskPercent) / 100;
  const riskPerUnit = Math.abs(entryPrice - stopLoss);

  if (riskPerUnit <= 0) return { quantity: 0, positionValue: 0 };

  const quantity = riskAmount / riskPerUnit;
  const positionValue = quantity * entryPrice;

  return {
    quantity: roundQuantity(quantity),
    positionValue,
  };
};

export const calculateMaxPositionValue = (
  equity: number,
  maxPositionSizePercent: number
): number => (equity * maxPositionSizePercent) / 100;
