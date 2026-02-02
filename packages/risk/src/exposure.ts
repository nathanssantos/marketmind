import type { ExposureConfig, ExposureCalculation, PositionLike, OrderSizeValidation } from './types';

export const calculateDynamicExposure = (
  walletBalance: number,
  _activeWatchersCount: number,
  config: ExposureConfig
): ExposureCalculation => {
  const { positionSizePercent, maxConcurrentPositions } = config;

  const exposurePerWatcher = positionSizePercent;
  const maxPositionValue = (walletBalance * positionSizePercent) / 100;
  const maxTotalExposure = (walletBalance * positionSizePercent * maxConcurrentPositions) / 100;

  return { exposurePerWatcher, maxPositionValue, maxTotalExposure };
};

export const calculatePositionExposure = (positions: PositionLike[]): number => {
  return positions.reduce((total, position) => {
    return total + position.entryPrice * position.quantity;
  }, 0);
};

export const calculateMaxPositionValue = (
  walletBalance: number,
  maxPositionSizePercent: number
): number => {
  return (walletBalance * maxPositionSizePercent) / 100;
};

export const calculateMaxTotalExposure = (
  walletBalance: number,
  maxPositionSizePercent: number,
  maxConcurrentPositions: number
): number => {
  return (walletBalance * maxPositionSizePercent * maxConcurrentPositions) / 100;
};

export const calculateMaxDailyLoss = (
  walletBalance: number,
  dailyLossLimitPercent: number
): number => {
  return (walletBalance * dailyLossLimitPercent) / 100;
};

export const calculateDrawdownPercent = (
  initialBalance: number,
  currentBalance: number
): number => {
  if (initialBalance <= 0) return 0;
  return ((initialBalance - currentBalance) / initialBalance) * 100;
};

export const validateOrderSizePure = (
  walletBalance: number,
  orderValue: number,
  maxPositionSizePercent: number
): OrderSizeValidation => {
  const maxAllowed = (walletBalance * maxPositionSizePercent) / 100;

  if (orderValue > maxAllowed) {
    return {
      isValid: false,
      reason: `Order size ${orderValue.toFixed(2)} exceeds maximum ${maxAllowed.toFixed(2)}`,
      maxAllowed,
    };
  }

  return { isValid: true, maxAllowed };
};

export const calculateExposureUtilization = (
  totalValue: number,
  maxAllowed: number
): number => {
  return maxAllowed > 0 ? (totalValue / maxAllowed) * 100 : 0;
};

export const canOpenNewPosition = (
  currentExposure: number,
  positionValue: number,
  maxTotalExposure: number
): { allowed: boolean; reason?: string } => {
  if (currentExposure + positionValue > maxTotalExposure) {
    return {
      allowed: false,
      reason: `Total exposure ${(currentExposure + positionValue).toFixed(2)} would exceed max ${maxTotalExposure.toFixed(2)}`,
    };
  }
  return { allowed: true };
};
