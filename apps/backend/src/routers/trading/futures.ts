import { calculateLiquidationPrice } from '@marketmind/types';
import { calculatePnl } from '../../utils/pnl-calculator';
import { TRPCError } from '@trpc/server';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { TRADING_CONFIG } from '../../constants';
import { orders, positions } from '../../db/schema';
import { isPaperWallet } from '../../services/binance-client';
import { getFuturesClient } from '../../exchange';
import { getBinanceFuturesDataService } from '../../services/binance-futures-data';
import { walletQueries } from '../../services/database/walletQueries';
import { logger } from '../../services/logger';
import { getMinNotionalFilterService } from '../../services/min-notional-filter';
import { autoTradingService } from '../../services/auto-trading';
import { protectedProcedure, router } from '../../trpc';
import { generateEntityId } from '../../utils/id';

export const futuresRouter = router({
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
        const client = getFuturesClient(wallet);
        const result = await client.setLeverage(input.symbol, input.leverage);
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
        const client = getFuturesClient(wallet);
        await client.setMarginType(input.symbol, input.marginType);
        return { success: true, marginType: input.marginType };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to set margin type',
          cause: error,
        });
      }
    }),

  setPositionMode: protectedProcedure
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

  getAccountInfo: protectedProcedure
    .input(z.object({ walletId: z.string() }))
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

        const client = getFuturesClient(wallet);

        await client.setLeverage(input.symbol, input.leverage);
        await client.setMarginType(input.symbol, input.marginType);

        const futuresOrder = await client.submitOrder({
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

        const client = getFuturesClient(wallet);
        await client.cancelOrder(input.symbol, input.orderId);

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
    .input(z.object({ walletId: z.string() }))
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
        const client = getFuturesClient(wallet);
        const exchangePositions = await client.getPositions();
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
        const client = getFuturesClient(wallet);
        return await client.getPosition(input.symbol);
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

        const client = getFuturesClient(wallet);
        const position = await client.getPosition(input.symbol);

        if (!position) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'No open position for this symbol' });
        }

        const symbolFilters = await getMinNotionalFilterService().getSymbolFilters('FUTURES');
        const stepSize = symbolFilters.get(input.symbol)?.stepSize?.toString();
        const result = await client.closePosition(input.symbol, position.positionAmt, stepSize);

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
        const client = getFuturesClient(wallet);
        return await client.getOpenOrders(input.symbol);
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
        const client = getFuturesClient(wallet);
        return await client.getLeverageBrackets(input.symbol);
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
        const client = getFuturesClient(wallet);
        return await client.getOpenAlgoOrders(input.symbol);
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
        const client = getFuturesClient(wallet);
        const openOrders = await client.getOpenAlgoOrders(input.symbol);
        const orderCount = openOrders.length;

        if (orderCount === 0) {
          logger.info({ symbol: input.symbol }, 'No algo orders to cancel');
          return { success: true, cancelled: 0 };
        }

        await client.cancelAllAlgoOrders(input.symbol);
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
