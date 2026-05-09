import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { PROTECTION_CONFIG } from '../../constants';
import { autoTradingConfig, tradeExecutions } from '../../db/schema';
import { autoTradingService } from '../../services/auto-trading';
import { autoTradingScheduler } from '../../services/auto-trading-scheduler';
import { cancelAllFuturesAlgoOrders, closePosition, createBinanceFuturesClient, getPositions, isPaperWallet } from '../../services/binance-futures-client';
import { walletQueries } from '../../services/database/walletQueries';
import { logger } from '../../services/logger';
import { closeExecutionAndBroadcast } from '../../services/wallet-broadcast';
import { getMinNotionalFilterService } from '../../services/min-notional-filter';
import { positionMonitorService } from '../../services/position-monitor';
import { protectedProcedure, router } from '../../trpc';
import { serializeError } from '../../utils/errors';
import { calculatePnl } from '@marketmind/utils';
import { log } from './utils';

export const recoveryRouter = router({
  emergencyStop: protectedProcedure
    .input(
      z.object({
        walletId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const wallet = await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);

      log('! EMERGENCY STOP initiated', { walletId: input.walletId });

      const result = {
        watchersStopped: 0,
        algoOrdersCancelled: 0,
        positionsClosed: 0,
        errors: [] as string[],
      };

      try {
        await autoTradingScheduler.stopAllWatchersForWallet(input.walletId);
        result.watchersStopped = 1;
        log(`✗ Stopped all watchers for wallet`, { walletId: input.walletId });
      } catch (error) {
        const errorMsg = serializeError(error);
        result.errors.push(`Failed to stop watchers: ${errorMsg}`);
        logger.error({ error: errorMsg }, '[EmergencyStop] Failed to stop watchers');
      }

      const walletMarketType = wallet.marketType ?? 'FUTURES';

      const openExecutions = await ctx.db
        .select()
        .from(tradeExecutions)
        .where(
          and(
            eq(tradeExecutions.walletId, input.walletId),
            eq(tradeExecutions.status, 'open'),
            eq(tradeExecutions.marketType, walletMarketType)
          )
        );

      if (!isPaperWallet(wallet) && walletMarketType === 'FUTURES') {
        try {
          const client = createBinanceFuturesClient(wallet);

          const uniqueSymbols = [...new Set(openExecutions.map((e) => e.symbol))];

          for (const symbol of uniqueSymbols) {
            try {
              await cancelAllFuturesAlgoOrders(client, symbol);
              result.algoOrdersCancelled++;
              log(`✗ Cancelled algo orders for ${symbol}`, { walletId: input.walletId, symbol });
            } catch (error) {
              const errorMsg = serializeError(error);
              if (!errorMsg.includes('No algo orders')) {
                result.errors.push(`Failed to cancel algo orders for ${symbol}: ${errorMsg}`);
              }
            }
          }

          const exitPricesBySymbol = new Map<string, string>();

          const minNotionalFilter = getMinNotionalFilterService();
          const symbolFilters = await minNotionalFilter.getSymbolFilters('FUTURES');

          const exchangePositions = await getPositions(client);
          for (const position of exchangePositions) {
            if (parseFloat(position.positionAmt) === 0) continue;

            try {
              const filters = symbolFilters.get(position.symbol);
              const stepSize = filters?.stepSize?.toString();

              const closeResult = await closePosition(
                client,
                position.symbol,
                position.positionAmt,
                stepSize
              );
              exitPricesBySymbol.set(position.symbol, closeResult.avgPrice);
              result.positionsClosed++;
              log(`▼ Closed position ${position.symbol}`, {
                walletId: input.walletId,
                symbol: position.symbol,
                amount: position.positionAmt,
                exitPrice: closeResult.avgPrice,
              });
            } catch (error) {
              const errorMsg = serializeError(error);
              result.errors.push(`Failed to close position ${position.symbol}: ${errorMsg}`);
              logger.error(
                { error: errorMsg, symbol: position.symbol },
                '[EmergencyStop] Failed to close position'
              );
            }
          }

          for (const execution of openExecutions) {
            const exitPrice = exitPricesBySymbol.get(execution.symbol);
            if (exitPrice) {
              const entryPrice = parseFloat(execution.entryPrice);
              const exitPriceNum = parseFloat(exitPrice);
              const qty = parseFloat(execution.quantity || '0');
              const marketType = execution.marketType === 'FUTURES' ? 'FUTURES' : 'SPOT';
              const leverage = execution.leverage ?? 1;

              const { grossPnl, totalFees, netPnl, pnlPercent } = calculatePnl({
                entryPrice,
                exitPrice: exitPriceNum,
                quantity: qty,
                side: execution.side,
                marketType,
                leverage,
              });

              await closeExecutionAndBroadcast(execution, {
                exitPrice: exitPriceNum,
                exitReason: 'EMERGENCY_STOP',
                exitSource: 'MANUAL',
                pnl: netPnl,
                pnlPercent,
                fees: totalFees,
              });

              log(`> Emergency closed execution`, {
                executionId: execution.id,
                symbol: execution.symbol,
                side: execution.side,
                entryPrice,
                exitPrice: exitPriceNum,
                grossPnl: grossPnl.toFixed(2),
                fees: totalFees.toFixed(2),
                netPnl: netPnl.toFixed(2),
                pnlPercent: pnlPercent.toFixed(2),
              });
            } else {
              await closeExecutionAndBroadcast(execution, {
                exitPrice: null,
                exitReason: 'EMERGENCY_STOP',
                exitSource: 'MANUAL',
                pnl: 0,
                pnlPercent: 0,
              });
            }
          }
        } catch (error) {
          const errorMsg = serializeError(error);
          result.errors.push(`Exchange operation failed: ${errorMsg}`);
          logger.error({ error: errorMsg }, '[EmergencyStop] Exchange operation failed');
        }
      } else {
        if (!isPaperWallet(wallet) && walletMarketType === 'SPOT') {
          log('! SPOT wallet emergency stop - positions NOT closed on exchange, manual close required', {
            walletId: input.walletId,
            openExecutions: openExecutions.length,
          });
          result.errors.push('SPOT positions must be manually closed on exchange');
        }

        for (const execution of openExecutions) {
          await closeExecutionAndBroadcast(execution, {
            exitPrice: null,
            exitReason: 'EMERGENCY_STOP',
            exitSource: 'MANUAL',
            pnl: 0,
            pnlPercent: 0,
          });
        }
      }

      const [config] = await ctx.db
        .select()
        .from(autoTradingConfig)
        .where(eq(autoTradingConfig.walletId, input.walletId))
        .limit(1);

      if (config) {
        await ctx.db
          .update(autoTradingConfig)
          .set({
            isEnabled: false,
            updatedAt: new Date(),
          })
          .where(eq(autoTradingConfig.id, config.id));
      }

      log('! EMERGENCY STOP completed', {
        walletId: input.walletId,
        ...result,
      });

      return {
        success: result.errors.length === 0,
        ...result,
      };
    }),

  recoverUnprotectedPosition: protectedProcedure
    .input(z.object({
      executionId: z.string(),
      stopLoss: z.number().optional(),
      takeProfit: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      log('# recoverUnprotectedPosition called', { executionId: input.executionId });

      const [execution] = await ctx.db
        .select()
        .from(tradeExecutions)
        .where(and(
          eq(tradeExecutions.id, input.executionId),
          eq(tradeExecutions.userId, ctx.user.id),
          eq(tradeExecutions.status, 'open')
        ))
        .limit(1);

      if (!execution) {
        log('✗ Execution not found or not open', { executionId: input.executionId });
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Open execution not found' });
      }

      if (execution.stopLoss) {
        log('! Execution already has stop loss', { executionId: input.executionId, stopLoss: execution.stopLoss });
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Execution already has a stop loss' });
      }

      const wallet = await walletQueries.getByIdAndUser(execution.walletId, ctx.user.id);
      const marketType = (execution.marketType ?? 'FUTURES');

      const currentPrice = await positionMonitorService.getCurrentPrice(execution.symbol, marketType);

      const stopLoss = input.stopLoss ?? (
        execution.side === 'LONG'
          ? currentPrice * (1 - PROTECTION_CONFIG.EMERGENCY_SL_PERCENT)
          : currentPrice * (1 + PROTECTION_CONFIG.EMERGENCY_SL_PERCENT)
      );

      log('> Recovery parameters', {
        executionId: input.executionId,
        symbol: execution.symbol,
        side: execution.side,
        currentPrice,
        calculatedStopLoss: stopLoss,
        userProvidedSL: input.stopLoss,
      });

      const slResult = await autoTradingService.createStopLossOrder(
        wallet,
        execution.symbol,
        parseFloat(execution.quantity),
        stopLoss,
        execution.side,
        marketType
      );

      const algoId = slResult.isAlgoOrder ? slResult.algoId : null;
      const orderId = slResult.isAlgoOrder ? null : slResult.orderId;

      await ctx.db
        .update(tradeExecutions)
        .set({
          stopLoss: stopLoss.toString(),
          stopLossAlgoId: algoId,
          stopLossOrderId: orderId,
          stopLossIsAlgo: slResult.isAlgoOrder,
          updatedAt: new Date(),
        })
        .where(eq(tradeExecutions.id, input.executionId));

      log('✓ Stop loss added to unprotected position', {
        executionId: input.executionId,
        symbol: execution.symbol,
        stopLoss,
        algoId,
        orderId,
      });

      return {
        success: true,
        stopLoss,
        algoId,
        orderId,
      };
    }),
});
