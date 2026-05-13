import { calculateLiquidationPrice } from '@marketmind/types';

import { calculatePnl } from '@marketmind/utils';
import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { badRequest, conflict, internalServerError, notFound } from '../../utils/trpc-errors';
import { z } from 'zod';
import { TRADING_CONFIG } from '../../constants';
import { orders, positions, tradeExecutions, wallets } from '../../db/schema';
import { mapBinanceErrorToTRPC } from '../../utils/binanceErrorHandler';
import {
  cancelAllSymbolOrders,
  closePosition as closeExchangePosition,
  createBinanceFuturesClient,
  getPosition,
  isPaperWallet,
  submitFuturesOrder,
} from '../../services/binance-futures-client';
import { getBinanceFuturesDataService } from '../../services/binance-futures-data';
import { walletQueries } from '../../services/database/walletQueries';
import { logger, serializeError } from '../../services/logger';
import { getMinNotionalFilterService } from '../../services/min-notional-filter';
import { closeExecutionAndBroadcast, incrementWalletBalanceAndBroadcast } from '../../services/wallet-broadcast';
import { syncLiveWalletSnapshot } from '../../services/wallet-snapshot';
import { protectedProcedure, router } from '../../trpc';
import { formatQuantityForBinance } from '../../utils/formatters';
import { generateEntityId } from '../../utils/id';

// In-flight reverse-position calls keyed by `${walletId}:${symbol}`.
// Two parallel reverses on the same live wallet+symbol would otherwise
// double-flip the position: each call snapshots `getPosition`, both
// cancel orders, both close (one no-ops thanks to reduceOnly), but
// each then opens a fresh leg — leaving the user 2× sized in the
// flipped direction. Rejecting concurrent calls with CONFLICT is
// safer than queueing them (the second click is almost always
// accidental, and queueing risks acting on stale market state by the
// time the lock frees).
const liveReverseInFlight = new Set<string>();

export const positionMutationsRouter = router({
  createPosition: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        symbol: z.string(),
        side: z.enum(['LONG', 'SHORT']),
        entryPrice: z.string(),
        entryQty: z.string(),
        stopLoss: z.string().optional(),
        takeProfit: z.string().optional(),
        setupId: z.string().optional(),
        leverage: z.number().min(1).max(125).optional(),
        marginType: z.enum(['ISOLATED', 'CROSSED']).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

      const leverage = input.leverage ?? 1;

      if (input.stopLoss && input.takeProfit) {
        const entryPrice = parseFloat(input.entryPrice);
        const stopLoss = parseFloat(input.stopLoss);
        const takeProfit = parseFloat(input.takeProfit);

        let risk: number;
        let reward: number;

        if (input.side === 'LONG') {
          risk = entryPrice - stopLoss;
          reward = takeProfit - entryPrice;
        } else {
          risk = stopLoss - entryPrice;
          reward = entryPrice - takeProfit;
        }

        if (risk <= 0) {
          throw badRequest('Invalid stop loss - stop loss must be below entry for LONG or above entry for SHORT');
        }

        const riskRewardRatio = reward / risk;

        if (riskRewardRatio < TRADING_CONFIG.MIN_RISK_REWARD_RATIO) {
          throw badRequest(
            `Risk/reward ratio (${riskRewardRatio.toFixed(2)}:1) is below minimum required (${TRADING_CONFIG.MIN_RISK_REWARD_RATIO}:1)`,
          );
        }

        logger.info({
          symbol: input.symbol,
          side: input.side,
          leverage,
          riskRewardRatio: riskRewardRatio.toFixed(2),
        }, '✓ Risk/Reward ratio validated for futures position');
      }

      const positionId = generateEntityId();
      const entryPrice = parseFloat(input.entryPrice);
      const liquidationPrice = calculateLiquidationPrice(entryPrice, leverage, input.side);

      await ctx.db.insert(positions).values({
        id: positionId,
        userId: ctx.user.id,
        walletId: input.walletId,
        symbol: input.symbol,
        side: input.side,
        entryPrice: input.entryPrice,
        entryQty: input.entryQty,
        currentPrice: input.entryPrice,
        stopLoss: input.stopLoss,
        takeProfit: input.takeProfit,
        setupId: input.setupId,
        status: 'open',
        marketType: 'FUTURES',
        leverage,
        marginType: 'CROSSED',
        liquidationPrice: liquidationPrice.toString(),
        accumulatedFunding: '0',
      });

      return { id: positionId, liquidationPrice };
    }),

  closePosition: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        symbol: z.string(),
        positionId: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const wallet = await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

      try {
        if (isPaperWallet(wallet) && input.positionId) {
          const [position] = await ctx.db
            .select()
            .from(positions)
            .where(
              and(
                eq(positions.id, input.positionId),
                eq(positions.userId, ctx.user.id),
                eq(positions.status, 'open')
              )
            )
            .limit(1);

          if (!position) {
            throw notFound('Position');
          }

          const dataService = getBinanceFuturesDataService();
          const markPriceData = await dataService.getMarkPrice(position.symbol);
          const exitPrice = markPriceData ? markPriceData.markPrice : parseFloat(position.currentPrice ?? position.entryPrice);

          const entryPrice = parseFloat(position.entryPrice);
          const quantity = parseFloat(position.entryQty);
          const posLeverage = position.leverage ?? 1;
          const accumulatedFunding = parseFloat(position.accumulatedFunding ?? '0');

          const { grossPnl, totalFees, netPnl, pnlPercent } = calculatePnl({
            entryPrice,
            exitPrice,
            quantity,
            side: position.side,
            marketType: 'FUTURES',
            leverage: posLeverage,
            accumulatedFunding,
          });

          await ctx.db
            .update(positions)
            .set({
              status: 'closed',
              closedAt: new Date(),
              updatedAt: new Date(),
              currentPrice: exitPrice.toString(),
              pnl: netPnl.toString(),
              pnlPercent: pnlPercent.toString(),
            })
            .where(eq(positions.id, input.positionId));

          // Wallet update via the broadcast helper so wallet:update
          // fires for the renderer (paper closes had ZERO WS emits before).
          // The non-tx call is fine: `incrementWalletBalanceAndBroadcast`
          // does its own atomic UPDATE ... RETURNING.
          const broadcast = await incrementWalletBalanceAndBroadcast(wallet.id, netPnl);
          const newBalance = broadcast?.currentBalance ?? wallet.currentBalance ?? '0';
          const walletSnapshot = {
            currentBalance: newBalance,
            totalWalletBalance: broadcast?.totalWalletBalance ?? newBalance,
          };

          // Also fire a synthetic position:closed for any tradeExecution
          // mirror the renderer might be tracking (paper-futures uses
          // both `positions` and `tradeExecutions`). Find the matching
          // open exec and run it through the canonical close cascade.
          const [paperExec] = await ctx.db
            .select()
            .from(tradeExecutions)
            .where(and(
              eq(tradeExecutions.walletId, input.walletId),
              eq(tradeExecutions.symbol, position.symbol),
              eq(tradeExecutions.status, 'open'),
              eq(tradeExecutions.marketType, 'FUTURES'),
            ))
            .limit(1);
          if (paperExec) {
            await closeExecutionAndBroadcast(paperExec, {
              exitPrice,
              exitReason: 'MANUAL_CLOSE',
              exitSource: 'MANUAL',
              pnl: netPnl,
              pnlPercent,
              fees: totalFees,
            });
          }

          logger.info({
            positionId: input.positionId,
            symbol: position.symbol,
            side: position.side,
            entryPrice,
            exitPrice,
            quantity,
            leverage: posLeverage,
            grossPnl: grossPnl.toFixed(4),
            fees: totalFees.toFixed(4),
            accumulatedFunding: accumulatedFunding.toFixed(4),
            netPnl: netPnl.toFixed(4),
            pnlPercent: pnlPercent.toFixed(2),
          }, 'Paper futures position closed with funding');

          const paperOpenExecutions = await ctx.db.select().from(tradeExecutions)
            .where(and(
              eq(tradeExecutions.walletId, input.walletId),
              eq(tradeExecutions.userId, ctx.user.id),
              eq(tradeExecutions.status, 'open'),
            ));

          return {
            success: true,
            positionId: input.positionId,
            pnl: netPnl,
            pnlPercent,
            accumulatedFunding,
            walletId: input.walletId,
            openExecutions: paperOpenExecutions,
            walletSnapshot,
          };
        }

        const client = createBinanceFuturesClient(wallet);
        const position = await getPosition(client, input.symbol);

        if (!position) {
          throw notFound('Open position for this symbol');
        }

        const symbolFilters = await getMinNotionalFilterService().getSymbolFilters('FUTURES');
        const stepSize = symbolFilters.get(input.symbol)?.stepSize?.toString();
        const result = await closeExchangePosition(client, input.symbol, position.positionAmt, stepSize);

        logger.info({
          walletId: input.walletId,
          symbol: input.symbol,
          orderId: result.orderId,
          side: result.side,
          quantity: result.origQty,
        }, 'Futures position closed');

        // Pull the post-close account state immediately. The user-stream
        // event will eventually deliver the same data, but a synchronous
        // refresh here makes `wallet.list` accurate before the mutation
        // resolves — `useOrderQuantity`'s sizing math reflects the new
        // capital on the very next click.
        const walletSnapshot = await syncLiveWalletSnapshot(ctx, wallet, client);

        // Phase 6 (binance audit): `getPositions` no longer caches —
        // every call fetches fresh from REST. Phase 5 made `getOpenOrders`
        // DB-backed, and the WS algo-update handler keeps the orders rows
        // current for orphaned TP/SL brackets after a close. Nothing to
        // invalidate here anymore.

        const openExecutions = await ctx.db.select().from(tradeExecutions)
          .where(and(
            eq(tradeExecutions.walletId, input.walletId),
            eq(tradeExecutions.userId, ctx.user.id),
            eq(tradeExecutions.status, 'open'),
          ));

        return { success: true, orderId: result.orderId, walletId: input.walletId, openExecutions, walletSnapshot };
      } catch (error) {
        throw mapBinanceErrorToTRPC(error);
      }
    }),

  reversePosition: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        symbol: z.string(),
        positionId: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const wallet = await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

      try {
        if (isPaperWallet(wallet)) {
          if (!input.positionId) throw badRequest('positionId is required for paper wallets');

          const dataService = getBinanceFuturesDataService();
          const markPriceData = await dataService.getMarkPrice(input.symbol);

          // Mirror closePositionAndCancelOrders: any pending NEW orders
          // for this wallet+symbol (limit entries, SL/TP brackets) are
          // tied to the OLD direction and must not survive the flip. The
          // new position is inserted with stopLoss/takeProfit NULL so it
          // starts clean; the user re-attaches SL/TP if they want them.
          await ctx.db
            .update(orders)
            .set({ status: 'CANCELED', updateTime: Date.now() })
            .where(
              and(
                eq(orders.walletId, input.walletId),
                eq(orders.symbol, input.symbol),
                eq(orders.status, 'NEW')
              )
            );

          const reversed = await ctx.db.transaction(async (tx) => {
            // FOR UPDATE locks the row so concurrent reverse / close calls
            // serialize. Without this, two simultaneous clicks would both
            // see status='open', both close the position, and both try to
            // insert a new one — leaving the user with two open positions
            // or a duplicate-id error.
            const [position] = await tx
              .select()
              .from(positions)
              .where(
                and(
                  eq(positions.id, input.positionId!),
                  eq(positions.userId, ctx.user.id),
                  eq(positions.status, 'open')
                )
              )
              .for('update')
              .limit(1);

            if (!position) throw notFound('Position');

            const exitPrice = markPriceData ? markPriceData.markPrice : parseFloat(position.currentPrice ?? position.entryPrice);
            const entryPrice = parseFloat(position.entryPrice);
            const quantity = parseFloat(position.entryQty);
            const posLeverage = position.leverage ?? 1;
            const accumulatedFunding = parseFloat(position.accumulatedFunding ?? '0');

            const { netPnl, pnlPercent } = calculatePnl({
              entryPrice,
              exitPrice,
              quantity,
              side: position.side,
              marketType: 'FUTURES',
              leverage: posLeverage,
              accumulatedFunding,
            });

            await tx
              .update(positions)
              .set({
                status: 'closed',
                closedAt: new Date(),
                updatedAt: new Date(),
                currentPrice: exitPrice.toString(),
                pnl: netPnl.toString(),
                pnlPercent: pnlPercent.toString(),
              })
              .where(eq(positions.id, input.positionId!));

            const newSide = position.side === 'LONG' ? 'SHORT' : 'LONG';
            const newPositionId = generateEntityId();
            const newLiquidationPrice = calculateLiquidationPrice(exitPrice, posLeverage, newSide);

            await tx.insert(positions).values({
              id: newPositionId,
              userId: ctx.user.id,
              walletId: input.walletId,
              symbol: position.symbol,
              side: newSide,
              entryPrice: exitPrice.toString(),
              entryQty: position.entryQty,
              currentPrice: exitPrice.toString(),
              status: 'open',
              marketType: 'FUTURES',
              leverage: posLeverage,
              marginType: position.marginType,
              liquidationPrice: newLiquidationPrice.toString(),
              accumulatedFunding: '0',
            });

            // Roll the realized PnL into wallet.currentBalance so the
            // frontend's max-position-size calculation (driven by
            // `useOrderQuantity`'s `parseFloat(activeWallet.currentBalance)`)
            // sees the updated capital before the next click. Mirrors
            // what `closePosition` already does on the paper path —
            // the absence of this update was a pre-existing bug:
            // closing a +$200 paper trade left the wallet untouched
            // until a manual refresh.
            const currentBalance = parseFloat(wallet.currentBalance ?? '0');
            const newBalance = currentBalance + netPnl;
            const newBalanceStr = newBalance.toString();
            await tx
              .update(wallets)
              .set({ currentBalance: newBalanceStr, totalWalletBalance: newBalanceStr, updatedAt: new Date() })
              .where(eq(wallets.id, wallet.id));

            return {
              newPositionId,
              newSide,
              netPnl,
              symbol: position.symbol,
              oldSide: position.side,
              exitPrice,
              walletSnapshot: { currentBalance: newBalanceStr, totalWalletBalance: newBalanceStr },
            };
          });

          logger.info({
            positionId: input.positionId,
            newPositionId: reversed.newPositionId,
            symbol: reversed.symbol,
            oldSide: reversed.oldSide,
            newSide: reversed.newSide,
            exitPrice: reversed.exitPrice,
            closedPnl: reversed.netPnl.toFixed(4),
          }, 'Paper futures position reversed');

          const paperOpenExecutions = await ctx.db.select().from(tradeExecutions)
            .where(and(
              eq(tradeExecutions.walletId, input.walletId),
              eq(tradeExecutions.userId, ctx.user.id),
              eq(tradeExecutions.status, 'open'),
            ));

          return {
            success: true,
            closedPnl: reversed.netPnl,
            newPositionId: reversed.newPositionId,
            newSide: reversed.newSide,
            walletId: input.walletId,
            openExecutions: paperOpenExecutions,
            walletSnapshot: reversed.walletSnapshot,
          };
        }

        const lockKey = `${input.walletId}:${input.symbol}`;
        if (liveReverseInFlight.has(lockKey)) {
          throw conflict('A reverse for this position is already in progress');
        }
        liveReverseInFlight.add(lockKey);

        try {
          const client = createBinanceFuturesClient(wallet);
          const position = await getPosition(client, input.symbol);

          if (!position) throw notFound('Open position for this symbol');

          const symbolFilters = await getMinNotionalFilterService().getSymbolFilters('FUTURES');
          const stepSize = symbolFilters.get(input.symbol)?.stepSize?.toString();

          const positionAmt = parseFloat(position.positionAmt);
          const quantity = Math.abs(positionAmt);
          // Both legs of the reverse go in the SAME direction. The close
          // is reduceOnly:true so it only zeroes the existing position;
          // the open then continues in the same direction to build the
          // flipped exposure. Example for SHORT 0.1: BUY 0.1 reduceOnly
          // (flat) → BUY 0.1 (LONG 0.1). The previous code sent BUY then
          // SELL, which silently re-opened a SHORT instead of flipping.
          const flipSide = positionAmt > 0 ? 'SELL' : 'BUY';
          const formattedQty = formatQuantityForBinance(quantity, stepSize);

          await cancelAllSymbolOrders(client, input.symbol);

          // reduceOnly:true keeps the close from accidentally opening a new
          // position in the opposite direction — e.g. if a concurrent order
          // already flipped the live position to flat or to the other side,
          // a non-reduce-only MARKET would happily open fresh exposure.
          const closeResult = await submitFuturesOrder(client, {
            symbol: input.symbol,
            side: flipSide,
            type: 'MARKET',
            quantity: formattedQty,
            reduceOnly: true,
          });

          let openResult;
          try {
            openResult = await submitFuturesOrder(client, {
              symbol: input.symbol,
              side: flipSide,
              type: 'MARKET',
              quantity: formattedQty,
            });
          } catch (openError) {
            // Close already filled, open failed — surface a clear error so
            // the user knows their position was closed but the reverse leg
            // didn't go through (typical causes: insufficient margin after
            // realizing the close PnL, exchange-side reject, network blip).
            // `serializeError` handles every shape (Error, plain object
            // with `message`, raw object → JSON, primitive). The previous
            // `instanceof Error ? .message : String(...)` fell to
            // `String(obj)` for non-Error wrappers, producing the
            // unhelpful "[object Object]" message in the user-facing
            // toast — observed when a Binance "Margin is insufficient"
            // error came back as a wrapped object literal.
            const reason = serializeError(openError);
            // Refresh the local wallet snapshot before throwing so the
            // user sees the post-close balance even though the open
            // failed — they're flat now, capital reflects the realized
            // PnL of the close leg. Without this, the frontend's
            // `wallet.list` cache stays at the pre-close balance until
            // the user-stream WS event lands.
            await syncLiveWalletSnapshot(ctx, wallet, client);
            logger.error({
              walletId: input.walletId,
              symbol: input.symbol,
              closeOrderId: closeResult.orderId,
              error: reason,
            }, 'Reverse: close filled but reopen failed');
            throw internalServerError(
              `Position closed (orderId ${closeResult.orderId}) but reopen failed: ${reason}`,
            );
          }

          logger.info({
            walletId: input.walletId,
            symbol: input.symbol,
            closeOrderId: closeResult.orderId,
            openOrderId: openResult.orderId,
            newSide: positionAmt > 0 ? 'SHORT' : 'LONG',
            quantity: formattedQty,
          }, 'Position reversed: cancel orders → close → open');

          // Pull the post-orders account state immediately. Both close
          // and open changed margin/balance — the frontend's max-order
          // sizer reads `wallet.currentBalance` and would otherwise
          // see stale capital until the next user-stream event.
          const walletSnapshot = await syncLiveWalletSnapshot(ctx, wallet, client);

          // Phase 6 (binance audit): `getPositions` is REST-direct, no
          // cache to invalidate. The reverse flips the side on Binance
          // synchronously, so the renderer's `getPositions` refetch
          // sees the new state on the very next query. OPEN_ORDERS is
          // DB-backed (Phase 5) and self-maintains via the WS handler.

          const openExecutions = await ctx.db.select().from(tradeExecutions)
            .where(and(
              eq(tradeExecutions.walletId, input.walletId),
              eq(tradeExecutions.userId, ctx.user.id),
              eq(tradeExecutions.status, 'open'),
            ));

          return {
            success: true,
            closeOrderId: closeResult.orderId,
            openOrderId: openResult.orderId,
            newSide: positionAmt > 0 ? 'SHORT' : 'LONG',
            walletId: input.walletId,
            openExecutions,
            walletSnapshot,
          };
        } finally {
          liveReverseInFlight.delete(lockKey);
        }
      } catch (error) {
        // Don't double-wrap our own TRPCErrors (the open-failure path
        // throws a structured TRPCError with the close orderId in the
        // message; mapBinanceErrorToTRPC would lose that context).
        if (error instanceof TRPCError) throw error;
        throw mapBinanceErrorToTRPC(error);
      }
    }),

  closePositionAndCancelOrders: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        symbol: z.string(),
        positionId: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const wallet = await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

      try {
        if (isPaperWallet(wallet) && input.positionId) {
          await ctx.db
            .update(orders)
            .set({ status: 'CANCELED', updateTime: Date.now() })
            .where(
              and(
                eq(orders.walletId, input.walletId),
                eq(orders.symbol, input.symbol),
                eq(orders.status, 'NEW')
              )
            );

          const [position] = await ctx.db
            .select()
            .from(positions)
            .where(
              and(
                eq(positions.id, input.positionId),
                eq(positions.userId, ctx.user.id),
                eq(positions.status, 'open')
              )
            )
            .limit(1);

          if (!position) throw notFound('Position');

          const dataService = getBinanceFuturesDataService();
          const markPriceData = await dataService.getMarkPrice(position.symbol);
          const exitPrice = markPriceData ? markPriceData.markPrice : parseFloat(position.currentPrice ?? position.entryPrice);

          const entryPrice = parseFloat(position.entryPrice);
          const quantity = parseFloat(position.entryQty);
          const posLeverage = position.leverage ?? 1;
          const accumulatedFunding = parseFloat(position.accumulatedFunding ?? '0');

          const { netPnl, pnlPercent } = calculatePnl({
            entryPrice,
            exitPrice,
            quantity,
            side: position.side,
            marketType: 'FUTURES',
            leverage: posLeverage,
            accumulatedFunding,
          });

          // Atomic close + wallet update — same pattern as
          // `closePosition` / `reversePosition` paper paths.
          const walletSnapshot = await ctx.db.transaction(async (tx) => {
            await tx
              .update(positions)
              .set({
                status: 'closed',
                closedAt: new Date(),
                updatedAt: new Date(),
                currentPrice: exitPrice.toString(),
                pnl: netPnl.toString(),
                pnlPercent: pnlPercent.toString(),
              })
              .where(eq(positions.id, input.positionId!));

            const currentBalance = parseFloat(wallet.currentBalance ?? '0');
            const newBalance = (currentBalance + netPnl).toString();
            await tx
              .update(wallets)
              .set({ currentBalance: newBalance, totalWalletBalance: newBalance, updatedAt: new Date() })
              .where(eq(wallets.id, wallet.id));

            return { currentBalance: newBalance, totalWalletBalance: newBalance };
          });

          logger.info({ positionId: input.positionId, symbol: input.symbol, netPnl: netPnl.toFixed(4) }, 'Paper position closed and orders cancelled');

          const paperOpenExecutions = await ctx.db.select().from(tradeExecutions)
            .where(and(
              eq(tradeExecutions.walletId, input.walletId),
              eq(tradeExecutions.userId, ctx.user.id),
              eq(tradeExecutions.status, 'open'),
            ));

          return { success: true, pnl: netPnl, pnlPercent, walletId: input.walletId, openExecutions: paperOpenExecutions, walletSnapshot };
        }

        const client = createBinanceFuturesClient(wallet);
        const position = await getPosition(client, input.symbol);

        if (!position) throw notFound('Open position for this symbol');

        await cancelAllSymbolOrders(client, input.symbol);

        const symbolFilters = await getMinNotionalFilterService().getSymbolFilters('FUTURES');
        const stepSize = symbolFilters.get(input.symbol)?.stepSize?.toString();
        const result = await closeExchangePosition(client, input.symbol, position.positionAmt, stepSize);

        logger.info({
          walletId: input.walletId,
          symbol: input.symbol,
          orderId: result.orderId,
        }, 'Position closed and all orders cancelled');

        // Synchronous wallet refresh — same rationale as `closePosition`
        // and `reversePosition` live paths. Without this, the frontend
        // sees stale capital until the user-stream WS catches up.
        const walletSnapshot = await syncLiveWalletSnapshot(ctx, wallet, client);

        // Phase 6 (binance audit): no cache layer for POSITIONS / OPEN_ORDERS
        // anymore — getPositions is REST-direct, getOpenOrders reads from
        // the DB. Both refetches after this mutation see fresh state.

        const openExecutions = await ctx.db.select().from(tradeExecutions)
          .where(and(
            eq(tradeExecutions.walletId, input.walletId),
            eq(tradeExecutions.userId, ctx.user.id),
            eq(tradeExecutions.status, 'open'),
          ));

        return { success: true, orderId: result.orderId, walletId: input.walletId, openExecutions, walletSnapshot };
      } catch (error) {
        throw mapBinanceErrorToTRPC(error);
      }
    }),
});
