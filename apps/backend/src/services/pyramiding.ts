import { serializeError } from '../utils/errors';
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import type { TradeExecution } from '../db/schema';
import { autoTradingConfig, tradeExecutions } from '../db/schema';
import { logger } from './logger';
import { positionMonitorService } from './position-monitor';

export interface ExecutionLike {
  entryPrice: string;
  quantity: string;
  side?: string | null;
  openedAt: Date;
  stopLoss?: string | null;
}

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

export interface PyramidEvaluation {
  canPyramid: boolean;
  reason: string;
  suggestedSize: number;
  currentEntries: number;
  maxEntries: number;
  profitPercent: number;
  exposurePercent: number;
}

export interface PyramidConfig {
  profitThreshold: number;
  minDistance: number;
  maxEntries: number;
  scaleFactor: number;
  mlConfidenceBoost: number;
}

export const DEFAULT_PYRAMIDING_CONFIG: PyramidConfig = {
  profitThreshold: 0.01,
  minDistance: 0.005,
  maxEntries: 5,
  scaleFactor: 0.8,
  mlConfidenceBoost: 1.2,
};

export class PyramidingService {
  private config: PyramidConfig;

  constructor(config?: Partial<PyramidConfig>) {
    this.config = { ...DEFAULT_PYRAMIDING_CONFIG, ...config };
  }

  updateConfig(config: Partial<PyramidConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): PyramidConfig {
    return { ...this.config };
  }

  async evaluatePyramid(
    userId: string,
    walletId: string,
    symbol: string,
    direction: 'LONG' | 'SHORT',
    currentPrice: number,
    mlConfidence?: number,
    config?: Partial<PyramidConfig>
  ): Promise<PyramidEvaluation> {
    const pyramidConfig = { ...this.config, ...config };

    const openExecutions = await db
      .select()
      .from(tradeExecutions)
      .where(
        and(
          eq(tradeExecutions.userId, userId),
          eq(tradeExecutions.walletId, walletId),
          eq(tradeExecutions.symbol, symbol),
          eq(tradeExecutions.side, direction),
          eq(tradeExecutions.status, 'open')
        )
      );

    if (openExecutions.length === 0) {
      return {
        canPyramid: false,
        reason: 'No existing position to pyramid into',
        suggestedSize: 0,
        currentEntries: 0,
        maxEntries: pyramidConfig.maxEntries,
        profitPercent: 0,
        exposurePercent: 0,
      };
    }

    if (openExecutions.length >= pyramidConfig.maxEntries) {
      logger.debug({
        symbol,
        direction,
        currentEntries: openExecutions.length,
        maxEntries: pyramidConfig.maxEntries,
      }, '[Pyramiding] Rejected: maximum entries reached');
      return {
        canPyramid: false,
        reason: `Maximum entries reached (${pyramidConfig.maxEntries})`,
        suggestedSize: 0,
        currentEntries: openExecutions.length,
        maxEntries: pyramidConfig.maxEntries,
        profitPercent: 0,
        exposurePercent: 0,
      };
    }

    const avgEntryPrice = calculateWeightedAvgPrice(openExecutions);
    const profitPercent = direction === 'LONG'
      ? (currentPrice - avgEntryPrice) / avgEntryPrice
      : (avgEntryPrice - currentPrice) / avgEntryPrice;

    if (profitPercent < pyramidConfig.profitThreshold) {
      logger.debug({
        symbol,
        direction,
        currentProfit: (profitPercent * 100).toFixed(2),
        requiredProfit: (pyramidConfig.profitThreshold * 100).toFixed(2),
      }, '[Pyramiding] Rejected: insufficient profit');
      return {
        canPyramid: false,
        reason: `Position not in sufficient profit (${(profitPercent * 100).toFixed(2)}% < ${(pyramidConfig.profitThreshold * 100).toFixed(2)}%)`,
        suggestedSize: 0,
        currentEntries: openExecutions.length,
        maxEntries: pyramidConfig.maxEntries,
        profitPercent,
        exposurePercent: 0,
      };
    }

    const lastEntry = openExecutions.sort((a, b) =>
      new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime()
    )[0];

    if (lastEntry) {
      const lastEntryPrice = parseFloat(lastEntry.entryPrice);
      const distanceFromLast = Math.abs(currentPrice - lastEntryPrice) / lastEntryPrice;

      if (distanceFromLast < pyramidConfig.minDistance) {
        return {
          canPyramid: false,
          reason: `Too close to last entry (${(distanceFromLast * 100).toFixed(2)}% < ${(pyramidConfig.minDistance * 100).toFixed(2)}%)`,
          suggestedSize: 0,
          currentEntries: openExecutions.length,
          maxEntries: pyramidConfig.maxEntries,
          profitPercent,
          exposurePercent: 0,
        };
      }
    }

    const [tradingConfig] = await db
      .select()
      .from(autoTradingConfig)
      .where(
        and(
          eq(autoTradingConfig.userId, userId),
          eq(autoTradingConfig.walletId, walletId)
        )
      );

    if (!tradingConfig) {
      return {
        canPyramid: false,
        reason: 'No trading configuration found',
        suggestedSize: 0,
        currentEntries: openExecutions.length,
        maxEntries: pyramidConfig.maxEntries,
        profitPercent,
        exposurePercent: 0,
      };
    }

    const baseSize = calculateBaseSize(openExecutions);
    let scaledSize = baseSize * Math.pow(pyramidConfig.scaleFactor, openExecutions.length);

    if (mlConfidence && mlConfidence > 0.7) {
      scaledSize *= pyramidConfig.mlConfidenceBoost;
    }

    const totalExposure = calculateTotalExposure(openExecutions) + scaledSize * currentPrice;
    const maxPositionSize = parseFloat(tradingConfig.maxPositionSize);

    const result = {
      canPyramid: true,
      reason: 'Position eligible for pyramid entry',
      suggestedSize: roundQuantity(scaledSize),
      currentEntries: openExecutions.length,
      maxEntries: pyramidConfig.maxEntries,
      profitPercent,
      exposurePercent: (totalExposure / maxPositionSize) * 100,
    };

    logger.info({
      symbol,
      direction,
      entryNumber: openExecutions.length + 1,
      suggestedSize: result.suggestedSize,
      profitPercent: (profitPercent * 100).toFixed(2),
      exposurePercent: result.exposurePercent.toFixed(1),
      avgEntryPrice: avgEntryPrice.toFixed(6),
      currentPrice,
    }, '[Pyramiding] Entry approved');

    return result;
  }

  async calculateDynamicPositionSize(
    userId: string,
    walletId: string,
    symbol: string,
    direction: 'LONG' | 'SHORT',
    walletBalance: number,
    entryPrice: number,
    _mlConfidence?: number,
    activeWatchersCount?: number
  ): Promise<{ quantity: number; sizePercent: number; reason: string }> {
    const openExecutions = await db
      .select()
      .from(tradeExecutions)
      .where(
        and(
          eq(tradeExecutions.userId, userId),
          eq(tradeExecutions.walletId, walletId),
          eq(tradeExecutions.symbol, symbol),
          eq(tradeExecutions.side, direction),
          eq(tradeExecutions.status, 'open')
        )
      );

    const allOpenPositions = await db
      .select()
      .from(tradeExecutions)
      .where(
        and(
          eq(tradeExecutions.userId, userId),
          eq(tradeExecutions.walletId, walletId),
          eq(tradeExecutions.status, 'open')
        )
      );

    const [tradingConfig] = await db
      .select()
      .from(autoTradingConfig)
      .where(
        and(
          eq(autoTradingConfig.userId, userId),
          eq(autoTradingConfig.walletId, walletId)
        )
      );

    if (!tradingConfig) {
      return {
        quantity: 0,
        sizePercent: 0,
        reason: 'No trading configuration found',
      };
    }

    const configMaxPositionSize = parseFloat(tradingConfig.maxPositionSize);
    const exposureMultiplier = parseFloat(tradingConfig.exposureMultiplier);

    let maxPositionSizePercent: number;
    if (activeWatchersCount && activeWatchersCount > 0) {
      maxPositionSizePercent = Math.min((100 * exposureMultiplier) / activeWatchersCount, 100);
    } else {
      maxPositionSizePercent = configMaxPositionSize;
    }

    const maxTotalExposure = activeWatchersCount && activeWatchersCount > 0
      ? walletBalance
      : (walletBalance * configMaxPositionSize * tradingConfig.maxConcurrentPositions) / 100;

    const totalWalletExposure = calculateTotalExposure(allOpenPositions);
    const remainingBalance = Math.max(0, walletBalance - totalWalletExposure);

    if (openExecutions.length === 0) {
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
        return {
          quantity: 0,
          sizePercent: 0,
          reason: 'No remaining balance available (100% exposure reached)',
        };
      }

      const quantity = positionValue / entryPrice;
      const roundedQuantity = roundQuantity(quantity);
      const actualPositionValue = roundedQuantity * entryPrice;

      if (actualPositionValue > remainingBalance) {
        const adjustedQuantity = Math.floor((remainingBalance / entryPrice) * 100000) / 100000;
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
    }

    const currentExposure = calculateTotalExposure(openExecutions);
    const remainingCapacity = maxTotalExposure - currentExposure;

    if (remainingCapacity <= 0) {
      logger.info({
        symbol,
        direction,
        currentExposure: currentExposure.toFixed(2),
        maxExposure: maxTotalExposure.toFixed(2),
      }, '[Pyramiding] Maximum exposure reached');
      return {
        quantity: 0,
        sizePercent: 0,
        reason: 'Maximum exposure reached',
      };
    }

    const avgEntryPrice = calculateWeightedAvgPrice(openExecutions);
    let currentPrice: number;
    const marketType = openExecutions[0]?.marketType === 'FUTURES' ? 'FUTURES' : 'SPOT';

    try {
      currentPrice = await positionMonitorService.getCurrentPrice(symbol, marketType);
    } catch (error) {
      logger.warn({
        symbol,
        marketType,
        error: serializeError(error),
      }, 'Failed to get current price for pyramiding, using entry price');
      currentPrice = entryPrice;
    }

    const profitPercent = direction === 'LONG'
      ? (currentPrice - avgEntryPrice) / avgEntryPrice
      : (avgEntryPrice - currentPrice) / avgEntryPrice;

    if (profitPercent < this.config.profitThreshold) {
      return {
        quantity: 0,
        sizePercent: 0,
        reason: `Position not in profit (${(profitPercent * 100).toFixed(2)}%), waiting for ${(this.config.profitThreshold * 100).toFixed(1)}%`,
      };
    }

    const baseQuantity = parseFloat(openExecutions[0]?.quantity || '0');
    const pyramidSize = baseQuantity * Math.pow(this.config.scaleFactor, openExecutions.length);

    const pyramidValue = pyramidSize * entryPrice;
    const maxPyramidValue = Math.min(pyramidValue, remainingCapacity);
    const finalQuantity = maxPyramidValue / entryPrice;
    const sizePercent = (maxPyramidValue / walletBalance) * 100;

    return {
      quantity: roundQuantity(finalQuantity),
      sizePercent,
      reason: `Pyramid entry #${openExecutions.length + 1}: ${sizePercent.toFixed(1)}% (profit: ${(profitPercent * 100).toFixed(2)}%)`,
    };
  }

  getExposureSummary(
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
  } {
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
  }
}

export const pyramidingService = new PyramidingService();
