import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { tradeExecutions, autoTradingConfig } from '../db/schema';
import type { TradeExecution } from '../db/schema';
import { logger } from './logger';
import { positionMonitorService } from './position-monitor';

const PYRAMID_PROFIT_THRESHOLD = 0.01;
const PYRAMID_MIN_DISTANCE = 0.005;
const PYRAMID_MAX_ENTRIES = 5;
const PYRAMID_SCALE_FACTOR = 0.8;
const PYRAMID_ML_CONFIDENCE_BOOST = 1.2;

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
  maxEntries: number;
  profitThreshold: number;
  minDistance: number;
  scaleFactor: number;
  mlConfidenceBoost: number;
}

export class PyramidingService {
  private defaultConfig: PyramidConfig = {
    maxEntries: PYRAMID_MAX_ENTRIES,
    profitThreshold: PYRAMID_PROFIT_THRESHOLD,
    minDistance: PYRAMID_MIN_DISTANCE,
    scaleFactor: PYRAMID_SCALE_FACTOR,
    mlConfidenceBoost: PYRAMID_ML_CONFIDENCE_BOOST,
  };

  async evaluatePyramid(
    userId: string,
    walletId: string,
    symbol: string,
    direction: 'LONG' | 'SHORT',
    currentPrice: number,
    mlConfidence?: number,
    config?: Partial<PyramidConfig>
  ): Promise<PyramidEvaluation> {
    const pyramidConfig = { ...this.defaultConfig, ...config };

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

    const avgEntryPrice = this.calculateWeightedAvgPrice(openExecutions);
    const profitPercent = direction === 'LONG'
      ? (currentPrice - avgEntryPrice) / avgEntryPrice
      : (avgEntryPrice - currentPrice) / avgEntryPrice;

    if (profitPercent < pyramidConfig.profitThreshold) {
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

    const baseSize = this.calculateBaseSize(openExecutions);
    let scaledSize = baseSize * Math.pow(pyramidConfig.scaleFactor, openExecutions.length);

    if (mlConfidence && mlConfidence > 0.7) {
      scaledSize *= pyramidConfig.mlConfidenceBoost;
    }

    const totalExposure = this.calculateTotalExposure(openExecutions) + scaledSize * currentPrice;
    const maxPositionSize = parseFloat(tradingConfig.maxPositionSize);

    return {
      canPyramid: true,
      reason: 'Position eligible for pyramid entry',
      suggestedSize: this.roundQuantity(scaledSize),
      currentEntries: openExecutions.length,
      maxEntries: pyramidConfig.maxEntries,
      profitPercent,
      exposurePercent: (totalExposure / maxPositionSize) * 100,
    };
  }

  async calculateDynamicPositionSize(
    userId: string,
    walletId: string,
    symbol: string,
    direction: 'LONG' | 'SHORT',
    walletBalance: number,
    entryPrice: number,
    mlConfidence?: number
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

    const maxPositionSizePercent = parseFloat(tradingConfig.maxPositionSize);
    const maxTotalExposure = (walletBalance * maxPositionSizePercent * tradingConfig.maxConcurrentPositions) / 100;

    if (openExecutions.length === 0) {
      let baseSizePercent: number;

      if (mlConfidence) {
        baseSizePercent = maxPositionSizePercent * mlConfidence;
        baseSizePercent = Math.max(baseSizePercent, maxPositionSizePercent * 0.2);
        baseSizePercent = Math.min(baseSizePercent, maxPositionSizePercent);
      } else {
        baseSizePercent = maxPositionSizePercent * 0.5;
      }

      const positionValue = (walletBalance * baseSizePercent) / 100;
      const quantity = positionValue / entryPrice;

      return {
        quantity: this.roundQuantity(quantity),
        sizePercent: baseSizePercent,
        reason: `Initial entry: ${baseSizePercent.toFixed(1)}% position (ML confidence: ${mlConfidence ? (mlConfidence * 100).toFixed(0) + '%' : 'N/A'})`,
      };
    }

    const currentExposure = this.calculateTotalExposure(openExecutions);
    const remainingCapacity = maxTotalExposure - currentExposure;

    if (remainingCapacity <= 0) {
      return {
        quantity: 0,
        sizePercent: 0,
        reason: 'Maximum exposure reached',
      };
    }

    const avgEntryPrice = this.calculateWeightedAvgPrice(openExecutions);
    let currentPrice: number;

    try {
      currentPrice = await positionMonitorService.getCurrentPrice(symbol);
    } catch {
      currentPrice = entryPrice;
    }

    const profitPercent = direction === 'LONG'
      ? (currentPrice - avgEntryPrice) / avgEntryPrice
      : (avgEntryPrice - currentPrice) / avgEntryPrice;

    if (profitPercent < PYRAMID_PROFIT_THRESHOLD) {
      return {
        quantity: 0,
        sizePercent: 0,
        reason: `Position not in profit (${(profitPercent * 100).toFixed(2)}%), waiting for ${(PYRAMID_PROFIT_THRESHOLD * 100).toFixed(1)}%`,
      };
    }

    const baseQuantity = parseFloat(openExecutions[0]?.quantity || '0');
    let pyramidSize = baseQuantity * Math.pow(PYRAMID_SCALE_FACTOR, openExecutions.length);

    if (mlConfidence) {
      pyramidSize *= mlConfidence;
      pyramidSize = Math.max(pyramidSize, baseQuantity * 0.2);
    }

    const pyramidValue = pyramidSize * entryPrice;
    const maxPyramidValue = Math.min(pyramidValue, remainingCapacity);
    const finalQuantity = maxPyramidValue / entryPrice;
    const sizePercent = (maxPyramidValue / walletBalance) * 100;

    return {
      quantity: this.roundQuantity(finalQuantity),
      sizePercent,
      reason: `Pyramid entry #${openExecutions.length + 1}: ${sizePercent.toFixed(1)}% (profit: ${(profitPercent * 100).toFixed(2)}%, ML: ${mlConfidence ? (mlConfidence * 100).toFixed(0) + '%' : 'N/A'})`,
    };
  }

  async adjustStopLossForPyramid(
    executions: TradeExecution[],
    direction: 'LONG' | 'SHORT'
  ): Promise<number | null> {
    if (executions.length < 2) return null;

    const avgEntryPrice = this.calculateWeightedAvgPrice(executions);

    const breakevenBuffer = direction === 'LONG' ? 1.002 : 0.998;
    const newStopLoss = avgEntryPrice * breakevenBuffer;

    const currentStops = executions
      .filter(e => e.stopLoss)
      .map(e => parseFloat(e.stopLoss!));

    if (currentStops.length === 0) return newStopLoss;

    const currentConsolidatedSL = direction === 'LONG'
      ? Math.max(...currentStops)
      : Math.min(...currentStops);

    const shouldUpdate = direction === 'LONG'
      ? newStopLoss > currentConsolidatedSL
      : newStopLoss < currentConsolidatedSL;

    if (shouldUpdate) {
      logger.info({
        direction,
        avgEntryPrice,
        oldStopLoss: currentConsolidatedSL,
        newStopLoss,
        entries: executions.length,
      }, 'Adjusting stop loss for pyramid position');

      return newStopLoss;
    }

    return null;
  }

  private calculateWeightedAvgPrice(executions: TradeExecution[]): number {
    let totalValue = 0;
    let totalQuantity = 0;

    for (const exec of executions) {
      const price = parseFloat(exec.entryPrice);
      const qty = parseFloat(exec.quantity);
      totalValue += price * qty;
      totalQuantity += qty;
    }

    return totalQuantity > 0 ? totalValue / totalQuantity : 0;
  }

  private calculateTotalExposure(executions: TradeExecution[]): number {
    return executions.reduce((sum, exec) => {
      const price = parseFloat(exec.entryPrice);
      const qty = parseFloat(exec.quantity);
      return sum + price * qty;
    }, 0);
  }

  private calculateBaseSize(executions: TradeExecution[]): number {
    if (executions.length === 0) return 0;

    const firstEntry = executions.sort((a, b) =>
      new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime()
    )[0];

    return parseFloat(firstEntry?.quantity || '0');
  }

  private roundQuantity(quantity: number): number {
    if (quantity < 1) {
      return Math.floor(quantity * 100000) / 100000;
    }
    if (quantity < 10) {
      return Math.floor(quantity * 1000) / 1000;
    }
    return Math.floor(quantity * 100) / 100;
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
    const avgEntryPrice = this.calculateWeightedAvgPrice(executions);
    const totalExposure = this.calculateTotalExposure(executions);
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
