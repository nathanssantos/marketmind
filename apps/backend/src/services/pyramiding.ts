import { calculateDynamicExposure } from '@marketmind/risk';
import type { Kline } from '@marketmind/types';
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import type { AutoTradingConfig, TradeExecution } from '../db/schema';
import { autoTradingConfig, tradeExecutions } from '../db/schema';
import { serializeError } from '../utils/errors';
import {
    prioritizePyramidCandidates as prioritizeCandidatesByAdx,
    type DynamicPyramidEvaluation,
    type PyramidCandidate,
} from './dynamic-pyramid-evaluator';
import {
    clearFiboState,
    initializeFiboState,
    type FiboLevel,
    type FiboPyramidEvaluation,
} from './fibonacci-pyramid-evaluator';
import { logger } from './logger';
import { getMinNotionalFilterService } from './min-notional-filter';

import {
    calculateBaseSize,
    calculateInitialPositionSize,
    calculateTotalExposure,
    calculateWeightedAvgPrice,
    DEFAULT_PYRAMIDING_CONFIG,
    getExposureSummary,
    logPyramidDecision,
    roundQuantity,
    type PyramidConfig,
    type PyramidEvaluation,
} from './pyramid-calculations';
import {
    evaluateDynamicPyramid,
    evaluateFibonacciPyramid,
} from './pyramid-mode-evaluators';
import { positionMonitorService } from './position-monitor';

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
      logger.trace({
        symbol, direction,
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
      logger.trace({
        symbol, direction,
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

    logPyramidDecision('APPROVED', symbol, direction, {
      Mode: 'static',
      'Entry #': `${openExecutions.length + 1}/${pyramidConfig.maxEntries}`,
      'Avg Entry': avgEntryPrice.toFixed(4),
      'Current Price': currentPrice.toFixed(4),
      'Profit %': `${(profitPercent * 100).toFixed(2)}%`,
      'Base Size': baseSize.toFixed(6),
      'Scale Factor': pyramidConfig.scaleFactor.toFixed(2),
      'ML Boost': mlConfidence && mlConfidence > 0.7 ? `${pyramidConfig.mlConfidenceBoost.toFixed(2)}x` : 'N/A',
      'Pyramid Size': result.suggestedSize.toFixed(6),
      'Exposure %': `${result.exposurePercent.toFixed(1)}%`,
    });

    logger.info({
      symbol, direction,
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
    activeWatchersCount?: number,
    marketType: 'SPOT' | 'FUTURES' = 'FUTURES'
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
      return { quantity: 0, sizePercent: 0, reason: 'No trading configuration found' };
    }

    const configMaxPositionSize = parseFloat(tradingConfig.maxPositionSize);
    const configPositionSizePercent = parseFloat(tradingConfig.positionSizePercent);

    const { exposurePerWatcher, maxTotalExposure } = calculateDynamicExposure(
      walletBalance,
      activeWatchersCount ?? 0,
      {
        positionSizePercent: configPositionSizePercent,
        maxPositionSizePercent: configMaxPositionSize,
        maxConcurrentPositions: tradingConfig.maxConcurrentPositions,
      }
    );
    const maxPositionSizePercent = exposurePerWatcher;

    const totalWalletExposure = calculateTotalExposure(allOpenPositions);
    const remainingBalance = Math.max(0, walletBalance - totalWalletExposure);

    if (openExecutions.length === 0) {
      return calculateInitialPositionSize(
        symbol, walletBalance, entryPrice, maxPositionSizePercent,
        remainingBalance, totalWalletExposure, activeWatchersCount, marketType
      );
    }

    const currentExposure = calculateTotalExposure(openExecutions);
    const remainingCapacity = maxTotalExposure - currentExposure;

    if (remainingCapacity <= 0) {
      logger.info({
        symbol, direction,
        currentExposure: currentExposure.toFixed(2),
        maxExposure: maxTotalExposure.toFixed(2),
      }, '[Pyramiding] Maximum exposure reached');
      return { quantity: 0, sizePercent: 0, reason: 'Maximum exposure reached' };
    }

    const avgEntryPrice = calculateWeightedAvgPrice(openExecutions);
    let currentPrice: number;

    try {
      currentPrice = await positionMonitorService.getCurrentPrice(symbol, marketType);
    } catch (error) {
      logger.warn({
        symbol, marketType,
        error: serializeError(error),
      }, 'Failed to get current price for pyramiding, using entry price');
      currentPrice = entryPrice;
    }

    const profitPercent = direction === 'LONG'
      ? (currentPrice - avgEntryPrice) / avgEntryPrice
      : (avgEntryPrice - currentPrice) / avgEntryPrice;

    if (profitPercent < this.config.profitThreshold) {
      return {
        quantity: 0, sizePercent: 0,
        reason: `Position not in profit (${(profitPercent * 100).toFixed(2)}%), waiting for ${(this.config.profitThreshold * 100).toFixed(1)}%`,
      };
    }

    const baseQuantity = parseFloat(openExecutions[0]?.quantity || '0');
    const pyramidSize = baseQuantity * Math.pow(this.config.scaleFactor, openExecutions.length);

    const pyramidValue = pyramidSize * entryPrice;
    const maxPyramidValue = Math.min(pyramidValue, remainingCapacity);
    const finalQuantity = maxPyramidValue / entryPrice;
    const roundedFinalQuantity = roundQuantity(finalQuantity);

    const minNotionalFilter = getMinNotionalFilterService();
    const pyramidValidation = await minNotionalFilter.validateQuantityAgainstMinQty(
      symbol, roundedFinalQuantity, entryPrice, marketType
    );

    if (!pyramidValidation.isValid) {
      logger.warn({
        symbol, quantity: roundedFinalQuantity, entryPrice,
        minQty: pyramidValidation.minQty,
        pyramidEntry: openExecutions.length + 1,
      }, `[Pyramiding] ${pyramidValidation.reason}`);
      return { quantity: 0, sizePercent: 0, reason: pyramidValidation.reason ?? 'Pyramid quantity below minimum' };
    }

    const sizePercent = (maxPyramidValue / walletBalance) * 100;

    return {
      quantity: roundedFinalQuantity,
      sizePercent,
      reason: `Pyramid entry #${openExecutions.length + 1}: ${sizePercent.toFixed(1)}% (profit: ${(profitPercent * 100).toFixed(2)}%)`,
    };
  }

  getExposureSummary(
    executions: TradeExecution[],
    currentPrice: number,
    walletBalance: number
  ) {
    return getExposureSummary(executions, currentPrice, walletBalance);
  }

  async evaluatePyramidByMode(
    userId: string,
    walletId: string,
    symbol: string,
    direction: 'LONG' | 'SHORT',
    currentPrice: number,
    klines: Kline[],
    stopLoss: number | null,
    mlConfidence?: number
  ): Promise<PyramidEvaluation> {
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
        currentEntries: 0,
        maxEntries: this.config.maxEntries,
        profitPercent: 0,
        exposurePercent: 0,
        mode: 'static',
      };
    }

    const pyramidConfig = this.buildPyramidConfigFromDb(tradingConfig);

    if (!tradingConfig.pyramidingEnabled) {
      return {
        canPyramid: false,
        reason: 'Pyramiding is disabled',
        suggestedSize: 0,
        currentEntries: 0,
        maxEntries: pyramidConfig.maxEntries,
        profitPercent: 0,
        exposurePercent: 0,
        mode: pyramidConfig.mode,
      };
    }

    switch (pyramidConfig.mode) {
      case 'dynamic':
        return evaluateDynamicPyramid(
          (u, w, s, d, p, m, c) => this.evaluatePyramid(u, w, s, d, p, m, c),
          userId, walletId, symbol, direction, currentPrice, klines, pyramidConfig, mlConfidence
        );
      case 'fibonacci':
        return evaluateFibonacciPyramid(userId, walletId, symbol, direction, currentPrice, stopLoss, pyramidConfig, mlConfidence);
      default:
        return this.evaluatePyramid(userId, walletId, symbol, direction, currentPrice, mlConfidence, pyramidConfig);
    }
  }

  buildPyramidConfigFromDb(tradingConfig: AutoTradingConfig): PyramidConfig {
    let fiboLevels: FiboLevel[] = ['1', '1.272', '1.618'];
    try {
      if (tradingConfig.pyramidFiboLevels) {
        const parsed = JSON.parse(tradingConfig.pyramidFiboLevels);
        if (Array.isArray(parsed)) {
          fiboLevels = parsed as FiboLevel[];
        }
      }
    } catch {
      logger.warn('Failed to parse pyramidFiboLevels, using defaults');
    }

    return {
      profitThreshold: parseFloat(tradingConfig.pyramidProfitThreshold),
      minDistance: parseFloat(tradingConfig.pyramidMinDistance),
      maxEntries: tradingConfig.maxPyramidEntries,
      scaleFactor: parseFloat(tradingConfig.pyramidScaleFactor),
      mlConfidenceBoost: this.config.mlConfidenceBoost,
      mode: tradingConfig.pyramidingMode,
      useAtr: tradingConfig.pyramidUseAtr,
      useAdx: tradingConfig.pyramidUseAdx,
      useRsi: tradingConfig.pyramidUseRsi,
      adxThreshold: tradingConfig.pyramidAdxThreshold,
      rsiLowerBound: tradingConfig.pyramidRsiLowerBound,
      rsiUpperBound: tradingConfig.pyramidRsiUpperBound,
      fiboLevels,
      leverage: tradingConfig.leverage ?? 1,
      leverageAware: tradingConfig.leverageAwarePyramid,
    };
  }

  initializeFiboTracking(symbol: string, direction: 'LONG' | 'SHORT', entryPrice: number): void {
    initializeFiboState(symbol, direction, entryPrice);
  }

  clearFiboTracking(symbol: string, direction: 'LONG' | 'SHORT'): void {
    clearFiboState(symbol, direction);
  }
}

export const pyramidingService = new PyramidingService();

export { prioritizeCandidatesByAdx as prioritizePyramidCandidates };
export type { DynamicPyramidEvaluation, FiboPyramidEvaluation, PyramidCandidate };
export {
  calculateWeightedAvgPrice,
  calculateTotalExposure,
  calculateBaseSize,
  roundQuantity,
  calculatePyramidProfitPercent,
  calculatePyramidSize,
  DEFAULT_PYRAMIDING_CONFIG,
} from './pyramid-calculations';
export type { ExecutionLike, PyramidEvaluation, PyramidConfig } from './pyramid-calculations';
