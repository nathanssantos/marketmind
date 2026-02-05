import { DEFAULT_CURRENCY } from '@marketmind/types';
import { TRPCError } from '@trpc/server';
import { MainClient, USDMClient } from 'binance';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { STABLECOINS } from '../constants';
import { orders, positions, wallets } from '../db/schema';
import { createBinanceClient, createBinanceFuturesClient, isPaperWallet } from '../services/binance-client';
import { getFuturesClient, getSpotClient } from '../exchange';
import { encryptApiKey } from '../services/encryption';
import { getWebSocketService } from '../services/websocket';
import { protectedProcedure, router } from '../trpc';
import { generateEntityId } from '../utils/id';

export const walletRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const userWallets = await ctx.db
      .select({
        id: wallets.id,
        name: wallets.name,
        walletType: wallets.walletType,
        marketType: wallets.marketType,
        currency: wallets.currency,
        exchange: wallets.exchange,
        initialBalance: wallets.initialBalance,
        currentBalance: wallets.currentBalance,
        totalDeposits: wallets.totalDeposits,
        totalWithdrawals: wallets.totalWithdrawals,
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
          marketType: wallets.marketType,
          currency: wallets.currency,
          exchange: wallets.exchange,
          initialBalance: wallets.initialBalance,
          currentBalance: wallets.currentBalance,
          totalDeposits: wallets.totalDeposits,
          totalWithdrawals: wallets.totalWithdrawals,
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
        currency: z.string().default(DEFAULT_CURRENCY),
        marketType: z.enum(['SPOT', 'FUTURES']).default('SPOT'),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const walletId = generateEntityId();

      await ctx.db.insert(wallets).values({
        id: walletId,
        userId: ctx.user.id,
        name: input.name,
        walletType: 'paper',
        marketType: input.marketType,
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
        walletType: 'paper' as const,
        marketType: input.marketType,
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
        marketType: z.enum(['SPOT', 'FUTURES']).default('FUTURES'),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        let initialBalance = 0;

        if (input.marketType === 'FUTURES') {
          const client = new USDMClient({
            api_key: input.apiKey,
            api_secret: input.apiSecret,
            testnet: input.walletType === 'testnet',
          });
          const accountInfo = await client.getAccountInformation();

          if (!accountInfo) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Invalid Binance Futures API credentials',
            });
          }

          const usdtAsset = accountInfo.assets?.find((a) => a.asset === 'USDT');
          initialBalance = usdtAsset?.marginBalance ? parseFloat(String(usdtAsset.marginBalance)) : 0;
        } else {
          const client = new MainClient({
            api_key: input.apiKey,
            api_secret: input.apiSecret,
            testnet: input.walletType === 'testnet',
          });
          const accountInfo = await client.getAccountInformation();

          if (!accountInfo) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Invalid Binance API credentials',
            });
          }

          const usdtBalance = accountInfo.balances?.find((b) => b.asset === 'USDT');
          initialBalance = usdtBalance?.free ? parseFloat(usdtBalance.free.toString()) : 0;
        }

        const apiKeyEncrypted = encryptApiKey(input.apiKey);
        const apiSecretEncrypted = encryptApiKey(input.apiSecret);

        const walletId = generateEntityId();

        await ctx.db.insert(wallets).values({
          id: walletId,
          userId: ctx.user.id,
          name: input.name,
          walletType: input.walletType,
          marketType: input.marketType,
          apiKeyEncrypted,
          apiSecretEncrypted,
          initialBalance: initialBalance.toString(),
          currentBalance: initialBalance.toString(),
          currency: DEFAULT_CURRENCY,
          isActive: true,
        });

        return {
          id: walletId,
          name: input.name,
          walletType: input.walletType,
          marketType: input.marketType,
          initialBalance: initialBalance.toString(),
          currentBalance: initialBalance.toString(),
          currency: DEFAULT_CURRENCY,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Failed to connect to Binance ${input.marketType} ${input.walletType}: ${errorMessage}`,
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

      await ctx.db.delete(orders).where(eq(orders.walletId, input.id));
      await ctx.db.delete(positions).where(eq(positions.walletId, input.id));
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
          currency: wallet.currency ?? DEFAULT_CURRENCY,
          walletType: 'paper' as const,
        };
      }

      try {
        let currentBalance = 0;
        let debugInfo: Record<string, string> = {};

        if (wallet.marketType === 'FUTURES') {
          const client = getFuturesClient(wallet);
          const accountInfo = await client.getAccountInfo();
          const usdtAsset = accountInfo.assets?.find((a) => a.asset === 'USDT');
          currentBalance = usdtAsset?.marginBalance
            ? parseFloat(String(usdtAsset.marginBalance))
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
        }

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
        const { incomeSyncService } = await import('../services/income-sync-service');
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
        let serverTime: number;

        if (wallet.marketType === 'FUTURES') {
          const client = createBinanceFuturesClient(wallet);
          serverTime = await client.getServerTime();
        } else {
          const client = createBinanceClient(wallet);
          await client.testConnectivity();
          serverTime = Number(await client.getServerTime());
        }

        return {
          connected: true,
          walletType: wallet.walletType,
          marketType: wallet.marketType,
          serverTime,
        };
      } catch (error) {
        return {
          connected: false,
          walletType: wallet.walletType,
          marketType: wallet.marketType,
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
        let totalValueUSDT = 0;
        let realizedBalanceUSDT = 0;
        let assets: Array<{ asset: string; free: string; locked: string; valueUSDT: string }> = [];

        if (wallet.marketType === 'FUTURES') {
          const client = getFuturesClient(wallet);
          const accountInfo = await client.getAccountInfo();

          const nonZeroAssets = accountInfo.assets?.filter((a) => {
            const balance = parseFloat(String(a.walletBalance || '0'));
            return balance > 0;
          }) || [];

          for (const asset of nonZeroAssets) {
            const assetWalletBalance = parseFloat(String(asset.walletBalance || '0'));
            const availableBalance = parseFloat(String(asset.availableBalance || '0'));
            const marginBalance = parseFloat(String(asset.marginBalance || '0'));

            if (asset.asset === 'USDT') {
              totalValueUSDT += marginBalance;
              realizedBalanceUSDT += assetWalletBalance;
            }

            assets.push({
              asset: asset.asset,
              free: availableBalance.toString(),
              locked: (assetWalletBalance - availableBalance).toFixed(2),
              valueUSDT: marginBalance.toFixed(2),
            });
          }
        } else {
          const client = createBinanceClient(wallet);
          const accountInfo = await client.getAccountInformation();

          const nonZeroBalances = accountInfo.balances?.filter((b) => {
            const free = parseFloat(b.free?.toString() || '0');
            const locked = parseFloat(b.locked?.toString() || '0');
            return free > 0 || locked > 0;
          }) || [];

          const assetsWithValue = await Promise.all(
            nonZeroBalances.map(async (balance) => {
              const free = parseFloat(balance.free?.toString() || '0');
              const locked = parseFloat(balance.locked?.toString() || '0');
              const total = free + locked;

              let valueUSDT = 0;

              if (STABLECOINS.includes(balance.asset as typeof STABLECOINS[number])) {
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

          assets = assetsWithValue;
          realizedBalanceUSDT = totalValueUSDT;
        }

        const sortedAssets = assets.sort(
          (a, b) => parseFloat(b.valueUSDT) - parseFloat(a.valueUSDT)
        );

        await ctx.db
          .update(wallets)
          .set({
            currentBalance: realizedBalanceUSDT.toFixed(2),
            updatedAt: new Date(),
          })
          .where(eq(wallets.id, input.id));

        return {
          totalValueUSDT: totalValueUSDT.toFixed(2),
          realizedBalance: realizedBalanceUSDT.toFixed(2),
          walletType: wallet.walletType,
          marketType: wallet.marketType,
          assets: sortedAssets,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to fetch portfolio from Binance ${wallet.walletType} ${wallet.marketType}: ${errorMessage}`,
          cause: error,
        });
      }
    }),
});
