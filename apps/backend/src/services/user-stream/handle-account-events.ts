import { and, eq } from 'drizzle-orm';
import { db } from '../../db';
import { tradeExecutions, wallets } from '../../db/schema';
import { cancelFuturesAlgoOrder } from '../binance-futures-client';
import { cancelAllProtectionOrders } from '../protection-orders';
import { clearProtectionOrderIds, type ProtectionOrderField } from '../execution-manager';
import { logger, serializeError } from '../logger';
import { getWebSocketService } from '../websocket';
import type {
  UserStreamContext,
  FuturesAccountUpdate,
  FuturesMarginCall,
  FuturesAccountConfigUpdate,
  FuturesConditionalOrderReject,
} from './types';

export async function handleAccountUpdate(
  ctx: UserStreamContext,
  walletId: string,
  event: FuturesAccountUpdate
): Promise<void> {
  try {
    const { a: accountData } = event;
    const { m: reason, B: balances, P: positionUpdates } = accountData;

    logger.info(
      {
        walletId,
        reason,
        balanceCount: balances.length,
        positionCount: positionUpdates.length,
      },
      '[FuturesUserStream] Account update received'
    );

    for (const balance of balances) {
      if (balance.a === 'USDT') {
        const wallet = await ctx.getCachedWallet(walletId);

        if (wallet) {
          const newBalance = parseFloat(balance.wb);
          ctx.invalidateWalletCache(walletId);
          await db
            .update(wallets)
            .set({
              currentBalance: newBalance.toString(),
              updatedAt: new Date(),
            })
            .where(eq(wallets.id, walletId));

          logger.trace(
            { walletId, newBalance, reason },
            '[FuturesUserStream] Wallet balance synced from account update'
          );
        }
      }
    }

    const wsService = getWebSocketService();
    if (wsService) {
      wsService.emitWalletUpdate(walletId, { reason, balances, positions: positionUpdates });
    }
  } catch (error) {
    logger.error(
      {
        walletId,
        error: serializeError(error),
      },
      '[FuturesUserStream] Error handling account update'
    );
  }
}

export async function handleMarginCall(
  _ctx: UserStreamContext,
  walletId: string,
  event: FuturesMarginCall
): Promise<void> {
  try {
    const { cw: crossWalletBalance, p: positionsAtRisk } = event;

    logger.warn(
      {
        walletId,
        crossWalletBalance,
        positionsAtRiskCount: positionsAtRisk.length,
      },
      '[FuturesUserStream] ! MARGIN CALL received'
    );

    const wsService = getWebSocketService();
    if (wsService) {
      for (const pos of positionsAtRisk) {
        wsService.emitRiskAlert(walletId, {
          type: 'LIQUIDATION_RISK',
          level: 'critical',
          positionId: undefined,
          symbol: pos.s,
          message: `Margin call: ${pos.s} at risk. Maintenance margin: ${pos.mm}, Mark price: ${pos.mp}`,
          data: {
            symbol: pos.s,
            positionSide: pos.ps,
            positionAmount: pos.pa,
            marginType: pos.mt,
            isolatedWallet: pos.iw,
            markPrice: pos.mp,
            unrealizedPnl: pos.up,
            maintenanceMargin: pos.mm,
          },
          timestamp: Date.now(),
        });
      }
    }
  } catch (error) {
    logger.error(
      {
        walletId,
        error: serializeError(error),
      },
      '[FuturesUserStream] Error handling margin call'
    );
  }
}

export function handleConfigUpdate(
  _ctx: UserStreamContext,
  walletId: string,
  event: FuturesAccountConfigUpdate
): void {
  if (event.ac) {
    const newLeverage = event.ac.l;
    const symbol = event.ac.s;
    logger.info(
      { walletId, symbol, leverage: newLeverage },
      '[FuturesUserStream] Leverage updated'
    );

    void db.update(tradeExecutions)
      .set({ leverage: newLeverage })
      .where(
        and(
          eq(tradeExecutions.walletId, walletId),
          eq(tradeExecutions.symbol, symbol),
          eq(tradeExecutions.status, 'open'),
          eq(tradeExecutions.marketType, 'FUTURES')
        )
      )
      .returning()
      .then((updatedRows) => {
        logger.info({ walletId, symbol, newLeverage, rowsUpdated: updatedRows.length }, '[FuturesUserStream] Updated leverage on open executions');
        const wsService = getWebSocketService();
        if (wsService) {
          for (const row of updatedRows) {
            wsService.emitPositionUpdate(walletId, row);
          }
        }
      })
      .catch((err) => {
        logger.error({ walletId, symbol, error: serializeError(err) }, '[FuturesUserStream] Failed to update leverage on open executions');
      });
  }

  if (event.ai) {
    logger.info(
      {
        walletId,
        multiAssetMode: event.ai.j,
      },
      '[FuturesUserStream] Multi-asset mode updated'
    );
  }
}

export async function handleConditionalOrderReject(
  _ctx: UserStreamContext,
  walletId: string,
  event: FuturesConditionalOrderReject
): Promise<void> {
  const { or: orderReject } = event;
  const { s: symbol, i: orderId, r: reason } = orderReject;

  try {
    const [pendingEntry] = await db
      .select()
      .from(tradeExecutions)
      .where(
        and(
          eq(tradeExecutions.walletId, walletId),
          eq(tradeExecutions.status, 'pending'),
          eq(tradeExecutions.entryOrderId, String(orderId))
        )
      )
      .limit(1);

    if (pendingEntry) {
      await db
        .update(tradeExecutions)
        .set({ status: 'cancelled', pnl: '0', pnlPercent: '0', fees: '0', entryFee: '0', exitFee: '0', updatedAt: new Date() })
        .where(eq(tradeExecutions.id, pendingEntry.id));
      logger.warn(
        { walletId, symbol, orderId, reason },
        '[FuturesUserStream] Entry conditional order rejected — pending execution cancelled'
      );
      return;
    }
  } catch (error) {
    logger.error({ walletId, orderId, error: serializeError(error) }, '[FuturesUserStream] Error checking entry execution for conditional reject');
  }

  logger.error(
    {
      walletId,
      symbol,
      orderId,
      reason,
    },
    '[FuturesUserStream] ! CRITICAL: Conditional order (TP/SL) was REJECTED'
  );

  const wsService = getWebSocketService();
  if (wsService) {
    wsService.emitRiskAlert(walletId, {
      type: 'ORDER_REJECTED',
      level: 'critical',
      symbol,
      message: `TP/SL order rejected: ${reason}`,
      data: { orderId, reason },
      timestamp: Date.now(),
    });
  }

  try {
    const [execution] = await db
      .select()
      .from(tradeExecutions)
      .where(
        and(
          eq(tradeExecutions.walletId, walletId),
          eq(tradeExecutions.symbol, symbol),
          eq(tradeExecutions.status, 'open'),
          eq(tradeExecutions.marketType, 'FUTURES')
        )
      )
      .limit(1);

    if (execution) {
      const rejectOrderIdStr = String(orderId);
      const isSLReject = execution.stopLossOrderId === rejectOrderIdStr || execution.stopLossAlgoId === rejectOrderIdStr;
      const isTPReject = execution.takeProfitOrderId === rejectOrderIdStr || execution.takeProfitAlgoId === rejectOrderIdStr;

      if (isSLReject || isTPReject) {
        const field: ProtectionOrderField = isSLReject ? 'stopLoss' : 'takeProfit';
        await clearProtectionOrderIds(execution.id, field);

        logger.error(
          {
            executionId: execution.id,
            symbol,
            orderId,
            isSLReject,
            isTPReject,
            reason,
            clearedField: field,
          },
          '[FuturesUserStream] ! CRITICAL: Position protection order REJECTED - IDs cleared, MANUAL INTERVENTION REQUIRED'
        );
      }
    }
  } catch (error) {
    logger.error(
      { walletId, orderId, error: serializeError(error) },
      '[FuturesUserStream] Error handling conditional order reject'
    );
  }
}

export async function cancelPendingEntryOrders(
  ctx: UserStreamContext,
  walletId: string,
  symbol: string,
  closedExecutionId: string
): Promise<void> {
  try {
    const pendingEntries = await db
      .select()
      .from(tradeExecutions)
      .where(
        and(
          eq(tradeExecutions.walletId, walletId),
          eq(tradeExecutions.symbol, symbol),
          eq(tradeExecutions.status, 'pending'),
          eq(tradeExecutions.marketType, 'FUTURES')
        )
      );

    if (pendingEntries.length === 0) {
      logger.trace({ walletId, symbol, closedExecutionId }, '[FuturesUserStream] No pending entries to cancel after close');
      return;
    }

    const apiClient = ctx.connections.get(walletId)?.apiClient;
    const walletRow = await ctx.getCachedWallet(walletId);

    for (const pending of pendingEntries) {
      if (apiClient && pending.entryOrderId) {
        try {
          const entryOrderType = pending.entryOrderType;
          const isAlgoEntry = entryOrderType === 'STOP_MARKET' || entryOrderType === 'TAKE_PROFIT_MARKET';
          if (isAlgoEntry) {
            await cancelFuturesAlgoOrder(apiClient, pending.entryOrderId);
          } else {
            await apiClient.cancelOrder({ symbol, orderId: Number(pending.entryOrderId) });
          }
          logger.info({ walletId, symbol, entryOrderId: pending.entryOrderId, isAlgoEntry }, '[FuturesUserStream] Cancelled pending entry order');
        } catch (cancelErr) {
          const msg = serializeError(cancelErr);
          if (!msg.includes('Unknown order') && !msg.includes('Order does not exist') && !msg.includes('not found'))
            {logger.warn({ walletId, symbol, entryOrderId: pending.entryOrderId, error: msg }, '[FuturesUserStream] Failed to cancel pending entry order on exchange');}
        }
      }

      if (walletRow && (pending.stopLossAlgoId || pending.stopLossOrderId || pending.takeProfitAlgoId || pending.takeProfitOrderId)) {
        await cancelAllProtectionOrders({
          wallet: walletRow,
          symbol,
          marketType: 'FUTURES',
          stopLossAlgoId: pending.stopLossAlgoId,
          stopLossOrderId: pending.stopLossOrderId,
          takeProfitAlgoId: pending.takeProfitAlgoId,
          takeProfitOrderId: pending.takeProfitOrderId,
        });
      }

      await db.update(tradeExecutions).set({ status: 'cancelled', pnl: '0', pnlPercent: '0', fees: '0', entryFee: '0', exitFee: '0', updatedAt: new Date() }).where(eq(tradeExecutions.id, pending.id));
      logger.info({ walletId, symbol, executionId: pending.id, closedExecutionId }, '[FuturesUserStream] Cancelled pending entry execution after position close');
    }
  } catch (error) {
    logger.error(
      { walletId, symbol, closedExecutionId, error: serializeError(error) },
      '[FuturesUserStream] Failed to cancel pending entry orders'
    );
  }
}
