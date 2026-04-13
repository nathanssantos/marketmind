import type { ScalpingSignal, ScalpingExecutionMode } from '@marketmind/types';
import { db } from '../../db';
import { tradeExecutions, type Wallet } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '../logger';
import { serializeError } from '../../utils/errors';
import { SCALPING_ENGINE } from '../../constants/scalping';
import { BinanceIpBannedError } from '../binance-api-cache';
import { updateStopLossOrder } from '../protection-orders';
import { walletQueries } from '../database/walletQueries';
import { getMinNotionalFilterService } from '../min-notional-filter';
import type { OrderParams } from '../auto-trading';

export const buildOrderParams = (
  executionMode: ScalpingExecutionMode,
  signal: ScalpingSignal,
  side: 'BUY' | 'SELL',
  quantity: number,
): OrderParams => {
  switch (executionMode) {
    case 'POST_ONLY':
      return {
        symbol: signal.symbol,
        side,
        type: 'LIMIT',
        quantity,
        price: signal.entryPrice,
        timeInForce: 'GTC',
      };
    case 'IOC':
      return {
        symbol: signal.symbol,
        side,
        type: 'MARKET',
        quantity,
        timeInForce: 'IOC',
      };
    case 'MARKET':
    default:
      return {
        symbol: signal.symbol,
        side,
        type: 'MARKET',
        quantity,
      };
  }
};

export interface MicroTrailingState {
  activePositions: Map<string, string>;
  lastTrailingUpdate: Map<string, number>;
  trailingInFlight: Set<string>;
  trailingErrorCount: Map<string, number>;
  symbolTickSizes: Map<string, number>;
}

export const checkMicroTrailing = async (
  symbol: string,
  currentPrice: number,
  config: { walletId: string; userId: string; microTrailingTicks: number },
  state: MicroTrailingState,
): Promise<void> => {
  if (config.microTrailingTicks <= 0) return;

  const executionId = state.activePositions.get(symbol);
  if (!executionId) return;

  if (state.trailingInFlight.has(symbol)) return;

  const now = Date.now();
  const lastUpdate = state.lastTrailingUpdate.get(symbol) ?? 0;
  if (now - lastUpdate < SCALPING_ENGINE.MICRO_TRAILING_MIN_INTERVAL_MS) return;

  state.trailingInFlight.add(symbol);
  try {
    const execution = await db.query.tradeExecutions.findFirst({
      where: and(
        eq(tradeExecutions.id, executionId),
        eq(tradeExecutions.walletId, config.walletId),
      ),
    });

    if (!state.activePositions.has(symbol)) return;

    if (!execution || execution.status !== 'open') {
      if (!execution) {
        state.activePositions.delete(symbol);
        logger.warn({ symbol, executionId }, 'Stale execution in micro-trailing, cleaned up');
      }
      return;
    }

    let tickSize = state.symbolTickSizes.get(symbol);
    if (tickSize === undefined) {
      const filterService = getMinNotionalFilterService();
      const filters = await filterService.getSymbolFilters('FUTURES');
      const symbolFilters = filters.get(symbol);
      tickSize = symbolFilters?.tickSize ?? SCALPING_ENGINE.DEFAULT_TICK_SIZE;
      state.symbolTickSizes.set(symbol, tickSize);
    }

    const currentSL = parseFloat(execution.stopLoss ?? '0');
    if (currentSL <= 0) return;

    const trailingDistance = config.microTrailingTicks * tickSize;
    const side = execution.side as 'LONG' | 'SHORT';

    let newSL: number;
    if (side === 'LONG') {
      newSL = currentPrice - trailingDistance;
      if (newSL <= currentSL) return;
    } else {
      newSL = currentPrice + trailingDistance;
      if (newSL >= currentSL) return;
    }

    state.lastTrailingUpdate.set(symbol, now);

    const wallet = await walletQueries.getByIdAndUser(config.walletId, config.userId);
    const quantity = parseFloat(execution.quantity);

    const result = await updateStopLossOrder({
      wallet: wallet as Wallet,
      symbol,
      side,
      quantity,
      triggerPrice: newSL,
      marketType: 'FUTURES',
      currentAlgoId: execution.stopLossAlgoId,
      currentOrderId: execution.stopLossOrderId,
    });

    await db.update(tradeExecutions)
      .set({
        stopLoss: String(newSL),
        stopLossAlgoId: result.algoId ?? null,
        stopLossOrderId: result.orderId ?? null,
        stopLossIsAlgo: !!result.algoId,
      })
      .where(eq(tradeExecutions.id, executionId));

    state.trailingErrorCount.delete(symbol);
    logger.debug({ symbol, oldSL: currentSL, newSL, tickSize, ticks: config.microTrailingTicks }, 'Micro-trailing SL updated');
  } catch (error) {
    const errorCount = (state.trailingErrorCount.get(symbol) ?? 0) + 1;
    state.trailingErrorCount.set(symbol, errorCount);

    if (error instanceof BinanceIpBannedError) {
      state.lastTrailingUpdate.set(symbol, now + SCALPING_ENGINE.IP_BAN_PAUSE_MS);
      logger.error({ symbol }, 'IP banned — micro-trailing paused for 5 minutes');
      return;
    }

    const backoffMs = Math.min(
      SCALPING_ENGINE.MICRO_TRAILING_ERROR_BACKOFF_MS * Math.pow(2, errorCount - 1),
      SCALPING_ENGINE.MICRO_TRAILING_MAX_BACKOFF_MS,
    );
    state.lastTrailingUpdate.set(symbol, now + backoffMs);
    logger.error({ error: serializeError(error), symbol, backoffMs, errorCount }, 'Failed to update micro-trailing SL');
  } finally {
    state.trailingInFlight.delete(symbol);
  }
};
