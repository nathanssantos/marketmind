import type { TradingSetup } from '@marketmind/types';
import {
  EXIT_REASON,
  PROTECTION_ORDER_RETRY,
  RISK_ALERT_LEVELS,
  RISK_ALERT_TYPES,
} from '../../constants';
import { db } from '../../db';
import { tradeExecutions, type Wallet } from '../../db/schema';
import { serializeError } from '../../utils/errors';
import { withRetrySafe } from '../../utils/retry';
import { autoTradingService } from '../auto-trading';
import { ocoOrderService } from '../oco-orders';
import { getWebSocketService } from '../websocket';
import type { ActiveWatcher } from './types';
import { log } from './utils';

export interface ProtectionOrderResult {
  stopLossOrderId: number | null;
  takeProfitOrderId: number | null;
  stopLossAlgoId: number | null;
  takeProfitAlgoId: number | null;
  stopLossIsAlgo: boolean;
  takeProfitIsAlgo: boolean;
  orderListId: number | null;
}

export interface SingleStopLossResult {
  stopLossOrderId: number | null;
  stopLossAlgoId: number | null;
  stopLossIsAlgo: boolean;
}

export class ProtectionOrderHandler {
  async placeProtectionOrders(
    watcher: ActiveWatcher,
    setup: TradingSetup,
    effectiveTakeProfit: number,
    wallet: Wallet,
    actualQuantity: number
  ): Promise<ProtectionOrderResult> {
    let stopLossOrderId: number | null = null;
    let takeProfitOrderId: number | null = null;
    let stopLossAlgoId: number | null = null;
    let takeProfitAlgoId: number | null = null;
    let stopLossIsAlgo = false;
    let takeProfitIsAlgo = false;
    let orderListId: number | null = null;

    const useSeparateOrders = watcher.marketType === 'FUTURES';

    if (useSeparateOrders) {
      log('> FUTURES market - using separate SL/TP orders (OCO not supported)', {
        symbol: watcher.symbol,
        marketType: watcher.marketType,
        stopLoss: setup.stopLoss,
        takeProfit: effectiveTakeProfit,
      });

      const slRetryResult = await withRetrySafe(
        () => autoTradingService.createStopLossOrder(
          wallet,
          watcher.symbol,
          actualQuantity,
          setup.stopLoss!,
          setup.direction,
          watcher.marketType
        ),
        { maxRetries: PROTECTION_ORDER_RETRY.MAX_ATTEMPTS, initialDelayMs: PROTECTION_ORDER_RETRY.INITIAL_DELAY_MS }
      );

      if (slRetryResult.success) {
        const slResult = slRetryResult.result;
        stopLossIsAlgo = slResult.isAlgoOrder;
        if (slResult.isAlgoOrder) {
          stopLossAlgoId = slResult.algoId;
        } else {
          stopLossOrderId = slResult.orderId;
        }
        log('✓ FUTURES stop loss order placed', {
          stopLossOrderId,
          stopLossAlgoId,
          stopLoss: setup.stopLoss,
          isAlgoOrder: slResult.isAlgoOrder,
        });
      } else {
        log('✗ FUTURES: Failed to place stop loss order after retries', {
          error: serializeError(slRetryResult.lastError),
        });
      }

      const tpRetryResult = await withRetrySafe(
        () => autoTradingService.createTakeProfitOrder(
          wallet,
          watcher.symbol,
          actualQuantity,
          effectiveTakeProfit,
          setup.direction,
          watcher.marketType
        ),
        { maxRetries: PROTECTION_ORDER_RETRY.MAX_ATTEMPTS, initialDelayMs: PROTECTION_ORDER_RETRY.INITIAL_DELAY_MS }
      );

      if (tpRetryResult.success) {
        const tpResult = tpRetryResult.result;
        takeProfitIsAlgo = tpResult.isAlgoOrder;
        if (tpResult.isAlgoOrder) {
          takeProfitAlgoId = tpResult.algoId;
        } else {
          takeProfitOrderId = tpResult.orderId;
        }
        log('> FUTURES take profit order placed', {
          takeProfitOrderId,
          takeProfitAlgoId,
          takeProfit: effectiveTakeProfit,
          isAlgoOrder: tpResult.isAlgoOrder,
        });
      } else {
        log('✗ FUTURES: Failed to place take profit order after retries', {
          error: serializeError(tpRetryResult.lastError),
        });
      }

      const hasSL = stopLossOrderId !== null || stopLossAlgoId !== null;
      const hasTP = takeProfitOrderId !== null || takeProfitAlgoId !== null;

      if (!hasSL || !hasTP) {
        this.emitIncompleteProtectionAlert(watcher, setup, hasSL, hasTP, stopLossAlgoId, takeProfitAlgoId);
      }
    } else {
      try {
        const ocoResult = await ocoOrderService.createExitOCO(
          wallet,
          watcher.symbol,
          actualQuantity,
          setup.stopLoss!,
          effectiveTakeProfit,
          setup.direction
        );

        if (ocoResult) {
          orderListId = ocoResult.orderListId;
          stopLossOrderId = ocoResult.stopLossOrderId;
          takeProfitOrderId = ocoResult.takeProfitOrderId;
          log('✓ OCO exit orders placed', {
            orderListId,
            stopLossOrderId,
            takeProfitOrderId,
            stopLoss: setup.stopLoss,
            takeProfit: effectiveTakeProfit,
          });
        } else {
          log('! OCO placement returned null, falling back to separate orders');
        }

        if (!orderListId) {
          const fallbackResult = await this.placeFallbackProtectionOrders(
            wallet,
            watcher,
            setup,
            effectiveTakeProfit,
            actualQuantity
          );

          stopLossOrderId = fallbackResult.stopLossOrderId;
          takeProfitOrderId = fallbackResult.takeProfitOrderId;
          stopLossAlgoId = fallbackResult.stopLossAlgoId;
          takeProfitAlgoId = fallbackResult.takeProfitAlgoId;
          stopLossIsAlgo = fallbackResult.stopLossIsAlgo;
          takeProfitIsAlgo = fallbackResult.takeProfitIsAlgo;
        }
      } catch (ocoError) {
        log('! Failed to place OCO exit orders, falling back to separate orders', {
          error: serializeError(ocoError),
        });

        const fallbackResult = await this.placeFallbackProtectionOrders(
          wallet,
          watcher,
          setup,
          effectiveTakeProfit,
          actualQuantity
        );

        stopLossOrderId = fallbackResult.stopLossOrderId;
        takeProfitOrderId = fallbackResult.takeProfitOrderId;
        stopLossAlgoId = fallbackResult.stopLossAlgoId;
        takeProfitAlgoId = fallbackResult.takeProfitAlgoId;
        stopLossIsAlgo = fallbackResult.stopLossIsAlgo;
        takeProfitIsAlgo = fallbackResult.takeProfitIsAlgo;
      }
    }

    return {
      stopLossOrderId,
      takeProfitOrderId,
      stopLossAlgoId,
      takeProfitAlgoId,
      stopLossIsAlgo,
      takeProfitIsAlgo,
      orderListId,
    };
  }

  async placeFallbackProtectionOrders(
    wallet: Wallet,
    watcher: ActiveWatcher,
    setup: TradingSetup,
    effectiveTakeProfit: number,
    actualQuantity: number
  ): Promise<Omit<ProtectionOrderResult, 'orderListId'>> {
    let stopLossOrderId: number | null = null;
    let takeProfitOrderId: number | null = null;
    let stopLossAlgoId: number | null = null;
    let takeProfitAlgoId: number | null = null;
    let stopLossIsAlgo = false;
    let takeProfitIsAlgo = false;

    const slFallbackResult = await withRetrySafe(
      () => autoTradingService.createStopLossOrder(
        wallet,
        watcher.symbol,
        actualQuantity,
        setup.stopLoss!,
        setup.direction,
        watcher.marketType
      ),
      { maxRetries: PROTECTION_ORDER_RETRY.MAX_ATTEMPTS, initialDelayMs: PROTECTION_ORDER_RETRY.INITIAL_DELAY_MS }
    );

    if (slFallbackResult.success) {
      const slResult = slFallbackResult.result;
      stopLossIsAlgo = slResult.isAlgoOrder;
      if (slResult.isAlgoOrder) {
        stopLossAlgoId = slResult.algoId;
      } else {
        stopLossOrderId = slResult.orderId;
      }
      log('✓ Stop loss order placed (fallback)', { stopLossOrderId, stopLossAlgoId, isAlgoOrder: slResult.isAlgoOrder });
    } else {
      log('! Failed to place stop loss order (fallback) after retries', {
        error: serializeError(slFallbackResult.lastError),
      });
    }

    const tpFallbackResult = await withRetrySafe(
      () => autoTradingService.createTakeProfitOrder(
        wallet,
        watcher.symbol,
        actualQuantity,
        effectiveTakeProfit,
        setup.direction,
        watcher.marketType
      ),
      { maxRetries: PROTECTION_ORDER_RETRY.MAX_ATTEMPTS, initialDelayMs: PROTECTION_ORDER_RETRY.INITIAL_DELAY_MS }
    );

    if (tpFallbackResult.success) {
      const tpResult = tpFallbackResult.result;
      takeProfitIsAlgo = tpResult.isAlgoOrder;
      if (tpResult.isAlgoOrder) {
        takeProfitAlgoId = tpResult.algoId;
      } else {
        takeProfitOrderId = tpResult.orderId;
      }
      log('> Take profit order placed (fallback)', { takeProfitOrderId, takeProfitAlgoId, isAlgoOrder: tpResult.isAlgoOrder });
    } else {
      log('! Failed to place take profit order (fallback) after retries', {
        error: serializeError(tpFallbackResult.lastError),
      });
    }

    return {
      stopLossOrderId,
      takeProfitOrderId,
      stopLossAlgoId,
      takeProfitAlgoId,
      stopLossIsAlgo,
      takeProfitIsAlgo,
    };
  }

  async placeSingleStopLoss(
    wallet: Wallet,
    watcher: ActiveWatcher,
    setup: TradingSetup,
    actualQuantity: number
  ): Promise<SingleStopLossResult> {
    let stopLossOrderId: number | null = null;
    let stopLossAlgoId: number | null = null;
    let stopLossIsAlgo = false;

    const slOnlyResult = await withRetrySafe(
      () => autoTradingService.createStopLossOrder(
        wallet,
        watcher.symbol,
        actualQuantity,
        setup.stopLoss!,
        setup.direction,
        watcher.marketType
      ),
      { maxRetries: PROTECTION_ORDER_RETRY.MAX_ATTEMPTS, initialDelayMs: PROTECTION_ORDER_RETRY.INITIAL_DELAY_MS }
    );

    if (slOnlyResult.success) {
      const slResult = slOnlyResult.result;
      stopLossIsAlgo = slResult.isAlgoOrder;
      if (slResult.isAlgoOrder) {
        stopLossAlgoId = slResult.algoId;
      } else {
        stopLossOrderId = slResult.orderId;
      }
      log('✓ Stop loss order placed (no TP)', { stopLossOrderId, stopLossAlgoId, stopLoss: setup.stopLoss, isAlgoOrder: slResult.isAlgoOrder });
    } else {
      log('! Failed to place stop loss order after retries', {
        error: serializeError(slOnlyResult.lastError),
      });
    }

    return { stopLossOrderId, stopLossAlgoId, stopLossIsAlgo };
  }

  async handleFailedProtection(
    watcher: ActiveWatcher,
    setup: TradingSetup,
    effectiveTakeProfit: number | undefined,
    wallet: Wallet,
    actualEntryPrice: number,
    actualQuantity: number,
    executionId: string,
    setupId: string,
    entryOrderId: number
  ): Promise<{ shouldReturn: boolean }> {
    log('! CRITICAL: SL creation failed - attempting to close entry position', {
      executionId,
      symbol: watcher.symbol,
      side: setup.direction,
      entryPrice: actualEntryPrice,
      quantity: actualQuantity,
      marketType: watcher.marketType,
    });

    try {
      const closeSide = setup.direction === 'LONG' ? 'SELL' : 'BUY';
      const closeResult = await autoTradingService.closePosition(
        wallet,
        watcher.symbol,
        actualQuantity,
        closeSide,
        watcher.marketType
      );

      if (closeResult) {
        log('✓ Compensation successful - position closed', {
          closeOrderId: closeResult.orderId,
          avgPrice: closeResult.avgPrice,
          entryPrice: actualEntryPrice,
        });

        const wsServiceCompensation = getWebSocketService();
        wsServiceCompensation?.emitRiskAlert(watcher.walletId, {
          type: RISK_ALERT_TYPES.ORDER_REJECTED,
          level: RISK_ALERT_LEVELS.WARNING,
          symbol: watcher.symbol,
          message: `Position ${watcher.symbol} was closed due to failed SL creation. Entry: ${actualEntryPrice}, Exit: ${closeResult.avgPrice}`,
          data: {
            reason: 'sl_creation_failed_compensation',
            side: setup.direction,
            entryPrice: actualEntryPrice.toString(),
            exitPrice: closeResult.avgPrice.toString(),
          },
          timestamp: Date.now(),
        });

        await db.insert(tradeExecutions).values({
          id: executionId,
          userId: watcher.userId,
          walletId: watcher.walletId,
          setupId,
          setupType: setup.type,
          symbol: watcher.symbol,
          side: setup.direction,
          entryPrice: actualEntryPrice.toString(),
          quantity: actualQuantity.toFixed(8),
          stopLoss: setup.stopLoss?.toString(),
          takeProfit: effectiveTakeProfit?.toString(),
          openedAt: new Date(),
          closedAt: new Date(),
          status: 'cancelled',
          exitReason: EXIT_REASON.SL_CREATION_FAILED,
          exitPrice: closeResult.avgPrice.toString(),
          marketType: watcher.marketType,
          entryInterval: watcher.interval,
          entryOrderId,
        });

        return { shouldReturn: true };
      }
    } catch (closeError) {
      log('✗ CRITICAL: Failed to close unprotected position', {
        error: serializeError(closeError),
      });
    }

    const wsServiceAlert = getWebSocketService();
    wsServiceAlert?.emitRiskAlert(watcher.walletId, {
      type: RISK_ALERT_TYPES.UNPROTECTED_POSITION,
      level: RISK_ALERT_LEVELS.CRITICAL,
      symbol: watcher.symbol,
      message: `CRITICAL: Position ${watcher.symbol} ${setup.direction} is UNPROTECTED. SL creation failed and compensation failed. MANUAL INTERVENTION REQUIRED!`,
      data: {
        reason: 'sl_creation_failed_compensation_failed',
        side: setup.direction,
        quantity: actualQuantity.toString(),
        entryPrice: actualEntryPrice.toString(),
        marketType: watcher.marketType,
        executionId,
      },
      timestamp: Date.now(),
    });

    return { shouldReturn: true };
  }

  private emitIncompleteProtectionAlert(
    watcher: ActiveWatcher,
    setup: TradingSetup,
    hasSL: boolean,
    hasTP: boolean,
    stopLossAlgoId: number | null,
    takeProfitAlgoId: number | null
  ): void {
    log('! CRITICAL: Incomplete protection orders - emitting alert', {
      symbol: watcher.symbol,
      hasSL,
      hasTP,
      stopLossAlgoId,
      takeProfitAlgoId,
    });

    const wsServiceProtection = getWebSocketService();
    if (wsServiceProtection) {
      wsServiceProtection.emitRiskAlert(watcher.walletId, {
        type: 'ORDER_REJECTED',
        level: 'critical',
        symbol: watcher.symbol,
        message: `CRITICAL: Position ${watcher.symbol} ${setup.direction} has incomplete protection. SL: ${hasSL ? 'OK' : 'MISSING'}, TP: ${hasTP ? 'OK' : 'MISSING'}. Please add missing orders manually!`,
        data: {
          reason: 'incomplete_protection_orders',
          side: setup.direction,
          hasSL,
          hasTP,
          stopLossAlgoId,
          takeProfitAlgoId,
        },
        timestamp: Date.now(),
      });
    }
  }
}

export const protectionOrderHandler = new ProtectionOrderHandler();
