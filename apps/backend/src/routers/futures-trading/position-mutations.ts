import { calculateLiquidationPrice } from '@marketmind/types';

import { calculatePnl } from '../../utils/pnl-calculator';
import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { TRADING_CONFIG } from '../../constants';
import { orders, positions, tradeExecutions } from '../../db/schema';
import { BinanceIpBannedError } from '../../services/binance-api-cache';
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
import { logger } from '../../services/logger';
import { getMinNotionalFilterService } from '../../services/min-notional-filter';
import { protectedProcedure, router } from '../../trpc';
import { formatQuantityForBinance } from '../../utils/formatters';
import { generateEntityId } from '../../utils/id';

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
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid stop loss - stop loss must be below entry for LONG or above entry for SHORT',
          });
        }

        const riskRewardRatio = reward / risk;

        if (riskRewardRatio < TRADING_CONFIG.MIN_RISK_REWARD_RATIO) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Risk/reward ratio (${riskRewardRatio.toFixed(2)}:1) is below minimum required (${TRADING_CONFIG.MIN_RISK_REWARD_RATIO}:1)`,
          });
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
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Position not found' });
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
            side: position.side as 'LONG' | 'SHORT',
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
          };
        }

        const client = createBinanceFuturesClient(wallet);
        const position = await getPosition(client, input.symbol);

        if (!position) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'No open position for this symbol' });
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

        const openExecutions = await ctx.db.select().from(tradeExecutions)
          .where(and(
            eq(tradeExecutions.walletId, input.walletId),
            eq(tradeExecutions.userId, ctx.user.id),
            eq(tradeExecutions.status, 'open'),
          ));

        return { success: true, orderId: result.orderId, walletId: input.walletId, openExecutions };
      } catch (error) {
        if (error instanceof BinanceIpBannedError) throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: error.message });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to close futures position',
          cause: error,
        });
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
          if (!input.positionId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'positionId is required for paper wallets' });

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

          if (!position) throw new TRPCError({ code: 'NOT_FOUND', message: 'Position not found' });

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
            side: position.side as 'LONG' | 'SHORT',
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

          const newSide = position.side === 'LONG' ? 'SHORT' : 'LONG';
          const newPositionId = generateEntityId();
          const newLiquidationPrice = calculateLiquidationPrice(exitPrice, posLeverage, newSide);

          await ctx.db.insert(positions).values({
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

          logger.info({
            positionId: input.positionId,
            newPositionId,
            symbol: position.symbol,
            oldSide: position.side,
            newSide,
            exitPrice,
            closedPnl: netPnl.toFixed(4),
          }, 'Paper futures position reversed');

          const paperOpenExecutions = await ctx.db.select().from(tradeExecutions)
            .where(and(
              eq(tradeExecutions.walletId, input.walletId),
              eq(tradeExecutions.userId, ctx.user.id),
              eq(tradeExecutions.status, 'open'),
            ));

          return { success: true, closedPnl: netPnl, newPositionId, newSide, walletId: input.walletId, openExecutions: paperOpenExecutions };
        }

        const client = createBinanceFuturesClient(wallet);
        const position = await getPosition(client, input.symbol);

        if (!position) throw new TRPCError({ code: 'NOT_FOUND', message: 'No open position for this symbol' });

        const symbolFilters = await getMinNotionalFilterService().getSymbolFilters('FUTURES');
        const stepSize = symbolFilters.get(input.symbol)?.stepSize?.toString();

        const positionAmt = parseFloat(position.positionAmt);
        const quantity = Math.abs(positionAmt);
        const closeSide = positionAmt > 0 ? 'SELL' : 'BUY';
        const openSide = positionAmt > 0 ? 'BUY' : 'SELL';
        const formattedQty = formatQuantityForBinance(quantity, stepSize);

        await cancelAllSymbolOrders(client, input.symbol);

        const closeResult = await submitFuturesOrder(client, {
          symbol: input.symbol,
          side: closeSide,
          type: 'MARKET',
          quantity: formattedQty,
        });

        const openResult = await submitFuturesOrder(client, {
          symbol: input.symbol,
          side: openSide,
          type: 'MARKET',
          quantity: formattedQty,
        });

        logger.info({
          walletId: input.walletId,
          symbol: input.symbol,
          closeOrderId: closeResult.orderId,
          openOrderId: openResult.orderId,
          newSide: positionAmt > 0 ? 'SHORT' : 'LONG',
          quantity: formattedQty,
        }, 'Position reversed: cancel orders → close → open');

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
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        if (error instanceof BinanceIpBannedError) throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: error.message });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to reverse position',
          cause: error,
        });
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

          if (!position) throw new TRPCError({ code: 'NOT_FOUND', message: 'Position not found' });

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
            side: position.side as 'LONG' | 'SHORT',
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

          logger.info({ positionId: input.positionId, symbol: input.symbol, netPnl: netPnl.toFixed(4) }, 'Paper position closed and orders cancelled');

          const paperOpenExecutions = await ctx.db.select().from(tradeExecutions)
            .where(and(
              eq(tradeExecutions.walletId, input.walletId),
              eq(tradeExecutions.userId, ctx.user.id),
              eq(tradeExecutions.status, 'open'),
            ));

          return { success: true, pnl: netPnl, pnlPercent, walletId: input.walletId, openExecutions: paperOpenExecutions };
        }

        const client = createBinanceFuturesClient(wallet);
        const position = await getPosition(client, input.symbol);

        if (!position) throw new TRPCError({ code: 'NOT_FOUND', message: 'No open position for this symbol' });

        await cancelAllSymbolOrders(client, input.symbol);

        const symbolFilters = await getMinNotionalFilterService().getSymbolFilters('FUTURES');
        const stepSize = symbolFilters.get(input.symbol)?.stepSize?.toString();
        const result = await closeExchangePosition(client, input.symbol, position.positionAmt, stepSize);

        logger.info({
          walletId: input.walletId,
          symbol: input.symbol,
          orderId: result.orderId,
        }, 'Position closed and all orders cancelled');

        const openExecutions = await ctx.db.select().from(tradeExecutions)
          .where(and(
            eq(tradeExecutions.walletId, input.walletId),
            eq(tradeExecutions.userId, ctx.user.id),
            eq(tradeExecutions.status, 'open'),
          ));

        return { success: true, orderId: result.orderId, walletId: input.walletId, openExecutions };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        if (error instanceof BinanceIpBannedError) throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: error.message });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to close position and cancel orders',
          cause: error,
        });
      }
    }),
});
