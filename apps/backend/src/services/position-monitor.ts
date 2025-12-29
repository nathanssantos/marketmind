import { BINANCE_FEES } from '@marketmind/types';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import type { TradeExecution, Wallet } from '../db/schema';
import { priceCache, tradeExecutions, wallets } from '../db/schema';
import { env } from '../env';
import { createBinanceClient, createBinanceClientForPrices, isPaperWallet } from './binance-client';
import { getBinanceFuturesDataService } from './binance-futures-data';
import { logger } from './logger';
import { strategyPerformanceService } from './strategy-performance';
import { trailingStopService } from './trailing-stop';
import { getWebSocketService } from './websocket';

const LIQUIDATION_THRESHOLDS = {
  WARNING: 0.50,
  DANGER: 0.25,
  CRITICAL: 0.10,
} as const;

type LiquidationRiskLevel = 'safe' | 'warning' | 'danger' | 'critical';

interface LiquidationRiskCheck {
  executionId: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  markPrice: number;
  liquidationPrice: number;
  distancePercent: number;
  riskLevel: LiquidationRiskLevel;
}

export interface PositionCheckResult {
  executionId: string;
  symbol: string;
  action: 'STOP_LOSS' | 'TAKE_PROFIT' | 'NONE';
  currentPrice: number;
  triggerPrice?: number;
}

export class PositionMonitorService {
  private monitoringTimeout: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL_MS = 5000;
  private processingExits: Set<string> = new Set();
  private processingGroups: Set<string> = new Set();

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
    await this.checkPendingOrders();

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

    const futuresExecutions = openExecutions.filter(e => e.marketType === 'FUTURES');
    if (futuresExecutions.length > 0) {
      try {
        await this.checkLiquidationRisk(futuresExecutions);
      } catch (error) {
        logger.error({
          error: error instanceof Error ? error.message : String(error),
        }, 'Error checking liquidation risk');
      }
    }
  }

  async checkPendingOrders(): Promise<void> {
    const pendingExecutions = await db
      .select()
      .from(tradeExecutions)
      .where(eq(tradeExecutions.status, 'pending'));

    if (pendingExecutions.length === 0) {
      return;
    }

    logger.debug({
      pendingCount: pendingExecutions.length,
      symbols: [...new Set(pendingExecutions.map(e => e.symbol))],
    }, '📋 Checking pending LIMIT orders');

    const now = new Date();

    for (const execution of pendingExecutions) {
      try {
        if (execution.expiresAt && execution.expiresAt < now) {
          logger.info({
            executionId: execution.id,
            symbol: execution.symbol,
            limitPrice: execution.limitEntryPrice,
            expiresAt: execution.expiresAt,
          }, '📋 Pending LIMIT order expired - cancelling');

          await db
            .update(tradeExecutions)
            .set({
              status: 'cancelled',
              exitReason: 'LIMIT_EXPIRED',
              closedAt: now,
              updatedAt: now,
            })
            .where(eq(tradeExecutions.id, execution.id));

          const wsService = getWebSocketService();
          if (wsService) {
            wsService.emitPositionUpdate(execution.walletId, {
              ...execution,
              status: 'cancelled',
              exitReason: 'LIMIT_EXPIRED',
            });
          }

          continue;
        }

        if (!execution.limitEntryPrice) {
          logger.warn({
            executionId: execution.id,
          }, 'Pending order missing limit price - cancelling');

          await db
            .update(tradeExecutions)
            .set({
              status: 'cancelled',
              exitReason: 'INVALID_ORDER',
              closedAt: now,
              updatedAt: now,
            })
            .where(eq(tradeExecutions.id, execution.id));

          const wsServiceInvalid = getWebSocketService();
          if (wsServiceInvalid) {
            wsServiceInvalid.emitPositionUpdate(execution.walletId, {
              ...execution,
              status: 'cancelled',
              exitReason: 'INVALID_ORDER',
            });
          }

          continue;
        }

        const currentPrice = await this.getCurrentPrice(execution.symbol);
        const limitPrice = parseFloat(execution.limitEntryPrice);
        const isLong = execution.side === 'LONG';

        const shouldFill = isLong
          ? currentPrice <= limitPrice
          : currentPrice >= limitPrice;

        const priceDiff = isLong
          ? ((limitPrice - currentPrice) / limitPrice) * 100
          : ((currentPrice - limitPrice) / limitPrice) * 100;

        logger.debug({
          executionId: execution.id,
          symbol: execution.symbol,
          side: execution.side,
          limitPrice,
          currentPrice,
          priceDiff: `${priceDiff.toFixed(3)}%`,
          shouldFill,
          condition: isLong ? `current (${currentPrice}) <= limit (${limitPrice})` : `current (${currentPrice}) >= limit (${limitPrice})`,
        }, '📊 Pending order price check');

        if (shouldFill) {
          logger.info({
            executionId: execution.id,
            symbol: execution.symbol,
            side: execution.side,
            limitPrice,
            currentPrice,
            fillPrice: currentPrice,
            improvement: `${Math.abs(((currentPrice - limitPrice) / limitPrice) * 100).toFixed(3)}%`,
          }, '🎯 LIMIT ORDER FILLED - Position now OPEN');

          await db
            .update(tradeExecutions)
            .set({
              status: 'open',
              entryPrice: currentPrice.toString(),
              openedAt: now,
              updatedAt: now,
            })
            .where(eq(tradeExecutions.id, execution.id));

          const wsServiceFill = getWebSocketService();
          if (wsServiceFill) {
            const side = execution.side as 'LONG' | 'SHORT';
            const sideLabel = side === 'LONG' ? 'Long' : 'Short';
            const formatPrice = (price: number) => price >= 1 ? price.toFixed(2) : price.toFixed(6);

            wsServiceFill.emitTradeNotification(execution.walletId, {
              type: 'LIMIT_FILLED',
              title: '🎯 Limit Order Filled',
              body: `${sideLabel} ${execution.symbol} @ ${formatPrice(currentPrice)}`,
              urgency: 'normal',
              data: {
                executionId: execution.id,
                symbol: execution.symbol,
                side,
                entryPrice: currentPrice.toString(),
              },
            });

            wsServiceFill.emitPositionUpdate(execution.walletId, {
              ...execution,
              status: 'open',
              entryPrice: currentPrice.toString(),
            });
          }
        }
      } catch (error) {
        logger.error({
          executionId: execution.id,
          error: error instanceof Error ? error.message : String(error),
        }, 'Error checking pending order');
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

    if (this.processingGroups.has(groupKey)) {
      logger.debug({ groupKey }, 'Skipping group check (polling) - already processing');
      return;
    }

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

    if (!slTriggered && !tpTriggered) {
      return;
    }

    this.processingGroups.add(groupKey);

    try {
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
    } finally {
      this.processingGroups.delete(groupKey);
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
    if (this.processingExits.has(execution.id)) {
      return;
    }

    this.processingExits.add(execution.id);

    try {
      const currentExecution = await db.query.tradeExecutions.findFirst({
        where: eq(tradeExecutions.id, execution.id),
      });

      if (!currentExecution || currentExecution.status !== 'open') {
        logger.debug({
          executionId: execution.id,
          status: currentExecution?.status,
        }, 'Skipping exit - position already closed or not found');
        return;
      }

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
      const feeRate = execution.marketType === 'FUTURES'
        ? BINANCE_FEES.FUTURES.VIP_0.taker
        : BINANCE_FEES.SPOT.VIP_0.taker;
      const entryFee = entryValue * feeRate;
      const exitFee = exitValue * feeRate;
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

      const wsService = getWebSocketService();
      if (wsService) {
        const isProfit = pnl > 0;
        const side = execution.side as 'LONG' | 'SHORT';
        const sideLabel = side === 'LONG' ? 'Long' : 'Short';

        let title: string;
        if (reason === 'TAKE_PROFIT') {
          title = '🎯 Take Profit';
        } else if (isProfit) {
          title = '✅ Stop Loss (Profit)';
        } else {
          title = '🛑 Stop Loss';
        }

        const pnlSign = pnl >= 0 ? '+' : '';
        const body = `${sideLabel} ${execution.symbol}: ${pnlSign}$${pnl.toFixed(2)} (${pnlSign}${adjustedPnlPercent.toFixed(2)}%)`;

        wsService.emitTradeNotification(execution.walletId, {
          type: 'POSITION_CLOSED',
          title,
          body,
          urgency: isProfit ? 'normal' : 'critical',
          data: {
            executionId: execution.id,
            symbol: execution.symbol,
            side,
            entryPrice: entryPrice.toString(),
            exitPrice: exitPrice.toString(),
            pnl: pnl.toString(),
            pnlPercent: adjustedPnlPercent.toString(),
            exitReason: reason,
          },
        });

        wsService.emitPositionUpdate(execution.walletId, {
          id: execution.id,
          status: 'closed',
          exitPrice: exitPrice.toString(),
          pnl: pnl.toString(),
          pnlPercent: adjustedPnlPercent.toString(),
          exitReason: reason,
        });
      }

      await strategyPerformanceService.updatePerformance(execution.id);
    } catch (error) {
      logger.error({
        executionId: execution.id,
        reason,
        error: error instanceof Error ? error.message : String(error),
      }, 'Failed to execute exit');
      throw error;
    } finally {
      this.processingExits.delete(execution.id);
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

    if (this.processingGroups.has(groupKey)) {
      logger.debug({ groupKey }, 'Skipping group check - already processing');
      return;
    }

    const consolidatedSL = this.calculateConsolidatedStopLoss(executions, isLong);
    const consolidatedTP = this.calculateConsolidatedTakeProfit(executions, isLong);

    const slTriggered = consolidatedSL !== null && (
      isLong ? currentPrice <= consolidatedSL : currentPrice >= consolidatedSL
    );

    const tpTriggered = consolidatedTP !== null && (
      isLong ? currentPrice >= consolidatedTP : currentPrice <= consolidatedTP
    );

    if (!slTriggered && !tpTriggered) {
      return;
    }

    this.processingGroups.add(groupKey);

    try {
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
    } finally {
      this.processingGroups.delete(groupKey);
    }
  }

  groupExecutionsBySymbolAndSidePublic(executions: TradeExecution[]): Map<string, TradeExecution[]> {
    return this.groupExecutionsBySymbolAndSide(executions);
  }

  private lastLiquidationAlerts: Map<string, { level: LiquidationRiskLevel; timestamp: number }> = new Map();
  private readonly LIQUIDATION_ALERT_COOLDOWN_MS = 60000;

  async checkLiquidationRisk(futuresExecutions: TradeExecution[]): Promise<LiquidationRiskCheck[]> {
    const results: LiquidationRiskCheck[] = [];
    const symbolsToCheck = [...new Set(futuresExecutions.map(e => e.symbol))];

    for (const symbol of symbolsToCheck) {
      try {
        const markPriceData = await getBinanceFuturesDataService().getMarkPrice(symbol);
        if (!markPriceData) continue;

        const markPrice = markPriceData.markPrice;
        const executionsForSymbol = futuresExecutions.filter(e => e.symbol === symbol);

        for (const execution of executionsForSymbol) {
          if (!execution.liquidationPrice) continue;

          const liquidationPrice = parseFloat(execution.liquidationPrice);
          if (liquidationPrice <= 0) continue;

          const distancePercent = execution.side === 'LONG'
            ? (markPrice - liquidationPrice) / markPrice
            : (liquidationPrice - markPrice) / markPrice;

          let riskLevel: LiquidationRiskLevel = 'safe';
          if (distancePercent <= LIQUIDATION_THRESHOLDS.CRITICAL) {
            riskLevel = 'critical';
          } else if (distancePercent <= LIQUIDATION_THRESHOLDS.DANGER) {
            riskLevel = 'danger';
          } else if (distancePercent <= LIQUIDATION_THRESHOLDS.WARNING) {
            riskLevel = 'warning';
          }

          const result: LiquidationRiskCheck = {
            executionId: execution.id,
            symbol,
            side: execution.side as 'LONG' | 'SHORT',
            markPrice,
            liquidationPrice,
            distancePercent,
            riskLevel,
          };

          results.push(result);

          if (riskLevel !== 'safe') {
            await this.emitLiquidationAlert(execution.walletId, result);
          }
        }
      } catch (error) {
        logger.error({
          symbol,
          error: error instanceof Error ? error.message : String(error),
        }, 'Error checking liquidation risk for symbol');
      }
    }

    return results;
  }

  private async emitLiquidationAlert(walletId: string, risk: LiquidationRiskCheck): Promise<void> {
    const alertKey = `${risk.executionId}-${risk.riskLevel}`;
    const lastAlert = this.lastLiquidationAlerts.get(alertKey);
    const now = Date.now();

    if (lastAlert && (now - lastAlert.timestamp) < this.LIQUIDATION_ALERT_COOLDOWN_MS) {
      return;
    }

    this.lastLiquidationAlerts.set(alertKey, { level: risk.riskLevel, timestamp: now });

    const wsService = getWebSocketService();
    if (!wsService) return;

    const distancePercentFormatted = (risk.distancePercent * 100).toFixed(2);
    const message = risk.riskLevel === 'critical'
      ? `⚠️ CRITICAL: ${risk.symbol} ${risk.side} position ${distancePercentFormatted}% from liquidation!`
      : risk.riskLevel === 'danger'
        ? `⚠️ DANGER: ${risk.symbol} ${risk.side} position ${distancePercentFormatted}% from liquidation`
        : `⚠️ WARNING: ${risk.symbol} ${risk.side} position ${distancePercentFormatted}% from liquidation`;

    wsService.emitLiquidationWarning(walletId, {
      symbol: risk.symbol,
      side: risk.side,
      markPrice: risk.markPrice,
      liquidationPrice: risk.liquidationPrice,
      distancePercent: risk.distancePercent,
      riskLevel: risk.riskLevel as 'warning' | 'danger' | 'critical',
    });

    wsService.emitRiskAlert(walletId, {
      type: 'LIQUIDATION_RISK',
      level: risk.riskLevel as 'warning' | 'danger' | 'critical',
      positionId: risk.executionId,
      symbol: risk.symbol,
      message,
      data: {
        side: risk.side,
        markPrice: risk.markPrice,
        liquidationPrice: risk.liquidationPrice,
        distancePercent: risk.distancePercent,
      },
      timestamp: now,
    });

    logger.warn({
      executionId: risk.executionId,
      symbol: risk.symbol,
      side: risk.side,
      markPrice: risk.markPrice,
      liquidationPrice: risk.liquidationPrice,
      distancePercent: distancePercentFormatted,
      riskLevel: risk.riskLevel,
    }, `[LIQUIDATION RISK] ${risk.riskLevel.toUpperCase()} - Position approaching liquidation`);
  }
}

export const positionMonitorService = new PositionMonitorService();
