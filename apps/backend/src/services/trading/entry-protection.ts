import type { MarketType, PositionSide, ProtectionMode } from '@marketmind/types';
import { ALGO_ORDER_DEFAULTS } from '../../constants/algo-orders';
import { db } from '../../db';
import { orders, type Wallet } from '../../db/schema';
import { getFuturesClient } from '../../exchange';
import { serializeError } from '../../utils/errors';
import { formatPriceForBinance, formatQuantityForBinance } from '../../utils/formatters';
import { logger } from '../logger';
import { getMinNotionalFilterService } from '../min-notional-filter';
import { createStopLossOrder, createTakeProfitOrder } from '../protection-orders';

type ProtectionLeg = 'STOP_LOSS' | 'TAKE_PROFIT';

export interface EntryProtectionRequest {
  wallet: Wallet;
  userId: string;
  symbol: string;
  side: PositionSide;
  quantity: number;
  marketType: MarketType;
  stopLoss?: string | null;
  takeProfit?: string | null;
  protectionMode: ProtectionMode;
}

export interface EntryProtectionIds {
  stopLossAlgoId: string | null;
  stopLossOrderId: string | null;
  stopLossIsAlgo: boolean;
  takeProfitAlgoId: string | null;
  takeProfitOrderId: string | null;
  takeProfitIsAlgo: boolean;
}

export interface EntryProtectionResult extends EntryProtectionIds {
  errors: string[];
}

const EMPTY_IDS: EntryProtectionIds = {
  stopLossAlgoId: null,
  stopLossOrderId: null,
  stopLossIsAlgo: false,
  takeProfitAlgoId: null,
  takeProfitOrderId: null,
  takeProfitIsAlgo: false,
};

const ALGO_TYPE_BY_LEG: Record<ProtectionLeg, 'STOP_MARKET' | 'TAKE_PROFIT_MARKET'> = {
  STOP_LOSS: 'STOP_MARKET',
  TAKE_PROFIT: 'TAKE_PROFIT_MARKET',
};

const legFailure = (leg: ProtectionLeg, error: unknown): string =>
  `${leg === 'STOP_LOSS' ? 'Stop loss' : 'Take profit'} was not placed: ${serializeError(error)}`;

const placeAttachedProtection = async (request: EntryProtectionRequest): Promise<EntryProtectionResult> => {
  const result: EntryProtectionResult = { ...EMPTY_IDS, errors: [] };
  const params = { wallet: request.wallet, symbol: request.symbol, side: request.side, quantity: request.quantity, marketType: request.marketType };

  if (request.stopLoss) {
    try {
      const stopLoss = await createStopLossOrder({ ...params, triggerPrice: parseFloat(request.stopLoss) });
      result.stopLossAlgoId = stopLoss.isAlgoOrder ? stopLoss.algoId ?? null : null;
      result.stopLossOrderId = stopLoss.isAlgoOrder ? null : stopLoss.orderId ?? null;
      result.stopLossIsAlgo = stopLoss.isAlgoOrder;
    } catch (error) {
      result.errors.push(legFailure('STOP_LOSS', error));
    }
  }

  if (request.takeProfit) {
    try {
      const takeProfit = await createTakeProfitOrder({ ...params, triggerPrice: parseFloat(request.takeProfit) });
      result.takeProfitAlgoId = takeProfit.isAlgoOrder ? takeProfit.algoId ?? null : null;
      result.takeProfitOrderId = takeProfit.isAlgoOrder ? null : takeProfit.orderId ?? null;
      result.takeProfitIsAlgo = takeProfit.isAlgoOrder;
    } catch (error) {
      result.errors.push(legFailure('TAKE_PROFIT', error));
    }
  }

  return result;
};

const placeIndependentLeg = async (request: EntryProtectionRequest, leg: ProtectionLeg, triggerPrice: string): Promise<void> => {
  const filters = (await getMinNotionalFilterService().getSymbolFilters(request.marketType)).get(request.symbol);
  const closeSide = request.side === 'LONG' ? 'SELL' : 'BUY';
  const algoOrder = await getFuturesClient(request.wallet).submitAlgoOrder({
    symbol: request.symbol,
    side: closeSide,
    type: ALGO_TYPE_BY_LEG[leg],
    triggerPrice: formatPriceForBinance(parseFloat(triggerPrice), filters?.tickSize?.toString()),
    quantity: formatQuantityForBinance(request.quantity, filters?.stepSize?.toString()),
    reduceOnly: true,
    workingType: ALGO_ORDER_DEFAULTS.workingType,
    priceProtect: ALGO_ORDER_DEFAULTS.priceProtect,
  });

  await db.insert(orders).values({
    orderId: algoOrder.algoId,
    userId: request.userId,
    walletId: request.wallet.id,
    symbol: algoOrder.symbol,
    side: algoOrder.side,
    type: algoOrder.type,
    price: algoOrder.triggerPrice ?? triggerPrice,
    origQty: algoOrder.quantity,
    executedQty: '0',
    status: 'NEW',
    time: algoOrder.createTime,
    updateTime: algoOrder.updateTime,
    marketType: request.marketType,
    reduceOnly: true,
  });
};

const placeIndependentProtection = async (request: EntryProtectionRequest): Promise<EntryProtectionResult> => {
  const result: EntryProtectionResult = { ...EMPTY_IDS, errors: [] };
  const legs: Array<[ProtectionLeg, string | null | undefined]> = [
    ['STOP_LOSS', request.stopLoss],
    ['TAKE_PROFIT', request.takeProfit],
  ];

  for (const [leg, triggerPrice] of legs) {
    if (!triggerPrice) continue;
    try {
      await placeIndependentLeg(request, leg, triggerPrice);
    } catch (error) {
      result.errors.push(legFailure(leg, error));
    }
  }

  return result;
};

export const placeEntryProtection = async (request: EntryProtectionRequest): Promise<EntryProtectionResult> => {
  if (!request.stopLoss && !request.takeProfit) return { ...EMPTY_IDS, errors: [] };

  const result = request.protectionMode === 'INDEPENDENT'
    ? await placeIndependentProtection(request)
    : await placeAttachedProtection(request);

  if (result.errors.length > 0) {
    logger.error({ symbol: request.symbol, walletId: request.wallet.id, errors: result.errors }, '[EntryProtection] Protection order placement failed');
  }

  return result;
};
