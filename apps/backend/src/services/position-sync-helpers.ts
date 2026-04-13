import type { OrphanedPositionEntry, UnknownPositionEntry, UpdatedPositionEntry } from '@marketmind/logger';
import { and, desc, eq, gte, isNotNull, or } from 'drizzle-orm';
import { db } from '../db';
import { orders, tradeExecutions } from '../db/schema';
import type { Wallet } from '../db/schema';
import { logger, serializeError } from './logger';
import { autoTradingService } from './auto-trading';

export interface SyncResult {
  walletId: string;
  synced: boolean;
  changes: {
    orphanedPositions: string[];
    unknownPositions: string[];
    updatedPositions: string[];
    balanceUpdated: boolean;
  };
  errors: string[];
  detailedOrphaned?: OrphanedPositionEntry[];
  detailedUnknown?: UnknownPositionEntry[];
  detailedUpdated?: UpdatedPositionEntry[];
}

export const createEmptySyncResult = (walletId: string): SyncResult => ({
  walletId,
  synced: true,
  changes: {
    orphanedPositions: [],
    unknownPositions: [],
    updatedPositions: [],
    balanceUpdated: false,
  },
  errors: [],
  detailedOrphaned: [],
  detailedUnknown: [],
  detailedUpdated: [],
});

export const createFailedSyncResult = (walletId: string, errorMsg: string): SyncResult => ({
  walletId,
  synced: false,
  changes: {
    orphanedPositions: [],
    unknownPositions: [],
    updatedPositions: [],
    balanceUpdated: false,
  },
  errors: [errorMsg],
});

export const processIntentOrderForAdoptedPosition = async (
  wallet: Wallet,
  symbol: string,
  side: 'LONG' | 'SHORT',
  positionAmt: number,
  executionId: string,
): Promise<void> => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const intentOrder = await db.query.orders.findFirst({
      where: and(
        eq(orders.walletId, wallet.id),
        eq(orders.symbol, symbol),
        eq(orders.side, side === 'LONG' ? 'BUY' : 'SELL'),
        or(isNotNull(orders.stopLossIntent), isNotNull(orders.takeProfitIntent)),
        gte(orders.createdAt, sevenDaysAgo),
      ),
      orderBy: [desc(orders.createdAt)],
    });

    if (!intentOrder) return;

    const qty = Math.abs(positionAmt);
    let stopLossAlgoId: string | null = null;
    let takeProfitAlgoId: string | null = null;
    let stopLossOrderId: string | null = null;
    let takeProfitOrderId: string | null = null;
    let stopLossIsAlgo = false;
    let takeProfitIsAlgo = false;

    if (intentOrder.stopLossIntent) {
      try {
        const slResult = await autoTradingService.createStopLossOrder(wallet, symbol, qty, parseFloat(intentOrder.stopLossIntent), side, 'FUTURES');
        if (slResult.isAlgoOrder) {
          stopLossAlgoId = slResult.algoId;
          stopLossIsAlgo = true;
        } else {
          stopLossOrderId = slResult.orderId;
        }
        logger.info({ executionId, symbol, stopLossIntent: intentOrder.stopLossIntent }, '[PositionSync] Placed SL from intent');
      } catch (slError) {
        logger.error({ executionId, symbol, error: serializeError(slError) }, '[PositionSync] Failed to place SL from intent');
      }
    }

    if (intentOrder.takeProfitIntent) {
      try {
        const tpResult = await autoTradingService.createTakeProfitOrder(wallet, symbol, qty, parseFloat(intentOrder.takeProfitIntent), side, 'FUTURES');
        if (tpResult.isAlgoOrder) {
          takeProfitAlgoId = tpResult.algoId;
          takeProfitIsAlgo = true;
        } else {
          takeProfitOrderId = tpResult.orderId;
        }
        logger.info({ executionId, symbol, takeProfitIntent: intentOrder.takeProfitIntent }, '[PositionSync] Placed TP from intent');
      } catch (tpError) {
        logger.error({ executionId, symbol, error: serializeError(tpError) }, '[PositionSync] Failed to place TP from intent');
      }
    }

    await db.update(tradeExecutions).set({
      stopLoss: intentOrder.stopLossIntent ?? undefined,
      takeProfit: intentOrder.takeProfitIntent ?? undefined,
      stopLossAlgoId,
      stopLossOrderId,
      takeProfitAlgoId,
      takeProfitOrderId,
      stopLossIsAlgo,
      takeProfitIsAlgo,
      updatedAt: new Date(),
    }).where(eq(tradeExecutions.id, executionId));

    await db.update(orders).set({
      stopLossIntent: null,
      takeProfitIntent: null,
    }).where(eq(orders.orderId, intentOrder.orderId));
  } catch (intentError) {
    logger.error({ executionId, symbol, error: serializeError(intentError) }, '[PositionSync] Failed to process intent order for adopted position');
  }
};
