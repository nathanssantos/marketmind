import { colorize } from '@marketmind/logger';
import type { TradeExecution } from '../db/schema';
import type { FiboLevel } from './fibonacci-pyramid-evaluator';
import { logger } from './logger';
import { getMinNotionalFilterService } from './min-notional-filter';

export interface ExecutionLike {
  entryPrice: string;
  quantity: string;
  side?: string | null;
  openedAt: Date;
  stopLoss?: string | null;
}

export interface PyramidEvaluation {
  canPyramid: boolean;
  reason: string;
  suggestedSize: number;
  currentEntries: number;
  maxEntries: number;
  profitPercent: number;
  exposurePercent: number;
  adxValue?: number | null;
  mode?: 'static' | 'dynamic' | 'fibonacci';
  adjustedScaleFactor?: number;
  adjustedMinDistance?: number;
  fiboTriggerLevel?: string | null;
}

export interface PyramidConfig {
  profitThreshold: number;
  minDistance: number;
  maxEntries: number;
  scaleFactor: number;
  mlConfidenceBoost: number;
  mode: 'static' | 'dynamic' | 'fibonacci';
  useAtr: boolean;
  useAdx: boolean;
  useRsi: boolean;
  adxThreshold: number;
  rsiLowerBound: number;
  rsiUpperBound: number;
  fiboLevels: FiboLevel[];
  leverage: number;
  leverageAware: boolean;
}

export const DEFAULT_PYRAMIDING_CONFIG: PyramidConfig = {
  profitThreshold: 0.01,
  minDistance: 0.005,
  maxEntries: 5,
  scaleFactor: 0.8,
  mlConfidenceBoost: 1.2,
  mode: 'static',
  useAtr: true,
  useAdx: true,
  useRsi: false,
  adxThreshold: 25,
  rsiLowerBound: 40,
  rsiUpperBound: 60,
  fiboLevels: ['1', '1.272', '1.618'],
  leverage: 1,
  leverageAware: true,
};

export const calculateWeightedAvgPrice = (executions: ExecutionLike[]): number => {
  let totalValue = 0;
  let totalQuantity = 0;

  for (const exec of executions) {
    const price = parseFloat(exec.entryPrice);
    const qty = parseFloat(exec.quantity);
    totalValue += price * qty;
    totalQuantity += qty;
  }

  return totalQuantity > 0 ? totalValue / totalQuantity : 0;
};

export const calculateTotalExposure = (executions: ExecutionLike[]): number => {
  return executions.reduce((sum, exec) => {
    const price = parseFloat(exec.entryPrice);
    const qty = parseFloat(exec.quantity);
    return sum + price * qty;
  }, 0);
};

export const calculateBaseSize = (executions: ExecutionLike[]): number => {
  if (executions.length === 0) return 0;

  const sorted = [...executions].sort(
    (a, b) => new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime()
  );

  return parseFloat(sorted[0]?.quantity || '0');
};

export const roundQuantity = (quantity: number): number => {
  if (quantity < 1) {
    return Math.floor(quantity * 100000) / 100000;
  }
  if (quantity < 10) {
    return Math.floor(quantity * 1000) / 1000;
  }
  return Math.floor(quantity * 100) / 100;
};

export const calculatePyramidProfitPercent = (
  avgEntryPrice: number,
  currentPrice: number,
  direction: 'LONG' | 'SHORT'
): number => {
  return direction === 'LONG'
    ? (currentPrice - avgEntryPrice) / avgEntryPrice
    : (avgEntryPrice - currentPrice) / avgEntryPrice;
};

export const calculatePyramidSize = (
  baseSize: number,
  entryCount: number,
  scaleFactor: number,
  mlConfidence?: number,
  mlConfidenceBoost: number = 1.2
): number => {
  let scaledSize = baseSize * Math.pow(scaleFactor, entryCount);

  if (mlConfidence && mlConfidence > 0.7) {
    scaledSize *= mlConfidenceBoost;
  }

  return scaledSize;
};

export const logPyramidDecision = (
  action: 'EVALUATE' | 'APPROVED' | 'REJECTED',
  symbol: string,
  direction: string,
  data: Record<string, string | number | null | undefined>
): void => {
  const actionColor = action === 'APPROVED' ? 'green' : action === 'REJECTED' ? 'red' : 'cyan';
  const icon = action === 'APPROVED' ? '✓' : action === 'REJECTED' ? '✗' : '>';
  const dirColor = direction === 'LONG' ? 'green' : 'red';

  const fields = Object.entries(data)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}=${value}`)
    .join(' · ');

  console.log(`  ${colorize(icon, actionColor)} ${colorize(`pyramid ${action.toLowerCase()}`, actionColor)} · ${colorize(symbol, 'bright')} ${colorize(direction, dirColor)} · ${colorize(fields, 'dim')}`);
};

export const getExposureSummary = (
  executions: TradeExecution[],
  currentPrice: number,
  walletBalance: number
): {
  totalQuantity: number;
  avgEntryPrice: number;
  totalExposure: number;
  exposurePercent: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
} => {
  if (executions.length === 0) {
    return {
      totalQuantity: 0,
      avgEntryPrice: 0,
      totalExposure: 0,
      exposurePercent: 0,
      unrealizedPnL: 0,
      unrealizedPnLPercent: 0,
    };
  }

  const totalQuantity = executions.reduce((sum, e) => sum + parseFloat(e.quantity), 0);
  const avgEntryPrice = calculateWeightedAvgPrice(executions);
  const totalExposure = calculateTotalExposure(executions);
  const direction = executions[0]?.side;

  const unrealizedPnL = direction === 'LONG'
    ? (currentPrice - avgEntryPrice) * totalQuantity
    : (avgEntryPrice - currentPrice) * totalQuantity;

  const unrealizedPnLPercent = (unrealizedPnL / totalExposure) * 100;

  return {
    totalQuantity,
    avgEntryPrice,
    totalExposure,
    exposurePercent: (totalExposure / walletBalance) * 100,
    unrealizedPnL,
    unrealizedPnLPercent,
  };
};

export const calculateInitialPositionSize = async (
  symbol: string,
  walletBalance: number,
  entryPrice: number,
  maxPositionSizePercent: number,
  remainingBalance: number,
  totalWalletExposure: number,
  activeWatchersCount?: number,
  marketType: 'SPOT' | 'FUTURES' = 'FUTURES'
): Promise<{ quantity: number; sizePercent: number; reason: string }> => {
  let positionValue = (walletBalance * maxPositionSizePercent) / 100;

  if (positionValue > remainingBalance && remainingBalance > 0) {
    logger.info({
      originalValue: positionValue.toFixed(2),
      adjustedValue: remainingBalance.toFixed(2),
      remainingBalance: remainingBalance.toFixed(2),
      totalExposure: totalWalletExposure.toFixed(2),
    }, 'Adjusted position value to use remaining balance');
    positionValue = remainingBalance;
  }

  if (positionValue <= 0) {
    return { quantity: 0, sizePercent: 0, reason: 'No remaining balance available (100% exposure reached)' };
  }

  const quantity = positionValue / entryPrice;
  const roundedQuantity = roundQuantity(quantity);

  const minNotionalFilter = getMinNotionalFilterService();
  const minQtyValidation = await minNotionalFilter.validateQuantityAgainstMinQty(
    symbol, roundedQuantity, entryPrice, marketType
  );

  if (!minQtyValidation.isValid) {
    logger.warn({
      symbol, quantity: roundedQuantity, entryPrice,
      minQty: minQtyValidation.minQty,
      minValue: minQtyValidation.minValue,
      positionValue, activeWatchersCount,
    }, `[Pyramiding] ${minQtyValidation.reason}`);
    return { quantity: 0, sizePercent: 0, reason: minQtyValidation.reason ?? 'Quantity below minimum' };
  }

  const actualPositionValue = roundedQuantity * entryPrice;

  if (actualPositionValue > remainingBalance) {
    const adjustedQuantity = Math.floor((remainingBalance / entryPrice) * 100000) / 100000;

    const adjustedValidation = await minNotionalFilter.validateQuantityAgainstMinQty(
      symbol, adjustedQuantity, entryPrice, marketType
    );

    if (!adjustedValidation.isValid) {
      return { quantity: 0, sizePercent: 0, reason: adjustedValidation.reason ?? 'Adjusted quantity below minimum' };
    }

    const adjustedValue = adjustedQuantity * entryPrice;
    const sizePercent = (adjustedValue / walletBalance) * 100;

    return {
      quantity: adjustedQuantity,
      sizePercent,
      reason: `Initial entry: ${sizePercent.toFixed(1)}% position (adjusted to fit remaining balance)`,
    };
  }

  const sizePercent = (actualPositionValue / walletBalance) * 100;

  return {
    quantity: roundedQuantity,
    sizePercent,
    reason: `Initial entry: ${sizePercent.toFixed(1)}% position (${activeWatchersCount ? `${activeWatchersCount} watchers` : 'config limit'})`,
  };
};
