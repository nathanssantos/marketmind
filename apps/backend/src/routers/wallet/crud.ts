import type { DatabaseType } from '../../db/client';
import { DEFAULT_CURRENCY, EXCHANGE_IDS } from '@marketmind/types';
import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { orders, positions, wallets } from '../../db/schema';
import {
  createBinanceFuturesClientFromCredentials,
  createBinanceSpotClientFromCredentials,
} from '../../services/binance-client';
import { encryptApiKey } from '../../services/encryption';
import { getWebSocketService } from '../../services/websocket';
import { protectedProcedure, router } from '../../trpc';
import { generateEntityId } from '../../utils/id';
import { badRequest, notFound } from '../../utils/trpc-errors';
import { WALLET_SAFE_COLUMNS } from './shared';

const IB_CURRENCY = 'USD';
const IB_GATEWAY_CREDENTIAL = 'ib-gateway';

const createInteractiveBrokersWallet = async (
  ctx: { db: DatabaseType; user: { id: string } },
  input: { name: string; walletType: 'live' | 'testnet'; marketType: 'SPOT' | 'FUTURES' },
) => {
  if (input.marketType === 'FUTURES') throw badRequest('Interactive Brokers wallets trade stocks only; choose Spot');

  const walletId = generateEntityId();
  await ctx.db.insert(wallets).values({
    id: walletId,
    userId: ctx.user.id,
    name: input.name,
    walletType: input.walletType,
    marketType: 'SPOT',
    exchange: 'INTERACTIVE_BROKERS',
    apiKeyEncrypted: encryptApiKey(IB_GATEWAY_CREDENTIAL),
    apiSecretEncrypted: encryptApiKey(IB_GATEWAY_CREDENTIAL),
    initialBalance: '0',
    currentBalance: '0',
    currency: IB_CURRENCY,
    isActive: true,
  });

  return {
    id: walletId,
    name: input.name,
    walletType: input.walletType,
    marketType: 'SPOT' as const,
    exchange: 'INTERACTIVE_BROKERS' as const,
    initialBalance: '0',
    currentBalance: '0',
    currency: IB_CURRENCY,
  };
};

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

      if (!wallet) throw notFound('Wallet');

      return wallet;
    }),

  createPaper: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        initialBalance: z.string().default('10000'),
        currency: z.string().default(DEFAULT_CURRENCY),
        marketType: z.enum(['SPOT', 'FUTURES']).default('FUTURES'),
        exchange: z.enum(EXCHANGE_IDS).default('BINANCE'),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (input.exchange === 'INTERACTIVE_BROKERS' && input.marketType === 'FUTURES') {
        throw badRequest('Interactive Brokers wallets trade stocks only; choose Spot');
      }
      const walletId = generateEntityId();

      await ctx.db.insert(wallets).values({
        id: walletId,
        userId: ctx.user.id,
        name: input.name,
        walletType: 'paper',
        marketType: input.marketType,
        exchange: input.exchange,
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
        exchange: input.exchange,
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
        exchange: z.enum(EXCHANGE_IDS).default('BINANCE'),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (input.exchange === 'INTERACTIVE_BROKERS') return createInteractiveBrokersWallet(ctx, input);
      try {
        let initialBalance = 0;

        const credentials = {
          apiKey: input.apiKey,
          apiSecret: input.apiSecret,
          testnet: input.walletType === 'testnet',
        };

        if (input.marketType === 'FUTURES') {
          const client = createBinanceFuturesClientFromCredentials(credentials);
          const accountInfo = await client.getAccountInformationV3();

          if (!accountInfo) throw badRequest('Invalid Binance Futures API credentials');

          const usdtAsset = accountInfo.assets?.find((a) => a.asset === 'USDT');
          initialBalance = usdtAsset?.marginBalance ? parseFloat(String(usdtAsset.marginBalance)) : 0;
        } else {
          const client = createBinanceSpotClientFromCredentials(credentials);
          const accountInfo = await client.getAccountInformation();

          if (!accountInfo) throw badRequest('Invalid Binance API credentials');

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
          exchange: input.exchange,
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
          exchange: input.exchange,
          initialBalance: initialBalance.toString(),
          currentBalance: initialBalance.toString(),
          currency: DEFAULT_CURRENCY,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw badRequest(
          `Failed to connect to Binance ${input.marketType} ${input.walletType}: ${errorMessage}`,
          error,
        );
      }
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(255).optional(),
        isActive: z.boolean().optional(),
        agentTradingEnabled: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const [existing] = await ctx.db
        .select()
        .from(wallets)
        .where(and(eq(wallets.id, input.id), eq(wallets.userId, ctx.user.id)))
        .limit(1);

      if (!existing) throw notFound('Wallet');

      const updateData: Partial<typeof wallets.$inferInsert> = {
        updatedAt: new Date(),
      };

      if (input.name !== undefined) updateData.name = input.name;
      if (input.isActive !== undefined) updateData.isActive = input.isActive;
      if (input.agentTradingEnabled !== undefined) updateData.agentTradingEnabled = input.agentTradingEnabled;

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

      if (!existing) throw notFound('Wallet');

      await ctx.db.delete(orders).where(eq(orders.walletId, input.id));
      await ctx.db.delete(positions).where(eq(positions.walletId, input.id));
      await ctx.db.delete(wallets).where(eq(wallets.id, input.id));

      return { success: true };
    }),
});
