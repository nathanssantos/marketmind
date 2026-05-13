import type { MarketType } from '@marketmind/types';
import { calculatePnl } from '@marketmind/utils';
import { and, desc, eq, ilike } from 'drizzle-orm';
import { z } from 'zod';
import { tradeExecutions } from '../../db/schema';
import { env } from '../../env';
import { binanceApiCache } from '../../services/binance-api-cache';
import { isPaperWallet } from '../../services/binance-client';
import { getFuturesClient, getSpotClient } from '../../exchange';
import { walletQueries } from '../../services/database/walletQueries';
import { emitPositionClose } from '../../services/income-events';
import { logger } from '../../services/logger';
import { cancelAllProtectionOrders } from '../../services/protection-orders';
import { protectedProcedure, router } from '../../trpc';
import { serializeError } from '../../utils/errors';
import { badRequest, internalServerError, notFound } from '../../utils/trpc-errors';
import { closeExecutionAndBroadcast, emitPositionClosedEvents } from '../../services/wallet-broadcast';
import { withWriteLock } from '../../services/write-op-mutex';
import { cancelFuturesExecutionOrders, cancelSpotExecutionOrders } from './cancel-execution-helpers';

export const executionsRouter = router({
  getTradeExecutions: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        symbol: z.string().optional(),
        search: z.string().optional(),
        status: z.enum(['pending', 'open', 'closed', 'cancelled']).optional(),
        limit: z.number().min(1).max(500).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input, ctx }) => {
      const whereConditions = [
        eq(tradeExecutions.userId, ctx.user.id),
        eq(tradeExecutions.walletId, input.walletId),
      ];

      if (input.symbol) whereConditions.push(eq(tradeExecutions.symbol, input.symbol));
      if (input.search) whereConditions.push(ilike(tradeExecutions.symbol, `%${input.search}%`));
      if (input.status) whereConditions.push(eq(tradeExecutions.status, input.status));

      const executions = await ctx.db
        .select()
        .from(tradeExecutions)
        .where(and(...whereConditions))
        .orderBy(desc(tradeExecutions.openedAt))
        .limit(input.limit)
        .offset(input.offset);

      return executions;
    }),

  closeTradeExecution: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        exitPrice: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const [execution] = await ctx.db
        .select()
        .from(tradeExecutions)
        .where(and(eq(tradeExecutions.id, input.id), eq(tradeExecutions.userId, ctx.user.id)))
        .limit(1);

      if (!execution) throw notFound('Trade execution');

      // Serialize close+create+reverse on the same (walletId, symbol)
      // so a rapid "close LONG, open SHORT" sequence doesn't race
      // against itself. The mutex queues the second operation until
      // the first has finished its full DB write path. Closes the
      // 2026-05-08 incident: user did close+open in <13s, neither
      // hit the user-stream cleanly, DB stayed on the first op's
      // partial state.
      return withWriteLock(execution.walletId, execution.symbol, async () => {

      if (execution.status !== 'open' && execution.status !== 'pending') {
        throw badRequest('Trade execution is not open or pending');
      }

      const wallet = await walletQueries.getById(execution.walletId);

      const walletSupportsLive = !isPaperWallet(wallet);
      const shouldExecuteReal = walletSupportsLive && env.ENABLE_LIVE_TRADING;
      const isFutures = execution.marketType === 'FUTURES';
      const leverage = execution.leverage ?? 1;

      if (execution.status === 'pending') {
        logger.info({
          executionId: execution.id,
          symbol: execution.symbol,
          entryOrderId: execution.entryOrderId,
          stopLossOrderId: execution.stopLossOrderId,
          takeProfitOrderId: execution.takeProfitOrderId,
          marketType: execution.marketType,
        }, 'Cancelling pending execution and associated orders');

        if (shouldExecuteReal) {
          if (isFutures) {
            await cancelFuturesExecutionOrders(execution, wallet);
          } else {
            const client = getSpotClient(wallet);
            const orderIdsToCancel = [
              execution.entryOrderId,
              execution.stopLossOrderId,
              execution.takeProfitOrderId,
            ].filter((id): id is string => id !== null);

            for (const orderId of orderIdsToCancel) {
              try {
                await client.cancelOrder(execution.symbol, orderId);
                logger.info({ orderId, symbol: execution.symbol }, 'Cancelled Binance order');
              } catch (error) {
                logger.warn({
                  orderId,
                  symbol: execution.symbol,
                  error: serializeError(error),
                }, 'Failed to cancel Binance order (may already be filled/cancelled)');
              }
            }
          }
        }

        await ctx.db
          .update(tradeExecutions)
          .set({
            status: 'cancelled',
            closedAt: new Date(),
            updatedAt: new Date(),
            stopLossAlgoId: null,
            stopLossOrderId: null,
            takeProfitAlgoId: null,
            takeProfitOrderId: null,
            entryOrderId: null,
          })
          .where(eq(tradeExecutions.id, input.id));

        emitPositionClosedEvents({
          walletId: execution.walletId,
          execution,
          exitPrice: parseFloat(execution.entryPrice ?? '0'),
          pnl: 0,
          pnlPercent: 0,
          exitReason: 'MANUAL_CANCEL',
        });

        const openExecutionsAfterCancel = await ctx.db
          .select()
          .from(tradeExecutions)
          .where(and(
            eq(tradeExecutions.walletId, execution.walletId),
            eq(tradeExecutions.userId, ctx.user.id),
            eq(tradeExecutions.status, 'open'),
          ));

        return {
          pnl: '0',
          grossPnl: '0',
          fees: '0',
          pnlPercent: '0.00',
          exitOrderId: null,
          exitPrice: '0',
          cancelled: true,
          walletId: execution.walletId,
          openExecutions: openExecutionsAfterCancel,
        };
      }

      const siblingExecutions = isFutures
        ? await ctx.db
            .select()
            .from(tradeExecutions)
            .where(
              and(
                eq(tradeExecutions.walletId, execution.walletId),
                eq(tradeExecutions.symbol, execution.symbol),
                eq(tradeExecutions.side, execution.side),
                eq(tradeExecutions.status, 'open'),
                eq(tradeExecutions.marketType, 'FUTURES')
              )
            )
        : [execution];

      const allExecutionsToClose = siblingExecutions.length > 0 ? siblingExecutions : [execution];
      const totalQty = allExecutionsToClose.reduce((sum, e) => sum + parseFloat(e.quantity), 0);
      const weightedEntryPrice = allExecutionsToClose.reduce(
        (sum, e) => sum + parseFloat(e.entryPrice) * parseFloat(e.quantity), 0
      ) / (totalQty || 1);

      let exitPrice = input.exitPrice ? parseFloat(input.exitPrice) : 0;
      let exitOrderId: string | null = null;

      if (shouldExecuteReal) {
        try {
          const orderSide = execution.side === 'LONG' ? 'SELL' : 'BUY';
          const marketType = execution.marketType as MarketType;

          await Promise.allSettled(
            allExecutionsToClose.map((exec) =>
              cancelAllProtectionOrders({
                wallet,
                symbol: exec.symbol,
                marketType,
                stopLossAlgoId: exec.stopLossAlgoId,
                stopLossOrderId: exec.stopLossOrderId,
                takeProfitAlgoId: exec.takeProfitAlgoId,
                takeProfitOrderId: exec.takeProfitOrderId,
              })
            )
          );

          if (isFutures) {
            const client = getFuturesClient(wallet);

            const order = await client.submitOrder({
              symbol: execution.symbol,
              side: orderSide,
              type: 'MARKET',
              quantity: String(totalQty),
              reduceOnly: true,
              newOrderRespType: 'RESULT',
            });

            exitOrderId = order.orderId;
            const filledPrice = parseFloat(order.avgPrice?.toString() || order.price?.toString() || '0');
            if (filledPrice > 0) exitPrice = filledPrice;

          } else {
            const client = getSpotClient(wallet);

            const order = await client.submitOrder({
              symbol: execution.symbol,
              side: orderSide,
              type: 'MARKET',
              quantity: totalQty,
            });

            exitOrderId = order.orderId;
            const filledPrice = order.price ? parseFloat(order.price) : 0;
            if (filledPrice > 0) exitPrice = filledPrice;
          }

          logger.info({
            executionId: execution.id,
            orderId: exitOrderId,
            symbol: execution.symbol,
            side: orderSide,
            quantity: totalQty,
            executionCount: allExecutionsToClose.length,
            exitPrice,
            marketType: execution.marketType,
            leverage,
          }, 'Manual close: Binance exit order executed for all sibling executions');
        } catch (error) {
          logger.error({
            executionId: execution.id,
            error: serializeError(error),
          }, 'Failed to execute Binance exit order');

          throw internalServerError(
            error instanceof Error ? error.message : 'Failed to execute exit order on Binance',
            error,
          );
        }
      } else {
        if (!input.exitPrice) {
          throw badRequest('Exit price is required for paper trading');
        }
        logger.info({
          executionId: execution.id,
          walletType: wallet.walletType,
          liveEnabled: env.ENABLE_LIVE_TRADING,
          marketType: execution.marketType,
          leverage,
          executionCount: allExecutionsToClose.length,
        }, 'Manual close: Paper/disabled mode - simulating exit');
      }

      const marketType = isFutures ? 'FUTURES' : 'SPOT';
      let totalNetPnl = 0;
      let totalGrossPnl = 0;
      let totalAllFees = 0;
      const paperCloseEmits: Array<{
        executionId: string;
        userId: string;
        symbol: string;
        grossPnl: number;
        totalFees: number;
      }> = [];

      // Each per-exec close goes through closeExecutionAndBroadcast
      // which (a) updates the row in DB with the close fields, (b)
      // increments wallet balance + emits wallet:update with the
      // authoritative post-increment balance via the helper's RETURNING
      // clause, and (c) emits the order:update + position:closed pair.
      // Earlier this used a transaction + manual wallet UPDATE, which
      // bypassed the wallet:update emit — leaving the renderer's
      // wallet.list cache stale until the next debounced invalidate.
      for (const exec of allExecutionsToClose) {
        const execEntryPrice = parseFloat(exec.entryPrice);
        const execQty = parseFloat(exec.quantity);
        const execLeverage = exec.leverage ?? 1;

        const { grossPnl, totalFees, netPnl, pnlPercent } = calculatePnl({
          entryPrice: execEntryPrice,
          exitPrice,
          quantity: execQty,
          side: exec.side,
          marketType,
          leverage: execLeverage,
        });

        totalNetPnl += netPnl;
        totalGrossPnl += grossPnl;
        totalAllFees += totalFees;

        const existingPartialPnl = parseFloat(exec.partialClosePnl ?? '0');
        const finalPnl = netPnl + existingPartialPnl;

        await closeExecutionAndBroadcast(exec, {
          exitPrice,
          exitOrderId,
          exitReason: 'MANUAL_CLOSE',
          exitSource: 'MANUAL',
          pnl: finalPnl,
          pnlPercent,
          fees: totalFees,
        });

        paperCloseEmits.push({
          executionId: exec.id,
          userId: ctx.user.id,
          symbol: exec.symbol,
          grossPnl,
          totalFees,
        });
      }

      // Toast emits — UX-specific, kept inline (not in helper).
      for (const emit of paperCloseEmits) {
        await emitPositionClose({
          wallet,
          execution: { id: emit.executionId, userId: emit.userId, symbol: emit.symbol },
          grossPnl: emit.grossPnl,
          totalFees: emit.totalFees,
        });
      }

      const totalPnlPercent = weightedEntryPrice > 0
        ? (totalNetPnl / (weightedEntryPrice * totalQty / leverage)) * 100
        : 0;

      const openExecutionsAfterClose = await ctx.db
        .select()
        .from(tradeExecutions)
        .where(and(
          eq(tradeExecutions.walletId, execution.walletId),
          eq(tradeExecutions.userId, ctx.user.id),
          eq(tradeExecutions.status, 'open'),
        ));

      if (shouldExecuteReal && isFutures) {
        // closeTradeExecution went through Binance — the futures
        // POSITIONS / OPEN_ORDERS caches need a flush so the renderer's
        // immediate refetch sees the post-close state instead of the
        // cached pre-close row. Mirrors what closePosition /
        // closePositionAndCancelOrders / reversePosition do in
        // futures-trading/position-mutations.ts. OPEN_ORDERS is now
        // DB-backed (Phase 5) and self-syncs via the WS handler.
        binanceApiCache.invalidate('POSITIONS', execution.walletId);
      }

      return {
        pnl: totalNetPnl.toString(),
        grossPnl: totalGrossPnl.toString(),
        fees: totalAllFees.toString(),
        pnlPercent: totalPnlPercent.toFixed(2),
        exitOrderId,
        exitPrice: exitPrice.toString(),
        leverage: isFutures ? leverage : undefined,
        marketType: execution.marketType,
        walletId: execution.walletId,
        openExecutions: openExecutionsAfterClose,
      };
      });
    }),

  cancelTradeExecution: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const [execution] = await ctx.db
        .select()
        .from(tradeExecutions)
        .where(and(eq(tradeExecutions.id, input.id), eq(tradeExecutions.userId, ctx.user.id)))
        .limit(1);

      if (!execution) throw notFound('Trade execution');

      const wallet = await walletQueries.findById(execution.walletId);

      if (wallet && !isPaperWallet(wallet) && env.ENABLE_LIVE_TRADING) {
        const isFutures = execution.marketType === 'FUTURES';

        if (isFutures) {
          await cancelFuturesExecutionOrders(execution, wallet);
          // No OPEN_ORDERS cache to invalidate — the WS handler updates
          // the DB rows and `getOpenOrders` reads from there directly
          // (Phase 5 of the binance audit).
        } else {
          await cancelSpotExecutionOrders(execution, wallet);
        }
      }

      await ctx.db
        .update(tradeExecutions)
        .set({
          status: 'cancelled',
          updatedAt: new Date(),
          stopLossAlgoId: null,
          stopLossOrderId: null,
          takeProfitAlgoId: null,
          takeProfitOrderId: null,
          entryOrderId: null,
        })
        .where(eq(tradeExecutions.id, input.id));

      const openExecutionsAfterCancel = await ctx.db
        .select()
        .from(tradeExecutions)
        .where(and(
          eq(tradeExecutions.walletId, execution.walletId),
          eq(tradeExecutions.userId, ctx.user.id),
          eq(tradeExecutions.status, 'open'),
        ));

      return { success: true, walletId: execution.walletId, openExecutions: openExecutionsAfterCancel };
    }),
});
