import { DEFAULT_CURRENCY } from '@marketmind/types';
import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { wallets, tradeExecutions } from '../../db/schema';
import { isPaperWallet } from '../../services/binance-client';
import { getFuturesClient, getSpotClient } from '../../exchange';
import { createBinanceFuturesClient, getPositions as getFuturesPositions } from '../../services/binance-futures-client';
import { getWebSocketService } from '../../services/websocket';
import { logger } from '../../services/logger';
import { protectedProcedure, router } from '../../trpc';

export const walletSyncRouter = router({
  syncBalance: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const [wallet] = await ctx.db
        .select()
        .from(wallets)
        .where(and(eq(wallets.id, input.id), eq(wallets.userId, ctx.user.id)))
        .limit(1);

      if (!wallet) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Wallet not found',
        });
      }

      if (isPaperWallet(wallet)) {
        return {
          currentBalance: wallet.currentBalance ?? '0',
          currency: wallet.currency ?? DEFAULT_CURRENCY,
          walletType: 'paper' as const,
        };
      }

      try {
        let currentBalance = 0;
        let debugInfo: Record<string, string> = {};

        let walletBalance = 0;

        if (wallet.marketType === 'FUTURES') {
          const client = getFuturesClient(wallet);
          const accountInfo = await client.getAccountInfo();
          const usdtAsset = accountInfo.assets?.find((a) => a.asset === 'USDT');
          currentBalance = usdtAsset?.marginBalance
            ? parseFloat(String(usdtAsset.marginBalance))
            : 0;
          walletBalance = usdtAsset?.walletBalance
            ? parseFloat(String(usdtAsset.walletBalance))
            : 0;

          debugInfo = {
            totalWalletBalance: String(accountInfo.totalWalletBalance ?? '0'),
            totalUnrealizedProfit: String(accountInfo.totalUnrealizedProfit ?? '0'),
            totalMarginBalance: String(accountInfo.totalMarginBalance ?? '0'),
            availableBalance: String(accountInfo.availableBalance ?? '0'),
            usdtWalletBalance: String(usdtAsset?.walletBalance ?? '0'),
            usdtUnrealizedProfit: String(usdtAsset?.unrealizedProfit ?? '0'),
            usdtMarginBalance: String(usdtAsset?.marginBalance ?? '0'),
            storedInitialBalance: wallet.initialBalance ?? '0',
          };

        } else {
          const client = getSpotClient(wallet);
          const accountInfo = await client.getAccountInfo();
          const usdtBalance = accountInfo.balances?.find((b) => b.asset === 'USDT');
          currentBalance = usdtBalance?.free
            ? parseFloat(usdtBalance.free.toString())
            : 0;
          walletBalance = currentBalance;
        }

        await ctx.db
          .update(wallets)
          .set({
            currentBalance: currentBalance.toString(),
            totalWalletBalance: walletBalance > 0 ? walletBalance.toString() : null,
            updatedAt: new Date(),
          })
          .where(eq(wallets.id, input.id));

        if (wallet.marketType === 'FUTURES') {
          try {
            const binanceClient = createBinanceFuturesClient(wallet);
            const exchangePositions = await getFuturesPositions(binanceClient);

            const openExecutions = await ctx.db
              .select({ id: tradeExecutions.id, symbol: tradeExecutions.symbol })
              .from(tradeExecutions)
              .where(
                and(
                  eq(tradeExecutions.walletId, input.id),
                  eq(tradeExecutions.status, 'open'),
                  eq(tradeExecutions.marketType, 'FUTURES'),
                )
              );

            for (const exec of openExecutions) {
              const pos = exchangePositions.find((p) => p.symbol === exec.symbol);
              if (!pos) continue;
              await ctx.db
                .update(tradeExecutions)
                .set({ liquidationPrice: pos.liquidationPrice })
                .where(eq(tradeExecutions.id, exec.id));
            }
          } catch (e) {
            logger.warn({ error: e }, 'Failed to sync liquidation prices');
          }
        }

        const wsService = getWebSocketService();
        if (wsService) {
          wsService.emitWalletUpdate(input.id, {
            id: wallet.id,
            name: wallet.name,
            currentBalance: currentBalance.toString(),
            totalWalletBalance: walletBalance > 0 ? walletBalance.toString() : null,
          });
        }

        return {
          currentBalance: currentBalance.toString(),
          totalWalletBalance: walletBalance > 0 ? walletBalance.toString() : null,
          currency: wallet.currency ?? DEFAULT_CURRENCY,
          walletType: wallet.walletType,
          debug: debugInfo,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to sync balance from Binance ${wallet.walletType}: ${errorMessage}`,
          cause: error,
        });
      }
    }),

  syncTransfers: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const [wallet] = await ctx.db
        .select()
        .from(wallets)
        .where(and(eq(wallets.id, input.id), eq(wallets.userId, ctx.user.id)))
        .limit(1);

      if (!wallet) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Wallet not found',
        });
      }

      if (isPaperWallet(wallet)) {
        return {
          success: true,
          totalDeposits: '0',
          totalWithdrawals: '0',
          message: 'Paper wallet - no transfers to sync',
        };
      }

      try {
        const { incomeSyncService } = await import('../../services/income-sync-service');
        const result = await incomeSyncService.backfillTransfers(wallet.id);

        const [updatedWallet] = await ctx.db
          .select({
            totalDeposits: wallets.totalDeposits,
            totalWithdrawals: wallets.totalWithdrawals,
          })
          .from(wallets)
          .where(eq(wallets.id, wallet.id))
          .limit(1);

        return {
          success: true,
          totalDeposits: updatedWallet?.totalDeposits ?? '0',
          totalWithdrawals: updatedWallet?.totalWithdrawals ?? '0',
          walletsProcessed: result.walletsProcessed,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to sync transfers: ${errorMessage}`,
          cause: error,
        });
      }
    }),
});
