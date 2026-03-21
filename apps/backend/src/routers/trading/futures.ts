import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { autoTradingService } from '../../services/auto-trading';
import { isPaperWallet } from '../../services/binance-client';
import { getFuturesClient } from '../../exchange';
import { walletQueries } from '../../services/database/walletQueries';
import { protectedProcedure, router } from '../../trpc';

export const futuresConfigRouter = router({
  setFuturesLeverage: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        symbol: z.string(),
        leverage: z.number().min(1).max(125),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const wallet = await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

      try {
        await autoTradingService.setFuturesLeverage(wallet, input.symbol, input.leverage);
        return { success: true, leverage: input.leverage };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to set leverage',
          cause: error,
        });
      }
    }),

  setFuturesMarginType: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        symbol: z.string(),
        marginType: z.enum(['ISOLATED', 'CROSSED']),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const wallet = await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

      try {
        await autoTradingService.setFuturesMarginType(wallet, input.symbol, input.marginType);
        return { success: true, marginType: input.marginType };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to set margin type',
          cause: error,
        });
      }
    }),

  setFuturesPositionMode: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        dualSidePosition: z.boolean(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const wallet = await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

      try {
        await autoTradingService.setFuturesPositionMode(wallet, input.dualSidePosition);
        return { success: true, dualSidePosition: input.dualSidePosition };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to set position mode',
          cause: error,
        });
      }
    }),

  getFuturesAccountInfo: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const wallet = await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

      if (isPaperWallet(wallet)) {
        return {
          totalWalletBalance: wallet.currentBalance || '0',
          availableBalance: wallet.currentBalance || '0',
          positions: [],
        };
      }

      try {
        const client = getFuturesClient(wallet);
        const account = await client.getAccountInfo();

        return {
          totalWalletBalance: account.totalWalletBalance,
          availableBalance: account.availableBalance,
          positions: account.positions
            .filter((p) => parseFloat(String(p.positionAmt)) !== 0)
            .map((p) => ({
              symbol: p.symbol,
              positionAmt: String(p.positionAmt),
              entryPrice: String(p.entryPrice),
              unrealizedProfit: String(p.unrealizedPnl),
              leverage: String(p.leverage),
              marginType: (p as unknown as { marginType?: string }).marginType,
              liquidationPrice: (p as unknown as { liquidationPrice?: string }).liquidationPrice,
            })),
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get futures account info',
          cause: error,
        });
      }
    }),
});
