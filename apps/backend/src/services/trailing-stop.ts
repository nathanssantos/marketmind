import type { Kline as KlineType, Interval, TrailingStopOptimizationConfig } from '@marketmind/types';
import { calculateSwingPoints } from '@marketmind/indicators';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db';
import { klines, tradeExecutions } from '../db/schema';
import type { TradeExecution } from '../db/schema';
import { logger } from './logger';

export const DEFAULT_TRAILING_STOP_CONFIG: TrailingStopOptimizationConfig = {
  breakevenProfitThreshold: 0.005,
  minTrailingDistancePercent: 0.002,
  swingLookback: 3,
  useATRMultiplier: false,
  atrMultiplier: 2.5,
};

export interface TrailingStopUpdate {
  executionId: string;
  oldStopLoss: number | null;
  newStopLoss: number;
  reason: 'breakeven' | 'swing_trail';
}

export interface TrailingStopInput {
  entryPrice: number;
  currentPrice: number;
  currentStopLoss: number | null;
  side: 'LONG' | 'SHORT';
  swingPoints: Array<{ price: number; type: 'high' | 'low' }>;
}

export interface TrailingStopResult {
  newStopLoss: number;
  reason: 'breakeven' | 'swing_trail';
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

    if (validSwingLows.length > 0) {
      const swingLow = validSwingLows[0]!.price;
      const buffer = swingLow * minDistancePercent;
      return swingLow - buffer;
    }
  } else {
    const validSwingHighs = recentSwings
      .filter(sp => sp.price > currentPrice && sp.price < entryPrice)
      .sort((a, b) => a.price - b.price);

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

export const computeTrailingStop = (
  input: TrailingStopInput,
  config: TrailingStopOptimizationConfig
): TrailingStopResult | null => {
  const { entryPrice, currentPrice, currentStopLoss, side, swingPoints } = input;
  const isLong = side === 'LONG';

  const profitPercent = calculateProfitPercent(entryPrice, currentPrice, isLong);

  if (profitPercent < config.breakevenProfitThreshold) {
    return null;
  }

  const breakevenPrice = calculateBreakevenPrice(entryPrice, isLong);

  if (!shouldUpdateStopLoss(breakevenPrice, currentStopLoss, isLong)) {
    return null;
  }

  const swingStop = findBestSwingStop(
    swingPoints,
    currentPrice,
    entryPrice,
    isLong,
    config.minTrailingDistancePercent
  );

  const newStopLoss = calculateNewStopLoss(breakevenPrice, swingStop, isLong);

  if (!shouldUpdateStopLoss(newStopLoss, currentStopLoss, isLong)) {
    return null;
  }

  return {
    newStopLoss,
    reason: swingStop !== null ? 'swing_trail' : 'breakeven',
  };
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
      const existing = groups.get(execution.symbol) || [];
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

    const klinesData = await db.query.klines.findMany({
      where: and(
        eq(klines.symbol, symbol),
        eq(klines.interval, '1h')
      ),
      orderBy: [desc(klines.openTime)],
      limit: 100,
    });

    if (klinesData.length < 20) {
      logger.debug({ symbol, count: klinesData.length }, 'Insufficient klines for trailing stop calculation');
      return updates;
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

    for (const execution of executions) {
      const update = this.calculateTrailingStop(
        execution,
        currentPrice,
        swingPoints
      );

      if (update) {
        await this.applyStopLossUpdate(execution.id, update.newStopLoss);
        updates.push(update);
      }
    }

    return updates;
  }

  private calculateTrailingStop(
    execution: TradeExecution,
    currentPrice: number,
    swingPoints: Array<{ index: number; type: 'high' | 'low'; price: number; timestamp: number }>
  ): TrailingStopUpdate | null {
    const entryPrice = parseFloat(execution.entryPrice);
    const currentStopLoss = execution.stopLoss ? parseFloat(execution.stopLoss) : null;

    const input: TrailingStopInput = {
      entryPrice,
      currentPrice,
      currentStopLoss,
      side: execution.side as 'LONG' | 'SHORT',
      swingPoints: swingPoints.map(sp => ({ price: sp.price, type: sp.type })),
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
