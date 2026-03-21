import type { TradingSetup } from '@marketmind/types';
import { db } from '../../db';
import { tradeExecutions, type Wallet } from '../../db/schema';
import { serializeError } from '../../utils/errors';
import { cooldownService } from '../cooldown';
import { positionMonitorService } from '../position-monitor';
import { getWebSocketService } from '../websocket';
import type { ActiveWatcher } from './types';
import { log } from './utils';
import { getIntervalMs } from './fibonacci-calculator';

export interface PaperOrderResult {
  actualEntryPrice: number;
  actualQuantity: number;
}

export const executePaperOrder = async (
  watcher: ActiveWatcher,
  setup: TradingSetup,
  effectiveTakeProfit: number | undefined,
  wallet: Wallet,
  dynamicSize: { quantity: number; sizePercent: number; reason?: string },
  executionId: string,
  setupId: string,
  useLimit: boolean,
  expectedEntryWithSlippage: number,
): Promise<PaperOrderResult | null> => {
  let actualEntryPrice = expectedEntryWithSlippage;
  const actualQuantity = dynamicSize.quantity;

  try {
    const currentMarketPrice = await positionMonitorService.getCurrentPrice(watcher.symbol, watcher.marketType);

    if (useLimit && setup.limitEntryPrice) {
      const wouldLimitFill = setup.direction === 'LONG'
        ? currentMarketPrice && currentMarketPrice <= setup.limitEntryPrice
        : currentMarketPrice && currentMarketPrice >= setup.limitEntryPrice;

      if (!wouldLimitFill) {
        log('> PAPER TRADING - Creating PENDING limit order', {
          walletType: wallet.walletType,
          direction: setup.direction,
          limitEntryPrice: setup.limitEntryPrice,
          currentMarketPrice,
          reason: setup.direction === 'LONG'
            ? `Waiting for price to drop to ${setup.limitEntryPrice} (pullback)`
            : `Waiting for price to rise to ${setup.limitEntryPrice} (bounce)`,
        });

        const expirationBars = setup.expirationBars ?? 3;
        const intervalMs = getIntervalMs(watcher.interval);
        const expiresAt = new Date(Date.now() + (expirationBars * intervalMs));

        try {
          const triggerCandle = setup.triggerCandleData?.find(c => c.offset === 0);
          const openedAtDate = new Date();
          await db.insert(tradeExecutions).values({
            id: executionId,
            userId: watcher.userId,
            walletId: watcher.walletId,
            setupId,
            setupType: setup.type,
            symbol: watcher.symbol,
            side: setup.direction,
            entryPrice: setup.limitEntryPrice.toString(),
            quantity: actualQuantity.toFixed(8),
            stopLoss: setup.stopLoss?.toString(),
            takeProfit: effectiveTakeProfit?.toString(),
            openedAt: openedAtDate,
            status: 'pending',
            entryOrderType: 'LIMIT',
            limitEntryPrice: setup.limitEntryPrice.toString(),
            expiresAt,
            marketType: watcher.marketType,
            entryInterval: watcher.interval,
            originalStopLoss: setup.stopLoss?.toString(),
            highestPriceSinceEntry: setup.limitEntryPrice.toString(),
            lowestPriceSinceEntry: setup.limitEntryPrice.toString(),
            triggerKlineIndex: setup.triggerKlineIndex,
            triggerKlineOpenTime: triggerCandle?.openTime,
            triggerCandleData: setup.triggerCandleData ? JSON.stringify(setup.triggerCandleData) : null,
            triggerIndicatorValues: setup.triggerIndicatorValues ? JSON.stringify(setup.triggerIndicatorValues) : null,
            fibonacciProjection: setup.fibonacciProjection ? JSON.stringify(setup.fibonacciProjection) : null,
          });

          log('✓ PENDING order created - waiting for price to reach limit', {
            executionId,
            limitEntryPrice: setup.limitEntryPrice,
            currentMarketPrice,
            expiresAt: expiresAt.toISOString(),
            expirationBars,
          });

          const wsService = getWebSocketService();
          if (wsService) {
            wsService.emitPositionUpdate(watcher.walletId, {
              id: executionId,
              symbol: watcher.symbol,
              side: setup.direction,
              status: 'pending',
              entryPrice: setup.limitEntryPrice.toString(),
              limitEntryPrice: setup.limitEntryPrice.toString(),
              quantity: actualQuantity.toFixed(8),
              stopLoss: setup.stopLoss?.toString(),
              takeProfit: effectiveTakeProfit?.toString(),
              setupType: setup.type,
              expiresAt: expiresAt.toISOString(),
              fibonacciProjection: setup.fibonacciProjection,
            });
          }

          await cooldownService.setCooldown(
            setup.type,
            watcher.symbol,
            watcher.interval,
            watcher.walletId,
            executionId,
            15,
            'Pending order created'
          );
        } catch (pendingError) {
          log('✗ Failed to create pending order', {
            error: serializeError(pendingError),
          });
        }

        return null;
      }

      actualEntryPrice = currentMarketPrice || setup.limitEntryPrice;
      log('> PAPER TRADING - LIMIT order filled immediately at market price', {
        walletType: wallet.walletType,
        direction: setup.direction,
        setupClosePrice: setup.entryPrice,
        limitEntryPrice: setup.limitEntryPrice,
        actualFillPrice: actualEntryPrice,
        orderType: 'LIMIT',
      });
    } else {
      log('> PAPER TRADING - Using current market price', {
        walletType: wallet.walletType,
        setupPrice: setup.entryPrice,
        orderType: 'MARKET',
      });

      if (currentMarketPrice) {
        actualEntryPrice = currentMarketPrice;
        log('✓ Using live market price for paper trading', {
          setupPrice: setup.entryPrice,
          marketPrice: currentMarketPrice,
          difference: `${((currentMarketPrice - setup.entryPrice) / setup.entryPrice * 100).toFixed(2)}%`,
        });
      } else {
        log('! No live price available, using setup price with slippage', {
          setupPrice: setup.entryPrice,
          priceUsed: expectedEntryWithSlippage,
        });
      }
    }
  } catch (priceError) {
    log('! Failed to get market price, using setup price with slippage', {
      error: serializeError(priceError),
    });
  }

  return { actualEntryPrice, actualQuantity };
};
