import type { TradingSetup } from '@marketmind/types';
import type { autoTradingConfig} from '../../../db/schema';
import { type Wallet } from '../../../db/schema';
import { serializeError } from '../../../utils/errors';
import { autoTradingService } from '../../auto-trading';
import { getFuturesClient } from '../../../exchange';
import { protectionOrderHandler } from './protection-order-handler';
import type { ActiveWatcher } from '../types';
import { log } from '../utils';

export interface LiveOrderResult {
  entryOrderId: string | null;
  actualEntryPrice: number;
  actualQuantity: number;
  actualEntryFee: number | null;
  stopLossOrderId: string | null;
  takeProfitOrderId: string | null;
  stopLossAlgoId: string | null;
  takeProfitAlgoId: string | null;
  stopLossIsAlgo: boolean;
  takeProfitIsAlgo: boolean;
  orderListId: string | null;
}

export const executeLiveOrder = async (
  watcher: ActiveWatcher,
  setup: TradingSetup,
  effectiveTakeProfit: number | undefined,
  wallet: Wallet,
  config: typeof autoTradingConfig.$inferSelect,
  dynamicSize: { quantity: number; sizePercent: number; reason?: string },
  executionId: string,
  setupId: string,
  orderType: 'MARKET',
  useLimit: boolean,
): Promise<LiveOrderResult | null> => {
  let entryOrderId: string | null = null;
  let actualEntryPrice = setup.entryPrice;
  let actualQuantity = dynamicSize.quantity;
  let actualEntryFee: number | null = null;
  let stopLossOrderId: string | null = null;
  let takeProfitOrderId: string | null = null;
  let stopLossAlgoId: string | null = null;
  let takeProfitAlgoId: string | null = null;
  let stopLossIsAlgo = false;
  let takeProfitIsAlgo = false;
  let orderListId: string | null = null;

  if (watcher.marketType === 'FUTURES') {
    try {
      const configLeverage = config.leverage ?? 1;

      await autoTradingService.setFuturesLeverage(
        wallet,
        watcher.symbol,
        configLeverage
      );

      await autoTradingService.setFuturesMarginType(
        wallet,
        watcher.symbol,
        'CROSSED'
      );

      log('> Futures leverage/margin configured', {
        symbol: watcher.symbol,
        leverage: configLeverage,
        marginType: 'CROSSED',
      });
    } catch (leverageError) {
      const errorMsg = serializeError(leverageError);
      const isBenignError = errorMsg.includes('No need to change') ||
        errorMsg.includes('leverage not changed') ||
        errorMsg.includes('already set');

      if (isBenignError) {
        log('> Futures leverage/margin already configured (skipping)', {
          symbol: watcher.symbol,
          message: errorMsg,
        });
      } else {
        log('✗ Failed to configure leverage/margin, aborting entry', {
          error: errorMsg,
        });
        return null;
      }
    }
  }

  log(`> LIVE EXECUTION - Placing ${orderType} order on Binance`, {
    walletType: wallet.walletType,
    symbol: watcher.symbol,
    side: setup.direction === 'LONG' ? 'BUY' : 'SELL',
    quantity: dynamicSize.quantity.toFixed(8),
    orderType,
    limitPrice: useLimit ? setup.limitEntryPrice : undefined,
  });

  try {
    const configLeverageForQty = config.leverage ?? 1;
    const adjustedQuantity = watcher.marketType === 'FUTURES'
      ? dynamicSize.quantity / configLeverageForQty
      : dynamicSize.quantity;

    if (watcher.marketType === 'FUTURES') {
      log('> Quantity adjusted for leverage', {
        originalQuantity: dynamicSize.quantity,
        adjustedQuantity,
        leverage: configLeverageForQty,
      });
    }

    const orderResult = await autoTradingService.executeBinanceOrder(
      wallet,
      {
        symbol: watcher.symbol,
        side: setup.direction === 'LONG' ? 'BUY' : 'SELL',
        type: orderType,
        quantity: adjustedQuantity,
        price: useLimit ? setup.limitEntryPrice : undefined,
        timeInForce: useLimit ? 'GTC' : undefined,
      },
      watcher.marketType
    );

    entryOrderId = orderResult.orderId;
    actualEntryPrice = parseFloat(orderResult.price) || setup.entryPrice;
    actualQuantity = parseFloat(orderResult.executedQty) || adjustedQuantity;

    const orderFilled = parseFloat(orderResult.executedQty) > 0;

    log('✓ Binance order executed', {
      orderId: entryOrderId,
      executedQty: orderResult.executedQty,
      price: orderResult.price,
      orderType,
      filled: orderFilled,
    });

    if (!orderFilled) {
      log('! MARKET order not filled (executedQty=0) - aborting trade creation', {
        orderId: entryOrderId,
        symbol: watcher.symbol,
        orderType,
        executedQty: orderResult.executedQty,
      });
      return null;
    }

    if (orderFilled && entryOrderId && watcher.marketType === 'FUTURES') {
      try {
        const client = getFuturesClient(wallet);
        const feeResult = await client.getOrderEntryFee(watcher.symbol, entryOrderId);
        if (feeResult) {
          actualEntryFee = feeResult.entryFee;
          if (feeResult.avgPrice > 0) {
            actualEntryPrice = feeResult.avgPrice;
          }
          log('> Entry fee captured from Binance', {
            entryOrderId,
            entryFee: actualEntryFee,
            avgPrice: feeResult.avgPrice,
          });
        }
      } catch (feeError) {
        log('! Failed to fetch entry fee, will be captured on close', {
          entryOrderId,
          error: serializeError(feeError),
        });
      }
    }

    if (orderFilled && setup.stopLoss && effectiveTakeProfit) {
      const protectionResult = await protectionOrderHandler.placeProtectionOrders(
        watcher,
        setup,
        effectiveTakeProfit,
        wallet,
        actualQuantity
      );

      stopLossOrderId = protectionResult.stopLossOrderId;
      takeProfitOrderId = protectionResult.takeProfitOrderId;
      stopLossAlgoId = protectionResult.stopLossAlgoId;
      takeProfitAlgoId = protectionResult.takeProfitAlgoId;
      stopLossIsAlgo = protectionResult.stopLossIsAlgo;
      takeProfitIsAlgo = protectionResult.takeProfitIsAlgo;
      orderListId = protectionResult.orderListId;

      const hasStopLossProtection = stopLossOrderId !== null || stopLossAlgoId !== null;
      if (!hasStopLossProtection && entryOrderId !== null && orderFilled) {
        const compensationResult = await protectionOrderHandler.handleFailedProtection(
          watcher,
          setup,
          effectiveTakeProfit,
          wallet,
          actualEntryPrice,
          actualQuantity,
          executionId,
          setupId,
          entryOrderId
        );
        if (compensationResult.shouldReturn) return null;
      }
    } else if (orderFilled && setup.stopLoss) {
      const slResult = await protectionOrderHandler.placeSingleStopLoss(
        wallet,
        watcher,
        setup,
        actualQuantity
      );

      stopLossOrderId = slResult.stopLossOrderId;
      stopLossAlgoId = slResult.stopLossAlgoId;
      stopLossIsAlgo = slResult.stopLossIsAlgo;

      const hasStopLossProtection = stopLossOrderId !== null || stopLossAlgoId !== null;
      if (!hasStopLossProtection && entryOrderId !== null && orderFilled) {
        const compensationResult = await protectionOrderHandler.handleFailedProtection(
          watcher,
          setup,
          effectiveTakeProfit,
          wallet,
          actualEntryPrice,
          actualQuantity,
          executionId,
          setupId,
          entryOrderId
        );
        if (compensationResult.shouldReturn) return null;
      }
    }
  } catch (orderError) {
    log('✗ Failed to execute Binance order', {
      error: serializeError(orderError),
    });
    return null;
  }

  return {
    entryOrderId,
    actualEntryPrice,
    actualQuantity,
    actualEntryFee,
    stopLossOrderId,
    takeProfitOrderId,
    stopLossAlgoId,
    takeProfitAlgoId,
    stopLossIsAlgo,
    takeProfitIsAlgo,
    orderListId,
  };
};
