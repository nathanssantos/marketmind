import { TRPCError } from '@trpc/server';
import { randomBytes } from 'crypto';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { wallets, type Wallet } from '../db/schema';
import { createBinanceClient, isPaperWallet } from '../services/binance-client';
import { encryptApiKey } from '../services/encryption';
import { getWebSocketService } from '../services/websocket';
import { protectedProcedure, router } from '../trpc';

const generateId = (length: number): string => {
  return randomBytes(length).toString('base64url').slice(0, length);
};

export const walletRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const userWallets = await ctx.db
      .select({
        id: wallets.id,
        name: wallets.name,
        walletType: wallets.walletType,
        currency: wallets.currency,
        initialBalance: wallets.initialBalance,
        currentBalance: wallets.currentBalance,
        isActive: wallets.isActive,
        createdAt: wallets.createdAt,
        updatedAt: wallets.updatedAt,
      })
      .from(wallets)
      .where(eq(wallets.userId, ctx.user.id));

    return userWallets;
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const [wallet] = await ctx.db
        .select({
          id: wallets.id,
          name: wallets.name,
          walletType: wallets.walletType,
          currency: wallets.currency,
          initialBalance: wallets.initialBalance,
          currentBalance: wallets.currentBalance,
          isActive: wallets.isActive,
          createdAt: wallets.createdAt,
          updatedAt: wallets.updatedAt,
        })
        .from(wallets)
        .where(and(eq(wallets.id, input.id), eq(wallets.userId, ctx.user.id)))
        .limit(1);

      if (!wallet) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Wallet not found',
        });
      }

      return wallet;
    }),

  createPaper: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        initialBalance: z.string().default('10000'),
        currency: z.string().default('USDT'),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const walletId = generateId(21);

      await ctx.db.insert(wallets).values({
        id: walletId,
        userId: ctx.user.id,
        name: input.name,
        apiKeyEncrypted: 'paper-trading',
        apiSecretEncrypted: 'paper-trading',
        initialBalance: input.initialBalance,
        currentBalance: input.initialBalance,
        currency: input.currency,
        isActive: true,
      });

      const walletData = {
        id: walletId,
        name: input.name,
        initialBalance: input.initialBalance,
        currentBalance: input.initialBalance,
        currency: input.currency,
      };

      const wsService = getWebSocketService();
      if (wsService) {
        wsService.emitWalletUpdate(walletId, walletData);
      }

      return walletData;
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        apiKey: z.string().min(1),
        apiSecret: z.string().min(1),
        walletType: z.enum(['live', 'testnet']).default('testnet'),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const tempWallet = {
          apiKeyEncrypted: input.apiKey,
          apiSecretEncrypted: input.apiSecret,
          walletType: input.walletType,
        } as Wallet;

        const client = createBinanceClient(tempWallet);
        const accountInfo = await client.getAccountInformation();

        if (!accountInfo) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid Binance API credentials',
          });
        }

        const apiKeyEncrypted = encryptApiKey(input.apiKey);
        const apiSecretEncrypted = encryptApiKey(input.apiSecret);

        const usdtBalance = accountInfo.balances?.find((b) => b.asset === 'USDT');
        const initialBalance = usdtBalance?.free
          ? parseFloat(usdtBalance.free.toString())
          : 0;

        const walletId = generateId(21);

        await ctx.db.insert(wallets).values({
          id: walletId,
          userId: ctx.user.id,
          name: input.name,
          walletType: input.walletType,
          apiKeyEncrypted,
          apiSecretEncrypted,
          initialBalance: initialBalance.toString(),
          currentBalance: initialBalance.toString(),
          currency: 'USDT',
          isActive: true,
        });

        return {
          id: walletId,
          name: input.name,
          walletType: input.walletType,
          initialBalance: initialBalance.toString(),
          currentBalance: initialBalance.toString(),
          currency: 'USDT',
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Failed to connect to Binance ${input.walletType}: ${errorMessage}`,
          cause: error,
        });
      }
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(255).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const [existing] = await ctx.db
        .select()
        .from(wallets)
        .where(and(eq(wallets.id, input.id), eq(wallets.userId, ctx.user.id)))
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Wallet not found',
        });
      }

      const updateData: Partial<typeof wallets.$inferInsert> = {
        updatedAt: new Date(),
      };

      if (input.name !== undefined) updateData.name = input.name;
      if (input.isActive !== undefined) updateData.isActive = input.isActive;

      await ctx.db.update(wallets).set(updateData).where(eq(wallets.id, input.id));

      const [updatedWallet] = await ctx.db
        .select({
          id: wallets.id,
          name: wallets.name,
          currency: wallets.currency,
          initialBalance: wallets.initialBalance,
          currentBalance: wallets.currentBalance,
          isActive: wallets.isActive,
        })
        .from(wallets)
        .where(eq(wallets.id, input.id))
        .limit(1);

      const wsService = getWebSocketService();
      if (wsService && updatedWallet) {
        wsService.emitWalletUpdate(input.id, updatedWallet);
      }

      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const [existing] = await ctx.db
        .select()
        .from(wallets)
        .where(and(eq(wallets.id, input.id), eq(wallets.userId, ctx.user.id)))
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Wallet not found',
        });
      }

      await ctx.db.delete(wallets).where(eq(wallets.id, input.id));

      return { success: true };
    }),

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
          currency: wallet.currency ?? 'USDT',
          walletType: 'paper' as const,
        };
      }

      try {
        const client = createBinanceClient(wallet);
        const accountInfo = await client.getAccountInformation();
        const usdtBalance = accountInfo.balances?.find((b) => b.asset === 'USDT');
        const currentBalance = usdtBalance?.free
          ? parseFloat(usdtBalance.free.toString())
          : 0;

        await ctx.db
          .update(wallets)
          .set({
            currentBalance: currentBalance.toString(),
            updatedAt: new Date(),
          })
          .where(eq(wallets.id, input.id));

        const wsService = getWebSocketService();
        if (wsService) {
          wsService.emitWalletUpdate(input.id, {
            id: wallet.id,
            name: wallet.name,
            currentBalance: currentBalance.toString(),
          });
        }

        return {
          currentBalance: currentBalance.toString(),
          currency: 'USDT',
          walletType: wallet.walletType,
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

  testConnection: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
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
          connected: true,
          walletType: 'paper' as const,
          message: 'Paper wallet - no API connection needed',
        };
      }

      try {
        const client = createBinanceClient(wallet);
        await client.testConnectivity();
        const serverTime = await client.getServerTime();

        return {
          connected: true,
          walletType: wallet.walletType,
          serverTime: Number(serverTime),
        };
      } catch (error) {
        return {
          connected: false,
          walletType: wallet.walletType,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }),

  getPortfolio: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
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
          totalValueUSDT: wallet.currentBalance ?? '0',
          walletType: 'paper' as const,
          assets: [
            {
              asset: 'USDT',
              free: wallet.currentBalance ?? '0',
              locked: '0',
              valueUSDT: wallet.currentBalance ?? '0',
            },
          ],
        };
      }

      try {
        const client = createBinanceClient(wallet);
        const accountInfo = await client.getAccountInformation();

        const nonZeroBalances = accountInfo.balances?.filter((b) => {
          const free = parseFloat(b.free?.toString() || '0');
          const locked = parseFloat(b.locked?.toString() || '0');
          return free > 0 || locked > 0;
        }) || [];

        const stablecoins = ['USDT', 'USDC', 'BUSD', 'DAI', 'TUSD'];
        let totalValueUSDT = 0;

        const assetsWithValue = await Promise.all(
          nonZeroBalances.map(async (balance) => {
            const free = parseFloat(balance.free?.toString() || '0');
            const locked = parseFloat(balance.locked?.toString() || '0');
            const total = free + locked;

            let valueUSDT = 0;

            if (stablecoins.includes(balance.asset)) {
              valueUSDT = total;
            } else {
              try {
                const ticker = await client.get24hrChangeStatistics({
                  symbol: `${balance.asset}USDT`,
                });
                const price = parseFloat(ticker.lastPrice || '0');
                valueUSDT = total * price;
              } catch {
                try {
                  const btcTicker = await client.get24hrChangeStatistics({
                    symbol: `${balance.asset}BTC`,
                  });
                  const btcUsdtTicker = await client.get24hrChangeStatistics({
                    symbol: 'BTCUSDT',
                  });
                  const btcPrice = parseFloat(btcTicker.lastPrice || '0');
                  const btcUsdtPrice = parseFloat(btcUsdtTicker.lastPrice || '0');
                  valueUSDT = total * btcPrice * btcUsdtPrice;
                } catch {
                  valueUSDT = 0;
                }
              }
            }

            totalValueUSDT += valueUSDT;

            return {
              asset: balance.asset,
              free: free.toString(),
              locked: locked.toString(),
              valueUSDT: valueUSDT.toFixed(2),
            };
          })
        );

        const sortedAssets = assetsWithValue.sort(
          (a, b) => parseFloat(b.valueUSDT) - parseFloat(a.valueUSDT)
        );

        await ctx.db
          .update(wallets)
          .set({
            currentBalance: totalValueUSDT.toFixed(2),
            updatedAt: new Date(),
          })
          .where(eq(wallets.id, input.id));

        return {
          totalValueUSDT: totalValueUSDT.toFixed(2),
          walletType: wallet.walletType,
          assets: sortedAssets,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to fetch portfolio from Binance ${wallet.walletType}: ${errorMessage}`,
          cause: error,
        });
      }
    }),
});
