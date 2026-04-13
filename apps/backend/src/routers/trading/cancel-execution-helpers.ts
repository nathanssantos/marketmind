import type { TradeExecution, Wallet } from '../../db/schema';
import { getFuturesClient, getSpotClient } from '../../exchange';
import { cancelAllProtectionOrders } from '../../services/protection-orders';
import { logger } from '../../services/logger';
import { serializeError } from '../../utils/errors';

export const cancelFuturesExecutionOrders = async (
  execution: TradeExecution,
  wallet: Wallet,
): Promise<void> => {
  const { createBinanceFuturesClient, cancelFuturesAlgoOrder } = await import('../../services/binance-futures-client');
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
};

export const cancelSpotExecutionOrders = async (
  execution: TradeExecution,
  wallet: Wallet,
): Promise<void> => {
  const client = getSpotClient(wallet);

  const orderIdsToCancel = [
    execution.entryOrderId,
    execution.stopLossOrderId,
    execution.takeProfitOrderId,
  ].filter((id): id is string => id !== null);

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
      const { createBinanceClient } = await import('../../services/binance-client');
      const binanceClient = createBinanceClient(wallet);
      await binanceClient.cancelOCO({ symbol: execution.symbol, orderListId: Number(execution.orderListId) });
      logger.info({ orderListId: execution.orderListId, symbol: execution.symbol }, 'Cancelled OCO order list');
    } catch (error) {
      logger.warn({
        orderListId: execution.orderListId,
        symbol: execution.symbol,
        error: serializeError(error),
      }, 'Failed to cancel OCO order list (may already be executed)');
    }
  }
};
