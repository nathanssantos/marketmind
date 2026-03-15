import { randomUUID } from 'crypto';
import type { ScalpingSignal, ScalpingExecutionMode } from '@marketmind/types';
import { db } from '../../db';
import { tradeExecutions, type Wallet } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '../logger';
import { serializeError } from '../../utils/errors';
import { SCALPING_ENGINE } from '../../constants/scalping';
import type { SignalEngine } from './signal-engine';
import type { BalanceCache } from './types';
import { autoTradingService, type OrderParams } from '../auto-trading';
import { createStopLossOrder, createTakeProfitOrder, updateStopLossOrder } from '../protection-orders';
import { walletQueries } from '../database/walletQueries';
import { getMinNotionalFilterService } from '../min-notional-filter';
import { getFuturesClient } from '../../exchange';

export interface ExecutionEngineConfig {
  walletId: string;
  userId: string;
  executionMode: ScalpingExecutionMode;
  positionSizePercent: number;
  leverage: number;
  maxConcurrentPositions: number;
  microTrailingTicks: number;
}

export class ExecutionEngine {
  private config: ExecutionEngineConfig;
  private signalEngine: SignalEngine;
  private activePositions = new Map<string, string>();
  private lastTrailingUpdate = new Map<string, number>();
  private balanceCache: BalanceCache | null = null;

  constructor(config: ExecutionEngineConfig, signalEngine: SignalEngine) {
    this.config = config;
    this.signalEngine = signalEngine;
  }

  private async getFreshBalance(wallet: Wallet): Promise<number> {
    const now = Date.now();
    if (this.balanceCache && now - this.balanceCache.timestamp < SCALPING_ENGINE.BALANCE_CACHE_TTL_MS) {
      return this.balanceCache.balance;
    }

    try {
      const client = getFuturesClient(wallet);
      const account = await client.getAccountInfo();
      const balance = parseFloat(account.availableBalance);
      this.balanceCache = { balance, timestamp: now };
      return balance;
    } catch (error) {
      logger.warn({ error: serializeError(error) }, 'Failed to fetch fresh balance from Binance, falling back to DB');
      return parseFloat(wallet.currentBalance ?? '0');
    }
  }

  async executeSignal(signal: ScalpingSignal): Promise<void> {
    try {
      if (this.activePositions.size >= this.config.maxConcurrentPositions) {
        logger.trace({ symbol: signal.symbol }, 'Max concurrent scalping positions reached');
        return;
      }

      if (this.activePositions.has(signal.symbol)) {
        logger.trace({ symbol: signal.symbol }, 'Already have scalping position for symbol');
        return;
      }

      const wallet = await walletQueries.getByIdAndUser(this.config.walletId, this.config.userId);

      const walletBalance = await this.getFreshBalance(wallet as Wallet);
      if (walletBalance <= 0) {
        logger.warn({ walletId: this.config.walletId }, 'Insufficient wallet balance for scalping');
        return;
      }

      const positionValue = (walletBalance * this.config.positionSizePercent) / 100;
      const quantity = positionValue / signal.entryPrice;
      const side: 'BUY' | 'SELL' = signal.direction === 'LONG' ? 'BUY' : 'SELL';

      const orderParams: OrderParams = this.buildOrderParams(signal, side, quantity);

      const orderResult = await autoTradingService.executeBinanceOrder(
        wallet as Wallet,
        orderParams,
        'FUTURES',
      );

      const executedQty = parseFloat(orderResult.executedQty);
      const executionId = randomUUID();
      const setupType = `scalping-${signal.strategy}`;

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

      await db.insert(tradeExecutions).values({
        id: executionId,
        userId: this.config.userId,
        walletId: this.config.walletId,
        symbol: signal.symbol,
        side: signal.direction,
        entryPrice: orderResult.price,
        quantity: String(executedQty),
        stopLoss: String(signal.stopLoss),
        takeProfit: String(signal.takeProfit),
        status: 'open',
        setupType,
        marketType: 'FUTURES',
        entryOrderId: orderResult.orderId,
        entryOrderType: orderParams.type as 'MARKET' | 'LIMIT' | 'STOP_MARKET' | 'TAKE_PROFIT_MARKET',
        stopLossAlgoId: slResult.algoId ?? null,
        stopLossOrderId: slResult.orderId ?? null,
        stopLossIsAlgo: !!slResult.algoId,
        takeProfitAlgoId: tpResult.algoId ?? null,
        takeProfitOrderId: tpResult.orderId ?? null,
        takeProfitIsAlgo: !!tpResult.algoId,
        openedAt: new Date(),
      });

      this.activePositions.set(signal.symbol, executionId);

      logger.info({
        executionId,
        symbol: signal.symbol,
        strategy: signal.strategy,
        direction: signal.direction,
        entryPrice: orderResult.price,
        quantity: executedQty,
        mode: this.config.executionMode,
        orderId: orderResult.orderId,
        slFailed,
        tpFailed,
      }, 'Scalping execution opened on Binance');
    } catch (error) {
      logger.error({ error: serializeError(error), signal: signal.id }, 'Failed to execute scalping signal');
    }
  }

  async closePosition(symbol: string, exitPrice: number, pnl: number): Promise<void> {
    const executionId = this.activePositions.get(symbol);
    if (!executionId) return;

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

      const walletBalance = await this.getFreshBalance(wallet as Wallet);
      this.signalEngine.recordTrade(pnl, walletBalance);

      logger.info({ executionId, symbol, exitPrice, pnl }, 'Scalping position closed');
    } catch (error) {
      logger.error({ error: serializeError(error), executionId, symbol }, 'Failed to close scalping position');
    }
  }

  async handlePositionClosed(symbol: string, pnl: number): Promise<void> {
    if (!this.activePositions.has(symbol)) return;
    this.activePositions.delete(symbol);

    try {
      const wallet = await walletQueries.getByIdAndUser(this.config.walletId, this.config.userId);
      const walletBalance = await this.getFreshBalance(wallet as Wallet);
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

  async restoreActivePositions(): Promise<void> {
    try {
      const openExecutions = await db.query.tradeExecutions.findMany({
        where: and(
          eq(tradeExecutions.walletId, this.config.walletId),
          eq(tradeExecutions.status, 'open'),
        ),
      });

      for (const exec of openExecutions) {
        if (exec.setupType?.startsWith('scalping-')) {
          this.activePositions.set(exec.symbol, exec.id);
        }
      }

      if (this.activePositions.size > 0) {
        logger.info(
          { walletId: this.config.walletId, count: this.activePositions.size, symbols: this.getActiveSymbols() },
          'Restored active scalping positions',
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

    const now = Date.now();
    const lastUpdate = this.lastTrailingUpdate.get(symbol) ?? 0;
    if (now - lastUpdate < SCALPING_ENGINE.MICRO_TRAILING_MIN_INTERVAL_MS) return;

    try {
      const execution = await db.query.tradeExecutions.findFirst({
        where: and(
          eq(tradeExecutions.id, executionId),
          eq(tradeExecutions.walletId, this.config.walletId),
        ),
      });
      if (!execution || execution.status !== 'open') {
        if (!execution) {
          this.activePositions.delete(symbol);
          logger.warn({ symbol, executionId }, 'Stale execution in micro-trailing, cleaned up');
        }
        return;
      }

      const filterService = getMinNotionalFilterService();
      const filters = await filterService.getSymbolFilters('FUTURES');
      const symbolFilters = filters.get(symbol);
      const tickSize = symbolFilters?.tickSize ?? SCALPING_ENGINE.DEFAULT_TICK_SIZE;

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

      this.lastTrailingUpdate.set(symbol, now);

      logger.debug({ symbol, oldSL: currentSL, newSL, tickSize, ticks: this.config.microTrailingTicks }, 'Micro-trailing SL updated');
    } catch (error) {
      logger.error({ error: serializeError(error), symbol }, 'Failed to update micro-trailing SL');
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
  }
}
