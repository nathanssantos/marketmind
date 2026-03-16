import { randomUUID } from 'crypto';
import type { ScalpingSignal, ScalpingExecutionMode } from '@marketmind/types';
import { db } from '../../db';
import { tradeExecutions, type Wallet } from '../../db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { ACTIVE_TRADE_STATUSES } from '@marketmind/types';
import { logger } from '../logger';
import { serializeError } from '../../utils/errors';
import { SCALPING_ENGINE } from '../../constants/scalping';
import type { SignalEngine } from './signal-engine';
import { autoTradingService, type OrderParams } from '../auto-trading';
import { BinanceIpBannedError } from '../binance-api-cache';
import { createStopLossOrder, createTakeProfitOrder, updateStopLossOrder } from '../protection-orders';
import { walletQueries } from '../database/walletQueries';
import { getMinNotionalFilterService } from '../min-notional-filter';

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
      const walletBalance = parseFloat((wallet as Wallet).currentBalance ?? '0');
      if (walletBalance <= 0) {
        logger.warn({ walletId: this.config.walletId }, 'Insufficient wallet balance for scalping');
        return;
      }

      await autoTradingService.setFuturesLeverage(wallet as Wallet, signal.symbol, this.config.leverage);
      await autoTradingService.setFuturesMarginType(wallet as Wallet, signal.symbol, this.config.marginType);

      const positionValue = (walletBalance * this.config.positionSizePercent) / 100;
      const quantity = positionValue / signal.entryPrice;
      const side: 'BUY' | 'SELL' = signal.direction === 'LONG' ? 'BUY' : 'SELL';

      const orderParams: OrderParams = this.buildOrderParams(signal, side, quantity);
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
        leverage: this.config.leverage,
        entryOrderType: orderParams.type as 'MARKET' | 'LIMIT' | 'STOP_MARKET' | 'TAKE_PROFIT_MARKET',
        openedAt: new Date(),
      });

      let orderResult;
      try {
        orderResult = await autoTradingService.executeBinanceOrder(
          wallet as Wallet,
          orderParams,
          'FUTURES',
        );
      } catch (orderError) {
        await db.delete(tradeExecutions).where(eq(tradeExecutions.id, executionId));
        logger.error({ error: serializeError(orderError), symbol: signal.symbol }, 'Failed to submit scalping order, rolled back');
        return;
      }

      const executedQty = parseFloat(orderResult.executedQty);

      let slResult: { algoId?: number | null; orderId?: number | null } = {};
      let tpResult: { algoId?: number | null; orderId?: number | null } = {};
      let slFailed = false;
      let tpFailed = false;

      try {
        const results = await Promise.allSettled([
          createStopLossOrder({
            wallet: wallet as Wallet,
            symbol: signal.symbol,
            side: signal.direction,
            quantity: executedQty,
            triggerPrice: signal.stopLoss,
            marketType: 'FUTURES',
          }),
          createTakeProfitOrder({
            wallet: wallet as Wallet,
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
            wallet as Wallet,
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
        leverage: this.config.leverage,
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
            wallet as Wallet,
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

      const walletBalance = parseFloat((wallet as Wallet).currentBalance ?? '0');
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
      const walletBalance = parseFloat((wallet as Wallet).currentBalance ?? '0');
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
    if (this.config.microTrailingTicks <= 0) return;

    const executionId = this.activePositions.get(symbol);
    if (!executionId) return;

    if (this.trailingInFlight.has(symbol)) return;

    const now = Date.now();
    const lastUpdate = this.lastTrailingUpdate.get(symbol) ?? 0;
    if (now - lastUpdate < SCALPING_ENGINE.MICRO_TRAILING_MIN_INTERVAL_MS) return;

    this.trailingInFlight.add(symbol);
    try {
      const execution = await db.query.tradeExecutions.findFirst({
        where: and(
          eq(tradeExecutions.id, executionId),
          eq(tradeExecutions.walletId, this.config.walletId),
        ),
      });

      if (!this.activePositions.has(symbol)) return;

      if (!execution || execution.status !== 'open') {
        if (!execution) {
          this.activePositions.delete(symbol);
          logger.warn({ symbol, executionId }, 'Stale execution in micro-trailing, cleaned up');
        }
        return;
      }

      let tickSize = this.symbolTickSizes.get(symbol);
      if (tickSize === undefined) {
        const filterService = getMinNotionalFilterService();
        const filters = await filterService.getSymbolFilters('FUTURES');
        const symbolFilters = filters.get(symbol);
        tickSize = symbolFilters?.tickSize ?? SCALPING_ENGINE.DEFAULT_TICK_SIZE;
        this.symbolTickSizes.set(symbol, tickSize);
      }

      const currentSL = parseFloat(execution.stopLoss ?? '0');
      if (currentSL <= 0) return;

      const trailingDistance = this.config.microTrailingTicks * tickSize;
      const side = execution.side as 'LONG' | 'SHORT';

      let newSL: number;
      if (side === 'LONG') {
        newSL = currentPrice - trailingDistance;
        if (newSL <= currentSL) return;
      } else {
        newSL = currentPrice + trailingDistance;
        if (newSL >= currentSL) return;
      }

      this.lastTrailingUpdate.set(symbol, now);

      const wallet = await walletQueries.getByIdAndUser(this.config.walletId, this.config.userId);
      const quantity = parseFloat(execution.quantity);

      const result = await updateStopLossOrder({
        wallet: wallet as Wallet,
        symbol,
        side,
        quantity,
        triggerPrice: newSL,
        marketType: 'FUTURES',
        currentAlgoId: execution.stopLossAlgoId ? Number(execution.stopLossAlgoId) : null,
        currentOrderId: execution.stopLossOrderId ? Number(execution.stopLossOrderId) : null,
      });

      await db.update(tradeExecutions)
        .set({
          stopLoss: String(newSL),
          stopLossAlgoId: result.algoId ?? null,
          stopLossOrderId: result.orderId ?? null,
          stopLossIsAlgo: !!result.algoId,
        })
        .where(eq(tradeExecutions.id, executionId));

      this.trailingErrorCount.delete(symbol);
      logger.debug({ symbol, oldSL: currentSL, newSL, tickSize, ticks: this.config.microTrailingTicks }, 'Micro-trailing SL updated');
    } catch (error) {
      const errorCount = (this.trailingErrorCount.get(symbol) ?? 0) + 1;
      this.trailingErrorCount.set(symbol, errorCount);

      if (error instanceof BinanceIpBannedError) {
        this.lastTrailingUpdate.set(symbol, now + SCALPING_ENGINE.IP_BAN_PAUSE_MS);
        logger.error({ symbol }, 'IP banned — micro-trailing paused for 5 minutes');
        return;
      }

      const backoffMs = Math.min(
        SCALPING_ENGINE.MICRO_TRAILING_ERROR_BACKOFF_MS * Math.pow(2, errorCount - 1),
        SCALPING_ENGINE.MICRO_TRAILING_MAX_BACKOFF_MS,
      );
      this.lastTrailingUpdate.set(symbol, now + backoffMs);
      logger.error({ error: serializeError(error), symbol, backoffMs, errorCount }, 'Failed to update micro-trailing SL');
    } finally {
      this.trailingInFlight.delete(symbol);
    }
  }

  private buildOrderParams(signal: ScalpingSignal, side: 'BUY' | 'SELL', quantity: number): OrderParams {
    switch (this.config.executionMode) {
      case 'POST_ONLY':
        return {
          symbol: signal.symbol,
          side,
          type: 'LIMIT',
          quantity,
          price: signal.entryPrice,
          timeInForce: 'GTC',
        };
      case 'IOC':
        return {
          symbol: signal.symbol,
          side,
          type: 'MARKET',
          quantity,
          timeInForce: 'IOC',
        };
      case 'MARKET':
      default:
        return {
          symbol: signal.symbol,
          side,
          type: 'MARKET',
          quantity,
        };
    }
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
