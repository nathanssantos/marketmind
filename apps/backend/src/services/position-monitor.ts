import { eq } from 'drizzle-orm';
import { db } from '../db';
import type { TradeExecution, Wallet } from '../db/schema';
import { priceCache, tradeExecutions, wallets } from '../db/schema';
import { env } from '../env';
import { createBinanceClient, createBinanceClientForPrices, isPaperWallet } from './binance-client';
import { logger } from './logger';
import { strategyPerformanceService } from './strategy-performance';
import { trailingStopService } from './trailing-stop';

export interface PositionCheckResult {
  executionId: string;
  symbol: string;
  action: 'STOP_LOSS' | 'TAKE_PROFIT' | 'NONE';
  currentPrice: number;
  triggerPrice?: number;
}

export class PositionMonitorService {
  private monitoringTimeout: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL_MS = 15000;

  start(): void {
    if (this.monitoringTimeout) {
      logger.warn('Position monitor already running');
      return;
    }

    logger.info('Starting position monitor service');

    const scheduleNext = () => {
      this.monitoringTimeout = setTimeout(async () => {
        try {
          await this.checkAllPositions();
        } catch (error) {
          logger.error({
            error: error instanceof Error ? error.message : String(error),
          }, 'Error in position monitoring loop');
        }
        scheduleNext();
      }, this.CHECK_INTERVAL_MS);
    };

    this.checkAllPositions()
      .catch((error) => {
        logger.error({
          error: error instanceof Error ? error.message : String(error),
        }, 'Error in initial position check');
      })
      .finally(() => {
        scheduleNext();
      });
  }

  stop(): void {
    if (this.monitoringTimeout) {
      clearTimeout(this.monitoringTimeout);
      this.monitoringTimeout = null;
      logger.info('Position monitor service stopped');
    }
  }

  async checkAllPositions(): Promise<void> {
    const openExecutions = await db
      .select()
      .from(tradeExecutions)
      .where(eq(tradeExecutions.status, 'open'));

    if (openExecutions.length === 0) {
      return;
    }

    await this.invalidatePriceCache();

    try {
      const trailingUpdates = await trailingStopService.updateTrailingStops();
      if (trailingUpdates.length > 0) {
        logger.info({ updateCount: trailingUpdates.length }, 'Trailing stops updated');
      }
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
      }, 'Error updating trailing stops');
    }

    const positionGroups = this.groupExecutionsBySymbolAndSide(openExecutions);

    for (const [groupKey, executions] of positionGroups) {
      try {
        await this.checkPositionGroup(groupKey, executions);
      } catch (error) {
        logger.error({
          groupKey,
          error: error instanceof Error ? error.message : String(error),
        }, 'Error checking position group');
      }
    }
  }

  private groupExecutionsBySymbolAndSide(executions: TradeExecution[]): Map<string, TradeExecution[]> {
    const groups = new Map<string, TradeExecution[]>();

    for (const execution of executions) {
      const key = `${execution.symbol}-${execution.side}`;
      const existing = groups.get(key) || [];
      existing.push(execution);
      groups.set(key, existing);
    }

    return groups;
  }

  private async checkPositionGroup(groupKey: string, executions: TradeExecution[]): Promise<void> {
    if (executions.length === 0) return;

    const firstExecution = executions[0];
    if (!firstExecution) return;

    const currentPrice = await this.getCurrentPrice(firstExecution.symbol);
    const isLong = firstExecution.side === 'LONG';

    const consolidatedSL = this.calculateConsolidatedStopLoss(executions, isLong);
    const consolidatedTP = this.calculateConsolidatedTakeProfit(executions, isLong);

    const slTriggered = consolidatedSL !== null && (
      isLong ? currentPrice <= consolidatedSL : currentPrice >= consolidatedSL
    );

    const tpTriggered = consolidatedTP !== null && (
      isLong ? currentPrice >= consolidatedTP : currentPrice <= consolidatedTP
    );

    if (slTriggered) {
      logger.info({
        groupKey,
        reason: 'STOP_LOSS',
        currentPrice,
        consolidatedSL,
        executionCount: executions.length,
      }, 'Consolidated stop loss triggered - closing all positions in group');

      for (const execution of executions) {
        await this.executeExit(execution, currentPrice, 'STOP_LOSS');
      }
    } else if (tpTriggered) {
      logger.info({
        groupKey,
        reason: 'TAKE_PROFIT',
        currentPrice,
        consolidatedTP,
        executionCount: executions.length,
      }, 'Consolidated take profit triggered - closing all positions in group');

      for (const execution of executions) {
        await this.executeExit(execution, currentPrice, 'TAKE_PROFIT');
      }
    }
  }

  private calculateConsolidatedStopLoss(executions: TradeExecution[], isLong: boolean): number | null {
    const stopLosses = executions
      .filter(e => e.stopLoss !== null)
      .map(e => parseFloat(e.stopLoss!));

    if (stopLosses.length === 0) return null;

    return isLong ? Math.max(...stopLosses) : Math.min(...stopLosses);
  }

  private calculateConsolidatedTakeProfit(executions: TradeExecution[], isLong: boolean): number | null {
    const takeProfits = executions
      .filter(e => e.takeProfit !== null)
      .map(e => parseFloat(e.takeProfit!));

    if (takeProfits.length === 0) return null;

    return isLong ? Math.min(...takeProfits) : Math.max(...takeProfits);
  }

  async checkPosition(execution: TradeExecution): Promise<PositionCheckResult> {
    const currentPrice = await this.getCurrentPrice(execution.symbol);

    const result: PositionCheckResult = {
      executionId: execution.id,
      symbol: execution.symbol,
      action: 'NONE',
      currentPrice,
    };

    if (!execution.stopLoss && !execution.takeProfit) {
      return result;
    }

    const stopLoss = execution.stopLoss ? parseFloat(execution.stopLoss) : null;
    const takeProfit = execution.takeProfit ? parseFloat(execution.takeProfit) : null;

    if (execution.side === 'LONG') {
      if (stopLoss && currentPrice <= stopLoss) {
        result.action = 'STOP_LOSS';
        result.triggerPrice = stopLoss;
        await this.executeExit(execution, currentPrice, 'STOP_LOSS');
      } else if (takeProfit && currentPrice >= takeProfit) {
        result.action = 'TAKE_PROFIT';
        result.triggerPrice = takeProfit;
        await this.executeExit(execution, currentPrice, 'TAKE_PROFIT');
      }
    } else {
      if (stopLoss && currentPrice >= stopLoss) {
        result.action = 'STOP_LOSS';
        result.triggerPrice = stopLoss;
        await this.executeExit(execution, currentPrice, 'STOP_LOSS');
      } else if (takeProfit && currentPrice <= takeProfit) {
        result.action = 'TAKE_PROFIT';
        result.triggerPrice = takeProfit;
        await this.executeExit(execution, currentPrice, 'TAKE_PROFIT');
      }
    }

    return result;
  }

  async executeExit(
    execution: TradeExecution,
    exitPrice: number,
    reason: 'STOP_LOSS' | 'TAKE_PROFIT'
  ): Promise<void> {
    try {
      const [wallet] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.id, execution.walletId))
        .limit(1);

      if (!wallet) {
        throw new Error(`Wallet not found: ${execution.walletId}`);
      }

      const quantity = parseFloat(execution.quantity);
      if (quantity === 0) {
        logger.warn({
          executionId: execution.id,
        }, 'Cannot execute exit for zero quantity position');
        return;
      }

      const entryPrice = parseFloat(execution.entryPrice);
      let grossPnl = 0;
      if (execution.side === 'LONG') {
        grossPnl = (exitPrice - entryPrice) * quantity;
      } else {
        grossPnl = (entryPrice - exitPrice) * quantity;
      }

      const entryValue = entryPrice * quantity;
      const exitValue = exitPrice * quantity;
      const entryFee = entryValue * 0.001;
      const exitFee = exitValue * 0.001;
      const totalFees = entryFee + exitFee;
      const pnl = grossPnl - totalFees;

      const pnlPercent = ((exitPrice - entryPrice) / entryPrice) * 100;
      const adjustedPnlPercent = execution.side === 'LONG' ? pnlPercent : -pnlPercent;

      let exitOrderId: number | null = null;

      const walletSupportsLive = !isPaperWallet(wallet);
      const shouldExecuteReal = walletSupportsLive && env.ENABLE_LIVE_TRADING;

      if (!shouldExecuteReal) {
        logger.info({
          executionId: execution.id,
          symbol: execution.symbol,
          walletType: wallet.walletType,
          reason,
          liveEnabled: env.ENABLE_LIVE_TRADING,
        }, 'Paper/disabled mode: simulating exit order');
      } else {
        exitOrderId = await this.createExitOrder(
          wallet,
          execution.symbol,
          quantity,
          exitPrice,
          execution.side
        );
      }

      const currentBalance = parseFloat(wallet.currentBalance || '0');
      const newBalance = currentBalance + pnl;

      await db
        .update(wallets)
        .set({
          currentBalance: newBalance.toString(),
          updatedAt: new Date(),
        })
        .where(eq(wallets.id, wallet.id));

      logger.info({
        walletId: wallet.id,
        walletType: wallet.walletType,
        pnl,
        oldBalance: currentBalance,
        newBalance,
      }, '💰 Wallet balance updated after position exit');

      await db
        .update(tradeExecutions)
        .set({
          exitPrice: exitPrice.toString(),
          exitOrderId,
          pnl: pnl.toString(),
          pnlPercent: adjustedPnlPercent.toString(),
          exitSource: 'ALGORITHM',
          exitReason: reason,
          status: 'closed',
          closedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(tradeExecutions.id, execution.id));

      logger.info({
        executionId: execution.id,
        symbol: execution.symbol,
        exitSource: 'ALGORITHM',
        reason,
        exitPrice,
        entryPrice,
        quantity,
        pnl: pnl.toFixed(2),
        pnlPercent: adjustedPnlPercent.toFixed(2),
        newBalance: newBalance.toFixed(2),
        isPaperTrading: isPaperWallet(wallet),
        message: `Posição fechada automaticamente: ${reason === 'STOP_LOSS' ? 'Stop Loss atingido' : 'Take Profit atingido'}`,
      }, '🤖 [ALGORITHM] Position closed automatically');

      await strategyPerformanceService.updatePerformance(execution.id);
    } catch (error) {
      logger.error({
        executionId: execution.id,
        reason,
        error: error instanceof Error ? error.message : String(error),
      }, 'Failed to execute exit');
      throw error;
    }
  }

  private async createExitOrder(
    wallet: Wallet,
    symbol: string,
    quantity: number,
    _price: number,
    side: 'LONG' | 'SHORT'
  ): Promise<number> {
    const client = createBinanceClient(wallet);
    const orderSide = side === 'LONG' ? 'SELL' : 'BUY';

    const order = await client.submitNewOrder({
      symbol,
      side: orderSide,
      type: 'MARKET',
      quantity,
    });

    logger.info({
      orderId: order.orderId,
      symbol,
      side: orderSide,
      quantity,
    }, 'Exit order created on Binance');

    return order.orderId;
  }

  async getCurrentPrice(symbol: string): Promise<number> {
    try {
      const [cached] = await db
        .select()
        .from(priceCache)
        .where(eq(priceCache.symbol, symbol))
        .limit(1);

      const cacheAge = cached
        ? Date.now() - new Date(cached.timestamp).getTime()
        : Infinity;

      if (cached && cacheAge < 3000) {
        return parseFloat(cached.price);
      }

      const client = createBinanceClientForPrices();
      const ticker = await client.get24hrChangeStatistics({ symbol });

      const price = parseFloat(ticker.lastPrice);

      await db
        .insert(priceCache)
        .values({
          symbol,
          price: price.toString(),
          timestamp: new Date(),
        })
        .onConflictDoUpdate({
          target: priceCache.symbol,
          set: {
            price: price.toString(),
            timestamp: new Date(),
            updatedAt: new Date(),
          },
        });

      return price;
    } catch (error) {
      logger.error({
        symbol,
        error: error instanceof Error ? error.message : String(error),
      }, 'Failed to get current price');
      throw error;
    }
  }

  async updatePrice(symbol: string, price: number): Promise<void> {
    try {
      await db
        .insert(priceCache)
        .values({
          symbol,
          price: price.toString(),
          timestamp: new Date(),
        })
        .onConflictDoUpdate({
          target: priceCache.symbol,
          set: {
            price: price.toString(),
            timestamp: new Date(),
            updatedAt: new Date(),
          },
        });
    } catch (error) {
      logger.error({
        symbol,
        price,
        error: error instanceof Error ? error.message : String(error),
      }, 'Failed to update price cache');
    }
  }

  async invalidatePriceCache(symbol?: string): Promise<void> {
    try {
      if (symbol) {
        await db
          .update(priceCache)
          .set({ timestamp: new Date(0) })
          .where(eq(priceCache.symbol, symbol));
      } else {
        await db.update(priceCache).set({ timestamp: new Date(0) });
      }
    } catch (error) {
      logger.error({
        symbol,
        error: error instanceof Error ? error.message : String(error),
      }, 'Failed to invalidate price cache');
    }
  }

  async checkPositionByPrice(
    execution: TradeExecution,
    currentPrice: number
  ): Promise<PositionCheckResult> {
    const result: PositionCheckResult = {
      executionId: execution.id,
      symbol: execution.symbol,
      action: 'NONE',
      currentPrice,
    };

    if (!execution.stopLoss && !execution.takeProfit) {
      return result;
    }

    const stopLoss = execution.stopLoss ? parseFloat(execution.stopLoss) : null;
    const takeProfit = execution.takeProfit ? parseFloat(execution.takeProfit) : null;

    if (execution.side === 'LONG') {
      if (stopLoss && currentPrice <= stopLoss) {
        result.action = 'STOP_LOSS';
        result.triggerPrice = stopLoss;
        await this.executeExit(execution, currentPrice, 'STOP_LOSS');
      } else if (takeProfit && currentPrice >= takeProfit) {
        result.action = 'TAKE_PROFIT';
        result.triggerPrice = takeProfit;
        await this.executeExit(execution, currentPrice, 'TAKE_PROFIT');
      }
    } else {
      if (stopLoss && currentPrice >= stopLoss) {
        result.action = 'STOP_LOSS';
        result.triggerPrice = stopLoss;
        await this.executeExit(execution, currentPrice, 'STOP_LOSS');
      } else if (takeProfit && currentPrice <= takeProfit) {
        result.action = 'TAKE_PROFIT';
        result.triggerPrice = takeProfit;
        await this.executeExit(execution, currentPrice, 'TAKE_PROFIT');
      }
    }

    return result;
  }

  async checkPositionGroupByPrice(executions: TradeExecution[], currentPrice: number): Promise<void> {
    if (executions.length === 0) return;

    const firstExecution = executions[0];
    if (!firstExecution) return;

    const isLong = firstExecution.side === 'LONG';
    const groupKey = `${firstExecution.symbol}-${firstExecution.side}`;

    const consolidatedSL = this.calculateConsolidatedStopLoss(executions, isLong);
    const consolidatedTP = this.calculateConsolidatedTakeProfit(executions, isLong);

    const slTriggered = consolidatedSL !== null && (
      isLong ? currentPrice <= consolidatedSL : currentPrice >= consolidatedSL
    );

    const tpTriggered = consolidatedTP !== null && (
      isLong ? currentPrice >= consolidatedTP : currentPrice <= consolidatedTP
    );

    if (slTriggered) {
      logger.info({
        groupKey,
        reason: 'STOP_LOSS',
        currentPrice,
        consolidatedSL,
        executionCount: executions.length,
      }, 'Consolidated stop loss triggered (real-time) - closing all positions in group');

      for (const execution of executions) {
        await this.executeExit(execution, currentPrice, 'STOP_LOSS');
      }
    } else if (tpTriggered) {
      logger.info({
        groupKey,
        reason: 'TAKE_PROFIT',
        currentPrice,
        consolidatedTP,
        executionCount: executions.length,
      }, 'Consolidated take profit triggered (real-time) - closing all positions in group');

      for (const execution of executions) {
        await this.executeExit(execution, currentPrice, 'TAKE_PROFIT');
      }
    }
  }

  groupExecutionsBySymbolAndSidePublic(executions: TradeExecution[]): Map<string, TradeExecution[]> {
    return this.groupExecutionsBySymbolAndSide(executions);
  }
}

export const positionMonitorService = new PositionMonitorService();
