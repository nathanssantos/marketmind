import { serializeError } from '../utils/errors';
import type { PendingOrderAction, PendingOrdersCheckResult } from '@marketmind/logger';
import { calculateTotalFees } from '@marketmind/types';
import { eq, sql } from 'drizzle-orm';
import { AUTO_TRADING_LIQUIDATION, AUTO_TRADING_TIMING, PROTECTION_CONFIG, RISK_ALERT_TYPES, RISK_ALERT_LEVELS } from '../constants';
import { db } from '../db';
import type { TradeExecution, Wallet } from '../db/schema';
import { priceCache as priceCacheTable, tradeExecutions, wallets } from '../db/schema';
import { env } from '../env';
import { calculateNotional, calculatePnl, formatPrice, formatQuantityForBinance, roundToDecimals } from '../utils/formatters';
import { getMinNotionalFilterService } from './min-notional-filter';
import { getFuturesClient, getSpotClient } from '../exchange';
import { createBinanceClientForPrices, createBinanceFuturesClientForPrices, isPaperWallet } from './binance-client';
import { getBinanceFuturesDataService } from './binance-futures-data';
import { logger } from './logger';
import { priceCache } from './price-cache';
import { strategyPerformanceService } from './strategy-performance';
import { trailingStopService } from './trailing-stop';
import { outputPendingOrdersCheckResults } from './watcher-batch-logger';
import { getWebSocketService } from './websocket';
import { opportunityCostManagerService } from './opportunity-cost-manager';
import { cancelAllProtectionOrders } from './protection-orders';
import { autoTradingScheduler } from './auto-trading-scheduler';
import { binancePriceStreamService } from './binance-price-stream';

const LIQUIDATION_THRESHOLDS = {
  WARNING: AUTO_TRADING_LIQUIDATION.WARNING_THRESHOLD,
  DANGER: AUTO_TRADING_LIQUIDATION.DANGER_THRESHOLD,
  CRITICAL: AUTO_TRADING_LIQUIDATION.CRITICAL_THRESHOLD,
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
  private trailingStopTimeout: NodeJS.Timeout | null = null;
  private opportunityCostTimeout: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL_MS = AUTO_TRADING_TIMING.CHECK_INTERVAL_MS;
  private readonly TRAILING_STOP_INTERVAL_MS = AUTO_TRADING_TIMING.TRAILING_STOP_INTERVAL_MS;
  private readonly OPPORTUNITY_COST_INTERVAL_MS = AUTO_TRADING_TIMING.OPPORTUNITY_COST_INTERVAL_MS;
  private processingExits: Set<string> = new Set();
  private processingGroups: Set<string> = new Set();
  private unprotectedAlerts: Map<string, number> = new Map();

  start(): void {
    if (this.monitoringTimeout) {
      logger.warn('Position monitor already running');
      return;
    }

    logger.trace('Starting position monitor service');

    const scheduleNext = () => {
      this.monitoringTimeout = setTimeout(async () => {
        try {
          await this.checkAllPositions();
        } catch (error) {
          logger.error({
            error: serializeError(error),
          }, 'Error in position monitoring loop');
        }
        scheduleNext();
      }, this.CHECK_INTERVAL_MS);
    };

    this.checkAllPositions()
      .catch((error) => {
        logger.error({
          error: serializeError(error),
        }, 'Error in initial position check');
      })
      .finally(() => {
        scheduleNext();
      });

    this.startTrailingStopLoop();
    this.startOpportunityCostLoop();
  }

  stop(): void {
    if (this.monitoringTimeout) {
      clearTimeout(this.monitoringTimeout);
      this.monitoringTimeout = null;
    }
    this.stopTrailingStopLoop();
    this.stopOpportunityCostLoop();
    logger.info('Position monitor service stopped');
  }

  private startTrailingStopLoop(): void {
    const scheduleNext = () => {
      this.trailingStopTimeout = setTimeout(async () => {
        try {
          const trailingUpdates = await trailingStopService.updateTrailingStops();
          if (trailingUpdates.length > 0) {
            logger.info({ updateCount: trailingUpdates.length }, 'Trailing stops updated');
          }
        } catch (error) {
          logger.error({
            error: serializeError(error),
          }, 'Error updating trailing stops');
        }
        scheduleNext();
      }, this.TRAILING_STOP_INTERVAL_MS);
    };
    scheduleNext();
  }

  private stopTrailingStopLoop(): void {
    if (this.trailingStopTimeout) {
      clearTimeout(this.trailingStopTimeout);
      this.trailingStopTimeout = null;
    }
  }

  private startOpportunityCostLoop(): void {
    const scheduleNext = () => {
      this.opportunityCostTimeout = setTimeout(async () => {
        try {
          await opportunityCostManagerService.checkAllPositions();
        } catch (error) {
          logger.error({
            error: serializeError(error),
          }, 'Error checking opportunity cost');
        }
        scheduleNext();
      }, this.OPPORTUNITY_COST_INTERVAL_MS);
    };
    scheduleNext();
  }

  private stopOpportunityCostLoop(): void {
    if (this.opportunityCostTimeout) {
      clearTimeout(this.opportunityCostTimeout);
      this.opportunityCostTimeout = null;
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

    const futuresExecutions = openExecutions.filter(e => e.marketType === 'FUTURES');
    if (futuresExecutions.length > 0) {
      try {
        await this.checkLiquidationRisk(futuresExecutions);
      } catch (error) {
        logger.error({
          error: serializeError(error),
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

    const startTime = new Date();
    const actions: PendingOrderAction[] = [];
    const now = new Date();

    const symbolsToFetch = pendingExecutions
      .filter(e => e.limitEntryPrice && (!e.expiresAt || e.expiresAt >= now))
      .map(e => ({
        symbol: e.symbol,
        marketType: (e.marketType === 'FUTURES' ? 'FUTURES' : 'SPOT') as 'SPOT' | 'FUTURES',
      }));

    const uniqueSymbols = Array.from(
      new Map(symbolsToFetch.map(s => [`${s.symbol}-${s.marketType}`, s])).values()
    );

    const priceMap = uniqueSymbols.length > 0
      ? await priceCache.batchFetch(uniqueSymbols)
      : new Map<string, number>();

    for (const execution of pendingExecutions) {
      try {
        if (execution.expiresAt && execution.expiresAt < now) {
          actions.push({
            executionId: execution.id,
            symbol: execution.symbol,
            side: execution.side,
            action: 'EXPIRED',
            limitPrice: execution.limitEntryPrice ? parseFloat(execution.limitEntryPrice) : null,
            expiresAt: execution.expiresAt,
          });

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
          actions.push({
            executionId: execution.id,
            symbol: execution.symbol,
            side: execution.side,
            action: 'INVALID',
            limitPrice: null,
            error: 'Missing limit price',
          });

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

        const marketType = (execution.marketType === 'FUTURES' ? 'FUTURES' : 'SPOT') as 'SPOT' | 'FUTURES';
        const priceKey = `${execution.symbol}-${marketType}`;
        const currentPrice = priceMap.get(priceKey) ?? await this.getCurrentPrice(execution.symbol, marketType);
        const limitPrice = parseFloat(execution.limitEntryPrice);
        const isLong = execution.side === 'LONG';

        const shouldFill = isLong
          ? currentPrice <= limitPrice
          : currentPrice >= limitPrice;

        if (shouldFill) {
          actions.push({
            executionId: execution.id,
            symbol: execution.symbol,
            side: execution.side,
            action: 'FILLED',
            limitPrice,
            currentPrice,
          });

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
            const side = execution.side;
            const sideLabel = side === 'LONG' ? 'Long' : 'Short';

            wsServiceFill.emitTradeNotification(execution.walletId, {
              type: 'LIMIT_FILLED',
              title: '> Limit Order Filled',
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
        } else {
          actions.push({
            executionId: execution.id,
            symbol: execution.symbol,
            side: execution.side,
            action: 'PENDING',
            limitPrice,
            currentPrice,
          });
        }
      } catch (error) {
        actions.push({
          executionId: execution.id,
          symbol: execution.symbol,
          side: execution.side,
          action: 'ERROR',
          limitPrice: execution.limitEntryPrice ? parseFloat(execution.limitEntryPrice) : null,
          error: serializeError(error),
        });
      }
    }

    const result: PendingOrdersCheckResult = {
      startTime,
      endTime: new Date(),
      totalChecked: pendingExecutions.length,
      expiredCount: actions.filter(a => a.action === 'EXPIRED').length,
      invalidCount: actions.filter(a => a.action === 'INVALID').length,
      filledCount: actions.filter(a => a.action === 'FILLED').length,
      pendingCount: actions.filter(a => a.action === 'PENDING').length,
      errorCount: actions.filter(a => a.action === 'ERROR').length,
      actions,
    };

    outputPendingOrdersCheckResults(result);
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
    const marketType = execution.marketType === 'FUTURES' ? 'FUTURES' : 'SPOT';
    const currentPrice = await this.getCurrentPrice(execution.symbol, marketType);

    const result: PositionCheckResult = {
      executionId: execution.id,
      symbol: execution.symbol,
      action: 'NONE',
      currentPrice,
    };

    if (!execution.stopLoss && !execution.takeProfit) {
      const alertKey = `unprotected-${execution.id}`;
      const lastAlert = this.unprotectedAlerts.get(alertKey);
      const now = Date.now();

      if (!lastAlert || now - lastAlert > PROTECTION_CONFIG.UNPROTECTED_ALERT_COOLDOWN_MS) {
        this.unprotectedAlerts.set(alertKey, now);

        const wsService = getWebSocketService();
        wsService?.emitRiskAlert(execution.walletId, {
          type: RISK_ALERT_TYPES.UNPROTECTED_POSITION,
          level: RISK_ALERT_LEVELS.DANGER,
          symbol: execution.symbol,
          message: `Position ${execution.symbol} ${execution.side} has NO stop loss protection. Add SL manually!`,
          data: {
            executionId: execution.id,
            entryPrice: execution.entryPrice,
            quantity: execution.quantity,
          },
          timestamp: now,
        });

        logger.warn({ executionId: execution.id, symbol: execution.symbol },
          '[PositionMonitor] UNPROTECTED POSITION - no SL/TP');
      }
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

      if (currentExecution?.status !== 'open') {
        logger.trace({
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

      const walletSupportsLive = !isPaperWallet(wallet);
      const shouldExecuteReal = walletSupportsLive && env.ENABLE_LIVE_TRADING;

      if (shouldExecuteReal) {
        const hasExchangeSLProtection = currentExecution.stopLossAlgoId || currentExecution.stopLossOrderId;
        const hasExchangeTPProtection = currentExecution.takeProfitAlgoId || currentExecution.takeProfitOrderId;

        if ((reason === 'STOP_LOSS' && hasExchangeSLProtection) ||
          (reason === 'TAKE_PROFIT' && hasExchangeTPProtection)) {
          logger.trace({
            executionId: execution.id,
            symbol: execution.symbol,
            reason,
            stopLossAlgoId: currentExecution.stopLossAlgoId,
            takeProfitAlgoId: currentExecution.takeProfitAlgoId,
          }, 'Skipping local exit - exchange-side protection order will handle it');
          return;
        }
      }

      const quantity = parseFloat(execution.quantity);
      if (quantity === 0) {
        logger.warn({
          executionId: execution.id,
        }, 'Cannot execute exit for zero quantity position');
        return;
      }

      const entryPrice = parseFloat(execution.entryPrice);
      const grossPnl = calculatePnl(entryPrice, exitPrice, quantity, execution.side);

      const entryValue = calculateNotional(entryPrice, quantity);
      const exitValue = calculateNotional(exitPrice, quantity);
      const marketType = execution.marketType === 'FUTURES' ? 'FUTURES' : 'SPOT';
      const { totalFees } = calculateTotalFees(entryValue, exitValue, { marketType });
      const pnl = roundToDecimals(grossPnl - totalFees, 8);

      const pnlPercent = roundToDecimals(((exitPrice - entryPrice) / entryPrice) * 100, 4);
      const adjustedPnlPercent = execution.side === 'LONG' ? pnlPercent : -pnlPercent;

      let exitOrderId: number | null = null;
      let positionSyncedFromExchange = false;

      if (!shouldExecuteReal) {
        logger.info({
          executionId: execution.id,
          symbol: execution.symbol,
          walletType: wallet.walletType,
          reason,
          liveEnabled: env.ENABLE_LIVE_TRADING,
        }, 'Paper/disabled mode: simulating exit order');
      } else {
        const marketType = execution.marketType === 'FUTURES' ? 'FUTURES' : 'SPOT';
        try {
          exitOrderId = await this.createExitOrder(
            wallet,
            execution.symbol,
            quantity,
            exitPrice,
            execution.side,
            marketType
          );
        } catch (orderError) {
          const errorMessage = serializeError(orderError);
          if (errorMessage.includes('ReduceOnly Order is rejected')) {
            logger.warn({
              executionId: execution.id,
              symbol: execution.symbol,
              side: execution.side,
              reason,
            }, 'Position not found on exchange (ReduceOnly rejected) - marking as synced closed');
            positionSyncedFromExchange = true;
          } else {
            throw orderError;
          }
        }
      }

      let actualExitPrice = exitPrice;
      let actualFees = totalFees;
      let actualPnl = pnl;
      let actualPnlPercent = adjustedPnlPercent;

      let actualEntryFee = parseFloat(execution.entryFee || '0');
      let actualExitFee = 0;

      if (positionSyncedFromExchange && marketType === 'FUTURES') {
        try {
          const client = getFuturesClient(wallet);
          const openedAt = execution.openedAt?.getTime() || execution.createdAt.getTime();
          const allFees = await client.getAllTradeFeesForPosition(execution.symbol, execution.side, openedAt);

          if (allFees) {
            actualExitPrice = allFees.exitPrice || exitPrice;
            actualEntryFee = allFees.entryFee;
            actualExitFee = allFees.exitFee;
            actualFees = allFees.totalFees;

            const grossPnl = calculatePnl(entryPrice, actualExitPrice, quantity, execution.side);
            actualPnl = roundToDecimals(grossPnl - actualFees, 8);

            const pnlPercentCalc = roundToDecimals(((actualExitPrice - entryPrice) / entryPrice) * 100, 4);
            actualPnlPercent = execution.side === 'LONG' ? pnlPercentCalc : -pnlPercentCalc;

            logger.info({
              executionId: execution.id,
              symbol: execution.symbol,
              originalExitPrice: exitPrice,
              actualExitPrice,
              actualEntryFee,
              actualExitFee,
              actualFees,
              actualPnl,
              binanceRealizedPnl: allFees.realizedPnl,
            }, '[PositionMonitor] Fetched actual trade fees from Binance (entry + exit)');
          } else {
            const closingTrade = await client.getLastClosingTrade(execution.symbol, execution.side, openedAt);
            if (closingTrade) {
              actualExitPrice = closingTrade.price;
              actualExitFee = closingTrade.commission;
              actualFees = actualEntryFee + actualExitFee;

              const grossPnl = calculatePnl(entryPrice, actualExitPrice, quantity, execution.side);
              actualPnl = roundToDecimals(grossPnl - actualFees, 8);

              const pnlPercentCalc = roundToDecimals(((actualExitPrice - entryPrice) / entryPrice) * 100, 4);
              actualPnlPercent = execution.side === 'LONG' ? pnlPercentCalc : -pnlPercentCalc;

              logger.info({
                executionId: execution.id,
                symbol: execution.symbol,
                actualExitPrice,
                actualExitFee,
                actualFees,
                actualPnl,
              }, '[PositionMonitor] Fetched exit fee from Binance (fallback)');
            }
          }
        } catch (fetchError) {
          logger.warn({
            executionId: execution.id,
            error: serializeError(fetchError),
          }, '[PositionMonitor] Failed to fetch actual fees from Binance, using detected values');
        }
      }

      const currentBalance = parseFloat(wallet.currentBalance || '0');

      await db
        .update(wallets)
        .set({
          currentBalance: sql`CAST(${wallets.currentBalance} AS DECIMAL(20,8)) + ${actualPnl}`,
          updatedAt: new Date(),
        })
        .where(eq(wallets.id, wallet.id));

      logger.info({
        walletId: wallet.id,
        walletType: wallet.walletType,
        pnl: actualPnl,
        previousBalance: currentBalance,
        expectedNewBalance: currentBalance + actualPnl,
      }, '[PositionMonitor] Wallet balance updated atomically after position exit');

      const exitSource = positionSyncedFromExchange ? 'EXCHANGE_SYNC' : 'ALGORITHM';

      await db
        .update(tradeExecutions)
        .set({
          exitPrice: actualExitPrice.toString(),
          exitOrderId,
          pnl: actualPnl.toString(),
          pnlPercent: actualPnlPercent.toString(),
          fees: actualFees.toString(),
          entryFee: actualEntryFee.toString(),
          exitFee: actualExitFee.toString(),
          exitSource,
          exitReason: reason,
          status: 'closed',
          closedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(tradeExecutions.id, execution.id));

      binancePriceStreamService.invalidateExecutionCache(execution.symbol);

      const hasProtectionOrders = execution.stopLossAlgoId || execution.stopLossOrderId ||
        execution.takeProfitAlgoId || execution.takeProfitOrderId;

      if (hasProtectionOrders && !isPaperWallet(wallet)) {
        try {
          await cancelAllProtectionOrders({
            wallet,
            symbol: execution.symbol,
            marketType: execution.marketType === 'FUTURES' ? 'FUTURES' : 'SPOT',
            stopLossAlgoId: execution.stopLossAlgoId,
            stopLossOrderId: execution.stopLossOrderId,
            takeProfitAlgoId: execution.takeProfitAlgoId,
            takeProfitOrderId: execution.takeProfitOrderId,
          });
          logger.info({
            executionId: execution.id,
            symbol: execution.symbol,
            stopLossAlgoId: execution.stopLossAlgoId,
            takeProfitAlgoId: execution.takeProfitAlgoId,
          }, '[PositionMonitor] Cancelled remaining protection orders after position exit');
        } catch (cancelError) {
          logger.warn({
            executionId: execution.id,
            symbol: execution.symbol,
            error: serializeError(cancelError),
          }, '[PositionMonitor] Failed to cancel protection orders - they may have already been filled or cancelled');
        }
      }

      const expectedNewBalance = roundToDecimals(currentBalance + pnl, 8);
      logger.info({
        executionId: execution.id,
        symbol: execution.symbol,
        exitSource,
        reason,
        exitPrice,
        entryPrice,
        quantity,
        pnl: pnl.toFixed(2),
        pnlPercent: adjustedPnlPercent.toFixed(2),
        expectedNewBalance: expectedNewBalance.toFixed(2),
        isPaperTrading: isPaperWallet(wallet),
        positionSyncedFromExchange,
      }, positionSyncedFromExchange
        ? '[PositionMonitor] Position closed (synced from exchange - position not found)'
        : '[PositionMonitor] Position closed automatically');

      const wsService = getWebSocketService();
      if (wsService) {
        const isProfit = pnl > 0;
        const side = execution.side;
        const sideLabel = side === 'LONG' ? 'Long' : 'Short';

        let title: string;
        if (reason === 'TAKE_PROFIT') {
          title = '> Take Profit';
        } else if (isProfit) {
          title = '✓ Stop Loss (Profit)';
        } else {
          title = '✗ Stop Loss';
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

      if (autoTradingScheduler.isWalletPaused(execution.walletId)) {
        autoTradingScheduler.resumeWatchersForWallet(execution.walletId);
        logger.info({ walletId: execution.walletId }, '[PositionMonitor] Resumed watchers after position exit');
      }
    } catch (error) {
      logger.error({
        executionId: execution.id,
        reason,
        error: serializeError(error),
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
    side: 'LONG' | 'SHORT',
    marketType: 'SPOT' | 'FUTURES' = 'FUTURES'
  ): Promise<number> {
    const orderSide = side === 'LONG' ? 'SELL' : 'BUY';

    const minNotionalFilter = getMinNotionalFilterService();
    const symbolFilters = await minNotionalFilter.getSymbolFilters(marketType);
    const filters = symbolFilters.get(symbol);
    const stepSize = filters?.stepSize?.toString();
    const formattedQuantity = parseFloat(formatQuantityForBinance(quantity, stepSize));

    logger.info({ symbol, originalQuantity: quantity, formattedQuantity, stepSize }, 'Formatting quantity for exit order');

    if (marketType === 'FUTURES') {
      const client = getFuturesClient(wallet);
      const order = await client.submitOrder({
        symbol,
        side: orderSide,
        type: 'MARKET',
        quantity: String(formattedQuantity),
        reduceOnly: true,
        newOrderRespType: 'RESULT',
      });

      logger.info({
        orderId: order.orderId,
        symbol,
        side: orderSide,
        quantity: formattedQuantity,
        avgPrice: order.avgPrice,
        executedQty: order.executedQty,
        marketType: 'FUTURES',
      }, 'Futures exit order created');

      return order.orderId;
    }

    const client = getSpotClient(wallet);
    const order = await client.submitOrder({
      symbol,
      side: orderSide,
      type: 'MARKET',
      quantity: formattedQuantity,
    });

    logger.info({
      orderId: order.orderId,
      symbol,
      side: orderSide,
      quantity: formattedQuantity,
      marketType: 'SPOT',
    }, 'Spot exit order created');

    return order.orderId;
  }

  async getCurrentPrice(symbol: string, marketType: 'SPOT' | 'FUTURES' = 'FUTURES'): Promise<number> {
    try {
      const inMemoryCached = priceCache.getPrice(symbol, marketType);
      if (inMemoryCached !== null) {
        return inMemoryCached;
      }

      const cacheKey = marketType === 'FUTURES' ? `${symbol}_FUTURES` : symbol;

      const [cached] = await db
        .select()
        .from(priceCacheTable)
        .where(eq(priceCacheTable.symbol, cacheKey))
        .limit(1);

      const cacheAge = cached
        ? Date.now() - new Date(cached.timestamp).getTime()
        : Infinity;

      if (cached && cacheAge < 3000) {
        const price = parseFloat(cached.price);
        priceCache.updateFromWebSocket(symbol, marketType, price);
        return price;
      }

      let price: number;

      if (marketType === 'FUTURES') {
        const markPriceData = await getBinanceFuturesDataService().getMarkPrice(symbol);
        if (markPriceData) {
          price = markPriceData.markPrice;
        } else {
          const client = createBinanceFuturesClientForPrices();
          const ticker = await client.get24hrChangeStatistics({ symbol });
          price = parseFloat(String(ticker.lastPrice));
        }
      } else {
        const client = createBinanceClientForPrices();
        const ticker = await client.get24hrChangeStatistics({ symbol });
        price = parseFloat(String(ticker.lastPrice));
      }

      priceCache.updateFromWebSocket(symbol, marketType, price);

      await db
        .insert(priceCacheTable)
        .values({
          symbol: cacheKey,
          price: price.toString(),
          timestamp: new Date(),
        })
        .onConflictDoUpdate({
          target: priceCacheTable.symbol,
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
        marketType,
        error: serializeError(error),
      }, 'Failed to get current price');
      throw error;
    }
  }

  async updatePrice(symbol: string, price: number): Promise<void> {
    try {
      await db
        .insert(priceCacheTable)
        .values({
          symbol,
          price: price.toString(),
          timestamp: new Date(),
        })
        .onConflictDoUpdate({
          target: priceCacheTable.symbol,
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
        error: serializeError(error),
      }, 'Failed to update price cache');
    }
  }

  async invalidatePriceCache(symbol?: string): Promise<void> {
    try {
      if (symbol) {
        await db
          .update(priceCacheTable)
          .set({ timestamp: new Date(0) })
          .where(eq(priceCacheTable.symbol, symbol));
      } else {
        await db.update(priceCacheTable).set({ timestamp: new Date(0) });
      }
    } catch (error) {
      logger.error({
        symbol,
        error: serializeError(error),
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
      logger.trace({ groupKey }, 'Skipping group check - already processing');
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
  private readonly LIQUIDATION_ALERT_COOLDOWN_MS = AUTO_TRADING_LIQUIDATION.ALERT_COOLDOWN_MS;
  private readonly MAX_LIQUIDATION_ALERTS = AUTO_TRADING_LIQUIDATION.MAX_ALERTS_IN_MEMORY;

  private cleanupOldLiquidationAlerts(): void {
    const now = Date.now();
    for (const [key, value] of this.lastLiquidationAlerts) {
      if (now - value.timestamp > this.LIQUIDATION_ALERT_COOLDOWN_MS * 2) {
        this.lastLiquidationAlerts.delete(key);
      }
    }
    if (this.lastLiquidationAlerts.size > this.MAX_LIQUIDATION_ALERTS) {
      const entries = Array.from(this.lastLiquidationAlerts.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toRemove = entries.slice(0, entries.length - this.MAX_LIQUIDATION_ALERTS);
      for (const [key] of toRemove) {
        this.lastLiquidationAlerts.delete(key);
      }
    }
  }

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
            side: execution.side,
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
          error: serializeError(error),
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

    this.cleanupOldLiquidationAlerts();
    this.lastLiquidationAlerts.set(alertKey, { level: risk.riskLevel, timestamp: now });

    const wsService = getWebSocketService();
    if (!wsService) return;

    const distancePercentFormatted = (risk.distancePercent * 100).toFixed(2);
    const message = risk.riskLevel === 'critical'
      ? `! CRITICAL: ${risk.symbol} ${risk.side} position ${distancePercentFormatted}% from liquidation!`
      : risk.riskLevel === 'danger'
        ? `! DANGER: ${risk.symbol} ${risk.side} position ${distancePercentFormatted}% from liquidation`
        : `! WARNING: ${risk.symbol} ${risk.side} position ${distancePercentFormatted}% from liquidation`;

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
