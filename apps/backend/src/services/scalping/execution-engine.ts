import { randomUUID } from 'crypto';
import type { EntryOrderType, ScalpingSignal, ScalpingExecutionMode } from '@marketmind/types';
import { db } from '../../db';
import { tradeExecutions } from '../../db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { ACTIVE_TRADE_STATUSES } from '@marketmind/types';
import { logger } from '../logger';
import { serializeError } from '../../utils/errors';
import type { SignalEngine } from './signal-engine';
import { autoTradingService, type OrderParams } from '../auto-trading';
import { createStopLossOrder, createTakeProfitOrder } from '../protection-orders';
import { walletQueries } from '../database/walletQueries';
import { buildOrderParams, checkMicroTrailing, type MicroTrailingState } from './micro-trailing';

export interface ExecutionEngineConfig {
  walletId: string;
  userId: string;
  executionMode: ScalpingExecutionMode;
  positionSizePercent: number;
  leverage: number;
  marginType: 'ISOLATED' | 'CROSSED';
  maxConcurrentPositions: number;
  microTrailingTicks: number;
}

export class ExecutionEngine {
  private config: ExecutionEngineConfig;
  private signalEngine: SignalEngine;
  private activePositions = new Map<string, string>();
  private executingSymbols = new Set<string>();
  private blockedSymbols = new Set<string>();
  private lastTrailingUpdate = new Map<string, number>();
  private trailingInFlight = new Set<string>();
  private trailingErrorCount = new Map<string, number>();
  private symbolTickSizes = new Map<string, number>();

  constructor(config: ExecutionEngineConfig, signalEngine: SignalEngine) {
    this.config = config;
    this.signalEngine = signalEngine;
  }

  async executeSignal(signal: ScalpingSignal): Promise<void> {
    if (this.executingSymbols.has(signal.symbol)) return;
    if (this.blockedSymbols.has(signal.symbol)) return;
    if (this.activePositions.size >= this.config.maxConcurrentPositions) {
      logger.trace({ symbol: signal.symbol }, 'Max concurrent scalping positions reached');
      return;
    }
    if (this.activePositions.has(signal.symbol)) {
      logger.trace({ symbol: signal.symbol }, 'Already have scalping position for symbol');
      return;
    }

    this.executingSymbols.add(signal.symbol);
    const executionId = randomUUID();
    this.activePositions.set(signal.symbol, executionId);
    let positionOpened = false;

    try {
      const existingPosition = await db.query.tradeExecutions.findFirst({
        where: and(
          eq(tradeExecutions.walletId, this.config.walletId),
          eq(tradeExecutions.symbol, signal.symbol),
          inArray(tradeExecutions.status, [...ACTIVE_TRADE_STATUSES]),
        ),
        columns: { id: true, setupType: true },
      });

      if (existingPosition) {
        logger.trace({ symbol: signal.symbol, existingSetup: existingPosition.setupType }, 'Scalping blocked: active position exists for symbol');
        return;
      }

      const wallet = await walletQueries.getByIdAndUser(this.config.walletId, this.config.userId);
      const walletBalance = parseFloat((wallet).currentBalance ?? '0');
      if (walletBalance <= 0) {
        logger.warn({ walletId: this.config.walletId }, 'Insufficient wallet balance for scalping');
        return;
      }

      await autoTradingService.setFuturesMarginType(wallet, signal.symbol, this.config.marginType);

      const client = (await import('../../exchange')).getFuturesClient(wallet);
      const pos = await client.getPosition(signal.symbol);
      const actualLeverage = pos ? Number(pos.leverage) : 1;

      const positionValue = (walletBalance * this.config.positionSizePercent) / 100;
      const quantity = positionValue / signal.entryPrice;
      const side: 'BUY' | 'SELL' = signal.direction === 'LONG' ? 'BUY' : 'SELL';

      const orderParams: OrderParams = buildOrderParams(this.config.executionMode, signal, side, quantity);
      const setupType = `scalping-${signal.strategy}`;

      await db.insert(tradeExecutions).values({
        id: executionId,
        userId: this.config.userId,
        walletId: this.config.walletId,
        symbol: signal.symbol,
        side: signal.direction,
        entryPrice: String(signal.entryPrice),
        quantity: String(quantity),
        stopLoss: String(signal.stopLoss),
        takeProfit: String(signal.takeProfit),
        status: 'pending',
        setupType,
        marketType: 'FUTURES',
        leverage: actualLeverage,
        entryOrderType: orderParams.type as EntryOrderType,
        openedAt: new Date(),
      });

      let orderResult;
      try {
        orderResult = await autoTradingService.executeBinanceOrder(
          wallet,
          orderParams,
          'FUTURES',
        );
      } catch (orderError) {
        await db.delete(tradeExecutions).where(eq(tradeExecutions.id, executionId));
        logger.error({ error: serializeError(orderError), symbol: signal.symbol }, 'Failed to submit scalping order, rolled back');
        return;
      }

      const executedQty = parseFloat(orderResult.executedQty);

      let slResult: { algoId?: string | null; orderId?: string | null } = {};
      let tpResult: { algoId?: string | null; orderId?: string | null } = {};
      let slFailed = false;
      let tpFailed = false;

      try {
        const results = await Promise.allSettled([
          createStopLossOrder({
            wallet: wallet,
            symbol: signal.symbol,
            side: signal.direction,
            quantity: executedQty,
            triggerPrice: signal.stopLoss,
            marketType: 'FUTURES',
          }),
          createTakeProfitOrder({
            wallet: wallet,
            symbol: signal.symbol,
            side: signal.direction,
            quantity: executedQty,
            triggerPrice: signal.takeProfit,
            marketType: 'FUTURES',
          }),
        ]);

        if (results[0].status === 'fulfilled') {
          slResult = results[0].value;
        } else {
          slFailed = true;
          logger.error({ error: serializeError(results[0].reason), symbol: signal.symbol }, 'Failed to create SL for scalping');
        }

        if (results[1].status === 'fulfilled') {
          tpResult = results[1].value;
        } else {
          tpFailed = true;
          logger.error({ error: serializeError(results[1].reason), symbol: signal.symbol }, 'Failed to create TP for scalping');
        }
      } catch (protectionError) {
        slFailed = true;
        tpFailed = true;
        logger.error({ error: serializeError(protectionError), symbol: signal.symbol }, 'Failed to create protection orders for scalping');
      }

      if (slFailed && tpFailed) {
        await db.delete(tradeExecutions).where(eq(tradeExecutions.id, executionId));
        logger.error({ symbol: signal.symbol, executedQty }, 'CRITICAL: Both SL and TP failed — closing position immediately');
        try {
          const closeSide: 'BUY' | 'SELL' = signal.direction === 'LONG' ? 'SELL' : 'BUY';
          await autoTradingService.executeBinanceOrder(
            wallet,
            { symbol: signal.symbol, side: closeSide, type: 'MARKET', quantity: executedQty, reduceOnly: true },
            'FUTURES',
          );
        } catch (closeError) {
          logger.error({ error: serializeError(closeError), symbol: signal.symbol }, 'CRITICAL: Failed to emergency-close unprotected position');
        }
        return;
      }

      if (slFailed) {
        logger.error({ symbol: signal.symbol, executedQty }, 'CRITICAL: SL creation failed — position has NO stop loss');
      }

      await db.update(tradeExecutions)
        .set({
          status: 'open',
          entryPrice: orderResult.price,
          quantity: String(executedQty),
          entryOrderId: orderResult.orderId,
          stopLossAlgoId: slResult.algoId ?? null,
          stopLossOrderId: slResult.orderId ?? null,
          stopLossIsAlgo: !!slResult.algoId,
          takeProfitAlgoId: tpResult.algoId ?? null,
          takeProfitOrderId: tpResult.orderId ?? null,
          takeProfitIsAlgo: !!tpResult.algoId,
        })
        .where(eq(tradeExecutions.id, executionId));

      positionOpened = true;

      logger.info({
        executionId,
        symbol: signal.symbol,
        strategy: signal.strategy,
        direction: signal.direction,
        entryPrice: orderResult.price,
        quantity: executedQty,
        leverage: actualLeverage,
        mode: this.config.executionMode,
        orderId: orderResult.orderId,
        slFailed,
        tpFailed,
      }, 'Scalping execution opened on Binance');
    } catch (error) {
      logger.error({ error: serializeError(error), signal: signal.id }, 'Failed to execute scalping signal');
    } finally {
      if (!positionOpened) this.activePositions.delete(signal.symbol);
      this.executingSymbols.delete(signal.symbol);
    }
  }

  async closePosition(symbol: string, exitPrice: number, pnl: number): Promise<void> {
    const executionId = this.activePositions.get(symbol);
    if (!executionId) return;

    this.clearTrailingState(symbol);

    try {
      const wallet = await walletQueries.getByIdAndUser(this.config.walletId, this.config.userId);

      const execution = await db.query.tradeExecutions.findFirst({
        where: and(
          eq(tradeExecutions.id, executionId),
          eq(tradeExecutions.walletId, this.config.walletId),
        ),
      });

      if (execution) {
        const quantity = parseFloat(execution.quantity);
        const closeSide: 'BUY' | 'SELL' = execution.side === 'LONG' ? 'SELL' : 'BUY';

        try {
          await autoTradingService.executeBinanceOrder(
            wallet,
            {
              symbol,
              side: closeSide,
              type: 'MARKET',
              quantity,
              reduceOnly: true,
            },
            'FUTURES',
          );
        } catch (closeError) {
          logger.error({ error: serializeError(closeError), symbol }, 'Failed to close scalping position on Binance');
        }
      }

      await db.update(tradeExecutions)
        .set({
          status: 'closed',
          exitPrice: String(exitPrice),
          pnl: String(pnl),
          closedAt: new Date(),
        })
        .where(and(
          eq(tradeExecutions.id, executionId),
          eq(tradeExecutions.walletId, this.config.walletId),
        ));

      this.activePositions.delete(symbol);

      const walletBalance = parseFloat((wallet).currentBalance ?? '0');
      this.signalEngine.recordTrade(pnl, walletBalance);

      logger.info({ executionId, symbol, exitPrice, pnl }, 'Scalping position closed');
    } catch (error) {
      logger.error({ error: serializeError(error), executionId, symbol }, 'Failed to close scalping position');
    }
  }

  async handlePositionClosed(symbol: string, pnl: number): Promise<void> {
    if (this.blockedSymbols.has(symbol)) {
      this.blockedSymbols.delete(symbol);
      logger.info({ symbol }, 'Pre-existing position closed — symbol unblocked for scalping');
      return;
    }

    if (!this.activePositions.has(symbol)) return;
    this.activePositions.delete(symbol);
    this.clearTrailingState(symbol);

    try {
      const wallet = await walletQueries.getByIdAndUser(this.config.walletId, this.config.userId);
      const walletBalance = parseFloat((wallet).currentBalance ?? '0');
      this.signalEngine.recordTrade(pnl, walletBalance);
    } catch (error) {
      logger.error({ error: serializeError(error), symbol }, 'Failed to fetch balance for recordTrade, using 0');
      this.signalEngine.recordTrade(pnl, 0);
    }

    logger.info({ symbol, pnl }, 'Scalping position closed via event bus');
  }

  hasActivePosition(symbol: string): boolean {
    return this.activePositions.has(symbol);
  }

  isSymbolBlocked(symbol: string): boolean {
    return this.blockedSymbols.has(symbol);
  }

  async restoreActivePositions(): Promise<void> {
    try {
      const openExecutions = await db.query.tradeExecutions.findMany({
        where: and(
          eq(tradeExecutions.walletId, this.config.walletId),
          inArray(tradeExecutions.status, [...ACTIVE_TRADE_STATUSES]),
        ),
      });

      for (const exec of openExecutions) {
        if (exec.setupType?.startsWith('scalping-')) {
          this.activePositions.set(exec.symbol, exec.id);
        } else {
          this.blockedSymbols.add(exec.symbol);
        }
      }

      if (this.activePositions.size > 0) {
        logger.info(
          { walletId: this.config.walletId, count: this.activePositions.size, symbols: this.getActiveSymbols() },
          'Restored active scalping positions',
        );
      }

      if (this.blockedSymbols.size > 0) {
        logger.info(
          { walletId: this.config.walletId, count: this.blockedSymbols.size, symbols: Array.from(this.blockedSymbols) },
          'Blocked symbols with pre-existing positions (scalping will start when they close)',
        );
      }
    } catch (error) {
      logger.error({ error: serializeError(error) }, 'Failed to restore active scalping positions');
    }
  }

  async checkMicroTrailing(symbol: string, currentPrice: number): Promise<void> {
    const state: MicroTrailingState = {
      activePositions: this.activePositions,
      lastTrailingUpdate: this.lastTrailingUpdate,
      trailingInFlight: this.trailingInFlight,
      trailingErrorCount: this.trailingErrorCount,
      symbolTickSizes: this.symbolTickSizes,
    };
    return checkMicroTrailing(symbol, currentPrice, this.config, state);
  }

  updateConfig(config: Partial<ExecutionEngineConfig>): void {
    Object.assign(this.config, config);
  }

  getActivePositionCount(): number {
    return this.activePositions.size;
  }

  getActiveSymbols(): string[] {
    return Array.from(this.activePositions.keys());
  }

  stop(): void {
    this.activePositions.clear();
    this.blockedSymbols.clear();
    this.trailingInFlight.clear();
    this.lastTrailingUpdate.clear();
    this.trailingErrorCount.clear();
    this.symbolTickSizes.clear();
  }

  private clearTrailingState(symbol: string): void {
    this.trailingInFlight.delete(symbol);
    this.lastTrailingUpdate.delete(symbol);
    this.trailingErrorCount.delete(symbol);
  }
}
