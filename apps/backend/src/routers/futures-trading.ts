import { TRPCError } from '@trpc/server';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { orders, positions } from '../db/schema';
import { walletQueries } from '../services/database/walletQueries';
import {
  createBinanceFuturesClient,
  isPaperWallet,
  setLeverage,
  setMarginType,
  getPositions as getFuturesPositions,
  getPosition,
  submitFuturesOrder,
  cancelFuturesOrder,
  closePosition as closeExchangePosition,
  getOpenOrders,
  getSymbolLeverageBrackets,
} from '../services/binance-futures-client';
import { getBinanceFuturesDataService } from '../services/binance-futures-data';
import { logger } from '../services/logger';
import { protectedProcedure, router } from '../trpc';
import { calculateLiquidationPrice, BINANCE_FEES } from '@marketmind/types';
import { TRADING_CONFIG } from '../constants';
import { generateEntityId } from '../utils/id';

const FUTURES_TAKER_FEE = BINANCE_FEES.FUTURES.VIP_0.taker;

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
        });

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

      try {
        const client = createBinanceFuturesClient(wallet);
        const exchangePositions = await getFuturesPositions(client);
        return exchangePositions;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get futures positions',
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
        }, '✅ Risk/Reward ratio validated for futures position');
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

          const positionValue = entryPrice * quantity;
          const exitValue = exitPrice * quantity;

          const grossPnl = position.side === 'LONG'
            ? exitValue - positionValue
            : positionValue - exitValue;

          const entryFee = positionValue * FUTURES_TAKER_FEE;
          const exitFee = exitValue * FUTURES_TAKER_FEE;
          const totalFees = entryFee + exitFee;

          const netPnl = grossPnl - totalFees + accumulatedFunding;
          const marginValue = positionValue / leverage;
          const pnlPercent = (netPnl / marginValue) * 100;

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

        const result = await closeExchangePosition(client, input.symbol, position.positionAmt);

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
        const client = createBinanceFuturesClient(wallet);
        return await getOpenOrders(client, input.symbol);
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get open orders',
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
});
