import { randomUUID } from 'crypto';
import type { ScalpingSignal, ScalpingExecutionMode } from '@marketmind/types';
import { db } from '../../db';
import { tradeExecutions, type Wallet } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '../logger';
import { serializeError } from '../../utils/errors';
import type { SignalEngine } from './signal-engine';
import { autoTradingService, type OrderParams } from '../auto-trading';
import { createStopLossOrder, createTakeProfitOrder } from '../protection-orders';
import { walletQueries } from '../database/walletQueries';

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

  constructor(config: ExecutionEngineConfig, signalEngine: SignalEngine) {
    this.config = config;
    this.signalEngine = signalEngine;
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

      const walletBalance = parseFloat((wallet as Wallet).currentBalance ?? '0');
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

      try {
        [slResult, tpResult] = await Promise.all([
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
      } catch (protectionError) {
        logger.error({ error: serializeError(protectionError), symbol: signal.symbol }, 'Failed to create protection orders for scalping');
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
      this.signalEngine.recordTrade(pnl);

      logger.info({ executionId, symbol, exitPrice, pnl }, 'Scalping position closed');
    } catch (error) {
      logger.error({ error: serializeError(error), executionId, symbol }, 'Failed to close scalping position');
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
