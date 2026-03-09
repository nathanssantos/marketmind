import { calculatePnl } from '../utils/pnl-calculator';
import { TRPCError } from '@trpc/server';
import { MainClient, USDMClient } from 'binance';
import { and, count, desc, eq, ilike } from 'drizzle-orm';
import { z } from 'zod';
import { TRADING_CONFIG } from '../constants';
import { autoTradingConfig, orders, positions, symbolTrailingStopOverrides, tradeExecutions, wallets } from '../db/schema';
import { env } from '../env';
import { autoTradingService } from '../services/auto-trading';
import { isPaperWallet } from '../services/binance-client';
import { getFuturesClient, getSpotClient } from '../exchange';
import { createMarketClient } from '../services/market-client-factory';
import { walletQueries } from '../services/database/walletQueries';
import { logger } from '../services/logger';
import { getMinNotionalFilterService } from '../services/min-notional-filter';
import { formatPriceForBinance, formatQuantityForBinance } from '../utils/formatters';
import { clearProtectionOrderIds } from '../services/execution-manager';
import { cancelAllProtectionOrders, cancelProtectionOrder, updateStopLossOrder, updateTakeProfitOrder } from '../services/protection-orders';
import { protectedProcedure, router } from '../trpc';
import { serializeError } from '../utils/errors';
import { generateEntityId } from '../utils/id';
import { getWebSocketService } from '../services/websocket';

let paperOrderCounter = 0;
const generatePaperOrderId = (): number => {
  paperOrderCounter = (paperOrderCounter + 1) % 10000;
  return Date.now() * 10000 + paperOrderCounter;
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
          'STOP_MARKET',
          'TAKE_PROFIT_MARKET',
        ]),
        quantity: z.string(),
        price: z.string().optional(),
        stopPrice: z.string().optional(),
        setupId: z.string().optional(),
        setupType: z.string().optional(),
        marketType: z.enum(['SPOT', 'FUTURES']).default('FUTURES'),
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

      if (wallet.marketType && wallet.marketType !== input.marketType) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot create ${input.marketType} order on ${wallet.marketType} wallet`,
        });
      }

      try {
        if (isPaperWallet(wallet)) {
          const simulatedOrderId = generatePaperOrderId();
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

        const symbolFiltersMap = await getMinNotionalFilterService().getSymbolFilters(input.marketType);
        const filters = symbolFiltersMap.get(input.symbol);
        const tickSize = filters?.tickSize?.toString();
        const stepSize = filters?.stepSize?.toString();

        if (input.marketType === 'FUTURES') {
          const [config] = await ctx.db
            .select()
            .from(autoTradingConfig)
            .where(eq(autoTradingConfig.walletId, input.walletId))
            .limit(1);

          const { createBinanceFuturesClient, setLeverage, setMarginType, getPosition } = await import('../services/binance-futures-client');
          const futuresClient = createBinanceFuturesClient(wallet);
          const existingPosition = await getPosition(futuresClient, input.symbol);
          if (!existingPosition) {
            try {
              await setLeverage(futuresClient, input.symbol, config?.leverage ?? 1);
              await setMarginType(futuresClient, input.symbol, config?.marginType ?? 'CROSSED');
            } catch {
              logger.warn({ symbol: input.symbol }, 'Could not apply leverage/margin type — open orders exist, proceeding with current settings');
            }
          }
        }

        const isConditionalFuturesOrder =
          input.marketType === 'FUTURES' &&
          (input.type === 'STOP_MARKET' || input.type === 'TAKE_PROFIT_MARKET');

        if (isConditionalFuturesOrder) {
          const triggerPrice = input.stopPrice
            ? formatPriceForBinance(parseFloat(input.stopPrice), tickSize)
            : input.price
              ? formatPriceForBinance(parseFloat(input.price), tickSize)
              : undefined;

          if (!triggerPrice) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'stopPrice is required for STOP_MARKET / TAKE_PROFIT_MARKET orders',
            });
          }

          const triggerPriceNum = parseFloat(triggerPrice);
          const requestedQty = parseFloat(input.quantity);
          const notional = requestedQty * triggerPriceNum;
          const minNotional = filters?.minNotional ?? 5;
          if (notional < minNotional) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Order notional ($${notional.toFixed(2)}) is below the minimum of $${minNotional} for ${input.symbol}. Increase your position size % or deposit more funds.`,
            });
          }

          const futuresClient = getFuturesClient(wallet);
          const algoOrder = await futuresClient.submitAlgoOrder({
            symbol: input.symbol,
            side: input.side,
            type: input.type as 'STOP_MARKET' | 'TAKE_PROFIT_MARKET',
            triggerPrice,
            quantity: formatQuantityForBinance(requestedQty, stepSize),
            workingType: 'CONTRACT_PRICE',
            ...(input.reduceOnly && { reduceOnly: true }),
          });

          await ctx.db.insert(orders).values({
            orderId: algoOrder.algoId,
            userId: ctx.user.id,
            walletId: input.walletId,
            symbol: algoOrder.symbol,
            side: algoOrder.side,
            type: algoOrder.type,
            price: algoOrder.triggerPrice ?? triggerPrice,
            origQty: algoOrder.quantity,
            executedQty: '0',
            status: 'NEW',
            time: algoOrder.createTime,
            updateTime: algoOrder.updateTime,
            setupId: input.setupId,
            setupType: input.setupType,
            marketType: input.marketType,
            reduceOnly: input.reduceOnly,
          });

          if (!input.reduceOnly) {
            await ctx.db.insert(tradeExecutions).values({
              id: generateEntityId(),
              userId: ctx.user.id,
              walletId: input.walletId,
              symbol: input.symbol,
              side: input.side === 'BUY' ? 'LONG' : 'SHORT',
              entryPrice: algoOrder.triggerPrice ?? triggerPrice,
              limitEntryPrice: algoOrder.triggerPrice ?? triggerPrice,
              quantity: String(algoOrder.quantity || input.quantity),
              entryOrderId: algoOrder.algoId,
              entryOrderType: input.type as 'STOP_MARKET' | 'TAKE_PROFIT_MARKET',
              status: 'pending',
              marketType: input.marketType,
              openedAt: new Date(),
            });
          }

          return {
            orderId: algoOrder.algoId,
            symbol: algoOrder.symbol,
            side: algoOrder.side,
            type: algoOrder.type,
            status: 'NEW',
            price: algoOrder.triggerPrice ?? triggerPrice,
            quantity: algoOrder.quantity,
            executedQty: '0',
            marketType: input.marketType,
          };
        }

        const orderQty = parseFloat(input.quantity);
        const orderPrice = parseFloat(input.price ?? input.stopPrice ?? '0');
        if (orderPrice > 0) {
          const notional = orderQty * orderPrice;
          const minNotional = filters?.minNotional ?? 5;
          if (notional < minNotional) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Order notional ($${notional.toFixed(2)}) is below the minimum of $${minNotional} for ${input.symbol}. Increase your position size % or deposit more funds.`,
            });
          }
        }

        const marketClient = createMarketClient(wallet, input.marketType);

        const binanceOrder = await marketClient.createOrder({
          symbol: input.symbol,
          side: input.side,
          type: input.type,
          quantity: parseFloat(formatQuantityForBinance(orderQty, stepSize)),
          price: input.price ? parseFloat(formatPriceForBinance(parseFloat(input.price), tickSize)) : undefined,
          stopPrice: input.stopPrice ? parseFloat(formatPriceForBinance(parseFloat(input.stopPrice), tickSize)) : undefined,
          timeInForce: input.type.includes('LIMIT') ? 'GTC' : undefined,
          reduceOnly: input.reduceOnly,
        });

        await ctx.db.insert(orders).values({
          orderId: binanceOrder.orderId,
          userId: ctx.user.id,
          walletId: input.walletId,
          symbol: binanceOrder.symbol,
          side: binanceOrder.side,
          type: binanceOrder.type,
          price: binanceOrder.price,
          origQty: binanceOrder.origQty,
          executedQty: binanceOrder.executedQty,
          status: binanceOrder.status,
          timeInForce: binanceOrder.timeInForce,
          time: binanceOrder.time,
          updateTime: binanceOrder.updateTime,
          setupId: input.setupId,
          setupType: input.setupType,
          marketType: input.marketType,
          reduceOnly: input.reduceOnly,
        });

        if (binanceOrder.status === 'NEW' && !input.reduceOnly) {
          const rawTargetPrice = input.stopPrice ?? input.price ?? binanceOrder.price;
          const targetPrice = rawTargetPrice && rawTargetPrice !== '0' ? rawTargetPrice : null;
          if (targetPrice) {
            await ctx.db.insert(tradeExecutions).values({
              id: generateEntityId(),
              userId: ctx.user.id,
              walletId: input.walletId,
              symbol: input.symbol,
              side: input.side === 'BUY' ? 'LONG' : 'SHORT',
              entryPrice: String(targetPrice),
              limitEntryPrice: String(targetPrice),
              quantity: String(binanceOrder.origQty || input.quantity),
              entryOrderId: binanceOrder.orderId,
              entryOrderType: 'LIMIT',
              status: 'pending',
              marketType: input.marketType,
              openedAt: new Date(),
            });
          }
        }

        return {
          orderId: binanceOrder.orderId,
          symbol: binanceOrder.symbol,
          side: binanceOrder.side,
          type: binanceOrder.type,
          status: binanceOrder.status,
          price: binanceOrder.price,
          quantity: binanceOrder.origQty,
          executedQty: binanceOrder.executedQty,
          marketType: input.marketType,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        const binanceCode = (error as { code?: number })?.code;
        const binanceMessage = (error as { message?: string })?.message;
        throw new TRPCError({
          code: typeof binanceCode === 'number' && binanceCode < 0 ? 'BAD_REQUEST' : 'INTERNAL_SERVER_ERROR',
          message: binanceMessage ?? 'Failed to create order',
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
        marketType: z.enum(['SPOT', 'FUTURES']).default('FUTURES'),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const wallet = await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

      if (wallet.marketType && wallet.marketType !== input.marketType) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot cancel ${input.marketType} order on ${wallet.marketType} wallet`,
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

        const [dbOrder] = await ctx.db.select().from(orders).where(eq(orders.orderId, input.orderId)).limit(1);
        const isAlgoFuturesOrder = input.marketType === 'FUTURES' && dbOrder && (dbOrder.type === 'STOP_MARKET' || dbOrder.type === 'TAKE_PROFIT_MARKET');

        let cancelSucceeded = false;
        if (isAlgoFuturesOrder) {
          const { createBinanceFuturesClient, cancelFuturesAlgoOrder } = await import('../services/binance-futures-client');
          const apiClient = createBinanceFuturesClient(wallet);
          try {
            await cancelFuturesAlgoOrder(apiClient, input.orderId);
            cancelSucceeded = true;
          } catch (cancelError) {
            const msg = (cancelError as Error)?.message ?? '';
            if (!msg.includes('Unknown order') && !msg.includes('Order does not exist') && !msg.includes('not found')) throw cancelError;
          }
        } else {
          const marketClient = createMarketClient(wallet, input.marketType);
          try {
            await marketClient.cancelOrder(input.symbol, input.orderId);
            cancelSucceeded = true;
          } catch (cancelError) {
            const binanceCode = (cancelError as { cause?: { code?: number } })?.cause?.code;
            if (binanceCode !== -2011) throw cancelError;
          }
        }

        await ctx.db
          .update(orders)
          .set({ status: 'CANCELED', updateTime: Date.now() })
          .where(eq(orders.orderId, input.orderId));

        await ctx.db
          .update(tradeExecutions)
          .set({ status: 'cancelled', updatedAt: new Date() })
          .where(
            and(
              eq(tradeExecutions.walletId, input.walletId),
              eq(tradeExecutions.entryOrderId, input.orderId),
              eq(tradeExecutions.status, 'pending')
            )
          );

        return {
          orderId: input.orderId,
          symbol: input.symbol,
          status: cancelSucceeded ? 'CANCELED' : 'ALREADY_FILLED',
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
        search: z.string().optional(),
        limit: z.number().min(1).max(500).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input, ctx }) => {
      const whereConditions = [
        eq(orders.userId, ctx.user.id),
        eq(orders.walletId, input.walletId),
      ];

      if (input.symbol) whereConditions.push(eq(orders.symbol, input.symbol));
      if (input.search) whereConditions.push(ilike(orders.symbol, `%${input.search}%`));

      const userOrders = await ctx.db
        .select()
        .from(orders)
        .where(and(...whereConditions))
        .orderBy(desc(orders.time))
        .limit(input.limit)
        .offset(input.offset);

      return userOrders;
    }),

  getOrdersStats: protectedProcedure
    .input(z.object({ walletId: z.string() }))
    .query(async ({ input, ctx }) => {
      const [ordersCount] = await ctx.db
        .select({ count: count() })
        .from(orders)
        .where(and(eq(orders.userId, ctx.user.id), eq(orders.walletId, input.walletId)));
      const [executionsCount] = await ctx.db
        .select({ count: count() })
        .from(tradeExecutions)
        .where(and(eq(tradeExecutions.userId, ctx.user.id), eq(tradeExecutions.walletId, input.walletId)));
      return {
        ordersCount: ordersCount?.count ?? 0,
        executionsCount: executionsCount?.count ?? 0,
      };
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
        marketType: z.enum(['SPOT', 'FUTURES']).default('FUTURES'),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const wallet = await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

      if (wallet.marketType && wallet.marketType !== input.marketType) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot sync ${input.marketType} orders on ${wallet.marketType} wallet`,
        });
      }

      try {
        if (isPaperWallet(wallet)) {
          return { synced: 0, message: 'Paper wallets do not sync with Binance' };
        }

        const marketClient = createMarketClient(wallet, input.marketType);
        const binanceOrders = await marketClient.getAllOrders(input.symbol, 100);

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
                executedQty: binanceOrder.executedQty,
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
              price: binanceOrder.price,
              origQty: binanceOrder.origQty,
              executedQty: binanceOrder.executedQty,
              status: binanceOrder.status,
              timeInForce: binanceOrder.timeInForce,
              time: binanceOrder.time,
              updateTime: binanceOrder.updateTime,
              marketType: input.marketType,
              reduceOnly: binanceOrder.reduceOnly,
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
        }, '✓ Risk/Reward ratio validated for manual position');
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
          }, '> [MANUAL] Manual close position: Binance exit order executed');
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
        }, '> [MANUAL] Manual close position: Paper/disabled mode - simulating exit');
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

  getTradeExecutions: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        symbol: z.string().optional(),
        search: z.string().optional(),
        status: z.enum(['pending', 'open', 'closed', 'cancelled']).optional(),
        limit: z.number().min(1).max(500).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input, ctx }) => {
      const whereConditions = [
        eq(tradeExecutions.userId, ctx.user.id),
        eq(tradeExecutions.walletId, input.walletId),
      ];

      if (input.symbol) whereConditions.push(eq(tradeExecutions.symbol, input.symbol));
      if (input.search) whereConditions.push(ilike(tradeExecutions.symbol, `%${input.search}%`));
      if (input.status) whereConditions.push(eq(tradeExecutions.status, input.status));

      const executions = await ctx.db
        .select()
        .from(tradeExecutions)
        .where(and(...whereConditions))
        .orderBy(desc(tradeExecutions.openedAt))
        .limit(input.limit)
        .offset(input.offset);

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
            const { createBinanceFuturesClient, cancelFuturesAlgoOrder } = await import('../services/binance-futures-client');
            const apiClient = createBinanceFuturesClient(wallet);
            const client = getFuturesClient(wallet);

            await cancelAllProtectionOrders({
              wallet,
              symbol: execution.symbol,
              marketType: 'FUTURES',
              stopLossAlgoId: execution.stopLossAlgoId,
              stopLossOrderId: execution.stopLossOrderId,
              takeProfitAlgoId: execution.takeProfitAlgoId,
              takeProfitOrderId: execution.takeProfitOrderId,
            });

            if (execution.entryOrderId) {
              const isAlgoEntry = execution.entryOrderType === 'STOP_MARKET' || execution.entryOrderType === 'TAKE_PROFIT_MARKET';
              try {
                if (isAlgoEntry) {
                  await cancelFuturesAlgoOrder(apiClient, execution.entryOrderId);
                } else {
                  await client.cancelOrder(execution.symbol, execution.entryOrderId);
                }
                logger.info({ orderId: execution.entryOrderId, symbol: execution.symbol }, 'Cancelled entry order during execution close');
              } catch (error) {
                logger.warn({
                  orderId: execution.entryOrderId,
                  symbol: execution.symbol,
                  error: serializeError(error),
                }, 'Failed to cancel entry order (may already be filled/cancelled)');
              }
            }

          } else {
            const client = getSpotClient(wallet);
            for (const orderId of orderIdsToCancel) {
              try {
                await client.cancelOrder(execution.symbol, orderId);
                logger.info({ orderId, symbol: execution.symbol }, 'Cancelled Binance order');
              } catch (error) {
                logger.warn({
                  orderId,
                  symbol: execution.symbol,
                  error: serializeError(error),
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
            stopLossAlgoId: null,
            stopLossOrderId: null,
            takeProfitAlgoId: null,
            takeProfitOrderId: null,
            entryOrderId: null,
          })
          .where(eq(tradeExecutions.id, input.id));

        const wsService = getWebSocketService();
        wsService?.emitPositionClosed(execution.walletId, {
          positionId: execution.id,
          symbol: execution.symbol,
          side: execution.side,
          exitReason: 'MANUAL_CANCEL',
          pnl: 0,
          pnlPercent: 0,
        });

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
          const marketType = execution.marketType as 'SPOT' | 'FUTURES';

          await cancelAllProtectionOrders({
            wallet,
            symbol: execution.symbol,
            marketType,
            stopLossAlgoId: execution.stopLossAlgoId,
            stopLossOrderId: execution.stopLossOrderId,
            takeProfitAlgoId: execution.takeProfitAlgoId,
            takeProfitOrderId: execution.takeProfitOrderId,
          });

          if (isFutures) {
            const client = getFuturesClient(wallet);

            const order = await client.submitOrder({
              symbol: execution.symbol,
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
              symbol: execution.symbol,
              side: orderSide,
              type: 'MARKET',
              quantity: qty,
            });

            exitOrderId = order.orderId;
            const filledPrice = order.price ? parseFloat(order.price) : 0;
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
            error: serializeError(error),
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

      const marketType = isFutures ? 'FUTURES' : 'SPOT';
      const { grossPnl, totalFees, netPnl, pnlPercent } = calculatePnl({
        entryPrice,
        exitPrice,
        quantity: qty,
        side: execution.side as 'LONG' | 'SHORT',
        marketType,
        leverage,
      });

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
            stopLossAlgoId: null,
            stopLossOrderId: null,
            takeProfitAlgoId: null,
            takeProfitOrderId: null,
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

      const wsService = getWebSocketService();
      wsService?.emitPositionClosed(execution.walletId, {
        positionId: execution.id,
        symbol: execution.symbol,
        side: execution.side,
        exitReason: 'MANUAL_CLOSE',
        pnl: netPnl,
        pnlPercent,
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
          const { createBinanceFuturesClient, cancelFuturesAlgoOrder } = await import('../services/binance-futures-client');
          const apiClient = createBinanceFuturesClient(wallet);
          const client = getFuturesClient(wallet);

          await cancelAllProtectionOrders({
            wallet,
            symbol: execution.symbol,
            marketType: 'FUTURES',
            stopLossAlgoId: execution.stopLossAlgoId,
            stopLossOrderId: execution.stopLossOrderId,
            takeProfitAlgoId: execution.takeProfitAlgoId,
            takeProfitOrderId: execution.takeProfitOrderId,
          });

          if (execution.entryOrderId) {
            const isAlgoEntry = execution.entryOrderType === 'STOP_MARKET' || execution.entryOrderType === 'TAKE_PROFIT_MARKET';
            try {
              if (isAlgoEntry) {
                await cancelFuturesAlgoOrder(apiClient, execution.entryOrderId);
              } else {
                await client.cancelOrder(execution.symbol, execution.entryOrderId);
              }
              logger.info({ orderId: execution.entryOrderId, symbol: execution.symbol }, 'Cancelled entry order during execution cancel');
            } catch (error) {
              logger.warn({
                orderId: execution.entryOrderId,
                symbol: execution.symbol,
                error: serializeError(error),
              }, 'Failed to cancel entry order (may already be filled/cancelled)');
            }
          }

        } else {
          const client = getSpotClient(wallet);

          for (const orderId of orderIdsToCancel) {
            try {
              await client.cancelOrder(execution.symbol, orderId);
              logger.info({ orderId, symbol: execution.symbol }, 'Cancelled Binance order during execution cancel');
            } catch (error) {
              logger.warn({
                orderId,
                symbol: execution.symbol,
                error: serializeError(error),
              }, 'Failed to cancel Binance order (may already be filled/cancelled)');
            }
          }

          if (execution.orderListId) {
            try {
              const { createBinanceClient } = await import('../services/binance-client');
              const binanceClient = createBinanceClient(wallet);
              await binanceClient.cancelOCO({ symbol: execution.symbol, orderListId: execution.orderListId });
              logger.info({ orderListId: execution.orderListId, symbol: execution.symbol }, 'Cancelled OCO order list');
            } catch (error) {
              logger.warn({
                orderListId: execution.orderListId,
                symbol: execution.symbol,
                error: serializeError(error),
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
          stopLossAlgoId: null,
          stopLossOrderId: null,
          takeProfitAlgoId: null,
          takeProfitOrderId: null,
          entryOrderId: null,
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
      const marketType = execution.marketType as 'SPOT' | 'FUTURES';
      const qty = parseFloat(execution.quantity);
      const side = execution.side as 'LONG' | 'SHORT';

      let newStopLossOrderId: number | null = execution.stopLossOrderId;
      let newStopLossAlgoId: number | null = execution.stopLossAlgoId;
      let newTakeProfitOrderId: number | null = execution.takeProfitOrderId;
      let newTakeProfitAlgoId: number | null = execution.takeProfitAlgoId;

      if (shouldExecuteReal) {
        try {
          if (input.stopLoss !== undefined) {
            const result = await updateStopLossOrder({
              wallet,
              symbol: execution.symbol,
              side,
              quantity: qty,
              triggerPrice: input.stopLoss,
              marketType,
              currentAlgoId: execution.stopLossAlgoId,
              currentOrderId: execution.stopLossOrderId,
            });

            if (isFutures) {
              newStopLossAlgoId = result.algoId ?? null;
            } else {
              newStopLossOrderId = result.orderId ?? null;
            }
          }

          if (input.takeProfit !== undefined) {
            const result = await updateTakeProfitOrder({
              wallet,
              symbol: execution.symbol,
              side,
              quantity: qty,
              triggerPrice: input.takeProfit,
              marketType,
              currentAlgoId: execution.takeProfitAlgoId,
              currentOrderId: execution.takeProfitOrderId,
            });

            if (isFutures) {
              newTakeProfitAlgoId = result.algoId ?? null;
            } else {
              newTakeProfitOrderId = result.orderId ?? null;
            }
          }
        } catch (error) {
          logger.error({
            executionId: execution.id,
            error: serializeError(error),
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
        stopLossAlgoId?: number | null;
        takeProfit?: string;
        takeProfitOrderId?: number | null;
        takeProfitAlgoId?: number | null;
      } = {
        updatedAt: new Date(),
      };

      if (input.stopLoss !== undefined) {
        updateData.stopLoss = input.stopLoss.toString();
        if (isFutures) {
          updateData.stopLossAlgoId = newStopLossAlgoId;
        } else {
          updateData.stopLossOrderId = newStopLossOrderId;
        }
      }

      if (input.takeProfit !== undefined) {
        updateData.takeProfit = input.takeProfit.toString();
        if (isFutures) {
          updateData.takeProfitAlgoId = newTakeProfitAlgoId;
        } else {
          updateData.takeProfitOrderId = newTakeProfitOrderId;
        }
      }

      await ctx.db
        .update(tradeExecutions)
        .set(updateData)
        .where(eq(tradeExecutions.id, input.id));

      logger.trace({
        executionId: execution.id,
        symbol: execution.symbol,
        stopLoss: input.stopLoss,
        takeProfit: input.takeProfit,
        isLive: shouldExecuteReal,
        isFutures,
        newStopLossOrderId: isFutures ? newStopLossAlgoId : newStopLossOrderId,
        newTakeProfitOrderId: isFutures ? newTakeProfitAlgoId : newTakeProfitOrderId,
      }, 'Updated trade execution SL/TP');

      return {
        success: true,
        stopLoss: input.stopLoss?.toString(),
        takeProfit: input.takeProfit?.toString(),
        stopLossOrderId: isFutures ? newStopLossAlgoId : newStopLossOrderId,
        takeProfitOrderId: isFutures ? newTakeProfitAlgoId : newTakeProfitOrderId,
      };
    }),

  updatePendingEntry: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        newPrice: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const [execution] = await ctx.db
        .select()
        .from(tradeExecutions)
        .where(
          and(
            eq(tradeExecutions.id, input.id),
            eq(tradeExecutions.userId, ctx.user.id),
            eq(tradeExecutions.status, 'pending')
          )
        )
        .limit(1);

      if (!execution) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Pending trade execution not found',
        });
      }

      if (execution.marketType !== 'FUTURES') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Only FUTURES pending orders can be moved',
        });
      }

      const wallet = await walletQueries.getById(execution.walletId);
      const isAlgoEntry = execution.entryOrderType === 'STOP_MARKET' || execution.entryOrderType === 'TAKE_PROFIT_MARKET';
      const symbolFiltersMap = await getMinNotionalFilterService().getSymbolFilters('FUTURES');
      const filters = symbolFiltersMap.get(execution.symbol);
      const tickSize = filters?.tickSize?.toString();
      const formattedPrice = formatPriceForBinance(input.newPrice, tickSize);

      const formattedQty = execution.quantity;

      if (isPaperWallet(wallet) || !env.ENABLE_LIVE_TRADING) {
        await ctx.db
          .update(tradeExecutions)
          .set({ entryPrice: formattedPrice, limitEntryPrice: formattedPrice, updatedAt: new Date() })
          .where(eq(tradeExecutions.id, input.id));
        return { success: true };
      }

      const { createBinanceFuturesClient, cancelFuturesAlgoOrder, cancelFuturesOrder, submitFuturesAlgoOrder, submitFuturesOrder } = await import('../services/binance-futures-client');
      const apiClient = createBinanceFuturesClient(wallet);

      const binarySide = execution.side === 'LONG' ? 'BUY' : 'SELL';
      let newOrderId: number;

      try {
        if (isAlgoEntry) {
          const algoOrder = await submitFuturesAlgoOrder(apiClient, {
            symbol: execution.symbol,
            side: binarySide,
            type: execution.entryOrderType as 'STOP_MARKET' | 'TAKE_PROFIT_MARKET',
            triggerPrice: formattedPrice,
            quantity: formattedQty,
            workingType: 'CONTRACT_PRICE',
          });
          newOrderId = algoOrder.algoId;
          await ctx.db.insert(orders).values({
            orderId: algoOrder.algoId,
            userId: ctx.user.id,
            walletId: execution.walletId,
            symbol: algoOrder.symbol,
            side: algoOrder.side,
            type: algoOrder.type,
            price: algoOrder.triggerPrice ?? formattedPrice,
            origQty: algoOrder.quantity,
            executedQty: '0',
            status: 'NEW',
            time: algoOrder.createTime,
            updateTime: algoOrder.updateTime,
            marketType: 'FUTURES',
            stopLossIntent: execution.stopLoss ?? null,
            takeProfitIntent: execution.takeProfit ?? null,
          });
        } else {
          const futuresOrder = await submitFuturesOrder(apiClient, {
            symbol: execution.symbol,
            side: binarySide,
            type: 'LIMIT',
            quantity: formattedQty,
            price: formattedPrice,
            timeInForce: 'GTC',
          });
          newOrderId = futuresOrder.orderId;
          await ctx.db.insert(orders).values({
            orderId: futuresOrder.orderId,
            userId: ctx.user.id,
            walletId: execution.walletId,
            symbol: futuresOrder.symbol,
            side: futuresOrder.side,
            type: futuresOrder.type,
            price: futuresOrder.price,
            origQty: futuresOrder.origQty,
            executedQty: '0',
            status: 'NEW',
            timeInForce: futuresOrder.timeInForce,
            time: futuresOrder.time,
            updateTime: futuresOrder.updateTime,
            marketType: 'FUTURES',
            stopLossIntent: execution.stopLoss ?? null,
            takeProfitIntent: execution.takeProfit ?? null,
          });
        }
      } catch (error) {
        logger.error({
          executionId: execution.id,
          symbol: execution.symbol,
          error: serializeError(error),
        }, 'Failed to create new entry order for pending entry move');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to create new entry order',
        });
      }

      if (execution.entryOrderId) {
        try {
          if (isAlgoEntry) {
            await cancelFuturesAlgoOrder(apiClient, execution.entryOrderId);
          } else {
            await cancelFuturesOrder(apiClient, execution.symbol, execution.entryOrderId);
          }
          logger.info({ orderId: execution.entryOrderId, symbol: execution.symbol }, 'Cancelled old entry order for pending entry move');
        } catch (error) {
          logger.warn({
            orderId: execution.entryOrderId,
            symbol: execution.symbol,
            error: serializeError(error),
          }, 'Failed to cancel old entry order (may already be filled/cancelled)');
        }
      }

      await ctx.db
        .update(tradeExecutions)
        .set({
          entryOrderId: newOrderId,
          entryPrice: formattedPrice,
          limitEntryPrice: formattedPrice,
          quantity: formattedQty,
          updatedAt: new Date(),
        })
        .where(eq(tradeExecutions.id, input.id));

      logger.info({
        executionId: execution.id,
        symbol: execution.symbol,
        newOrderId,
        newPrice: formattedPrice,
        newQty: formattedQty,
      }, 'Updated pending entry order price and quantity');

      return { success: true };
    }),

  getTickerPrices: protectedProcedure
    .input(
      z.object({
        symbols: z.array(z.string()),
        marketType: z.enum(['SPOT', 'FUTURES']).default('FUTURES'),
        exchange: z.enum(['BINANCE', 'INTERACTIVE_BROKERS']).default('BINANCE'),
      })
    )
    .query(async ({ input }) => {
      if (input.symbols.length === 0) return {};

      if (input.exchange === 'INTERACTIVE_BROKERS') return {};

      const MAX_RETRIES = 3;
      const RETRY_DELAY_MS = 1000;

      const fetchPrices = async (attempt: number): Promise<Record<string, string>> => {
        try {
          const prices: Record<string, string> = {};

          if (input.marketType === 'FUTURES') {
            const client = new USDMClient({ disableTimeSync: true });
            const tickers = await client.getSymbolPriceTicker();
            const tickersArray = Array.isArray(tickers) ? tickers : [tickers];

            for (const symbol of input.symbols) {
              const ticker = tickersArray.find((t) => t.symbol === symbol);
              if (ticker?.price) prices[symbol] = ticker.price.toString();
            }

            return prices;
          }

          const client = new MainClient({ disableTimeSync: true });
          const tickers = await client.getSymbolPriceTicker();
          const tickersArray = Array.isArray(tickers) ? tickers : [tickers];

          for (const symbol of input.symbols) {
            const ticker = tickersArray.find((t) => t.symbol === symbol);
            if (ticker?.price) prices[symbol] = ticker.price.toString();
          }

          return prices;
        } catch (error) {
          const errorMessage = serializeError(error);
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
        const errorMessage = serializeError(error);
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

  cancelIndividualProtectionOrder: protectedProcedure
    .input(
      z.object({
        executionIds: z.array(z.string()),
        type: z.enum(['stopLoss', 'takeProfit']),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const results: { executionId: string; success: boolean; error?: string }[] = [];

      for (const executionId of input.executionIds) {
        try {
          const [execution] = await ctx.db
            .select()
            .from(tradeExecutions)
            .where(and(eq(tradeExecutions.id, executionId), eq(tradeExecutions.userId, ctx.user.id)))
            .limit(1);

          if (!execution) {
            results.push({ executionId, success: false, error: 'Execution not found' });
            continue;
          }

          if (execution.status !== 'open' && execution.status !== 'pending') {
            results.push({ executionId, success: false, error: 'Execution is not open or pending' });
            continue;
          }

          const wallet = await walletQueries.getById(execution.walletId);
          const walletSupportsLive = !isPaperWallet(wallet);
          const shouldExecuteReal = walletSupportsLive && env.ENABLE_LIVE_TRADING;
          const marketType = execution.marketType as 'SPOT' | 'FUTURES';

          const algoId = input.type === 'stopLoss' ? execution.stopLossAlgoId : execution.takeProfitAlgoId;
          const orderId = input.type === 'stopLoss' ? execution.stopLossOrderId : execution.takeProfitOrderId;

          if (!algoId && !orderId) {
            results.push({ executionId, success: true });
            continue;
          }

          if (shouldExecuteReal) {
            const cancelled = await cancelProtectionOrder({
              wallet,
              symbol: execution.symbol,
              marketType,
              algoId,
              orderId,
            });

            if (!cancelled) {
              logger.warn({ executionId, type: input.type, algoId, orderId }, 'Failed to cancel protection order on exchange - may already be filled');
            }
          }

          await clearProtectionOrderIds(executionId, input.type);

          logger.info({
            executionId,
            type: input.type,
            algoId,
            orderId,
            isLive: shouldExecuteReal,
          }, 'Cancelled individual protection order');

          results.push({ executionId, success: true });
        } catch (error) {
          logger.error({ executionId, type: input.type, error: serializeError(error) }, 'Error cancelling protection order');
          results.push({ executionId, success: false, error: serializeError(error) });
        }
      }

      return { results };
    }),

  getSymbolTrailingConfig: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        symbol: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

      const override = await ctx.db.query.symbolTrailingStopOverrides.findFirst({
        where: and(
          eq(symbolTrailingStopOverrides.walletId, input.walletId),
          eq(symbolTrailingStopOverrides.symbol, input.symbol)
        ),
      });

      return override ?? null;
    }),

  updateSymbolTrailingConfig: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        symbol: z.string(),
        useIndividualConfig: z.boolean().optional(),
        trailingStopEnabled: z.boolean().nullable().optional(),
        trailingActivationPercentLong: z.string().nullable().optional(),
        trailingActivationPercentShort: z.string().nullable().optional(),
        trailingDistancePercentLong: z.string().nullable().optional(),
        trailingDistancePercentShort: z.string().nullable().optional(),
        useAdaptiveTrailing: z.boolean().nullable().optional(),
        useProfitLockDistance: z.boolean().nullable().optional(),
        trailingDistanceMode: z.enum(['auto', 'fixed']).nullable().optional(),
        trailingStopOffsetPercent: z.string().nullable().optional(),
        trailingActivationModeLong: z.enum(['auto', 'manual']).nullable().optional(),
        trailingActivationModeShort: z.enum(['auto', 'manual']).nullable().optional(),
        manualTrailingActivatedLong: z.boolean().nullable().optional(),
        manualTrailingActivatedShort: z.boolean().nullable().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

      const { walletId, symbol, ...fields } = input;

      const existing = await ctx.db.query.symbolTrailingStopOverrides.findFirst({
        where: and(
          eq(symbolTrailingStopOverrides.walletId, walletId),
          eq(symbolTrailingStopOverrides.symbol, symbol)
        ),
      });

      if (existing) {
        const [updated] = await ctx.db
          .update(symbolTrailingStopOverrides)
          .set({ ...fields, updatedAt: new Date() })
          .where(eq(symbolTrailingStopOverrides.id, existing.id))
          .returning();
        return updated!;
      }

      const [created] = await ctx.db
        .insert(symbolTrailingStopOverrides)
        .values({
          walletId,
          symbol,
          useIndividualConfig: fields.useIndividualConfig ?? false,
          trailingStopEnabled: fields.trailingStopEnabled ?? null,
          trailingActivationPercentLong: fields.trailingActivationPercentLong ?? null,
          trailingActivationPercentShort: fields.trailingActivationPercentShort ?? null,
          trailingDistancePercentLong: fields.trailingDistancePercentLong ?? null,
          trailingDistancePercentShort: fields.trailingDistancePercentShort ?? null,
          useAdaptiveTrailing: fields.useAdaptiveTrailing ?? null,
          useProfitLockDistance: fields.useProfitLockDistance ?? null,
          trailingDistanceMode: fields.trailingDistanceMode ?? null,
          trailingStopOffsetPercent: fields.trailingStopOffsetPercent ?? null,
          trailingActivationModeLong: fields.trailingActivationModeLong ?? null,
          trailingActivationModeShort: fields.trailingActivationModeShort ?? null,
          manualTrailingActivatedLong: fields.manualTrailingActivatedLong ?? null,
          manualTrailingActivatedShort: fields.manualTrailingActivatedShort ?? null,
        })
        .returning();
      return created!;
    }),

  getSymbolFilters: protectedProcedure
    .input(z.object({
      symbol: z.string(),
      marketType: z.enum(['SPOT', 'FUTURES']).default('FUTURES'),
    }))
    .query(async ({ input }) => {
      const service = getMinNotionalFilterService();
      const filtersMap = await service.getSymbolFilters(input.marketType);
      const filters = filtersMap.get(input.symbol);
      if (!filters) return { minNotional: input.marketType === 'FUTURES' ? 5 : 10, minQty: 0, stepSize: 0, tickSize: 0 };
      return filters;
    }),
});
