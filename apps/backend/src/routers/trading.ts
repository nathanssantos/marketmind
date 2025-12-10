import type { BinanceNewOrderResult, BinanceOrderQueryResult } from '@marketmind/types';
import { TRPCError } from '@trpc/server';
import { MainClient } from 'binance';
import { randomBytes } from 'crypto';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { orders, positions, wallets } from '../db/schema';
import { decryptApiKey } from '../services/encryption';
import { protectedProcedure, router } from '../trpc';

const generateId = (length: number): string => {
  return randomBytes(length).toString('base64url').slice(0, length);
};

export const tradingRouter = router({
  createOrder: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        symbol: z.string(),
        side: z.enum(['BUY', 'SELL']),
        type: z.enum([
          'LIMIT',
          'MARKET',
          'STOP_LOSS',
          'STOP_LOSS_LIMIT',
          'TAKE_PROFIT',
          'TAKE_PROFIT_LIMIT',
        ]),
        quantity: z.string(),
        price: z.string().optional(),
        stopPrice: z.string().optional(),
        setupId: z.string().optional(),
        setupType: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const [wallet] = await ctx.db
        .select()
        .from(wallets)
        .where(and(eq(wallets.id, input.walletId), eq(wallets.userId, ctx.user.id)))
        .limit(1);

      if (!wallet) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Wallet not found',
        });
      }

      if (!wallet.isActive) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Wallet is inactive',
        });
      }

      try {
        const apiKey = decryptApiKey(wallet.apiKeyEncrypted);
        const apiSecret = decryptApiKey(wallet.apiSecretEncrypted);

        const client = new MainClient({
          api_key: apiKey,
          api_secret: apiSecret,
        });

        const binanceOrder = await client.submitNewOrder({
          symbol: input.symbol,
          side: input.side,
          type: input.type,
          quantity: parseFloat(input.quantity),
          price: input.price ? parseFloat(input.price) : undefined,
          stopPrice: input.stopPrice ? parseFloat(input.stopPrice) : undefined,
          timeInForce: input.type.includes('LIMIT') ? 'GTC' : undefined,
        });

        const orderData = binanceOrder as BinanceNewOrderResult;

        await ctx.db.insert(orders).values({
          orderId: orderData.orderId,
          userId: ctx.user.id,
          walletId: input.walletId,
          symbol: orderData.symbol,
          side: orderData.side,
          type: orderData.type,
          price: orderData.price?.toString(),
          origQty: orderData.origQty?.toString(),
          executedQty: orderData.executedQty?.toString(),
          status: orderData.status,
          timeInForce: orderData.timeInForce,
          time: orderData.transactTime,
          updateTime: orderData.transactTime,
          setupId: input.setupId,
          setupType: input.setupType,
        });

        return {
          orderId: orderData.orderId,
          symbol: orderData.symbol,
          side: orderData.side,
          type: orderData.type,
          status: orderData.status,
          price: orderData.price,
          quantity: orderData.origQty,
          executedQty: orderData.executedQty,
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to create order',
          cause: error,
        });
      }
    }),

  cancelOrder: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        symbol: z.string(),
        orderId: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const [wallet] = await ctx.db
        .select()
        .from(wallets)
        .where(and(eq(wallets.id, input.walletId), eq(wallets.userId, ctx.user.id)))
        .limit(1);

      if (!wallet) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Wallet not found',
        });
      }

      try {
        const apiKey = decryptApiKey(wallet.apiKeyEncrypted);
        const apiSecret = decryptApiKey(wallet.apiSecretEncrypted);

        const client = new MainClient({
          api_key: apiKey,
          api_secret: apiSecret,
        });

        const canceledOrder = await client.cancelOrder({
          symbol: input.symbol,
          orderId: input.orderId,
        });

        await ctx.db
          .update(orders)
          .set({
            status: 'CANCELED',
            updateTime: Date.now(),
          })
          .where(eq(orders.orderId, input.orderId));

        return {
          orderId: canceledOrder.orderId,
          symbol: canceledOrder.symbol,
          status: 'CANCELED',
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to cancel order',
          cause: error,
        });
      }
    }),

  getOrders: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        symbol: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ input, ctx }) => {
      const whereConditions = [
        eq(orders.userId, ctx.user.id),
        eq(orders.walletId, input.walletId),
      ];

      if (input.symbol) {
        whereConditions.push(eq(orders.symbol, input.symbol));
      }

      const userOrders = await ctx.db
        .select()
        .from(orders)
        .where(and(...whereConditions))
        .orderBy(desc(orders.time))
        .limit(input.limit);

      return userOrders;
    }),

  getOrderById: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        orderId: z.number(),
      })
    )
    .query(async ({ input, ctx }) => {
      const [order] = await ctx.db
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.orderId, input.orderId),
            eq(orders.userId, ctx.user.id),
            eq(orders.walletId, input.walletId)
          )
        )
        .limit(1);

      if (!order) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Order not found',
        });
      }

      return order;
    }),

  syncOrders: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        symbol: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const [wallet] = await ctx.db
        .select()
        .from(wallets)
        .where(and(eq(wallets.id, input.walletId), eq(wallets.userId, ctx.user.id)))
        .limit(1);

      if (!wallet) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Wallet not found',
        });
      }

      try {
        const apiKey = decryptApiKey(wallet.apiKeyEncrypted);
        const apiSecret = decryptApiKey(wallet.apiSecretEncrypted);

        const client = new MainClient({
          api_key: apiKey,
          api_secret: apiSecret,
        });

        const binanceOrders = await client.getAllOrders({
          symbol: input.symbol,
          limit: 100,
        });

        for (const binanceOrder of binanceOrders) {
          const orderData = binanceOrder as BinanceOrderQueryResult;

          const [existingOrder] = await ctx.db
            .select()
            .from(orders)
            .where(eq(orders.orderId, orderData.orderId))
            .limit(1);

          if (existingOrder) {
            await ctx.db
              .update(orders)
              .set({
                status: orderData.status,
                executedQty: orderData.executedQty?.toString(),
                updateTime: orderData.updateTime,
              })
              .where(eq(orders.orderId, orderData.orderId));
          } else {
            await ctx.db.insert(orders).values({
              orderId: orderData.orderId,
              userId: ctx.user.id,
              walletId: input.walletId,
              symbol: orderData.symbol,
              side: orderData.side,
              type: orderData.type,
              price: orderData.price?.toString(),
              origQty: orderData.origQty?.toString(),
              executedQty: orderData.executedQty?.toString(),
              status: orderData.status,
              timeInForce: orderData.timeInForce,
              time: orderData.time,
              updateTime: orderData.updateTime,
            });
          }
        }

        return { synced: binanceOrders.length };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to sync orders',
          cause: error,
        });
      }
    }),

  getPositions: protectedProcedure
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
      })
    )
    .mutation(async ({ input, ctx }) => {
      const [wallet] = await ctx.db
        .select()
        .from(wallets)
        .where(and(eq(wallets.id, input.walletId), eq(wallets.userId, ctx.user.id)))
        .limit(1);

      if (!wallet) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Wallet not found',
        });
      }

      const positionId = generateId(21);

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

  closePosition: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        exitPrice: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const [position] = await ctx.db
        .select()
        .from(positions)
        .where(and(eq(positions.id, input.id), eq(positions.userId, ctx.user.id)))
        .limit(1);

      if (!position) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Position not found',
        });
      }

      const entryPrice = parseFloat(position.entryPrice);
      const exitPrice = parseFloat(input.exitPrice);
      const qty = parseFloat(position.entryQty);

      let pnl = 0;
      if (position.side === 'LONG') {
        pnl = (exitPrice - entryPrice) * qty;
      } else {
        pnl = (entryPrice - exitPrice) * qty;
      }

      const pnlPercent = (pnl / (entryPrice * qty)) * 100;

      await ctx.db
        .update(positions)
        .set({
          status: 'closed',
          currentPrice: input.exitPrice,
          pnl: pnl.toString(),
          pnlPercent: pnlPercent.toString(),
          closedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(positions.id, input.id));

      return {
        pnl: pnl.toString(),
        pnlPercent: pnlPercent.toFixed(2),
      };
    }),
});
