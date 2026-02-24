import { calculateLiquidationPrice } from '@marketmind/types';

import { calculatePnl } from '../utils/pnl-calculator';
import { TRPCError } from '@trpc/server';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { TRADING_CONFIG } from '../constants';
import { orders, positions } from '../db/schema';
import { binanceApiCache } from '../services/binance-api-cache';
import { autoTradingService } from '../services/auto-trading';
import {
    cancelAllFuturesAlgoOrders,
    cancelFuturesOrder,
    closePosition as closeExchangePosition,
    createBinanceFuturesClient,
    getOpenAlgoOrders,
    getPositions as getFuturesPositions,
    getOpenOrders,
    getPosition,
    getSymbolLeverageBrackets,
    isPaperWallet,
    setLeverage,
    setMarginType,
    submitFuturesOrder,
} from '../services/binance-futures-client';
import { getBinanceFuturesDataService } from '../services/binance-futures-data';
import { walletQueries } from '../services/database/walletQueries';
import { logger } from '../services/logger';
import { getMinNotionalFilterService } from '../services/min-notional-filter';
import { protectedProcedure, router } from '../trpc';
import { generateEntityId } from '../utils/id';

export const futuresTradingRouter = router({
  setLeverage: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        symbol: z.string(),
        leverage: z.number().min(1).max(125),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const wallet = await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

      if (isPaperWallet(wallet)) {
        return { leverage: input.leverage, maxNotionalValue: '0', symbol: input.symbol };
      }

      try {
        const client = createBinanceFuturesClient(wallet);
        const result = await setLeverage(client, input.symbol, input.leverage);
        return result;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to set leverage',
          cause: error,
        });
      }
    }),

  setMarginType: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        symbol: z.string(),
        marginType: z.enum(['ISOLATED', 'CROSSED']),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const wallet = await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

      if (isPaperWallet(wallet)) {
        return { success: true, marginType: input.marginType };
      }

      try {
        const client = createBinanceFuturesClient(wallet);
        await setMarginType(client, input.symbol, input.marginType);
        return { success: true, marginType: input.marginType };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to set margin type',
          cause: error,
        });
      }
    }),

  createOrder: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        symbol: z.string(),
        side: z.enum(['BUY', 'SELL']),
        type: z.enum(['MARKET', 'LIMIT', 'STOP', 'STOP_MARKET', 'TAKE_PROFIT', 'TAKE_PROFIT_MARKET']),
        quantity: z.string(),
        price: z.string().optional(),
        stopPrice: z.string().optional(),
        reduceOnly: z.boolean().optional(),
        setupId: z.string().optional(),
        setupType: z.string().optional(),
        leverage: z.number().min(1).max(125).default(1),
        marginType: z.enum(['ISOLATED', 'CROSSED']).default('ISOLATED'),
        stopLoss: z.string().optional(),
        takeProfit: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const wallet = await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

      if (!wallet.isActive) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Wallet is inactive' });
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
            timeInForce: input.type === 'LIMIT' ? 'GTC' : undefined,
            time: simulatedOrderId,
            updateTime: simulatedOrderId,
            setupId: input.setupId,
            setupType: input.setupType,
            marketType: 'FUTURES',
            reduceOnly: input.reduceOnly ?? false,
            stopLossIntent: input.stopLoss,
            takeProfitIntent: input.takeProfit,
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

        const client = createBinanceFuturesClient(wallet);

        await setLeverage(client, input.symbol, input.leverage);
        await setMarginType(client, input.symbol, input.marginType);

        const futuresOrder = await submitFuturesOrder(client, {
          symbol: input.symbol,
          side: input.side,
          type: input.type,
          quantity: input.quantity,
          price: input.price,
          stopPrice: input.stopPrice,
          reduceOnly: input.reduceOnly,
          timeInForce: input.type === 'LIMIT' ? 'GTC' : undefined,
        });

        await ctx.db.insert(orders).values({
          orderId: futuresOrder.orderId,
          userId: ctx.user.id,
          walletId: input.walletId,
          symbol: futuresOrder.symbol,
          side: futuresOrder.side,
          type: futuresOrder.type,
          price: futuresOrder.price,
          origQty: futuresOrder.origQty,
          executedQty: futuresOrder.executedQty,
          status: futuresOrder.status,
          timeInForce: futuresOrder.timeInForce,
          time: futuresOrder.time,
          updateTime: futuresOrder.updateTime,
          setupId: input.setupId,
          setupType: input.setupType,
          marketType: 'FUTURES',
          reduceOnly: futuresOrder.reduceOnly,
          stopLossIntent: input.stopLoss,
          takeProfitIntent: input.takeProfit,
        });

        if (input.type === 'MARKET') {
          const direction = input.side === 'BUY' ? 'LONG' : 'SHORT';
          const quantity = parseFloat(input.quantity);
          if (input.stopLoss) {
            try {
              await autoTradingService.createStopLossOrder(wallet, input.symbol, quantity, parseFloat(input.stopLoss), direction, 'FUTURES');
            } catch (slError) {
              logger.error({ error: slError instanceof Error ? slError.message : String(slError), symbol: input.symbol }, '[createOrder] Failed to place MARKET SL order');
            }
          }
          if (input.takeProfit) {
            try {
              await autoTradingService.createTakeProfitOrder(wallet, input.symbol, quantity, parseFloat(input.takeProfit), direction, 'FUTURES');
            } catch (tpError) {
              logger.error({ error: tpError instanceof Error ? tpError.message : String(tpError), symbol: input.symbol }, '[createOrder] Failed to place MARKET TP order');
            }
          }
        }

        return {
          orderId: futuresOrder.orderId,
          symbol: futuresOrder.symbol,
          side: futuresOrder.side,
          type: futuresOrder.type,
          status: futuresOrder.status,
          price: futuresOrder.price,
          quantity: futuresOrder.origQty,
          executedQty: futuresOrder.executedQty,
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to create futures order',
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
      const wallet = await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

      try {
        if (isPaperWallet(wallet)) {
          await ctx.db
            .update(orders)
            .set({ status: 'CANCELED', updateTime: Date.now() })
            .where(eq(orders.orderId, input.orderId));

          return { orderId: input.orderId, symbol: input.symbol, status: 'CANCELED' };
        }

        const client = createBinanceFuturesClient(wallet);
        await cancelFuturesOrder(client, input.symbol, input.orderId);

        await ctx.db
          .update(orders)
          .set({ status: 'CANCELED', updateTime: Date.now() })
          .where(eq(orders.orderId, input.orderId));

        return { orderId: input.orderId, symbol: input.symbol, status: 'CANCELED' };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to cancel futures order',
          cause: error,
        });
      }
    }),

  getPositions: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const wallet = await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

      if (isPaperWallet(wallet)) {
        const dbPositions = await ctx.db
          .select()
          .from(positions)
          .where(
            and(
              eq(positions.userId, ctx.user.id),
              eq(positions.walletId, input.walletId),
              eq(positions.status, 'open'),
              eq(positions.marketType, 'FUTURES')
            )
          )
          .orderBy(desc(positions.createdAt));

        return dbPositions;
      }

      if (binanceApiCache.isBanned()) {
        const waitSeconds = Math.ceil(binanceApiCache.getBanExpiresIn() / 1000);
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: `IP banned by Binance. Try again in ${waitSeconds} seconds.`,
        });
      }

      const cached = binanceApiCache.get<Awaited<ReturnType<typeof getFuturesPositions>>>('POSITIONS', input.walletId);
      if (cached) return cached;

      try {
        const client = createBinanceFuturesClient(wallet);
        const exchangePositions = await getFuturesPositions(client);
        binanceApiCache.set('POSITIONS', input.walletId, exchangePositions);
        return exchangePositions;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (errorMessage.includes('418') || errorMessage.includes('-1003') || errorMessage.includes('Way too many requests')) {
          const banMatch = errorMessage.match(/until\s+(\d+)/);
          const banExpiry = banMatch?.[1] ? parseInt(banMatch[1], 10) : Date.now() + 5 * 60 * 1000;
          binanceApiCache.setBanned(banExpiry);
        }
        logger.error({ error: errorMessage }, 'Failed to get futures positions');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: errorMessage,
          cause: error,
        });
      }
    }),

  getPosition: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        symbol: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const wallet = await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

      if (isPaperWallet(wallet)) {
        const [dbPosition] = await ctx.db
          .select()
          .from(positions)
          .where(
            and(
              eq(positions.userId, ctx.user.id),
              eq(positions.walletId, input.walletId),
              eq(positions.symbol, input.symbol),
              eq(positions.status, 'open'),
              eq(positions.marketType, 'FUTURES')
            )
          )
          .limit(1);

        return dbPosition || null;
      }

      try {
        const client = createBinanceFuturesClient(wallet);
        return await getPosition(client, input.symbol);
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get futures position',
          cause: error,
        });
      }
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
        leverage: z.number().min(1).max(125).default(1),
        marginType: z.enum(['ISOLATED', 'CROSSED']).default('ISOLATED'),
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
          leverage: input.leverage,
          riskRewardRatio: riskRewardRatio.toFixed(2),
        }, '✓ Risk/Reward ratio validated for futures position');
      }

      const positionId = generateEntityId();
      const entryPrice = parseFloat(input.entryPrice);
      const liquidationPrice = calculateLiquidationPrice(entryPrice, input.leverage, input.side);

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
        marketType: 'FUTURES',
        leverage: input.leverage,
        marginType: input.marginType,
        liquidationPrice: liquidationPrice.toString(),
        accumulatedFunding: '0',
      });

      return { id: positionId, liquidationPrice };
    }),

  closePosition: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        symbol: z.string(),
        positionId: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const wallet = await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

      try {
        if (isPaperWallet(wallet) && input.positionId) {
          const [position] = await ctx.db
            .select()
            .from(positions)
            .where(
              and(
                eq(positions.id, input.positionId),
                eq(positions.userId, ctx.user.id),
                eq(positions.status, 'open')
              )
            )
            .limit(1);

          if (!position) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Position not found' });
          }

          const dataService = getBinanceFuturesDataService();
          const markPriceData = await dataService.getMarkPrice(position.symbol);
          const exitPrice = markPriceData ? markPriceData.markPrice : parseFloat(position.currentPrice ?? position.entryPrice);

          const entryPrice = parseFloat(position.entryPrice);
          const quantity = parseFloat(position.entryQty);
          const leverage = position.leverage ?? 1;
          const accumulatedFunding = parseFloat(position.accumulatedFunding ?? '0');

          const { grossPnl, totalFees, netPnl, pnlPercent } = calculatePnl({
            entryPrice,
            exitPrice,
            quantity,
            side: position.side as 'LONG' | 'SHORT',
            marketType: 'FUTURES',
            leverage,
            accumulatedFunding,
          });

          await ctx.db
            .update(positions)
            .set({
              status: 'closed',
              closedAt: new Date(),
              updatedAt: new Date(),
              currentPrice: exitPrice.toString(),
              pnl: netPnl.toString(),
              pnlPercent: pnlPercent.toString(),
            })
            .where(eq(positions.id, input.positionId));

          logger.info({
            positionId: input.positionId,
            symbol: position.symbol,
            side: position.side,
            entryPrice,
            exitPrice,
            quantity,
            leverage,
            grossPnl: grossPnl.toFixed(4),
            fees: totalFees.toFixed(4),
            accumulatedFunding: accumulatedFunding.toFixed(4),
            netPnl: netPnl.toFixed(4),
            pnlPercent: pnlPercent.toFixed(2),
          }, 'Paper futures position closed with funding');

          return {
            success: true,
            positionId: input.positionId,
            pnl: netPnl,
            pnlPercent,
            accumulatedFunding,
          };
        }

        const client = createBinanceFuturesClient(wallet);
        const position = await getPosition(client, input.symbol);

        if (!position) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'No open position for this symbol' });
        }

        const symbolFilters = await getMinNotionalFilterService().getSymbolFilters('FUTURES');
        const stepSize = symbolFilters.get(input.symbol)?.stepSize?.toString();
        const result = await closeExchangePosition(client, input.symbol, position.positionAmt, stepSize);

        logger.info({
          walletId: input.walletId,
          symbol: input.symbol,
          orderId: result.orderId,
          side: result.side,
          quantity: result.origQty,
        }, 'Futures position closed');

        return { success: true, orderId: result.orderId };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to close futures position',
          cause: error,
        });
      }
    }),

  getOpenOrders: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        symbol: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const wallet = await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

      if (isPaperWallet(wallet)) {
        const whereConditions = [
          eq(orders.userId, ctx.user.id),
          eq(orders.walletId, input.walletId),
          eq(orders.marketType, 'FUTURES'),
          eq(orders.status, 'NEW'),
        ];

        if (input.symbol) {
          whereConditions.push(eq(orders.symbol, input.symbol));
        }

        return ctx.db.select().from(orders).where(and(...whereConditions));
      }

      try {
        if (binanceApiCache.isBanned()) {
          const waitSeconds = Math.ceil(binanceApiCache.getBanExpiresIn() / 1000);
          throw new TRPCError({
            code: 'TOO_MANY_REQUESTS',
            message: `IP banned by Binance. Try again in ${waitSeconds} seconds.`,
          });
        }

        const cacheKey = input.symbol || 'all';
        const cached = binanceApiCache.get<Awaited<ReturnType<typeof getOpenOrders>>>('OPEN_ORDERS', input.walletId, cacheKey);
        if (cached) return cached;

        const client = createBinanceFuturesClient(wallet);
        const openOrders = await getOpenOrders(client, input.symbol);
        binanceApiCache.set('OPEN_ORDERS', input.walletId, openOrders, cacheKey);
        return openOrders;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (errorMessage.includes('418') || errorMessage.includes('banned') || errorMessage.includes('-1003')) {
          const banMatch = errorMessage.match(/until\s+(\d+)/);
          const banExpiry = banMatch?.[1] ? parseInt(banMatch[1], 10) : Date.now() + 5 * 60 * 1000;
          binanceApiCache.setBanned(banExpiry);
        }
        logger.error({ error: errorMessage }, 'Failed to get open futures orders');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: errorMessage,
          cause: error,
        });
      }
    }),

  getLeverageBrackets: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        symbol: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const wallet = await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

      if (isPaperWallet(wallet)) {
        return [
          { bracket: 1, initialLeverage: 125, notionalCap: 50000, notionalFloor: 0, maintMarginRatio: 0.004, cum: 0 },
          { bracket: 2, initialLeverage: 100, notionalCap: 250000, notionalFloor: 50000, maintMarginRatio: 0.005, cum: 50 },
          { bracket: 3, initialLeverage: 50, notionalCap: 1000000, notionalFloor: 250000, maintMarginRatio: 0.01, cum: 1300 },
        ];
      }

      try {
        const client = createBinanceFuturesClient(wallet);
        return await getSymbolLeverageBrackets(client, input.symbol);
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get leverage brackets',
          cause: error,
        });
      }
    }),

  getMarkPrice: protectedProcedure
    .input(z.object({ symbol: z.string() }))
    .query(async ({ input }) => {
      const dataService = getBinanceFuturesDataService();
      return dataService.getMarkPrice(input.symbol);
    }),

  getFundingRate: protectedProcedure
    .input(z.object({ symbol: z.string() }))
    .query(async ({ input }) => {
      const dataService = getBinanceFuturesDataService();
      return dataService.getCurrentFundingRate(input.symbol);
    }),

  getExchangeInfo: protectedProcedure.query(async () => {
    const dataService = getBinanceFuturesDataService();
    return dataService.getExchangeInfo();
  }),

  getOpenAlgoOrders: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        symbol: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const wallet = await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

      if (isPaperWallet(wallet)) {
        return [];
      }

      try {
        const client = createBinanceFuturesClient(wallet);
        return await getOpenAlgoOrders(client, input.symbol);
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get open algo orders',
          cause: error,
        });
      }
    }),

  cancelAllAlgoOrders: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
        symbol: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const wallet = await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

      if (isPaperWallet(wallet)) {
        logger.info({ symbol: input.symbol }, 'Paper wallet - skipping algo order cancellation');
        return { success: true, cancelled: 0 };
      }

      try {
        const client = createBinanceFuturesClient(wallet);
        const openOrders = await getOpenAlgoOrders(client, input.symbol);
        const orderCount = openOrders.length;

        if (orderCount === 0) {
          logger.info({ symbol: input.symbol }, 'No algo orders to cancel');
          return { success: true, cancelled: 0 };
        }

        await cancelAllFuturesAlgoOrders(client, input.symbol);
        logger.info({ symbol: input.symbol, cancelled: orderCount }, 'Cancelled all algo orders for symbol');

        return { success: true, cancelled: orderCount };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to cancel algo orders',
          cause: error,
        });
      }
    }),
});
