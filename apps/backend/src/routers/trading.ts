import type { BinanceNewOrderResult, BinanceOrderQueryResult, MarketType } from '@marketmind/types';
import { calculateTotalFees } from '@marketmind/types';
import { TRPCError } from '@trpc/server';
import { MainClient, USDMClient } from 'binance';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { TRADING_CONFIG } from '../constants';
import { orders, positions, tradeExecutions, wallets } from '../db/schema';
import { env } from '../env';
import { autoTradingService } from '../services/auto-trading';
import { walletQueries } from '../services/database/walletQueries';
import { createBinanceClient, createBinanceFuturesClient, isPaperWallet } from '../services/binance-client';
import { logger } from '../services/logger';
import { protectedProcedure, router } from '../trpc';
import { generateEntityId } from '../utils/id';

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
          'STOP_MARKET',
          'TAKE_PROFIT_MARKET',
        ]),
        quantity: z.string(),
        price: z.string().optional(),
        stopPrice: z.string().optional(),
        setupId: z.string().optional(),
        setupType: z.string().optional(),
        marketType: z.enum(['SPOT', 'FUTURES']).default('SPOT'),
        reduceOnly: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const wallet = await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

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
            marketType: input.marketType,
            reduceOnly: input.reduceOnly,
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
            marketType: input.marketType,
          };
        }

        if (input.marketType === 'FUTURES') {
          const client = createBinanceFuturesClient(wallet);

          const binanceOrder = await client.submitNewOrder({
            symbol: input.symbol,
            side: input.side,
            type: input.type as 'LIMIT' | 'MARKET' | 'STOP_MARKET' | 'TAKE_PROFIT_MARKET',
            quantity: parseFloat(input.quantity),
            price: input.price ? parseFloat(input.price) : undefined,
            stopPrice: input.stopPrice ? parseFloat(input.stopPrice) : undefined,
            timeInForce: input.type.includes('LIMIT') ? 'GTC' : undefined,
            reduceOnly: input.reduceOnly ? 'true' : undefined,
          });

          await ctx.db.insert(orders).values({
            orderId: binanceOrder.orderId,
            userId: ctx.user.id,
            walletId: input.walletId,
            symbol: binanceOrder.symbol,
            side: binanceOrder.side,
            type: binanceOrder.type,
            price: binanceOrder.price?.toString(),
            origQty: binanceOrder.origQty?.toString(),
            executedQty: binanceOrder.executedQty?.toString(),
            status: binanceOrder.status,
            timeInForce: binanceOrder.timeInForce,
            time: binanceOrder.updateTime,
            updateTime: binanceOrder.updateTime,
            setupId: input.setupId,
            setupType: input.setupType,
            marketType: 'FUTURES',
            reduceOnly: input.reduceOnly,
          });

          return {
            orderId: binanceOrder.orderId,
            symbol: binanceOrder.symbol,
            side: binanceOrder.side,
            type: binanceOrder.type,
            status: binanceOrder.status,
            price: binanceOrder.price,
            quantity: binanceOrder.origQty,
            executedQty: binanceOrder.executedQty,
            marketType: 'FUTURES' as MarketType,
          };
        }

        const client = createBinanceClient(wallet);

        const binanceOrder = await client.submitNewOrder({
          symbol: input.symbol,
          side: input.side,
          type: input.type as 'LIMIT' | 'MARKET' | 'STOP_LOSS' | 'STOP_LOSS_LIMIT' | 'TAKE_PROFIT' | 'TAKE_PROFIT_LIMIT',
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
          marketType: 'SPOT',
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
          marketType: 'SPOT' as MarketType,
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
        marketType: z.enum(['SPOT', 'FUTURES']).default('SPOT'),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const wallet = await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

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

        if (input.marketType === 'FUTURES') {
          const client = createBinanceFuturesClient(wallet);

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
        marketType: z.enum(['SPOT', 'FUTURES']).default('SPOT'),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const wallet = await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

      try {
        if (isPaperWallet(wallet)) {
          return { synced: 0, message: 'Paper wallets do not sync with Binance' };
        }

        if (input.marketType === 'FUTURES') {
          const client = createBinanceFuturesClient(wallet);

          const binanceOrders = await client.getAllOrders({
            symbol: input.symbol,
            limit: 100,
          });

          for (const binanceOrder of binanceOrders) {
            const [existingOrder] = await ctx.db
              .select()
              .from(orders)
              .where(eq(orders.orderId, binanceOrder.orderId))
              .limit(1);

            if (existingOrder) {
              await ctx.db
                .update(orders)
                .set({
                  status: binanceOrder.status,
                  executedQty: binanceOrder.executedQty?.toString(),
                  updateTime: binanceOrder.updateTime,
                })
                .where(eq(orders.orderId, binanceOrder.orderId));
            } else {
              await ctx.db.insert(orders).values({
                orderId: binanceOrder.orderId,
                userId: ctx.user.id,
                walletId: input.walletId,
                symbol: binanceOrder.symbol,
                side: binanceOrder.side,
                type: binanceOrder.type,
                price: binanceOrder.price?.toString(),
                origQty: binanceOrder.origQty?.toString(),
                executedQty: binanceOrder.executedQty?.toString(),
                status: binanceOrder.status,
                timeInForce: binanceOrder.timeInForce,
                time: binanceOrder.time,
                updateTime: binanceOrder.updateTime,
                marketType: 'FUTURES',
                reduceOnly: binanceOrder.reduceOnly,
              });
            }
          }

          return { synced: binanceOrders.length };
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
              marketType: 'SPOT',
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
            const client = createBinanceFuturesClient(wallet);
            const order = await client.submitNewOrder({
              symbol: position.symbol,
              side: orderSide,
              type: 'MARKET',
              quantity: qty,
              reduceOnly: 'true',
            });

            exitOrderId = order.orderId;
            const filledPrice = parseFloat(order.avgPrice?.toString() || order.price?.toString() || '0');
            if (filledPrice > 0) exitPrice = filledPrice;
          } else {
            const client = createBinanceClient(wallet);
            const order = await client.submitNewOrder({
              symbol: position.symbol,
              side: orderSide,
              type: 'MARKET',
              quantity: qty,
            });

            exitOrderId = order.orderId;
            const filledPrice = 'price' in order ? parseFloat(order.price?.toString() || '0') : 0;
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
          marketType: position.marketType,
          leverage,
          message: 'Position closed manually by user (paper trading)',
        }, '👤 [MANUAL] Manual close position: Paper/disabled mode - simulating exit');
      }

      const entryValue = entryPrice * qty;
      const exitValue = exitPrice * qty;
      const marketType = isFutures ? 'FUTURES' : 'SPOT';
      const { totalFees } = calculateTotalFees(entryValue, exitValue, { marketType });

      let grossPnl = 0;
      if (position.side === 'LONG') {
        grossPnl = (exitPrice - entryPrice) * qty;
      } else {
        grossPnl = (entryPrice - exitPrice) * qty;
      }

      const netPnl = grossPnl - totalFees;
      const marginValue = entryValue / leverage;
      const pnlPercent = (netPnl / marginValue) * 100;

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

  getTradeExecutions: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        symbol: z.string().optional(),
        status: z.enum(['pending', 'open', 'closed', 'cancelled']).optional(),
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

      if (execution.status !== 'open' && execution.status !== 'pending') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Trade execution is not open or pending',
        });
      }

      const wallet = await walletQueries.getById(execution.walletId);

      const walletSupportsLive = !isPaperWallet(wallet);
      const shouldExecuteReal = walletSupportsLive && env.ENABLE_LIVE_TRADING;
      const isFutures = execution.marketType === 'FUTURES';
      const leverage = execution.leverage || 1;

      if (execution.status === 'pending') {
        logger.info({
          executionId: execution.id,
          symbol: execution.symbol,
          entryOrderId: execution.entryOrderId,
          stopLossOrderId: execution.stopLossOrderId,
          takeProfitOrderId: execution.takeProfitOrderId,
          marketType: execution.marketType,
        }, 'Cancelling pending execution and associated orders');

        if (shouldExecuteReal) {
          const orderIdsToCancel = [
            execution.entryOrderId,
            execution.stopLossOrderId,
            execution.takeProfitOrderId,
          ].filter((id): id is number => id !== null);

          if (isFutures) {
            const client = createBinanceFuturesClient(wallet);
            for (const orderId of orderIdsToCancel) {
              try {
                await client.cancelOrder({ symbol: execution.symbol, orderId });
                logger.info({ orderId, symbol: execution.symbol }, 'Cancelled Binance Futures order');
              } catch (error) {
                logger.warn({
                  orderId,
                  symbol: execution.symbol,
                  error: error instanceof Error ? error.message : String(error),
                }, 'Failed to cancel Binance Futures order (may already be filled/cancelled)');
              }
            }
          } else {
            const client = createBinanceClient(wallet);
            for (const orderId of orderIdsToCancel) {
              try {
                await client.cancelOrder({ symbol: execution.symbol, orderId });
                logger.info({ orderId, symbol: execution.symbol }, 'Cancelled Binance order');
              } catch (error) {
                logger.warn({
                  orderId,
                  symbol: execution.symbol,
                  error: error instanceof Error ? error.message : String(error),
                }, 'Failed to cancel Binance order (may already be filled/cancelled)');
              }
            }
          }
        }

        await ctx.db
          .update(tradeExecutions)
          .set({
            status: 'cancelled',
            closedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(tradeExecutions.id, input.id));

        return {
          pnl: '0',
          grossPnl: '0',
          fees: '0',
          pnlPercent: '0.00',
          exitOrderId: null,
          exitPrice: '0',
          cancelled: true,
        };
      }

      const entryPrice = parseFloat(execution.entryPrice);
      const qty = parseFloat(execution.quantity);
      let exitPrice = input.exitPrice ? parseFloat(input.exitPrice) : 0;
      let exitOrderId: number | null = null;

      if (shouldExecuteReal) {
        try {
          const orderSide = execution.side === 'LONG' ? 'SELL' : 'BUY';

          if (isFutures) {
            const client = createBinanceFuturesClient(wallet);

            if (execution.stopLossOrderId) {
              try {
                await client.cancelOrder({ symbol: execution.symbol, orderId: execution.stopLossOrderId });
                logger.info({ orderId: execution.stopLossOrderId }, 'Cancelled SL order');
              } catch (e) {
                logger.warn({ orderId: execution.stopLossOrderId, error: e }, 'Failed to cancel SL order');
              }
            }
            if (execution.takeProfitOrderId) {
              try {
                await client.cancelOrder({ symbol: execution.symbol, orderId: execution.takeProfitOrderId });
                logger.info({ orderId: execution.takeProfitOrderId }, 'Cancelled TP order');
              } catch (e) {
                logger.warn({ orderId: execution.takeProfitOrderId, error: e }, 'Failed to cancel TP order');
              }
            }

            const order = await client.submitNewOrder({
              symbol: execution.symbol,
              side: orderSide,
              type: 'MARKET',
              quantity: qty,
              reduceOnly: 'true',
            });

            exitOrderId = order.orderId;
            const filledPrice = parseFloat(order.avgPrice?.toString() || order.price?.toString() || '0');
            if (filledPrice > 0) exitPrice = filledPrice;
          } else {
            const client = createBinanceClient(wallet);

            if (execution.stopLossOrderId) {
              try {
                await client.cancelOrder({ symbol: execution.symbol, orderId: execution.stopLossOrderId });
                logger.info({ orderId: execution.stopLossOrderId }, 'Cancelled SL order');
              } catch (e) {
                logger.warn({ orderId: execution.stopLossOrderId, error: e }, 'Failed to cancel SL order');
              }
            }
            if (execution.takeProfitOrderId) {
              try {
                await client.cancelOrder({ symbol: execution.symbol, orderId: execution.takeProfitOrderId });
                logger.info({ orderId: execution.takeProfitOrderId }, 'Cancelled TP order');
              } catch (e) {
                logger.warn({ orderId: execution.takeProfitOrderId, error: e }, 'Failed to cancel TP order');
              }
            }

            const order = await client.submitNewOrder({
              symbol: execution.symbol,
              side: orderSide,
              type: 'MARKET',
              quantity: qty,
            });

            exitOrderId = order.orderId;
            const filledPrice = 'price' in order ? parseFloat(order.price?.toString() || '0') : 0;
            if (filledPrice > 0) exitPrice = filledPrice;
          }

          logger.info({
            executionId: execution.id,
            orderId: exitOrderId,
            symbol: execution.symbol,
            side: orderSide,
            quantity: qty,
            exitPrice,
            marketType: execution.marketType,
            leverage,
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
          marketType: execution.marketType,
          leverage,
        }, 'Manual close: Paper/disabled mode - simulating exit');
      }

      const entryValue = entryPrice * qty;
      const exitValue = exitPrice * qty;
      const marketType = isFutures ? 'FUTURES' : 'SPOT';
      const { totalFees } = calculateTotalFees(entryValue, exitValue, { marketType });

      let grossPnl = 0;
      if (execution.side === 'LONG') {
        grossPnl = (exitPrice - entryPrice) * qty;
      } else {
        grossPnl = (entryPrice - exitPrice) * qty;
      }

      const netPnl = grossPnl - totalFees;
      const marginValue = entryValue / leverage;
      const pnlPercent = (netPnl / marginValue) * 100;

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
        leverage: isFutures ? leverage : undefined,
        marketType: execution.marketType,
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

      const wallet = await walletQueries.findById(execution.walletId);

      if (wallet && !isPaperWallet(wallet) && env.ENABLE_LIVE_TRADING) {
        const isFutures = execution.marketType === 'FUTURES';
        const orderIdsToCancel = [
          execution.entryOrderId,
          execution.stopLossOrderId,
          execution.takeProfitOrderId,
        ].filter((id): id is number => id !== null);

        if (isFutures) {
          const client = createBinanceFuturesClient(wallet);

          for (const orderId of orderIdsToCancel) {
            try {
              await client.cancelOrder({ symbol: execution.symbol, orderId });
              logger.info({ orderId, symbol: execution.symbol }, 'Cancelled Binance Futures order during execution cancel');
            } catch (error) {
              logger.warn({
                orderId,
                symbol: execution.symbol,
                error: error instanceof Error ? error.message : String(error),
              }, 'Failed to cancel Binance Futures order (may already be filled/cancelled)');
            }
          }
        } else {
          const client = createBinanceClient(wallet);

          for (const orderId of orderIdsToCancel) {
            try {
              await client.cancelOrder({ symbol: execution.symbol, orderId });
              logger.info({ orderId, symbol: execution.symbol }, 'Cancelled Binance order during execution cancel');
            } catch (error) {
              logger.warn({
                orderId,
                symbol: execution.symbol,
                error: error instanceof Error ? error.message : String(error),
              }, 'Failed to cancel Binance order (may already be filled/cancelled)');
            }
          }

          if (execution.orderListId) {
            try {
              await client.cancelOCO({ symbol: execution.symbol, orderListId: execution.orderListId });
              logger.info({ orderListId: execution.orderListId, symbol: execution.symbol }, 'Cancelled OCO order list');
            } catch (error) {
              logger.warn({
                orderListId: execution.orderListId,
                symbol: execution.symbol,
                error: error instanceof Error ? error.message : String(error),
              }, 'Failed to cancel OCO order list (may already be executed)');
            }
          }
        }
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

  updateTradeExecutionSLTP: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        stopLoss: z.number().optional(),
        takeProfit: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (input.stopLoss === undefined && input.takeProfit === undefined) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'At least one of stopLoss or takeProfit must be provided',
        });
      }

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

      if (execution.status !== 'open' && execution.status !== 'pending') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Trade execution is not open or pending',
        });
      }

      const wallet = await walletQueries.getById(execution.walletId);

      const walletSupportsLive = !isPaperWallet(wallet);
      const shouldExecuteReal = walletSupportsLive && env.ENABLE_LIVE_TRADING;
      const isFutures = execution.marketType === 'FUTURES';
      const qty = parseFloat(execution.quantity);

      let newStopLossOrderId: number | null = execution.stopLossOrderId;
      let newTakeProfitOrderId: number | null = execution.takeProfitOrderId;

      if (shouldExecuteReal) {
        try {
          if (isFutures) {
            const client = createBinanceFuturesClient(wallet);

            if (input.stopLoss !== undefined) {
              if (execution.stopLossOrderId) {
                try {
                  await client.cancelOrder({ symbol: execution.symbol, orderId: execution.stopLossOrderId });
                  logger.info({ orderId: execution.stopLossOrderId }, 'Cancelled old SL order');
                } catch (e) {
                  logger.warn({ orderId: execution.stopLossOrderId, error: e }, 'Failed to cancel old SL order');
                }
              }

              const closeSide = execution.side === 'LONG' ? 'SELL' : 'BUY';
              const newSLOrder = await client.submitNewOrder({
                symbol: execution.symbol,
                side: closeSide,
                type: 'STOP_MARKET',
                stopPrice: input.stopLoss,
                closePosition: 'false',
                quantity: qty,
                reduceOnly: 'true',
                timeInForce: 'GTE_GTC',
                workingType: 'MARK_PRICE',
                priceProtect: 'TRUE',
              });
              newStopLossOrderId = newSLOrder.orderId;
              logger.info({ orderId: newStopLossOrderId, stopPrice: input.stopLoss }, 'Created new SL order');
            }

            if (input.takeProfit !== undefined) {
              if (execution.takeProfitOrderId) {
                try {
                  await client.cancelOrder({ symbol: execution.symbol, orderId: execution.takeProfitOrderId });
                  logger.info({ orderId: execution.takeProfitOrderId }, 'Cancelled old TP order');
                } catch (e) {
                  logger.warn({ orderId: execution.takeProfitOrderId, error: e }, 'Failed to cancel old TP order');
                }
              }

              const closeSide = execution.side === 'LONG' ? 'SELL' : 'BUY';
              const newTPOrder = await client.submitNewOrder({
                symbol: execution.symbol,
                side: closeSide,
                type: 'TAKE_PROFIT_MARKET',
                stopPrice: input.takeProfit,
                closePosition: 'false',
                quantity: qty,
                reduceOnly: 'true',
                timeInForce: 'GTE_GTC',
                workingType: 'MARK_PRICE',
                priceProtect: 'TRUE',
              });
              newTakeProfitOrderId = newTPOrder.orderId;
              logger.info({ orderId: newTakeProfitOrderId, stopPrice: input.takeProfit }, 'Created new TP order');
            }
          } else {
            const client = createBinanceClient(wallet);

            if (input.stopLoss !== undefined) {
              if (execution.stopLossOrderId) {
                try {
                  await client.cancelOrder({ symbol: execution.symbol, orderId: execution.stopLossOrderId });
                  logger.info({ orderId: execution.stopLossOrderId }, 'Cancelled old SL order');
                } catch (e) {
                  logger.warn({ orderId: execution.stopLossOrderId, error: e }, 'Failed to cancel old SL order');
                }
              }

              const closeSide = execution.side === 'LONG' ? 'SELL' : 'BUY';
              const newSLOrder = await client.submitNewOrder({
                symbol: execution.symbol,
                side: closeSide,
                type: 'STOP_LOSS_LIMIT',
                stopPrice: input.stopLoss,
                price: input.stopLoss,
                quantity: qty,
                timeInForce: 'GTC',
              });
              const slResult = newSLOrder as BinanceNewOrderResult;
              newStopLossOrderId = slResult.orderId;
              logger.info({ orderId: newStopLossOrderId, stopPrice: input.stopLoss }, 'Created new SL order');
            }

            if (input.takeProfit !== undefined) {
              if (execution.takeProfitOrderId) {
                try {
                  await client.cancelOrder({ symbol: execution.symbol, orderId: execution.takeProfitOrderId });
                  logger.info({ orderId: execution.takeProfitOrderId }, 'Cancelled old TP order');
                } catch (e) {
                  logger.warn({ orderId: execution.takeProfitOrderId, error: e }, 'Failed to cancel old TP order');
                }
              }

              const closeSide = execution.side === 'LONG' ? 'SELL' : 'BUY';
              const newTPOrder = await client.submitNewOrder({
                symbol: execution.symbol,
                side: closeSide,
                type: 'TAKE_PROFIT_LIMIT',
                stopPrice: input.takeProfit,
                price: input.takeProfit,
                quantity: qty,
                timeInForce: 'GTC',
              });
              const tpResult = newTPOrder as BinanceNewOrderResult;
              newTakeProfitOrderId = tpResult.orderId;
              logger.info({ orderId: newTakeProfitOrderId, stopPrice: input.takeProfit }, 'Created new TP order');
            }
          }
        } catch (error) {
          logger.error({
            executionId: execution.id,
            error: error instanceof Error ? error.message : String(error),
          }, 'Failed to update SL/TP orders on Binance');

          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error instanceof Error ? error.message : 'Failed to update orders on Binance',
          });
        }
      }

      const updateData: {
        updatedAt: Date;
        stopLoss?: string;
        stopLossOrderId?: number | null;
        takeProfit?: string;
        takeProfitOrderId?: number | null;
      } = {
        updatedAt: new Date(),
      };

      if (input.stopLoss !== undefined) {
        updateData.stopLoss = input.stopLoss.toString();
        updateData.stopLossOrderId = newStopLossOrderId;
      }

      if (input.takeProfit !== undefined) {
        updateData.takeProfit = input.takeProfit.toString();
        updateData.takeProfitOrderId = newTakeProfitOrderId;
      }

      await ctx.db
        .update(tradeExecutions)
        .set(updateData)
        .where(eq(tradeExecutions.id, input.id));

      logger.info({
        executionId: execution.id,
        symbol: execution.symbol,
        stopLoss: input.stopLoss,
        takeProfit: input.takeProfit,
        isLive: shouldExecuteReal,
        newStopLossOrderId,
        newTakeProfitOrderId,
      }, 'Updated trade execution SL/TP');

      return {
        success: true,
        stopLoss: input.stopLoss?.toString(),
        takeProfit: input.takeProfit?.toString(),
        stopLossOrderId: newStopLossOrderId,
        takeProfitOrderId: newTakeProfitOrderId,
      };
    }),

  getTickerPrices: protectedProcedure
    .input(
      z.object({
        symbols: z.array(z.string()),
        marketType: z.enum(['SPOT', 'FUTURES']).default('SPOT'),
      })
    )
    .query(async ({ input }) => {
      if (input.symbols.length === 0) return {};

      const MAX_RETRIES = 3;
      const RETRY_DELAY_MS = 1000;

      const fetchPrices = async (attempt: number): Promise<Record<string, string>> => {
        try {
          const prices: Record<string, string> = {};

          if (input.marketType === 'FUTURES') {
            const client = new USDMClient();
            const tickers = await client.getSymbolPriceTicker();
            const tickersArray = Array.isArray(tickers) ? tickers : [tickers];

            for (const symbol of input.symbols) {
              const ticker = tickersArray.find((t) => t.symbol === symbol);
              if (ticker?.price) prices[symbol] = ticker.price.toString();
            }

            return prices;
          }

          const client = new MainClient();
          const tickers = await client.getSymbolPriceTicker();
          const tickersArray = Array.isArray(tickers) ? tickers : [tickers];

          for (const symbol of input.symbols) {
            const ticker = tickersArray.find((t) => t.symbol === symbol);
            if (ticker?.price) prices[symbol] = ticker.price.toString();
          }

          return prices;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          const isRetryable = errorMessage.includes('ETIMEDOUT') ||
            errorMessage.includes('ECONNRESET') ||
            errorMessage.includes('ENOTFOUND') ||
            errorMessage.includes('socket hang up');

          if (isRetryable && attempt < MAX_RETRIES) {
            logger.warn({
              attempt,
              maxRetries: MAX_RETRIES,
              errorMessage,
              symbols: input.symbols,
            }, 'Retrying ticker price fetch after network error');
            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt));
            return fetchPrices(attempt + 1);
          }

          throw error;
        }
      };

      try {
        return await fetchPrices(1);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error({
          errorMessage,
          symbols: input.symbols,
          marketType: input.marketType,
        }, 'Failed to fetch ticker prices from Binance after retries');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to fetch ticker prices: ${errorMessage}`,
          cause: error,
        });
      }
    }),

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
        const client = createBinanceFuturesClient(wallet);
        const account = await client.getAccountInformation();

        return {
          totalWalletBalance: account.totalWalletBalance,
          availableBalance: account.availableBalance,
          positions: account.positions
            .filter((p) => parseFloat(String(p.positionAmt)) !== 0)
            .map((p) => ({
              symbol: p.symbol,
              positionAmt: String(p.positionAmt),
              entryPrice: String(p.entryPrice),
              unrealizedProfit: String(p.unrealizedProfit),
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
