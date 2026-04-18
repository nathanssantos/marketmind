import { eq } from 'drizzle-orm';
import { db } from '../db';
import type { TradeExecution } from '../db/schema';
import { tradeExecutions, wallets } from '../db/schema';
import { serializeError } from '../utils/errors';
import { formatPrice } from '../utils/formatters';
import { logger } from './logger';
import { BinanceIpBannedError } from './binance-api-cache';
import { updateStopLossOrder } from './protection-orders';
import { getWebSocketService } from './websocket';

export const applyStopLossUpdate = async (
  execution: TradeExecution,
  newStopLoss: number,
  oldStopLoss: number | null,
  isFirstActivation?: boolean,
  currentExtremePrice?: number
): Promise<void> => {
  let newAlgoId: string | null = null;

  if (execution.marketType === 'FUTURES' && execution.stopLossAlgoId && execution.stopLossIsAlgo) {
    try {
      const [wallet] = await db.select().from(wallets).where(eq(wallets.id, execution.walletId)).limit(1);

      if (wallet?.walletType === 'live') {
        const result = await updateStopLossOrder({
          wallet,
          symbol: execution.symbol,
          side: execution.side,
          quantity: parseFloat(execution.quantity),
          triggerPrice: newStopLoss,
          marketType: 'FUTURES',
          currentAlgoId: execution.stopLossAlgoId,
        });
        newAlgoId = result.algoId ?? null;
        logger.info({ algoId: newAlgoId, executionId: execution.id }, '[TrailingStop] SL order updated via protection-orders service');
      }
    } catch (error) {
      if (error instanceof BinanceIpBannedError) throw error;
      logger.error({ error: serializeError(error), executionId: execution.id }, '[TrailingStop] Failed to update SL order on Binance');
    }
  }

  const isLong = execution.side === 'LONG';

  const updateData: Record<string, unknown> = {
    stopLoss: newStopLoss.toString(),
    ...(newAlgoId && { stopLossAlgoId: newAlgoId }),
    updatedAt: new Date(),
  };

  if (isFirstActivation) {
    updateData['trailingActivatedAt'] = new Date();
    if (currentExtremePrice !== undefined) {
      if (isLong) {
        updateData['highestPriceSinceTrailingActivation'] = currentExtremePrice.toString();
      } else {
        updateData['lowestPriceSinceTrailingActivation'] = currentExtremePrice.toString();
      }
    }
    logger.info({ executionId: execution.id, currentExtremePrice }, '[TrailingStop] First activation - saving activation data');
  } else if (currentExtremePrice !== undefined) {
    if (isLong) {
      const currentHighest = execution.highestPriceSinceTrailingActivation
        ? parseFloat(execution.highestPriceSinceTrailingActivation)
        : 0;
      if (currentExtremePrice > currentHighest) {
        updateData['highestPriceSinceTrailingActivation'] = currentExtremePrice.toString();
      }
    } else {
      const currentLowest = execution.lowestPriceSinceTrailingActivation
        ? parseFloat(execution.lowestPriceSinceTrailingActivation)
        : Infinity;
      if (currentExtremePrice < currentLowest) {
        updateData['lowestPriceSinceTrailingActivation'] = currentExtremePrice.toString();
      }
    }
  }

  await db
    .update(tradeExecutions)
    .set(updateData)
    .where(eq(tradeExecutions.id, execution.id));

  const wsService = getWebSocketService();
  if (wsService) {
    const side = execution.side;
    const sideLabel = side === 'LONG' ? 'Long' : 'Short';

    wsService.emitTradeNotification(execution.walletId, {
      type: 'TRAILING_STOP_UPDATED',
      title: 'Trailing Stop',
      body: `${sideLabel} ${execution.symbol}: ${oldStopLoss ? formatPrice(oldStopLoss) : '-'} → ${formatPrice(newStopLoss)}`,
      urgency: 'low',
      data: {
        executionId: execution.id,
        symbol: execution.symbol,
        side,
        oldStopLoss: oldStopLoss?.toString(),
        newStopLoss: newStopLoss.toString(),
      },
    });

    wsService.emitPositionUpdate(execution.walletId, {
      id: execution.id,
      status: 'open',
      stopLoss: newStopLoss.toString(),
    });
  }
};
