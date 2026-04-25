import type { MarketType } from '@marketmind/types';
import { eq } from 'drizzle-orm';
import { AUTO_TRADING_TIMING, PROTECTION_CONFIG, RISK_ALERT_TYPES, RISK_ALERT_LEVELS } from '../../constants';
import { db } from '../../db';
import type { TradeExecution } from '../../db/schema';
import { tradeExecutions } from '../../db/schema';
import { serializeError } from '../../utils/errors';
import { BinanceIpBannedError, binanceApiCache } from '../binance-api-cache';
import { logger } from '../logger';
import { trailingStopService } from '../trailing-stop';
import { getWebSocketService } from '../websocket';
import { opportunityCostManagerService } from '../opportunity-cost-manager';
import { checkLiquidationRisk } from './liquidation-checks';
import { checkPendingOrders } from './pending-orders';
import { getCurrentPrice, updatePrice, invalidatePriceCache } from './price-service';
import { executeExit } from './exit-execution';
import type { PositionCheckResult } from './types';

export type { PositionCheckResult } from './types';
export type { LiquidationRiskCheck } from './types';

export class PositionMonitorService {
  private monitoringTimeout: NodeJS.Timeout | null = null;
  private trailingStopTimeout: NodeJS.Timeout | null = null;
  private opportunityCostTimeout: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL_MS = AUTO_TRADING_TIMING.CHECK_INTERVAL_MS;
  private readonly TRAILING_STOP_INTERVAL_MS = AUTO_TRADING_TIMING.TRAILING_STOP_INTERVAL_MS;
  private readonly OPPORTUNITY_COST_INTERVAL_MS = AUTO_TRADING_TIMING.OPPORTUNITY_COST_INTERVAL_MS;
  private processingGroups: Set<string> = new Set();
  private unprotectedAlerts: Map<string, number> = new Map();

  start(): void {
    if (this.monitoringTimeout) {
      logger.warn('Position monitor already running');
      return;
    }

    logger.trace('Starting position monitor service');

    const scheduleNext = () => {
      this.monitoringTimeout = setTimeout(() => {
        void (async () => {
          try {
            await this.checkAllPositions();
          } catch (error) {
            if (error instanceof BinanceIpBannedError) {
              logger.warn('[PositionMonitor] Skipping check cycle - IP banned');
            } else {
              logger.error({
                error: serializeError(error),
              }, 'Error in position monitoring loop');
            }
          }
          scheduleNext();
        })();
      }, this.CHECK_INTERVAL_MS);
    };

    this.checkAllPositions()
      .catch((error) => {
        if (error instanceof BinanceIpBannedError) {
          logger.warn('[PositionMonitor] Skipping initial check - IP banned');
        } else {
          logger.error({
            error: serializeError(error),
          }, 'Error in initial position check');
        }
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
      this.trailingStopTimeout = setTimeout(() => {
        void (async () => {
          try {
            if (binanceApiCache.isBanned()) { scheduleNext(); return; }
            const trailingUpdates = await trailingStopService.updateTrailingStops();
            if (trailingUpdates.length > 0) {
              logger.info({ updateCount: trailingUpdates.length }, 'Trailing stops updated');
            }
          } catch (error) {
            if (!(error instanceof BinanceIpBannedError)) {
              logger.error({
                error: serializeError(error),
              }, 'Error updating trailing stops');
            }
          }
          scheduleNext();
        })();
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
      this.opportunityCostTimeout = setTimeout(() => {
        void (async () => {
          try {
            if (binanceApiCache.isBanned()) { scheduleNext(); return; }
            await opportunityCostManagerService.checkAllPositions();
          } catch (error) {
            logger.error({
              error: serializeError(error),
            }, 'Error checking opportunity cost');
          }
          scheduleNext();
        })();
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
    if (binanceApiCache.isBanned()) return;
    await this.checkPendingOrders();

    const openExecutions = await db
      .select()
      .from(tradeExecutions)
      .where(eq(tradeExecutions.status, 'open'));

    if (openExecutions.length === 0) return;

    for (const execution of openExecutions) {
      try {
        await this.checkPosition(execution);
      } catch (error) {
        if (error instanceof BinanceIpBannedError) {
          logger.warn('[PositionMonitor] Skipping position checks - IP banned');
          break;
        }
        logger.error({
          executionId: execution.id,
          symbol: execution.symbol,
          error: serializeError(error),
        }, 'Error checking position SL/TP in polling loop');
      }
    }

    const futuresExecutions = openExecutions.filter(e => e.marketType === 'FUTURES');
    if (futuresExecutions.length > 0) {
      try {
        await this.checkLiquidationRisk(futuresExecutions);
      } catch (error) {
        if (!(error instanceof BinanceIpBannedError)) {
          logger.error({
            error: serializeError(error),
          }, 'Error checking liquidation risk');
        }
      }
    }
  }

  async checkPendingOrders(): Promise<void> {
    return checkPendingOrders();
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

    const exitReason = execution.exitReason;
    if (exitReason === 'STOP_LOSS' || exitReason === 'TAKE_PROFIT') {
      logger.warn({
        executionId: execution.id,
        symbol: execution.symbol,
        exitReason,
        currentPrice,
      }, '[PositionMonitor] Detected pending exit from algo trigger - forcing close (ORDER_TRADE_UPDATE likely missed)');

      result.action = exitReason;
      await this.executeExit(execution, currentPrice, exitReason);
      return result;
    }

    if (!execution.stopLoss && !execution.takeProfit) {
      this.emitUnprotectedAlert(execution);
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
    return executeExit(execution, exitPrice, reason);
  }

  async getCurrentPrice(symbol: string, marketType: MarketType = 'FUTURES'): Promise<number> {
    return getCurrentPrice(symbol, marketType);
  }

  async updatePrice(symbol: string, price: number): Promise<void> {
    return updatePrice(symbol, price);
  }

  async invalidatePriceCache(symbol?: string): Promise<void> {
    return invalidatePriceCache(symbol);
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

    if (!execution.stopLoss && !execution.takeProfit) return result;

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

    if (!slTriggered && !tpTriggered) return;

    const allDeferredToExchange = executions.every((e) => {
      if (slTriggered) return !!(e.stopLossAlgoId || e.stopLossOrderId);
      return !!(e.takeProfitAlgoId || e.takeProfitOrderId);
    });

    if (allDeferredToExchange) {
      logger.trace({ groupKey, slTriggered, tpTriggered }, 'All executions have exchange-side protection - skipping consolidated check');
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

  async checkLiquidationRisk(futuresExecutions: TradeExecution[]) {
    return checkLiquidationRisk(futuresExecutions);
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

  private emitUnprotectedAlert(execution: TradeExecution): void {
    const alertKey = `unprotected-${execution.id}`;
    const lastAlert = this.unprotectedAlerts.get(alertKey);
    const now = Date.now();

    if (lastAlert && now - lastAlert <= PROTECTION_CONFIG.UNPROTECTED_ALERT_COOLDOWN_MS) return;

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
}

export const positionMonitorService = new PositionMonitorService();
