import type { PositionSide } from '@marketmind/types';
import { and, eq } from 'drizzle-orm';
import { badRequest } from '../../utils/trpc-errors';
import { ALGO_ORDER_DEFAULTS } from '../../constants/algo-orders';
import type { DatabaseType } from '../../db/client';
import { orders, tradeExecutions } from '../../db/schema';
import { autoTradingService } from '../../services/auto-trading';
import {
  createBinanceFuturesClient,
  getOrderEntryFee,
  submitFuturesAlgoOrder,
} from '../../services/binance-futures-client';
import type { walletQueries } from '../../services/database/walletQueries';
import { logger, serializeError } from '../../services/logger';
import { formatPriceForBinance, formatQuantityForBinance } from '../../utils/formatters';
import { generateEntityId } from '../../utils/id';

export const handleConditionalOrder = async (
  ctx: { db: DatabaseType; user: { id: string } },
  input: {
    walletId: string;
    symbol: string;
    side: 'BUY' | 'SELL';
    type: string;
    quantity: string;
    stopPrice?: string;
    reduceOnly?: boolean;
    setupId?: string;
    setupType?: string;
    stopLoss?: string;
    takeProfit?: string;
  },
  client: ReturnType<typeof createBinanceFuturesClient>,
  tickSize: string | undefined,
  stepSize: string | undefined,
  actualLeverage: number,
) => {
  if (!input.stopPrice) {
    throw badRequest('stopPrice is required for STOP_MARKET / TAKE_PROFIT_MARKET orders');
  }

  const triggerPrice = formatPriceForBinance(parseFloat(input.stopPrice), tickSize);

  const algoOrder = await submitFuturesAlgoOrder(client, {
    symbol: input.symbol,
    side: input.side,
    type: input.type as 'STOP_MARKET' | 'TAKE_PROFIT_MARKET',
    triggerPrice,
    quantity: formatQuantityForBinance(parseFloat(input.quantity), stepSize),
    workingType: ALGO_ORDER_DEFAULTS.workingType,
    priceProtect: ALGO_ORDER_DEFAULTS.priceProtect,
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
    marketType: 'FUTURES',
    reduceOnly: input.reduceOnly ?? false,
    stopLossIntent: input.stopLoss,
    takeProfitIntent: input.takeProfit,
  });

  if (!input.reduceOnly) {
    const oppositeDirection = input.side === 'BUY' ? 'SHORT' : 'LONG';
    const [existingOpposite] = await ctx.db
      .select({ id: tradeExecutions.id })
      .from(tradeExecutions)
      .where(
        and(
          eq(tradeExecutions.walletId, input.walletId),
          eq(tradeExecutions.symbol, input.symbol),
          eq(tradeExecutions.side, oppositeDirection),
          eq(tradeExecutions.status, 'open'),
          eq(tradeExecutions.marketType, 'FUTURES')
        )
      )
      .limit(1);

    if (!existingOpposite) {
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
        stopLoss: input.stopLoss,
        takeProfit: input.takeProfit,
        status: 'pending',
        openedAt: new Date(),
        marketType: 'FUTURES',
        leverage: actualLeverage,
      });
      logger.info(
        { symbol: input.symbol, algoId: algoOrder.algoId },
        '[createOrder] Created pending tradeExecution for manual STOP_MARKET/TP_MARKET order',
      );
    } else {
      logger.info(
        { symbol: input.symbol, algoId: algoOrder.algoId, existingOpposite: existingOpposite.id },
        '[createOrder] Skipped pending execution — reduce order against existing opposite position',
      );
    }
  }

  const openExecutions = await ctx.db.select().from(tradeExecutions)
    .where(
      and(
        eq(tradeExecutions.walletId, input.walletId),
        eq(tradeExecutions.userId, ctx.user.id),
        eq(tradeExecutions.status, 'open'),
      )
    );

  return {
    orderId: algoOrder.algoId,
    symbol: algoOrder.symbol,
    side: algoOrder.side,
    type: algoOrder.type,
    status: 'NEW' as const,
    price: algoOrder.triggerPrice ?? triggerPrice,
    quantity: algoOrder.quantity,
    executedQty: '0',
    openExecutions,
  };
};

export const handleMarketOrderProtection = async (
  ctx: { db: DatabaseType; user: { id: string } },
  input: {
    walletId: string;
    symbol: string;
    side: 'BUY' | 'SELL';
    quantity: string;
    stopLoss?: string;
    takeProfit?: string;
    price?: string;
  },
  futuresOrder: { orderId: string; price: string; avgPrice?: string },
  wallet: Awaited<ReturnType<typeof walletQueries.getByIdAndUser>>,
  orderDirection: PositionSide,
  actualLeverage: number,
) => {
  const quantity = parseFloat(input.quantity);
  let slResult: Awaited<ReturnType<typeof autoTradingService.createStopLossOrder>> | null = null;
  let tpResult: Awaited<ReturnType<typeof autoTradingService.createTakeProfitOrder>> | null = null;

  if (input.stopLoss) {
    try {
      slResult = await autoTradingService.createStopLossOrder(wallet, input.symbol, quantity, parseFloat(input.stopLoss), orderDirection, 'FUTURES');
    } catch (slError) {
      logger.error({ error: serializeError(slError), symbol: input.symbol }, '[createOrder] Failed to place MARKET SL order');
    }
  }
  if (input.takeProfit) {
    try {
      tpResult = await autoTradingService.createTakeProfitOrder(wallet, input.symbol, quantity, parseFloat(input.takeProfit), orderDirection, 'FUTURES');
    } catch (tpError) {
      logger.error({ error: serializeError(tpError), symbol: input.symbol }, '[createOrder] Failed to place MARKET TP order');
    }
  }

  if (slResult || tpResult) {
    // Determine the actual fill price. submitNewOrder's avgPrice is
    // the response from Binance with newOrderRespType='RESULT' — for
    // MARKET orders this SHOULD reflect the fill avg, but in practice
    // we've seen it return 0 / empty under load (slippage events,
    // partial fills not yet aggregated). Previously we fell back to
    // `input.price` (the chart's reference price at click time), which
    // produced phantom entry_price up to $200+ off the actual avg
    // during volatile fills (incident 2026-05-08 exec FuxZ3Mhqq4a:
    // chart was at 79623, real avg fill was 79408 → DB stored 79623
    // → orphan-close PnL was understated by $215).
    //
    // Instead: query Binance for the order's actual trade fills via
    // getOrderEntryFee. That endpoint returns the true weighted avg
    // from the userTrades log, which is always authoritative. If the
    // query also fails (IP banned, network issue), only then fall back
    // to input.price as a placeholder — the next ORDER_TRADE_UPDATE
    // WS event will overwrite it with the real avg (handler at
    // handle-order-update.ts:215 was changed to update instead of
    // skip when entry fills arrive for tracked execs).
    let fillPrice = parseFloat((futuresOrder as { avgPrice?: string }).avgPrice ?? '0');
    let entryFee = 0;
    if (fillPrice <= 0) {
      try {
        const client = createBinanceFuturesClient(wallet);
        const orderFees = await getOrderEntryFee(client, input.symbol, futuresOrder.orderId);
        if (orderFees && orderFees.avgPrice > 0) {
          fillPrice = orderFees.avgPrice;
          entryFee = orderFees.entryFee;
          logger.info(
            { symbol: input.symbol, orderId: futuresOrder.orderId, fillPrice, entryFee },
            '[createOrder] Recovered MARKET fill price via getOrderEntryFee (avgPrice was missing from submit response)',
          );
        }
      } catch (recoverError) {
        logger.warn(
          { error: serializeError(recoverError), symbol: input.symbol, orderId: futuresOrder.orderId },
          '[createOrder] Could not recover MARKET fill price — using input.price as placeholder; next ORDER_TRADE_UPDATE will correct it',
        );
      }
    }
    await ctx.db.insert(tradeExecutions).values({
      id: generateEntityId(),
      userId: ctx.user.id,
      walletId: input.walletId,
      symbol: input.symbol,
      side: orderDirection,
      entryOrderId: futuresOrder.orderId,
      entryPrice: fillPrice > 0 ? fillPrice.toString() : (input.price ?? '0'),
      entryFee: entryFee > 0 ? entryFee.toString() : null,
      quantity: input.quantity,
      stopLoss: input.stopLoss,
      takeProfit: input.takeProfit,
      stopLossAlgoId: slResult?.isAlgoOrder === true ? slResult.algoId : null,
      takeProfitAlgoId: tpResult?.isAlgoOrder === true ? tpResult.algoId : null,
      stopLossOrderId: slResult?.isAlgoOrder === false ? slResult.orderId : null,
      takeProfitOrderId: tpResult?.isAlgoOrder === false ? tpResult.orderId : null,
      stopLossIsAlgo: slResult?.isAlgoOrder ?? false,
      takeProfitIsAlgo: tpResult?.isAlgoOrder ?? false,
      status: 'open',
      openedAt: new Date(),
      entryOrderType: 'MARKET',
      marketType: 'FUTURES',
      leverage: actualLeverage,
    });
    logger.info({ symbol: input.symbol, orderId: futuresOrder.orderId, fillPrice }, '[createOrder] Created tradeExecution for manual MARKET order with SL/TP');
  }
};
