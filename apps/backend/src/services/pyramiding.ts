import { colorize } from '@marketmind/logger';
import { calculateDynamicExposure } from '@marketmind/risk';
import type { Kline } from '@marketmind/types';
import { TRADING_DEFAULTS } from '@marketmind/types';
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import type { AutoTradingConfig, TradeExecution } from '../db/schema';
import { autoTradingConfig, tradeExecutions } from '../db/schema';
import { serializeError } from '../utils/errors';
import {
    calculateLeverageAdjustedScaleFactor,
    evaluateDynamicConditions,
    prioritizePyramidCandidates as prioritizeCandidatesByAdx,
    type DynamicPyramidConfig,
    type DynamicPyramidEvaluation,
    type PyramidCandidate,
} from './dynamic-pyramid-evaluator';
import {
    clearFiboState,
    evaluateFiboPyramidTrigger,
    initializeFiboState,
    type FiboLevel,
    type FiboPyramidConfig,
    type FiboPyramidEvaluation,
} from './fibonacci-pyramid-evaluator';
import { logger } from './logger';
import { getMinNotionalFilterService } from './min-notional-filter';
import { positionMonitorService } from './position-monitor';

const logPyramidDecision = (
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
      logger.trace({
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
      return {
        quantity: 0,
        sizePercent: 0,
        reason: 'No trading configuration found',
      };
    }

    const configMaxPositionSize = parseFloat(tradingConfig.maxPositionSize);

    const { exposurePerWatcher, maxTotalExposure } = calculateDynamicExposure(
      walletBalance,
      activeWatchersCount ?? 0,
      {
        positionSizePercent: TRADING_DEFAULTS.POSITION_SIZE_PERCENT,
        maxPositionSizePercent: configMaxPositionSize,
        maxConcurrentPositions: tradingConfig.maxConcurrentPositions,
      }
    );
    const maxPositionSizePercent = exposurePerWatcher;

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

      const minNotionalFilter = getMinNotionalFilterService();
      const minQtyValidation = await minNotionalFilter.validateQuantityAgainstMinQty(
        symbol,
        roundedQuantity,
        entryPrice,
        marketType
      );

      if (!minQtyValidation.isValid) {
        logger.warn({
          symbol,
          quantity: roundedQuantity,
          entryPrice,
          minQty: minQtyValidation.minQty,
          minValue: minQtyValidation.minValue,
          positionValue,
          activeWatchersCount,
        }, `[Pyramiding] ${minQtyValidation.reason}`);
        return {
          quantity: 0,
          sizePercent: 0,
          reason: minQtyValidation.reason ?? 'Quantity below minimum',
        };
      }

      const actualPositionValue = roundedQuantity * entryPrice;

      if (actualPositionValue > remainingBalance) {
        const adjustedQuantity = Math.floor((remainingBalance / entryPrice) * 100000) / 100000;

        const adjustedValidation = await minNotionalFilter.validateQuantityAgainstMinQty(
          symbol,
          adjustedQuantity,
          entryPrice,
          marketType
        );

        if (!adjustedValidation.isValid) {
          return {
            quantity: 0,
            sizePercent: 0,
            reason: adjustedValidation.reason ?? 'Adjusted quantity below minimum',
          };
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
    const roundedFinalQuantity = roundQuantity(finalQuantity);

    const minNotionalFilter = getMinNotionalFilterService();
    const pyramidValidation = await minNotionalFilter.validateQuantityAgainstMinQty(
      symbol,
      roundedFinalQuantity,
      entryPrice,
      marketType
    );

    if (!pyramidValidation.isValid) {
      logger.warn({
        symbol,
        quantity: roundedFinalQuantity,
        entryPrice,
        minQty: pyramidValidation.minQty,
        pyramidEntry: openExecutions.length + 1,
      }, `[Pyramiding] ${pyramidValidation.reason}`);
      return {
        quantity: 0,
        sizePercent: 0,
        reason: pyramidValidation.reason ?? 'Pyramid quantity below minimum',
      };
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
        return this.evaluateDynamicPyramid(
          userId,
          walletId,
          symbol,
          direction,
          currentPrice,
          klines,
          pyramidConfig,
          mlConfidence
        );
      case 'fibonacci':
        return this.evaluateFibonacciPyramid(
          userId,
          walletId,
          symbol,
          direction,
          currentPrice,
          stopLoss,
          pyramidConfig,
          mlConfidence
        );
      default:
        return this.evaluatePyramid(
          userId,
          walletId,
          symbol,
          direction,
          currentPrice,
          mlConfidence,
          pyramidConfig
        );
    }
  }

  private async evaluateDynamicPyramid(
    userId: string,
    walletId: string,
    symbol: string,
    direction: 'LONG' | 'SHORT',
    currentPrice: number,
    klines: Kline[],
    config: PyramidConfig,
    mlConfidence?: number
  ): Promise<PyramidEvaluation> {
    const dynamicConfig: DynamicPyramidConfig = {
      useAtr: config.useAtr,
      useAdx: config.useAdx,
      useRsi: config.useRsi,
      adxThreshold: config.adxThreshold,
      rsiLowerBound: config.rsiLowerBound,
      rsiUpperBound: config.rsiUpperBound,
      baseMinDistance: config.minDistance,
      baseScaleFactor: config.scaleFactor,
      leverage: config.leverage,
      leverageAware: config.leverageAware,
    };

    const dynamicEval = evaluateDynamicConditions(klines, dynamicConfig);

    if (!dynamicEval.canPyramid) {
      logPyramidDecision('REJECTED', symbol, direction, {
        Mode: 'dynamic',
        Reason: dynamicEval.reason,
        ADX: dynamicEval.adxValue?.toFixed(2) ?? 'N/A',
        'ADX Threshold': config.adxThreshold,
        RSI: dynamicEval.rsiValue?.toFixed(2) ?? 'N/A',
        'RSI Range': `${config.rsiLowerBound}-${config.rsiUpperBound}`,
        ATR: dynamicEval.atrValue?.toFixed(6) ?? 'N/A',
        'Adj Scale': dynamicEval.adjustedScaleFactor?.toFixed(3) ?? 'N/A',
        'Adj Distance': dynamicEval.adjustedMinDistance?.toFixed(4) ?? 'N/A',
      });

      return {
        canPyramid: false,
        reason: dynamicEval.reason,
        suggestedSize: 0,
        currentEntries: 0,
        maxEntries: config.maxEntries,
        profitPercent: 0,
        exposurePercent: 0,
        adxValue: dynamicEval.adxValue,
        mode: 'dynamic',
        adjustedScaleFactor: dynamicEval.adjustedScaleFactor,
        adjustedMinDistance: dynamicEval.adjustedMinDistance,
      };
    }

    const adjustedConfig: Partial<PyramidConfig> = {
      ...config,
      minDistance: dynamicEval.adjustedMinDistance,
      scaleFactor: dynamicEval.adjustedScaleFactor,
    };

    const staticEval = await this.evaluatePyramid(
      userId,
      walletId,
      symbol,
      direction,
      currentPrice,
      mlConfidence,
      adjustedConfig
    );

    if (staticEval.canPyramid) {
      logPyramidDecision('APPROVED', symbol, direction, {
        Mode: 'dynamic',
        'Entry #': `${staticEval.currentEntries + 1}/${staticEval.maxEntries}`,
        'Profit %': `${(staticEval.profitPercent * 100).toFixed(2)}%`,
        ADX: dynamicEval.adxValue?.toFixed(2) ?? 'N/A',
        RSI: dynamicEval.rsiValue?.toFixed(2) ?? 'N/A',
        ATR: dynamicEval.atrValue?.toFixed(6) ?? 'N/A',
        'Base Scale': config.scaleFactor.toFixed(2),
        'Adj Scale': dynamicEval.adjustedScaleFactor.toFixed(3),
        'Adj Distance': `${(dynamicEval.adjustedMinDistance * 100).toFixed(2)}%`,
        'Pyramid Size': staticEval.suggestedSize.toFixed(6),
        Leverage: config.leverage,
      });
    }

    return {
      ...staticEval,
      adxValue: dynamicEval.adxValue,
      mode: 'dynamic',
      adjustedScaleFactor: dynamicEval.adjustedScaleFactor,
      adjustedMinDistance: dynamicEval.adjustedMinDistance,
    };
  }

  private async evaluateFibonacciPyramid(
    userId: string,
    walletId: string,
    symbol: string,
    direction: 'LONG' | 'SHORT',
    currentPrice: number,
    stopLoss: number | null,
    config: PyramidConfig,
    _mlConfidence?: number
  ): Promise<PyramidEvaluation> {
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
        maxEntries: config.maxEntries,
        profitPercent: 0,
        exposurePercent: 0,
        mode: 'fibonacci',
      };
    }

    if (openExecutions.length >= config.maxEntries) {
      return {
        canPyramid: false,
        reason: `Maximum entries reached (${config.maxEntries})`,
        suggestedSize: 0,
        currentEntries: openExecutions.length,
        maxEntries: config.maxEntries,
        profitPercent: 0,
        exposurePercent: 0,
        mode: 'fibonacci',
      };
    }

    const avgEntryPrice = calculateWeightedAvgPrice(openExecutions);
    const effectiveStopLoss = stopLoss ?? parseFloat(openExecutions[0]?.stopLoss ?? '0');

    if (effectiveStopLoss === 0) {
      return {
        canPyramid: false,
        reason: 'Stop loss required for Fibonacci pyramid mode',
        suggestedSize: 0,
        currentEntries: openExecutions.length,
        maxEntries: config.maxEntries,
        profitPercent: 0,
        exposurePercent: 0,
        mode: 'fibonacci',
      };
    }

    const fiboConfig: FiboPyramidConfig = {
      enabledLevels: config.fiboLevels,
      leverage: config.leverage,
      leverageAware: config.leverageAware,
      baseScaleFactor: config.scaleFactor,
    };

    const fiboEval = evaluateFiboPyramidTrigger(
      symbol,
      direction,
      avgEntryPrice,
      effectiveStopLoss,
      currentPrice,
      fiboConfig
    );

    const profitPercent = direction === 'LONG'
      ? (currentPrice - avgEntryPrice) / avgEntryPrice
      : (avgEntryPrice - currentPrice) / avgEntryPrice;

    if (!fiboEval.canPyramid) {
      logPyramidDecision('REJECTED', symbol, direction, {
        Mode: 'fibonacci',
        Reason: fiboEval.reason,
        'Entry #': `${openExecutions.length}/${config.maxEntries}`,
        'Avg Entry': avgEntryPrice.toFixed(4),
        'Current Price': currentPrice.toFixed(4),
        'Stop Loss': effectiveStopLoss.toFixed(4),
        'Profit %': `${(profitPercent * 100).toFixed(2)}%`,
        'Next Level': fiboEval.nextLevel ?? 'N/A',
        'Enabled Levels': config.fiboLevels.join(', '),
      });

      return {
        canPyramid: false,
        reason: fiboEval.reason,
        suggestedSize: 0,
        currentEntries: openExecutions.length,
        maxEntries: config.maxEntries,
        profitPercent,
        exposurePercent: 0,
        mode: 'fibonacci',
        fiboTriggerLevel: fiboEval.nextLevel,
      };
    }

    const scaleFactor = calculateLeverageAdjustedScaleFactor(
      config.scaleFactor,
      config.leverage,
      config.leverageAware
    );

    const baseSize = calculateBaseSize(openExecutions);
    const scaledSize = baseSize * Math.pow(scaleFactor, openExecutions.length);

    logPyramidDecision('APPROVED', symbol, direction, {
      Mode: 'fibonacci',
      'Fibo Level': fiboEval.triggerLevel ?? '-',
      'Entry #': `${openExecutions.length + 1}/${config.maxEntries}`,
      'Avg Entry': avgEntryPrice.toFixed(4),
      'Current Price': currentPrice.toFixed(4),
      'Profit %': `${(profitPercent * 100).toFixed(2)}%`,
      'Base Size': baseSize.toFixed(6),
      'Scale Factor': scaleFactor.toFixed(2),
      'Pyramid Size': roundQuantity(scaledSize).toFixed(6),
      Leverage: config.leverage,
      'Next Level': fiboEval.nextLevel ?? 'N/A',
    });

    logger.info({
      symbol,
      direction,
      fiboLevel: fiboEval.triggerLevel,
      entryNumber: openExecutions.length + 1,
      suggestedSize: roundQuantity(scaledSize),
      profitPercent: (profitPercent * 100).toFixed(2),
    }, '[Pyramiding] Fibonacci entry approved');

    return {
      canPyramid: true,
      reason: `Fibonacci ${fiboEval.triggerLevel} level triggered`,
      suggestedSize: roundQuantity(scaledSize),
      currentEntries: openExecutions.length,
      maxEntries: config.maxEntries,
      profitPercent,
      exposurePercent: 0,
      mode: 'fibonacci',
      fiboTriggerLevel: fiboEval.triggerLevel,
      adjustedScaleFactor: scaleFactor,
    };
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

