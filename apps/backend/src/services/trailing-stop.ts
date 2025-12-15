import { calculateATR, calculateSwingPoints } from '@marketmind/indicators';
import type { Interval, Kline as KlineType, TrailingStopOptimizationConfig } from '@marketmind/types';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db';
import type { TradeExecution } from '../db/schema';
import { klines, setupDetections, tradeExecutions } from '../db/schema';
import { logger } from './logger';

export const DEFAULT_TRAILING_STOP_CONFIG: TrailingStopOptimizationConfig = {
  breakevenProfitThreshold: 0.005,
  minTrailingDistancePercent: 0.002,
  swingLookback: 3,
  useATRMultiplier: true,
  atrMultiplier: 2.0,
};

export interface TrailingStopUpdate {
  executionId: string;
  oldStopLoss: number | null;
  newStopLoss: number;
  reason: 'breakeven' | 'swing_trail' | 'atr_trail';
}

export interface TrailingStopInput {
  entryPrice: number;
  currentPrice: number;
  currentStopLoss: number | null;
  side: 'LONG' | 'SHORT';
  swingPoints: Array<{ price: number; type: 'high' | 'low' }>;
  atr?: number;
  highestPrice?: number;
  lowestPrice?: number;
}

export interface TrailingStopResult {
  newStopLoss: number;
  reason: 'breakeven' | 'swing_trail' | 'atr_trail';
}

export const calculateProfitPercent = (
  entryPrice: number,
  currentPrice: number,
  isLong: boolean
): number => {
  return isLong
    ? (currentPrice - entryPrice) / entryPrice
    : (entryPrice - currentPrice) / entryPrice;
};

export const calculateBreakevenPrice = (
  entryPrice: number,
  isLong: boolean,
  buffer: number = 0.001
): number => {
  return entryPrice * (isLong ? 1 + buffer : 1 - buffer);
};

export const findBestSwingStop = (
  swingPoints: Array<{ price: number; type: 'high' | 'low' }>,
  currentPrice: number,
  entryPrice: number,
  isLong: boolean,
  minDistancePercent: number
): number | null => {
  const relevantSwings = swingPoints.filter(sp =>
    isLong ? sp.type === 'low' : sp.type === 'high'
  );

  const recentSwings = relevantSwings.slice(-5);

  if (isLong) {
    const validSwingLows = recentSwings
      .filter(sp => sp.price < currentPrice && sp.price > entryPrice)
      .sort((a, b) => b.price - a.price);

    logger.debug({
      side: 'LONG',
      recentSwingsCount: recentSwings.length,
      recentSwings: recentSwings.map(s => s.price),
      validSwingLowsCount: validSwingLows.length,
      validSwingLows: validSwingLows.map(s => s.price),
      criteria: `price < ${currentPrice} AND price > ${entryPrice}`,
    }, 'Finding best swing stop for LONG');

    if (validSwingLows.length > 0) {
      const swingLow = validSwingLows[0]!.price;
      const buffer = swingLow * minDistancePercent;
      return swingLow - buffer;
    }
  } else {
    const validSwingHighs = recentSwings
      .filter(sp => sp.price > currentPrice && sp.price < entryPrice)
      .sort((a, b) => a.price - b.price);

    logger.debug({
      side: 'SHORT',
      recentSwingsCount: recentSwings.length,
      recentSwings: recentSwings.map(s => s.price),
      validSwingHighsCount: validSwingHighs.length,
      validSwingHighs: validSwingHighs.map(s => s.price),
      criteria: `price > ${currentPrice} AND price < ${entryPrice}`,
    }, 'Finding best swing stop for SHORT');

    if (validSwingHighs.length > 0) {
      const swingHigh = validSwingHighs[0]!.price;
      const buffer = swingHigh * minDistancePercent;
      return swingHigh + buffer;
    }
  }

  return null;
};

export const shouldUpdateStopLoss = (
  newStopLoss: number,
  currentStopLoss: number | null,
  isLong: boolean
): boolean => {
  if (currentStopLoss === null) return true;
  return isLong ? newStopLoss > currentStopLoss : newStopLoss < currentStopLoss;
};

export const calculateNewStopLoss = (
  breakevenPrice: number,
  swingStop: number | null,
  isLong: boolean
): number => {
  if (swingStop === null) return breakevenPrice;
  return isLong
    ? Math.max(breakevenPrice, swingStop)
    : Math.min(breakevenPrice, swingStop);
};

export const calculateATRTrailingStop = (
  highestOrLowestPrice: number,
  atr: number,
  isLong: boolean,
  atrMultiplier: number
): number => {
  const atrDistance = atr * atrMultiplier;
  return isLong
    ? highestOrLowestPrice - atrDistance
    : highestOrLowestPrice + atrDistance;
};

export const computeTrailingStop = (
  input: TrailingStopInput,
  config: TrailingStopOptimizationConfig
): TrailingStopResult | null => {
  const { entryPrice, currentPrice, currentStopLoss, side, swingPoints, atr, highestPrice, lowestPrice } = input;
  const isLong = side === 'LONG';

  const profitPercent = calculateProfitPercent(entryPrice, currentPrice, isLong);

  if (profitPercent < config.breakevenProfitThreshold) {
    return null;
  }

  const breakevenPrice = calculateBreakevenPrice(entryPrice, isLong);

  const swingStop = findBestSwingStop(
    swingPoints,
    currentPrice,
    entryPrice,
    isLong,
    config.minTrailingDistancePercent
  );

  let atrStop: number | null = null;
  if (swingStop === null && config.useATRMultiplier && atr && atr > 0) {
    const extremePrice = isLong ? highestPrice : lowestPrice;
    if (extremePrice !== undefined) {
      const candidateAtrStop = calculateATRTrailingStop(extremePrice, atr, isLong, config.atrMultiplier);
      if (shouldUpdateStopLoss(candidateAtrStop, currentStopLoss, isLong)) {
        atrStop = candidateAtrStop;
        logger.debug({
          extremePrice,
          atr,
          atrMultiplier: config.atrMultiplier,
          atrStop,
        }, 'ATR trailing stop calculated');
      }
    }
  }

  logger.debug({
    entryPrice,
    currentPrice,
    profitPercent: (profitPercent * 100).toFixed(2),
    breakevenPrice,
    swingStop,
    atrStop,
    swingPointsCount: swingPoints.length,
    relevantSwings: swingPoints.filter(sp => isLong ? sp.type === 'low' : sp.type === 'high').slice(-5),
  }, 'Trailing stop calculation details');

  let newStopLoss: number;
  let reason: 'breakeven' | 'swing_trail' | 'atr_trail';

  if (swingStop !== null) {
    newStopLoss = calculateNewStopLoss(breakevenPrice, swingStop, isLong);
    reason = 'swing_trail';
  } else if (atrStop !== null) {
    newStopLoss = atrStop;
    reason = 'atr_trail';
  } else {
    newStopLoss = breakevenPrice;
    reason = 'breakeven';
  }

  if (!shouldUpdateStopLoss(newStopLoss, currentStopLoss, isLong)) {
    return null;
  }

  return { newStopLoss, reason };
};

export class TrailingStopService {
  private config: TrailingStopOptimizationConfig;

  constructor(config?: Partial<TrailingStopOptimizationConfig>) {
    this.config = { ...DEFAULT_TRAILING_STOP_CONFIG, ...config };
  }

  updateConfig(config: Partial<TrailingStopOptimizationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): TrailingStopOptimizationConfig {
    return { ...this.config };
  }

  async updateTrailingStops(): Promise<TrailingStopUpdate[]> {
    const updates: TrailingStopUpdate[] = [];

    const openExecutions = await db
      .select()
      .from(tradeExecutions)
      .where(eq(tradeExecutions.status, 'open'));

    if (openExecutions.length === 0) {
      return updates;
    }

    const executionGroups = this.groupExecutionsBySymbol(openExecutions);

    for (const [symbol, executions] of executionGroups) {
      try {
        const groupUpdates = await this.processSymbolGroup(symbol, executions);
        updates.push(...groupUpdates);
      } catch (error) {
        logger.error({
          symbol,
          error: error instanceof Error ? error.message : String(error),
        }, 'Error processing trailing stops for symbol');
      }
    }

    return updates;
  }

  private groupExecutionsBySymbol(executions: TradeExecution[]): Map<string, TradeExecution[]> {
    const groups = new Map<string, TradeExecution[]>();

    for (const execution of executions) {
      const existing = groups.get(execution.symbol) ?? [];
      existing.push(execution);
      groups.set(execution.symbol, existing);
    }

    return groups;
  }

  private async processSymbolGroup(
    symbol: string,
    executions: TradeExecution[]
  ): Promise<TrailingStopUpdate[]> {
    const updates: TrailingStopUpdate[] = [];

    const executionsByInterval = new Map<string, TradeExecution[]>();
    
    for (const execution of executions) {
      if (!execution.setupId) {
        logger.warn({ executionId: execution.id }, 'Trade execution missing setupId, skipping trailing stop');
        continue;
      }

      const setup = await db.query.setupDetections.findFirst({
        where: eq(setupDetections.id, execution.setupId),
      });

      if (!setup) {
        logger.warn({ executionId: execution.id, setupId: execution.setupId }, 'Setup not found for execution');
        continue;
      }

      const interval = setup.interval;
      const existing = executionsByInterval.get(interval) ?? [];
      existing.push(execution);
      executionsByInterval.set(interval, existing);
    }

    for (const [interval, groupExecutions] of executionsByInterval) {
      const klinesData = await db.query.klines.findMany({
        where: and(
          eq(klines.symbol, symbol),
          eq(klines.interval, interval)
        ),
        orderBy: [desc(klines.openTime)],
        limit: 100,
      });

      if (klinesData.length < 20) {
        logger.debug({ symbol, interval, count: klinesData.length }, 'Insufficient klines for trailing stop calculation');
        continue;
      }

      klinesData.reverse();

      const mappedKlines: KlineType[] = klinesData.map((k) => ({
        symbol: k.symbol,
        interval: k.interval as Interval,
        openTime: k.openTime.getTime(),
        closeTime: k.closeTime.getTime(),
        open: k.open,
        high: k.high,
        low: k.low,
        close: k.close,
        volume: k.volume,
        quoteVolume: k.quoteVolume ?? '0',
        trades: k.trades ?? 0,
        takerBuyBaseVolume: k.takerBuyBaseVolume ?? '0',
        takerBuyQuoteVolume: k.takerBuyQuoteVolume ?? '0',
      }));

      const currentPrice = parseFloat(mappedKlines[mappedKlines.length - 1]!.close);
      const { swingPoints } = calculateSwingPoints(mappedKlines, this.config.swingLookback);

      const atrValues = this.config.useATRMultiplier ? calculateATR(mappedKlines, 14) : [];
      const currentATR = atrValues.length > 0 ? atrValues[atrValues.length - 1] : undefined;

      for (const execution of groupExecutions) {
        const update = this.calculateTrailingStop(
          execution,
          currentPrice,
          swingPoints,
          mappedKlines,
          currentATR
        );

        if (update) {
          await this.applyStopLossUpdate(execution.id, update.newStopLoss);
          updates.push(update);
        }
      }
    }

    return updates;
  }

  private calculateTrailingStop(
    execution: TradeExecution,
    currentPrice: number,
    swingPoints: Array<{ index: number; type: 'high' | 'low'; price: number; timestamp: number }>,
    klines: KlineType[],
    atr?: number
  ): TrailingStopUpdate | null {
    const entryPrice = parseFloat(execution.entryPrice);
    const currentStopLoss = execution.stopLoss ? parseFloat(execution.stopLoss) : null;
    const isLong = execution.side === 'LONG';

    const entryTime = new Date(execution.openedAt).getTime();
    const klinesAfterEntry = klines.filter(k => k.openTime >= entryTime);

    let highestPrice: number | undefined;
    let lowestPrice: number | undefined;

    if (klinesAfterEntry.length > 0) {
      highestPrice = Math.max(...klinesAfterEntry.map(k => parseFloat(k.high)));
      lowestPrice = Math.min(...klinesAfterEntry.map(k => parseFloat(k.low)));
    }

    const input: TrailingStopInput = {
      entryPrice,
      currentPrice,
      currentStopLoss,
      side: execution.side,
      swingPoints: swingPoints.map(sp => ({ price: sp.price, type: sp.type })),
      atr,
      highestPrice: isLong ? highestPrice : undefined,
      lowestPrice: isLong ? undefined : lowestPrice,
    };

    const result = computeTrailingStop(input, this.config);

    if (!result) return null;

    const profitPercent = calculateProfitPercent(entryPrice, currentPrice, execution.side === 'LONG');

    logger.info({
      executionId: execution.id,
      symbol: execution.symbol,
      side: execution.side,
      entryPrice,
      currentPrice,
      profitPercent: (profitPercent * 100).toFixed(2),
      oldStopLoss: currentStopLoss,
      newStopLoss: result.newStopLoss,
      reason: result.reason,
    }, 'Trailing stop updated');

    return {
      executionId: execution.id,
      oldStopLoss: currentStopLoss,
      newStopLoss: result.newStopLoss,
      reason: result.reason,
    };
  }

  private async applyStopLossUpdate(executionId: string, newStopLoss: number): Promise<void> {
    await db
      .update(tradeExecutions)
      .set({
        stopLoss: newStopLoss.toString(),
        updatedAt: new Date(),
      })
      .where(eq(tradeExecutions.id, executionId));
  }
}

export const trailingStopService = new TrailingStopService();
