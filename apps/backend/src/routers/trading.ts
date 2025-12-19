import type { BinanceNewOrderResult, BinanceOrderQueryResult } from '@marketmind/types';
import { TRPCError } from '@trpc/server';
import { MainClient } from 'binance';
import { randomBytes } from 'crypto';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { orders, positions, tradeExecutions, wallets } from '../db/schema';
import { env } from '../env';
import { createBinanceClient, isPaperWallet } from '../services/binance-client';
import { logger } from '../services/logger';
import { protectedProcedure, router } from '../trpc';

const generateId = (length: number): string => {
  return randomBytes(length).toString('base64url').slice(0, length);
};

const BINANCE_TAKER_FEE = 0.001;

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
        if (isPaperWallet(wallet)) {
          const simulatedOrderId = Date.now();
          const price = input.price || '0';
          const quantity = input.quantity;

          await ctx.db.insert(orders).values({
            orderId: simulatedOrderId,
            userId: ctx.user.id,
            walletId: input.walletId,
            symbol: input.symbol,
            side: input.side,
            type: input.type,
            price,
            origQty: quantity,
            executedQty: input.type === 'MARKET' ? quantity : '0',
            status: input.type === 'MARKET' ? 'FILLED' : 'NEW',
            timeInForce: input.type.includes('LIMIT') ? 'GTC' : undefined,
            time: simulatedOrderId,
            updateTime: simulatedOrderId,
            setupId: input.setupId,
            setupType: input.setupType,
          });

          return {
            orderId: simulatedOrderId,
            symbol: input.symbol,
            side: input.side,
            type: input.type,
            status: input.type === 'MARKET' ? 'FILLED' : 'NEW',
            price,
            quantity,
            executedQty: input.type === 'MARKET' ? quantity : '0',
          };
        }

        const client = createBinanceClient(wallet);

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
        if (isPaperWallet(wallet)) {
          await ctx.db
            .update(orders)
            .set({
              status: 'CANCELED',
              updateTime: Date.now(),
            })
            .where(eq(orders.orderId, input.orderId));

          return {
            orderId: input.orderId,
            symbol: input.symbol,
            status: 'CANCELED',
          };
        }

        const client = createBinanceClient(wallet);

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
        if (isPaperWallet(wallet)) {
          return { synced: 0, message: 'Paper wallets do not sync with Binance' };
        }

        const client = createBinanceClient(wallet);

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

      const MIN_RISK_REWARD_RATIO = 1.5;

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

        if (riskRewardRatio < MIN_RISK_REWARD_RATIO) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Risk/reward ratio (${riskRewardRatio.toFixed(2)}:1) is below minimum required (${MIN_RISK_REWARD_RATIO}:1)`,
          });
        }

        logger.info({
          symbol: input.symbol,
          side: input.side,
          riskRewardRatio: riskRewardRatio.toFixed(2),
        }, '✅ Risk/Reward ratio validated for manual position');
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
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Position not found',
        });
      }

      if (position.status !== 'open') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Position is not open',
        });
      }

      const [wallet] = await ctx.db
        .select()
        .from(wallets)
        .where(eq(wallets.id, position.walletId))
        .limit(1);

      if (!wallet) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Wallet not found',
        });
      }

      const entryPrice = parseFloat(position.entryPrice);
      const qty = parseFloat(position.entryQty);
      let exitPrice = input.exitPrice ? parseFloat(input.exitPrice) : 0;
      let exitOrderId: number | null = null;

      const walletSupportsLive = !isPaperWallet(wallet);
      const shouldExecuteReal = walletSupportsLive && env.ENABLE_LIVE_TRADING;

      if (shouldExecuteReal) {
        try {
          const client = createBinanceClient(wallet);
          const orderSide = position.side === 'LONG' ? 'SELL' : 'BUY';

          const order = await client.submitNewOrder({
            symbol: position.symbol,
            side: orderSide,
            type: 'MARKET',
            quantity: qty,
          });

          exitOrderId = order.orderId;
          const filledPrice = 'price' in order ? parseFloat(order.price?.toString() || '0') : 0;
          if (filledPrice > 0) exitPrice = filledPrice;

          logger.info({
            positionId: position.id,
            orderId: exitOrderId,
            symbol: position.symbol,
            side: orderSide,
            quantity: qty,
            exitPrice,
          exitSource: 'MANUAL',
          message: 'Posição fechada manualmente pelo usuário',
          }, '👤 [MANUAL] Manual close position: Binance exit order executed');
        } catch (error) {
          logger.error({
            positionId: position.id,
            error: error instanceof Error ? error.message : String(error),
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
          message: 'Posição fechada manualmente pelo usuário (paper trading)',
        }, '👤 [MANUAL] Manual close position: Paper/disabled mode - simulating exit');
      }

      const entryValue = entryPrice * qty;
      const exitValue = exitPrice * qty;
      const entryFee = entryValue * BINANCE_TAKER_FEE;
      const exitFee = exitValue * BINANCE_TAKER_FEE;
      const totalFees = entryFee + exitFee;

      let grossPnl = 0;
      if (position.side === 'LONG') {
        grossPnl = (exitPrice - entryPrice) * qty;
      } else {
        grossPnl = (entryPrice - exitPrice) * qty;
      }

      const netPnl = grossPnl - totalFees;
      const pnlPercent = (netPnl / entryValue) * 100;

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
      };
    }),

  getTradeExecutions: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        symbol: z.string().optional(),
        status: z.enum(['open', 'closed', 'cancelled']).optional(),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ input, ctx }) => {
      const whereConditions = [
        eq(tradeExecutions.userId, ctx.user.id),
        eq(tradeExecutions.walletId, input.walletId),
      ];

      if (input.symbol) {
        whereConditions.push(eq(tradeExecutions.symbol, input.symbol));
      }

      if (input.status) {
        whereConditions.push(eq(tradeExecutions.status, input.status));
      }

      const executions = await ctx.db
        .select()
        .from(tradeExecutions)
        .where(and(...whereConditions))
        .orderBy(desc(tradeExecutions.openedAt))
        .limit(input.limit);

      return executions;
    }),

  closeTradeExecution: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        exitPrice: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const [execution] = await ctx.db
        .select()
        .from(tradeExecutions)
        .where(and(eq(tradeExecutions.id, input.id), eq(tradeExecutions.userId, ctx.user.id)))
        .limit(1);

      if (!execution) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Trade execution not found',
        });
      }

      if (execution.status !== 'open') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Trade execution is not open',
        });
      }

      const [wallet] = await ctx.db
        .select()
        .from(wallets)
        .where(eq(wallets.id, execution.walletId))
        .limit(1);

      if (!wallet) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Wallet not found',
        });
      }

      const entryPrice = parseFloat(execution.entryPrice);
      const qty = parseFloat(execution.quantity);
      let exitPrice = input.exitPrice ? parseFloat(input.exitPrice) : 0;
      let exitOrderId: number | null = null;

      const walletSupportsLive = !isPaperWallet(wallet);
      const shouldExecuteReal = walletSupportsLive && env.ENABLE_LIVE_TRADING;

      if (shouldExecuteReal) {
        try {
          const client = createBinanceClient(wallet);
          const orderSide = execution.side === 'LONG' ? 'SELL' : 'BUY';

          const order = await client.submitNewOrder({
            symbol: execution.symbol,
            side: orderSide,
            type: 'MARKET',
            quantity: qty,
          });

          exitOrderId = order.orderId;
          const filledPrice = 'price' in order ? parseFloat(order.price?.toString() || '0') : 0;
          if (filledPrice > 0) exitPrice = filledPrice;

          logger.info({
            executionId: execution.id,
            orderId: exitOrderId,
            symbol: execution.symbol,
            side: orderSide,
            quantity: qty,
            exitPrice,
          }, 'Manual close: Binance exit order executed');
        } catch (error) {
          logger.error({
            executionId: execution.id,
            error: error instanceof Error ? error.message : String(error),
          }, 'Failed to execute Binance exit order');

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
          executionId: execution.id,
          walletType: wallet.walletType,
          liveEnabled: env.ENABLE_LIVE_TRADING,
        }, 'Manual close: Paper/disabled mode - simulating exit');
      }

      const entryValue = entryPrice * qty;
      const exitValue = exitPrice * qty;
      const entryFee = entryValue * BINANCE_TAKER_FEE;
      const exitFee = exitValue * BINANCE_TAKER_FEE;
      const totalFees = entryFee + exitFee;

      let grossPnl = 0;
      if (execution.side === 'LONG') {
        grossPnl = (exitPrice - entryPrice) * qty;
      } else {
        grossPnl = (entryPrice - exitPrice) * qty;
      }

      const netPnl = grossPnl - totalFees;
      const pnlPercent = (netPnl / entryValue) * 100;

      const currentBalance = parseFloat(wallet.currentBalance || '0');
      const newBalance = currentBalance + netPnl;

      await ctx.db.transaction(async (tx) => {
        await tx
          .update(tradeExecutions)
          .set({
            status: 'closed',
            exitPrice: exitPrice.toString(),
            exitOrderId,
            pnl: netPnl.toString(),
            pnlPercent: pnlPercent.toString(),
            fees: totalFees.toString(),
            closedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(tradeExecutions.id, input.id));

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
      };
    }),

  cancelTradeExecution: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const [execution] = await ctx.db
        .select()
        .from(tradeExecutions)
        .where(and(eq(tradeExecutions.id, input.id), eq(tradeExecutions.userId, ctx.user.id)))
        .limit(1);

      if (!execution) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Trade execution not found',
        });
      }

      await ctx.db
        .update(tradeExecutions)
        .set({
          status: 'cancelled',
          updatedAt: new Date(),
        })
        .where(eq(tradeExecutions.id, input.id));

      return { success: true };
    }),

  getTickerPrices: protectedProcedure
    .input(
      z.object({
        symbols: z.array(z.string()),
      })
    )
    .query(async ({ input }) => {
      if (input.symbols.length === 0) return {};

      try {
        const client = new MainClient();
        const prices: Record<string, string> = {};

        const tickers = await client.getSymbolPriceTicker();
        const tickersArray = Array.isArray(tickers) ? tickers : [tickers];

        for (const symbol of input.symbols) {
          const ticker = tickersArray.find((t) => t.symbol === symbol);
          if (ticker?.price) prices[symbol] = ticker.price.toString();
        }

        return prices;
      } catch (error) {
        logger.error({ error, symbols: input.symbols }, 'Failed to fetch ticker prices');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch ticker prices',
          cause: error,
        });
      }
    }),
});
