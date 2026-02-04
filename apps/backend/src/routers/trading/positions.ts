import { calculatePnl } from '../../utils/pnl-calculator';
import { TRPCError } from '@trpc/server';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { TRADING_CONFIG } from '../../constants';
import { positions, wallets } from '../../db/schema';
import { env } from '../../env';
import { isPaperWallet } from '../../services/binance-client';
import { getFuturesClient, getSpotClient } from '../../exchange';
import { walletQueries } from '../../services/database/walletQueries';
import { logger } from '../../services/logger';
import { protectedProcedure, router } from '../../trpc';
import { serializeError } from '../../utils/errors';
import { generateEntityId } from '../../utils/id';

export const positionsRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        status: z.enum(['open', 'closed']).optional(),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ input, ctx }) => {
      const whereConditions = [
        eq(positions.userId, ctx.user.id),
        eq(positions.walletId, input.walletId),
      ];

      if (input.status) {
        whereConditions.push(eq(positions.status, input.status));
      }

      const userPositions = await ctx.db
        .select()
        .from(positions)
        .where(and(...whereConditions))
        .orderBy(desc(positions.createdAt))
        .limit(input.limit);

      return userPositions;
    }),

  create: protectedProcedure
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
      })
    )
    .mutation(async ({ input, ctx }) => {
      await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

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
          riskRewardRatio: riskRewardRatio.toFixed(2),
        }, '✅ Risk/Reward ratio validated for manual position');
      }

      const positionId = generateEntityId();

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
      });

      return { id: positionId };
    }),

  close: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        exitPrice: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const [position] = await ctx.db
        .select()
        .from(positions)
        .where(and(eq(positions.id, input.id), eq(positions.userId, ctx.user.id)))
        .limit(1);

      if (!position) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Position not found' });
      }

      if (position.status !== 'open') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Position is not open' });
      }

      const wallet = await walletQueries.getById(position.walletId);

      const entryPrice = parseFloat(position.entryPrice);
      const qty = parseFloat(position.entryQty);
      let exitPrice = input.exitPrice ? parseFloat(input.exitPrice) : 0;
      let exitOrderId: number | null = null;

      const walletSupportsLive = !isPaperWallet(wallet);
      const shouldExecuteReal = walletSupportsLive && env.ENABLE_LIVE_TRADING;

      const isFutures = position.marketType === 'FUTURES';
      const leverage = position.leverage || 1;

      if (shouldExecuteReal) {
        try {
          const orderSide = position.side === 'LONG' ? 'SELL' : 'BUY';

          if (isFutures) {
            const client = getFuturesClient(wallet);
            const order = await client.submitOrder({
              symbol: position.symbol,
              side: orderSide,
              type: 'MARKET',
              quantity: String(qty),
              reduceOnly: true,
              newOrderRespType: 'RESULT',
            });

            exitOrderId = order.orderId;
            const filledPrice = parseFloat(order.avgPrice?.toString() || order.price?.toString() || '0');
            if (filledPrice > 0) exitPrice = filledPrice;
          } else {
            const client = getSpotClient(wallet);
            const order = await client.submitOrder({
              symbol: position.symbol,
              side: orderSide,
              type: 'MARKET',
              quantity: qty,
            });

            exitOrderId = order.orderId;
            const filledPrice = order.price ? parseFloat(order.price) : 0;
            if (filledPrice > 0) exitPrice = filledPrice;
          }

          logger.info({
            positionId: position.id,
            orderId: exitOrderId,
            symbol: position.symbol,
            side: orderSide,
            quantity: qty,
            exitPrice,
            exitSource: 'MANUAL',
            marketType: position.marketType,
            leverage,
            message: 'Position closed manually by user',
          }, '👤 [MANUAL] Manual close position: Binance exit order executed');
        } catch (error) {
          logger.error({
            positionId: position.id,
            error: serializeError(error),
          }, 'Failed to execute Binance exit order for position');

          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error instanceof Error ? error.message : 'Failed to execute exit order on Binance',
          });
        }
      } else {
        if (!input.exitPrice) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Exit price is required for paper trading',
          });
        }
        logger.info({
          positionId: position.id,
          walletType: wallet.walletType,
          liveEnabled: env.ENABLE_LIVE_TRADING,
          exitSource: 'MANUAL',
          marketType: position.marketType,
          leverage,
          message: 'Position closed manually by user (paper trading)',
        }, '👤 [MANUAL] Manual close position: Paper/disabled mode - simulating exit');
      }

      const marketType = isFutures ? 'FUTURES' : 'SPOT';
      const { grossPnl, totalFees, netPnl, pnlPercent } = calculatePnl({
        entryPrice,
        exitPrice,
        quantity: qty,
        side: position.side as 'LONG' | 'SHORT',
        marketType,
        leverage,
      });

      const currentBalance = parseFloat(wallet.currentBalance || '0');
      const newBalance = currentBalance + netPnl;

      await ctx.db.transaction(async (tx) => {
        await tx
          .update(positions)
          .set({
            status: 'closed',
            currentPrice: exitPrice.toString(),
            pnl: netPnl.toString(),
            pnlPercent: pnlPercent.toString(),
            closedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(positions.id, input.id));

        await tx
          .update(wallets)
          .set({
            currentBalance: newBalance.toString(),
            updatedAt: new Date(),
          })
          .where(eq(wallets.id, wallet.id));
      });

      return {
        pnl: netPnl.toString(),
        grossPnl: grossPnl.toString(),
        fees: totalFees.toString(),
        pnlPercent: pnlPercent.toFixed(2),
        exitOrderId,
        exitPrice: exitPrice.toString(),
        leverage: isFutures ? leverage : undefined,
        marketType: position.marketType,
      };
    }),
});
