import { calculateTotalFees } from '@marketmind/types';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../db';
import type { TradeExecution, Wallet } from '../../db/schema';
import { tradeExecutions, wallets } from '../../db/schema';
import { env } from '../../env';
import { getFuturesClient, getSpotClient } from '../../exchange';
import { calculateNotional, calculatePnl, formatQuantityForBinance, roundToDecimals } from '../../utils/formatters';
import { serializeError } from '../../utils/errors';
import { getMinNotionalFilterService } from '../min-notional-filter';
import { isPaperWallet } from '../binance-client';
import { binancePriceStreamService } from '../binance-price-stream';
import { cancelAllProtectionOrders } from '../protection-orders';
import { logger } from '../logger';
import { strategyPerformanceService } from '../strategy-performance';
import { getWebSocketService } from '../websocket';
import { autoTradingScheduler } from '../auto-trading-scheduler';
import { fetchActualFeesFromExchange, fetchMissingEntryFee } from './fee-reconciliation';

const processingExits = new Set<string>();

export const isProcessingExit = (executionId: string): boolean => processingExits.has(executionId);

const createExitOrder = async (
  wallet: Wallet,
  symbol: string,
  quantity: number,
  _price: number,
  side: 'LONG' | 'SHORT',
  marketType: 'SPOT' | 'FUTURES' = 'FUTURES'
): Promise<string> => {
  const orderSide = side === 'LONG' ? 'SELL' : 'BUY';

  const minNotionalFilter = getMinNotionalFilterService();
  const symbolFilters = await minNotionalFilter.getSymbolFilters(marketType);
  const filters = symbolFilters.get(symbol);
  const stepSize = filters?.stepSize?.toString();
  const formattedQuantity = parseFloat(formatQuantityForBinance(quantity, stepSize));

  logger.info({ symbol, originalQuantity: quantity, formattedQuantity, stepSize }, 'Formatting quantity for exit order');

  if (marketType === 'FUTURES') {
    const client = getFuturesClient(wallet);
    const order = await client.submitOrder({
      symbol,
      side: orderSide,
      type: 'MARKET',
      quantity: String(formattedQuantity),
      reduceOnly: true,
      newOrderRespType: 'RESULT',
    });

    logger.info({
      orderId: order.orderId,
      symbol,
      side: orderSide,
      quantity: formattedQuantity,
      avgPrice: order.avgPrice,
      executedQty: order.executedQty,
      marketType: 'FUTURES',
    }, 'Futures exit order created');

    return order.orderId;
  }

  const client = getSpotClient(wallet);
  const order = await client.submitOrder({
    symbol,
    side: orderSide,
    type: 'MARKET',
    quantity: formattedQuantity,
  });

  logger.info({
    orderId: order.orderId,
    symbol,
    side: orderSide,
    quantity: formattedQuantity,
    marketType: 'SPOT',
  }, 'Spot exit order created');

  return order.orderId;
};

export const executeExit = async (
  execution: TradeExecution,
  exitPrice: number,
  reason: 'STOP_LOSS' | 'TAKE_PROFIT'
): Promise<void> => {
  if (processingExits.has(execution.id)) return;

  processingExits.add(execution.id);

  try {
    const currentExecution = await db.query.tradeExecutions.findFirst({
      where: eq(tradeExecutions.id, execution.id),
    });

    if (currentExecution?.status !== 'open') {
      logger.trace({
        executionId: execution.id,
        status: currentExecution?.status,
      }, 'Skipping exit - position already closed or not found');
      return;
    }

    const [wallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.id, execution.walletId))
      .limit(1);

    if (!wallet) throw new Error(`Wallet not found: ${execution.walletId}`);

    const walletSupportsLive = !isPaperWallet(wallet);
    const shouldExecuteReal = walletSupportsLive && env.ENABLE_LIVE_TRADING;

    if (shouldExecuteReal) {
      const hasExchangeSLProtection = currentExecution.stopLossAlgoId || currentExecution.stopLossOrderId;
      const hasExchangeTPProtection = currentExecution.takeProfitAlgoId || currentExecution.takeProfitOrderId;

      if ((reason === 'STOP_LOSS' && hasExchangeSLProtection) ||
        (reason === 'TAKE_PROFIT' && hasExchangeTPProtection)) {
        logger.trace({
          executionId: execution.id,
          symbol: execution.symbol,
          reason,
          stopLossAlgoId: currentExecution.stopLossAlgoId,
          takeProfitAlgoId: currentExecution.takeProfitAlgoId,
        }, 'Deferring to exchange-side protection order - exchange will handle exit');
        return;
      }
    }

    const quantity = parseFloat(execution.quantity);
    if (quantity === 0) {
      logger.warn({ executionId: execution.id }, 'Cannot execute exit for zero quantity position');
      return;
    }

    const entryPrice = parseFloat(execution.entryPrice);
    const grossPnl = calculatePnl(entryPrice, exitPrice, quantity, execution.side);

    const exitValue = calculateNotional(exitPrice, quantity);
    const marketType = execution.marketType === 'FUTURES' ? 'FUTURES' : 'SPOT';
    const actualEntryFeeFromRecord = parseFloat(currentExecution.entryFee || '0');
    const { exitFee: estimatedExitFee } = calculateTotalFees(0, exitValue, { marketType });
    const totalFees = actualEntryFeeFromRecord + estimatedExitFee;
    const accumulatedFunding = parseFloat(currentExecution.accumulatedFunding || '0');
    const pnl = roundToDecimals(grossPnl - totalFees + accumulatedFunding, 8);

    const pnlPercent = roundToDecimals(((exitPrice - entryPrice) / entryPrice) * 100, 4);
    const adjustedPnlPercent = execution.side === 'LONG' ? pnlPercent : -pnlPercent;

    let exitOrderId: string | null = null;
    let positionSyncedFromExchange = false;

    if (!shouldExecuteReal) {
      logger.info({
        executionId: execution.id,
        symbol: execution.symbol,
        walletType: wallet.walletType,
        reason,
        liveEnabled: env.ENABLE_LIVE_TRADING,
      }, 'Paper/disabled mode: simulating exit order');
    } else {
      try {
        exitOrderId = await createExitOrder(
          wallet,
          execution.symbol,
          quantity,
          exitPrice,
          execution.side,
          marketType
        );
      } catch (orderError) {
        const errorMessage = serializeError(orderError);
        const errorCode = (orderError as Record<string, unknown>)?.['code'];
        if (errorMessage.includes('ReduceOnly Order is rejected') || errorCode === -2022) {
          logger.warn({
            executionId: execution.id,
            symbol: execution.symbol,
            side: execution.side,
            reason,
          }, 'Position not found on exchange (ReduceOnly rejected) - marking as synced closed');
          positionSyncedFromExchange = true;
        } else {
          throw orderError;
        }
      }
    }

    let actualExitPrice = exitPrice;
    let actualFees = totalFees;
    let actualPnl = pnl;
    let actualPnlPercent = adjustedPnlPercent;
    let actualEntryFee = actualEntryFeeFromRecord;
    let actualExitFee = estimatedExitFee;

    if (positionSyncedFromExchange && marketType === 'FUTURES') {
      const result = await fetchActualFeesFromExchange(
        wallet, execution, entryPrice, exitPrice, quantity,
        accumulatedFunding, actualEntryFeeFromRecord, estimatedExitFee
      );
      actualExitPrice = result.actualExitPrice;
      actualEntryFee = result.actualEntryFee;
      actualExitFee = result.actualExitFee;
      actualFees = result.actualFees;
      actualPnl = result.actualPnl;
      actualPnlPercent = result.actualPnlPercent;
    }

    if (actualEntryFee === 0 && !positionSyncedFromExchange && marketType === 'FUTURES' && execution.entryOrderId && !isPaperWallet(wallet)) {
      const result = await fetchMissingEntryFee(wallet, execution, {
        actualEntryFee, actualExitFee, actualExitPrice, accumulatedFunding, entryPrice, quantity,
      });
      actualEntryFee = result.actualEntryFee;
      actualFees = result.actualFees;
      actualPnl = result.actualPnl;
    }

    const exitSource = positionSyncedFromExchange ? 'EXCHANGE_SYNC' : 'ALGORITHM';

    const closeResult = await db
      .update(tradeExecutions)
      .set({
        exitPrice: actualExitPrice.toString(),
        exitOrderId,
        pnl: actualPnl.toString(),
        pnlPercent: actualPnlPercent.toString(),
        fees: actualFees.toString(),
        entryFee: actualEntryFee.toString(),
        exitFee: actualExitFee.toString(),
        exitSource,
        exitReason: reason,
        status: 'closed',
        closedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(tradeExecutions.id, execution.id), eq(tradeExecutions.status, 'open')))
      .returning({ id: tradeExecutions.id });

    if (closeResult.length === 0) {
      logger.info({
        executionId: execution.id,
        symbol: execution.symbol,
      }, '[PositionMonitor] Position already closed by another process - skipping balance update and cleanup');
      return;
    }

    const currentBalance = parseFloat(wallet.currentBalance || '0');

    await db
      .update(wallets)
      .set({
        currentBalance: sql`CAST(${wallets.currentBalance} AS DECIMAL(20,8)) + ${actualPnl}`,
        updatedAt: new Date(),
      })
      .where(eq(wallets.id, wallet.id));

    logger.info({
      walletId: wallet.id,
      walletType: wallet.walletType,
      pnl: actualPnl,
      previousBalance: currentBalance,
      expectedNewBalance: currentBalance + actualPnl,
    }, '[PositionMonitor] Wallet balance updated atomically after position exit');

    binancePriceStreamService.invalidateExecutionCache(execution.symbol);

    const hasProtectionOrders = execution.stopLossAlgoId || execution.stopLossOrderId ||
      execution.takeProfitAlgoId || execution.takeProfitOrderId;

    if (hasProtectionOrders && !isPaperWallet(wallet)) {
      try {
        await cancelAllProtectionOrders({
          wallet,
          symbol: execution.symbol,
          marketType: execution.marketType === 'FUTURES' ? 'FUTURES' : 'SPOT',
          stopLossAlgoId: execution.stopLossAlgoId,
          stopLossOrderId: execution.stopLossOrderId,
          takeProfitAlgoId: execution.takeProfitAlgoId,
          takeProfitOrderId: execution.takeProfitOrderId,
        });
        logger.info({
          executionId: execution.id,
          symbol: execution.symbol,
          stopLossAlgoId: execution.stopLossAlgoId,
          takeProfitAlgoId: execution.takeProfitAlgoId,
        }, '[PositionMonitor] Cancelled remaining protection orders after position exit');
      } catch (cancelError) {
        logger.warn({
          executionId: execution.id,
          symbol: execution.symbol,
          error: serializeError(cancelError),
        }, '[PositionMonitor] Failed to cancel protection orders - they may have already been filled or cancelled');
      }
    }

    const expectedNewBalance = roundToDecimals(currentBalance + pnl, 8);
    logger.info({
      executionId: execution.id,
      symbol: execution.symbol,
      exitSource,
      reason,
      exitPrice,
      entryPrice,
      quantity,
      pnl: pnl.toFixed(2),
      pnlPercent: adjustedPnlPercent.toFixed(2),
      expectedNewBalance: expectedNewBalance.toFixed(2),
      isPaperTrading: isPaperWallet(wallet),
      positionSyncedFromExchange,
    }, positionSyncedFromExchange
      ? '[PositionMonitor] Position closed (synced from exchange - position not found)'
      : '[PositionMonitor] Position closed automatically');

    const wsService = getWebSocketService();
    if (wsService) {
      const isProfit = pnl > 0;
      const side = execution.side;
      const sideLabel = side === 'LONG' ? 'Long' : 'Short';

      let title: string;
      if (reason === 'TAKE_PROFIT') {
        title = 'Take Profit';
      } else if (isProfit) {
        title = '✓ Stop Loss (Profit)';
      } else {
        title = '✗ Stop Loss';
      }

      const pnlSign = pnl >= 0 ? '+' : '';
      const body = `${sideLabel} ${execution.symbol}: ${pnlSign}$${pnl.toFixed(2)} (${pnlSign}${adjustedPnlPercent.toFixed(2)}%)`;

      wsService.emitTradeNotification(execution.walletId, {
        type: 'POSITION_CLOSED',
        title,
        body,
        urgency: isProfit ? 'normal' : 'critical',
        data: {
          executionId: execution.id,
          symbol: execution.symbol,
          side,
          entryPrice: entryPrice.toString(),
          exitPrice: exitPrice.toString(),
          pnl: pnl.toString(),
          pnlPercent: adjustedPnlPercent.toString(),
          exitReason: reason,
        },
      });

      wsService.emitPositionUpdate(execution.walletId, {
        id: execution.id,
        status: 'closed',
        exitPrice: exitPrice.toString(),
        pnl: pnl.toString(),
        pnlPercent: adjustedPnlPercent.toString(),
        exitReason: reason,
      });
    }

    await strategyPerformanceService.updatePerformance(execution.id);

    if (autoTradingScheduler.isWalletPaused(execution.walletId)) {
      autoTradingScheduler.resumeWatchersForWallet(execution.walletId);
      logger.info({ walletId: execution.walletId }, '[PositionMonitor] Resumed watchers after position exit');
    }
  } catch (error) {
    logger.error({
      executionId: execution.id,
      reason,
      error: serializeError(error),
    }, 'Failed to execute exit');
    throw error;
  } finally {
    processingExits.delete(execution.id);
  }
};
