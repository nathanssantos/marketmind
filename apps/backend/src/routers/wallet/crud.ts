import { DEFAULT_CURRENCY } from '@marketmind/types';
import { TRPCError } from '@trpc/server';
import { MainClient, USDMClient } from 'binance';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { orders, positions, wallets } from '../../db/schema';
import { encryptApiKey } from '../../services/encryption';
import { getWebSocketService } from '../../services/websocket';
import { protectedProcedure, router } from '../../trpc';
import { generateEntityId } from '../../utils/id';
import { WALLET_SAFE_COLUMNS } from './shared';

export const walletCrudRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const userWallets = await ctx.db
      .select(WALLET_SAFE_COLUMNS)
      .from(wallets)
      .where(eq(wallets.userId, ctx.user.id));

    return userWallets;
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const [wallet] = await ctx.db
        .select(WALLET_SAFE_COLUMNS)
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
        marketType: z.enum(['SPOT', 'FUTURES']).default('FUTURES'),
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
            disableTimeSync: true,
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
            disableTimeSync: true,
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
});
