import { MainClient } from 'binance';
import { and, eq } from 'drizzle-orm';
import type { TradeExecution, Wallet, PriceCache } from '../db/schema';
import { tradeExecutions, priceCache, wallets } from '../db/schema';
import { db } from '../db';
import { decryptApiKey } from './encryption';
import { logger } from './logger';

export interface PositionCheckResult {
  executionId: string;
  symbol: string;
  action: 'STOP_LOSS' | 'TAKE_PROFIT' | 'NONE';
  currentPrice: number;
  triggerPrice?: number;
}

export class PositionMonitorService {
  private monitoringInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL_MS = 60000; // 1 minute

  start(): void {
    if (this.monitoringInterval) {
      logger.warn('Position monitor already running');
      return;
    }

    logger.info('Starting position monitor service');
    this.monitoringInterval = setInterval(() => {
      this.checkAllPositions().catch((error) => {
        logger.error('Error in position monitoring loop', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }, this.CHECK_INTERVAL_MS);

    this.checkAllPositions().catch((error) => {
      logger.error('Error in initial position check', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
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

    logger.info(`Checking ${openExecutions.length} open positions`);

    for (const execution of openExecutions) {
      try {
        await this.checkPosition(execution);
      } catch (error) {
        logger.error('Error checking position', {
          executionId: execution.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
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

    const entryPrice = parseFloat(execution.entryPrice);
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
        logger.warn('Cannot execute exit for zero quantity position', {
          executionId: execution.id,
        });
        return;
      }

      const exitOrderId = await this.createExitOrder(
        wallet,
        execution.symbol,
        quantity,
        exitPrice,
        execution.side
      );

      const entryPrice = parseFloat(execution.entryPrice);
      let pnl = 0;
      if (execution.side === 'LONG') {
        pnl = (exitPrice - entryPrice) * quantity;
      } else {
        pnl = (entryPrice - exitPrice) * quantity;
      }

      const pnlPercent = ((exitPrice - entryPrice) / entryPrice) * 100;
      const adjustedPnlPercent = execution.side === 'LONG' ? pnlPercent : -pnlPercent;

      await db
        .update(tradeExecutions)
        .set({
          exitPrice: exitPrice.toString(),
          exitOrderId,
          pnl: pnl.toString(),
          pnlPercent: adjustedPnlPercent.toString(),
          status: 'closed',
          closedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(tradeExecutions.id, execution.id));

      logger.info('Position exit executed', {
        executionId: execution.id,
        symbol: execution.symbol,
        reason,
        exitPrice,
        pnl: pnl.toFixed(2),
        pnlPercent: adjustedPnlPercent.toFixed(2),
      });
    } catch (error) {
      logger.error('Failed to execute exit', {
        executionId: execution.id,
        reason,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async createExitOrder(
    wallet: Wallet,
    symbol: string,
    quantity: number,
    price: number,
    side: 'LONG' | 'SHORT'
  ): Promise<number> {
    const apiKey = decryptApiKey(wallet.apiKeyEncrypted);
    const apiSecret = decryptApiKey(wallet.apiSecretEncrypted);

    const client = new MainClient({
      api_key: apiKey,
      api_secret: apiSecret,
    });

    const orderSide = side === 'LONG' ? 'SELL' : 'BUY';

    const order = await client.submitNewOrder({
      symbol,
      side: orderSide,
      type: 'MARKET',
      quantity,
    });

    logger.info('Exit order created on Binance', {
      orderId: order.orderId,
      symbol,
      side: orderSide,
      quantity,
    });

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

      if (cached && cacheAge < 5000) {
        return parseFloat(cached.price);
      }

      const client = new MainClient();
      const ticker = await client.get24hrChangeStatististics({ symbol });

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
      logger.error('Failed to get current price', {
        symbol,
        error: error instanceof Error ? error.message : String(error),
      });
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
      logger.error('Failed to update price cache', {
        symbol,
        price,
        error: error instanceof Error ? error.message : String(error),
      });
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
}

export const positionMonitorService = new PositionMonitorService();
