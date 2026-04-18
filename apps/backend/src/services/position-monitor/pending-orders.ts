import type { PendingOrderAction, PendingOrdersCheckResult } from '@marketmind/logger';
import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { tradeExecutions } from '../../db/schema';
import { serializeError } from '../../utils/errors';
import { formatPrice } from '../../utils/formatters';
import { priceCache } from '../price-cache';
import { outputPendingOrdersCheckResults } from '../watcher-batch-logger';
import { getWebSocketService } from '../websocket';
import { getCurrentPrice } from './price-service';

export const checkPendingOrders = async (): Promise<void> => {
  const pendingExecutions = await db
    .select()
    .from(tradeExecutions)
    .where(eq(tradeExecutions.status, 'pending'));

  if (pendingExecutions.length === 0) return;

  const startTime = new Date();
  const actions: PendingOrderAction[] = [];
  const now = new Date();

  const symbolsToFetch = pendingExecutions
    .filter(e => e.limitEntryPrice && (!e.expiresAt || e.expiresAt >= now))
    .map(e => ({
      symbol: e.symbol,
      marketType: e.marketType === 'FUTURES' ? 'FUTURES' as const : 'SPOT' as const,
    }));

  const uniqueSymbols = Array.from(
    new Map(symbolsToFetch.map(s => [`${s.symbol}-${s.marketType}`, s])).values()
  );

  const priceMap = uniqueSymbols.length > 0
    ? await priceCache.batchFetch(uniqueSymbols)
    : new Map<string, number>();

  for (const execution of pendingExecutions) {
    try {
      if (execution.expiresAt && execution.expiresAt < now) {
        actions.push({
          executionId: execution.id,
          symbol: execution.symbol,
          side: execution.side,
          action: 'EXPIRED',
          limitPrice: execution.limitEntryPrice ? parseFloat(execution.limitEntryPrice) : null,
          expiresAt: execution.expiresAt,
        });

        await db
          .update(tradeExecutions)
          .set({
            status: 'cancelled',
            exitReason: 'LIMIT_EXPIRED',
            closedAt: now,
            updatedAt: now,
          })
          .where(eq(tradeExecutions.id, execution.id));

        const wsService = getWebSocketService();
        if (wsService) {
          wsService.emitPositionUpdate(execution.walletId, {
            ...execution,
            status: 'cancelled',
            exitReason: 'LIMIT_EXPIRED',
          });
        }

        continue;
      }

      if (!execution.limitEntryPrice) {
        actions.push({
          executionId: execution.id,
          symbol: execution.symbol,
          side: execution.side,
          action: 'INVALID',
          limitPrice: null,
          error: 'Missing limit price',
        });

        await db
          .update(tradeExecutions)
          .set({
            status: 'cancelled',
            exitReason: 'INVALID_ORDER',
            closedAt: now,
            updatedAt: now,
          })
          .where(eq(tradeExecutions.id, execution.id));

        const wsServiceInvalid = getWebSocketService();
        if (wsServiceInvalid) {
          wsServiceInvalid.emitPositionUpdate(execution.walletId, {
            ...execution,
            status: 'cancelled',
            exitReason: 'INVALID_ORDER',
          });
        }

        continue;
      }

      if (execution.entryOrderType === 'STOP_MARKET' || execution.entryOrderType === 'TAKE_PROFIT_MARKET') continue;

      const marketType = (execution.marketType === 'FUTURES' ? 'FUTURES' : 'SPOT');
      const priceKey = `${execution.symbol}-${marketType}`;
      const currentPrice = priceMap.get(priceKey) ?? await getCurrentPrice(execution.symbol, marketType);
      const limitPrice = parseFloat(execution.limitEntryPrice);
      const isLong = execution.side === 'LONG';

      const shouldFill = isLong
        ? currentPrice <= limitPrice
        : currentPrice >= limitPrice;

      if (shouldFill) {
        actions.push({
          executionId: execution.id,
          symbol: execution.symbol,
          side: execution.side,
          action: 'FILLED',
          limitPrice,
          currentPrice,
        });

        await db
          .update(tradeExecutions)
          .set({
            status: 'open',
            entryPrice: currentPrice.toString(),
            openedAt: now,
            updatedAt: now,
          })
          .where(eq(tradeExecutions.id, execution.id));

        const wsServiceFill = getWebSocketService();
        if (wsServiceFill) {
          const side = execution.side;
          const sideLabel = side === 'LONG' ? 'Long' : 'Short';

          wsServiceFill.emitTradeNotification(execution.walletId, {
            type: 'LIMIT_FILLED',
            title: 'Limit Order Filled',
            body: `${sideLabel} ${execution.symbol} @ ${formatPrice(currentPrice)}`,
            urgency: 'normal',
            data: {
              executionId: execution.id,
              symbol: execution.symbol,
              side,
              entryPrice: currentPrice.toString(),
            },
          });

          wsServiceFill.emitPositionUpdate(execution.walletId, {
            ...execution,
            status: 'open',
            entryPrice: currentPrice.toString(),
          });
        }
      } else {
        actions.push({
          executionId: execution.id,
          symbol: execution.symbol,
          side: execution.side,
          action: 'PENDING',
          limitPrice,
          currentPrice,
        });
      }
    } catch (error) {
      actions.push({
        executionId: execution.id,
        symbol: execution.symbol,
        side: execution.side,
        action: 'ERROR',
        limitPrice: execution.limitEntryPrice ? parseFloat(execution.limitEntryPrice) : null,
        error: serializeError(error),
      });
    }
  }

  const result: PendingOrdersCheckResult = {
    startTime,
    endTime: new Date(),
    totalChecked: pendingExecutions.length,
    expiredCount: actions.filter(a => a.action === 'EXPIRED').length,
    invalidCount: actions.filter(a => a.action === 'INVALID').length,
    filledCount: actions.filter(a => a.action === 'FILLED').length,
    pendingCount: actions.filter(a => a.action === 'PENDING').length,
    errorCount: actions.filter(a => a.action === 'ERROR').length,
    actions,
  };

  outputPendingOrdersCheckResults(result);
};
