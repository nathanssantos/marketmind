import type { Kline as KlineType, Interval } from '@marketmind/types';
import { calculateSwingPoints } from '@marketmind/indicators';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db';
import { klines, tradeExecutions } from '../db/schema';
import type { TradeExecution } from '../db/schema';
import { logger } from './logger';

const SWING_LOOKBACK = 3;
const BREAKEVEN_PROFIT_THRESHOLD = 0.005;
const MIN_TRAILING_DISTANCE_PERCENT = 0.002;

export interface TrailingStopUpdate {
  executionId: string;
  oldStopLoss: number | null;
  newStopLoss: number;
  reason: 'breakeven' | 'swing_trail';
}

export class TrailingStopService {
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
    const { swingPoints } = calculateSwingPoints(mappedKlines, SWING_LOOKBACK);

    for (const execution of executions) {
      const update = await this.calculateTrailingStop(
        execution,
        currentPrice,
        swingPoints,
        mappedKlines
      );

      if (update) {
        await this.applyStopLossUpdate(execution.id, update.newStopLoss);
        updates.push(update);
      }
    }

    return updates;
  }

  private async calculateTrailingStop(
    execution: TradeExecution,
    currentPrice: number,
    swingPoints: Array<{ index: number; type: 'high' | 'low'; price: number; timestamp: number }>,
    _klines: KlineType[]
  ): Promise<TrailingStopUpdate | null> {
    const entryPrice = parseFloat(execution.entryPrice);
    const currentStopLoss = execution.stopLoss ? parseFloat(execution.stopLoss) : null;
    const isLong = execution.side === 'LONG';

    const profitPercent = isLong
      ? (currentPrice - entryPrice) / entryPrice
      : (entryPrice - currentPrice) / entryPrice;

    if (profitPercent >= BREAKEVEN_PROFIT_THRESHOLD) {
      const breakevenPrice = entryPrice * (isLong ? 1.001 : 0.999);

      if (currentStopLoss === null ||
          (isLong && breakevenPrice > currentStopLoss) ||
          (!isLong && breakevenPrice < currentStopLoss)) {

        const relevantSwings = swingPoints.filter(sp =>
          isLong ? sp.type === 'low' : sp.type === 'high'
        );

        const recentSwings = relevantSwings.slice(-5);

        let trailingStop: number | null = null;

        if (isLong) {
          const validSwingLows = recentSwings
            .filter(sp => sp.price < currentPrice && sp.price > entryPrice)
            .sort((a, b) => b.price - a.price);

          if (validSwingLows.length > 0) {
            const swingLow = validSwingLows[0]!.price;
            const buffer = swingLow * MIN_TRAILING_DISTANCE_PERCENT;
            trailingStop = swingLow - buffer;
          }
        } else {
          const validSwingHighs = recentSwings
            .filter(sp => sp.price > currentPrice && sp.price < entryPrice)
            .sort((a, b) => a.price - b.price);

          if (validSwingHighs.length > 0) {
            const swingHigh = validSwingHighs[0]!.price;
            const buffer = swingHigh * MIN_TRAILING_DISTANCE_PERCENT;
            trailingStop = swingHigh + buffer;
          }
        }

        const newStopLoss = trailingStop !== null
          ? (isLong
              ? Math.max(breakevenPrice, trailingStop)
              : Math.min(breakevenPrice, trailingStop))
          : breakevenPrice;

        if (currentStopLoss === null ||
            (isLong && newStopLoss > currentStopLoss) ||
            (!isLong && newStopLoss < currentStopLoss)) {

          logger.info({
            executionId: execution.id,
            symbol: execution.symbol,
            side: execution.side,
            entryPrice,
            currentPrice,
            profitPercent: (profitPercent * 100).toFixed(2),
            oldStopLoss: currentStopLoss,
            newStopLoss,
            reason: trailingStop !== null ? 'swing_trail' : 'breakeven',
          }, 'Trailing stop updated');

          return {
            executionId: execution.id,
            oldStopLoss: currentStopLoss,
            newStopLoss,
            reason: trailingStop !== null ? 'swing_trail' : 'breakeven',
          };
        }
      }
    }

    return null;
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
