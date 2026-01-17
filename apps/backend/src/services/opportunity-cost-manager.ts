import { OPPORTUNITY_COST_CONFIG } from '@marketmind/types';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import type { TradeExecution } from '../db/schema';
import { autoTradingConfig, tradeExecutions } from '../db/schema';
import { serializeError } from '../utils/errors';
import { logger } from './logger';
import { priceCache } from './price-cache';
import { getWebSocketService } from './websocket';

export interface OpportunityCostConfig {
  opportunityCostEnabled: boolean;
  maxHoldingPeriodBars: number;
  stalePriceThresholdPercent: number;
  staleTradeAction: 'ALERT_ONLY' | 'TIGHTEN_STOP' | 'AUTO_CLOSE';
  timeBasedStopTighteningEnabled: boolean;
  timeTightenAfterBars: number;
  timeTightenPercentPerBar: number;
}

export interface StaleTradeCheck {
  executionId: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  barsInTrade: number;
  priceMovementPercent: number;
  isStale: boolean;
  profitPercent: number;
  currentPrice: number;
  recommendedAction: 'NONE' | 'ALERT' | 'TIGHTEN' | 'CLOSE';
  newStopLoss?: number;
  reason?: string;
}

export interface BarIncrementResult {
  executionId: string;
  newBarsInTrade: number;
  priceMovementPercent: number;
  significantMovement: boolean;
}

const parseNumeric = (value: string | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  return parseFloat(value);
};

export class OpportunityCostManagerService {
  private readonly ALERT_COOLDOWN_MS = OPPORTUNITY_COST_CONFIG.ALERT_COOLDOWN_MS;
  private readonly MAX_LOCK_PERCENT = OPPORTUNITY_COST_CONFIG.MAX_LOCK_PERCENT;

  async checkAllPositions(): Promise<StaleTradeCheck[]> {
    const results: StaleTradeCheck[] = [];

    const openExecutions = await db
      .select()
      .from(tradeExecutions)
      .where(eq(tradeExecutions.status, 'open'));

    if (openExecutions.length === 0) return results;

    const executionsByWallet = new Map<string, TradeExecution[]>();
    for (const execution of openExecutions) {
      const existing = executionsByWallet.get(execution.walletId) ?? [];
      existing.push(execution);
      executionsByWallet.set(execution.walletId, existing);
    }

    for (const [walletId, executions] of executionsByWallet) {
      const config = await this.getConfig(walletId);
      if (!config?.opportunityCostEnabled) continue;

      for (const execution of executions) {
        try {
          const currentPrice = await this.getCurrentPrice(execution.symbol, execution.marketType ?? 'SPOT');
          if (!currentPrice) continue;

          const check = await this.checkPosition(execution, config, currentPrice);
          results.push(check);

          if (check.recommendedAction !== 'NONE') {
            await this.handleStalePosition(execution, config, check, currentPrice);
          }
        } catch (error) {
          logger.error({
            executionId: execution.id,
            symbol: execution.symbol,
            error: serializeError(error),
          }, 'Error checking opportunity cost for position');
        }
      }
    }

    return results;
  }

  async checkPosition(
    execution: TradeExecution,
    config: OpportunityCostConfig,
    currentPrice: number
  ): Promise<StaleTradeCheck> {
    const entryPrice = parseNumeric(execution.entryPrice);
    const stopLoss = parseNumeric(execution.stopLoss);
    const barsInTrade = execution.barsInTrade ?? 0;
    const highestPrice = parseNumeric(execution.highestPriceSinceEntry) || entryPrice;
    const lowestPrice = parseNumeric(execution.lowestPriceSinceEntry) || entryPrice;

    const priceMovementPercent = this.calculatePriceMovementPercent(
      entryPrice,
      highestPrice,
      lowestPrice,
      execution.side
    );

    const profitPercent = this.calculateProfitPercent(entryPrice, currentPrice, execution.side);

    const isStale = barsInTrade >= config.maxHoldingPeriodBars &&
      priceMovementPercent < config.stalePriceThresholdPercent;

    let recommendedAction: StaleTradeCheck['recommendedAction'] = 'NONE';
    let newStopLoss: number | undefined;
    let reason: string | undefined;

    if (isStale) {
      switch (config.staleTradeAction) {
        case 'ALERT_ONLY':
          recommendedAction = 'ALERT';
          reason = `Trade stale after ${barsInTrade} bars with only ${priceMovementPercent.toFixed(2)}% movement`;
          break;
        case 'TIGHTEN_STOP':
          if (profitPercent > 0) {
            recommendedAction = 'TIGHTEN';
            newStopLoss = this.calculateTightenedStop(execution, config, currentPrice, profitPercent);
            reason = `Tightening stop due to stale trade (${barsInTrade} bars, ${priceMovementPercent.toFixed(2)}% movement)`;
          } else {
            recommendedAction = 'ALERT';
            reason = `Trade stale but in loss - alerting only`;
          }
          break;
        case 'AUTO_CLOSE':
          recommendedAction = 'CLOSE';
          reason = `Auto-closing stale trade after ${barsInTrade} bars`;
          break;
      }
    } else if (config.timeBasedStopTighteningEnabled &&
               barsInTrade >= config.timeTightenAfterBars &&
               profitPercent > 0) {
      const potentialNewStop = this.calculateTimeBasedTightening(execution, config, currentPrice, profitPercent);
      if (potentialNewStop && potentialNewStop !== stopLoss) {
        recommendedAction = 'TIGHTEN';
        newStopLoss = potentialNewStop;
        reason = `Time-based stop tightening after ${barsInTrade} bars`;
      }
    }

    return {
      executionId: execution.id,
      symbol: execution.symbol,
      side: execution.side,
      barsInTrade,
      priceMovementPercent,
      isStale,
      profitPercent,
      currentPrice,
      recommendedAction,
      newStopLoss,
      reason,
    };
  }

  async incrementBarsInTrade(
    executionId: string,
    currentPrice: number
  ): Promise<BarIncrementResult | null> {
    const execution = await db
      .select()
      .from(tradeExecutions)
      .where(eq(tradeExecutions.id, executionId))
      .limit(1)
      .then(rows => rows[0]);

    if (!execution || execution.status !== 'open') return null;

    const entryPrice = parseNumeric(execution.entryPrice);
    const currentBars = execution.barsInTrade ?? 0;
    const newBarsInTrade = currentBars + 1;

    let highestPrice = parseNumeric(execution.highestPriceSinceEntry) || entryPrice;
    let lowestPrice = parseNumeric(execution.lowestPriceSinceEntry) || entryPrice;

    if (currentPrice > highestPrice) highestPrice = currentPrice;
    if (currentPrice < lowestPrice) lowestPrice = currentPrice;

    const config = await this.getConfig(execution.walletId);
    const threshold = config?.stalePriceThresholdPercent ?? OPPORTUNITY_COST_CONFIG.DEFAULT_STALE_THRESHOLD_PERCENT;

    const priceMovementPercent = this.calculatePriceMovementPercent(
      entryPrice,
      highestPrice,
      lowestPrice,
      execution.side
    );

    const significantMovement = priceMovementPercent >= threshold;

    const updateData: Record<string, unknown> = {
      barsInTrade: newBarsInTrade,
      highestPriceSinceEntry: highestPrice.toString(),
      lowestPriceSinceEntry: lowestPrice.toString(),
      updatedAt: new Date(),
    };

    if (significantMovement) {
      updateData.lastPriceMovementBar = newBarsInTrade;
    }

    await db
      .update(tradeExecutions)
      .set(updateData)
      .where(eq(tradeExecutions.id, executionId));

    logger.debug({
      executionId,
      symbol: execution.symbol,
      newBarsInTrade,
      priceMovementPercent: priceMovementPercent.toFixed(2),
      significantMovement,
    }, 'Incremented bars in trade');

    return {
      executionId,
      newBarsInTrade,
      priceMovementPercent,
      significantMovement,
    };
  }

  async handleStalePosition(
    execution: TradeExecution,
    _config: OpportunityCostConfig,
    check: StaleTradeCheck,
    currentPrice: number
  ): Promise<void> {
    const wsService = getWebSocketService();

    switch (check.recommendedAction) {
      case 'ALERT':
        await this.sendStaleTradeAlert(execution, check);
        break;

      case 'TIGHTEN':
        if (check.newStopLoss) {
          await this.applyStopTightening(execution, check.newStopLoss, check.reason);
          if (wsService) {
            wsService.emitPositionUpdate(execution.walletId, {
              ...execution,
              stopLoss: check.newStopLoss.toString(),
            });
          }
        }
        break;

      case 'CLOSE':
        logger.info({
          executionId: execution.id,
          symbol: execution.symbol,
          barsInTrade: check.barsInTrade,
          reason: check.reason,
        }, 'Auto-closing stale trade');

        await db
          .update(tradeExecutions)
          .set({
            status: 'closed',
            exitPrice: currentPrice.toString(),
            exitReason: 'STALE_TRADE',
            exitSource: 'OPPORTUNITY_COST',
            closedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(tradeExecutions.id, execution.id));

        if (wsService) {
          wsService.emitPositionUpdate(execution.walletId, {
            ...execution,
            status: 'closed',
            exitPrice: currentPrice.toString(),
            exitReason: 'STALE_TRADE',
          });
          wsService.emitNotification(execution.walletId, {
            type: 'warning',
            title: 'Trade Auto-Closed',
            message: `${execution.symbol} closed due to stale trade (${check.barsInTrade} bars)`,
          });
        }
        break;
    }
  }

  private calculatePriceMovementPercent(
    entryPrice: number,
    highestPrice: number,
    lowestPrice: number,
    side: 'LONG' | 'SHORT'
  ): number {
    if (entryPrice === 0) return 0;

    if (side === 'LONG') {
      const upMove = ((highestPrice - entryPrice) / entryPrice) * 100;
      const downMove = ((entryPrice - lowestPrice) / entryPrice) * 100;
      return Math.max(upMove, downMove);
    } else {
      const downMove = ((entryPrice - lowestPrice) / entryPrice) * 100;
      const upMove = ((highestPrice - entryPrice) / entryPrice) * 100;
      return Math.max(downMove, upMove);
    }
  }

  private calculateProfitPercent(
    entryPrice: number,
    currentPrice: number,
    side: 'LONG' | 'SHORT'
  ): number {
    if (entryPrice === 0) return 0;

    if (side === 'LONG') {
      return ((currentPrice - entryPrice) / entryPrice) * 100;
    } else {
      return ((entryPrice - currentPrice) / entryPrice) * 100;
    }
  }

  private calculateTightenedStop(
    execution: TradeExecution,
    config: OpportunityCostConfig,
    currentPrice: number,
    _profitPercent: number
  ): number {
    const entryPrice = parseNumeric(execution.entryPrice);
    const currentStopLoss = parseNumeric(execution.stopLoss);
    const barsInTrade = execution.barsInTrade ?? 0;

    const barsOverThreshold = Math.max(0, barsInTrade - config.timeTightenAfterBars);
    const lockPercent = Math.min(barsOverThreshold * config.timeTightenPercentPerBar, this.MAX_LOCK_PERCENT);

    const profitDistance = Math.abs(currentPrice - entryPrice);
    const lockAmount = profitDistance * (lockPercent / 100);

    let newStopLoss: number;
    if (execution.side === 'LONG') {
      newStopLoss = entryPrice + lockAmount;
      newStopLoss = Math.max(newStopLoss, currentStopLoss);
    } else {
      newStopLoss = entryPrice - lockAmount;
      newStopLoss = Math.min(newStopLoss, currentStopLoss);
    }

    return newStopLoss;
  }

  private calculateTimeBasedTightening(
    execution: TradeExecution,
    config: OpportunityCostConfig,
    currentPrice: number,
    profitPercent: number
  ): number | null {
    return this.calculateTightenedStop(execution, config, currentPrice, profitPercent);
  }

  private async applyStopTightening(
    execution: TradeExecution,
    newStopLoss: number,
    reason?: string
  ): Promise<void> {
    const currentStopLoss = parseNumeric(execution.stopLoss);
    const originalStopLoss = parseNumeric(execution.originalStopLoss) || currentStopLoss;

    await db
      .update(tradeExecutions)
      .set({
        stopLoss: newStopLoss.toString(),
        originalStopLoss: originalStopLoss.toString(),
        updatedAt: new Date(),
      })
      .where(eq(tradeExecutions.id, execution.id));

    logger.info({
      executionId: execution.id,
      symbol: execution.symbol,
      oldStopLoss: currentStopLoss,
      newStopLoss,
      reason,
    }, 'Applied time-based stop tightening');
  }

  private async sendStaleTradeAlert(
    execution: TradeExecution,
    check: StaleTradeCheck
  ): Promise<void> {
    const now = new Date();
    const lastAlertTime = execution.opportunityCostAlertSentAt?.getTime() ?? 0;

    if (now.getTime() - lastAlertTime < this.ALERT_COOLDOWN_MS) {
      return;
    }

    await db
      .update(tradeExecutions)
      .set({
        opportunityCostAlertSentAt: now,
        updatedAt: now,
      })
      .where(eq(tradeExecutions.id, execution.id));

    const wsService = getWebSocketService();
    if (wsService) {
      wsService.emitNotification(execution.walletId, {
        type: 'warning',
        title: 'Stale Trade Alert',
        message: `${execution.symbol} has been in trade for ${check.barsInTrade} bars with only ${check.priceMovementPercent.toFixed(2)}% movement`,
      });
    }

    logger.info({
      executionId: execution.id,
      symbol: execution.symbol,
      barsInTrade: check.barsInTrade,
      priceMovementPercent: check.priceMovementPercent,
    }, 'Sent stale trade alert');
  }

  private async getConfig(walletId: string): Promise<OpportunityCostConfig | null> {
    const config = await db
      .select()
      .from(autoTradingConfig)
      .where(eq(autoTradingConfig.walletId, walletId))
      .limit(1)
      .then(rows => rows[0]);

    if (!config) return null;

    return {
      opportunityCostEnabled: config.opportunityCostEnabled,
      maxHoldingPeriodBars: config.maxHoldingPeriodBars,
      stalePriceThresholdPercent: parseFloat(config.stalePriceThresholdPercent),
      staleTradeAction: config.staleTradeAction,
      timeBasedStopTighteningEnabled: config.timeBasedStopTighteningEnabled,
      timeTightenAfterBars: config.timeTightenAfterBars,
      timeTightenPercentPerBar: parseFloat(config.timeTightenPercentPerBar),
    };
  }

  private async getCurrentPrice(symbol: string, marketType: 'SPOT' | 'FUTURES'): Promise<number | null> {
    try {
      return await priceCache.fetchPrice(symbol, marketType);
    } catch (error) {
      logger.error({
        symbol,
        marketType,
        error: serializeError(error),
      }, 'Error fetching current price');
      return null;
    }
  }
}

export const opportunityCostManagerService = new OpportunityCostManagerService();
