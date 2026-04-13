import type { MarketType, Order } from '@marketmind/types';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { roundTradingPrice, roundTradingQty } from '@shared/utils';
import type { MutableRefObject } from 'react';
import type { BackendExecution } from '../useOrderLinesRenderer';

export interface OptimisticEntryParams {
  symbol: string;
  side: 'LONG' | 'SHORT';
  price: number;
  marketType: MarketType;
  getOrderQuantity: (price: number) => string;
  setOptimisticExecutions: React.Dispatch<React.SetStateAction<BackendExecution[]>>;
  orderLoadingMapRef: MutableRefObject<Map<string, number>>;
  manager: CanvasManager | null;
}

export const createOptimisticEntry = ({
  symbol,
  side,
  price,
  marketType,
  getOrderQuantity,
  setOptimisticExecutions,
  orderLoadingMapRef,
  manager,
}: OptimisticEntryParams): string => {
  const optimisticId = `opt-${Date.now()}`;

  setOptimisticExecutions(prev => [...prev, {
    id: optimisticId,
    symbol,
    side,
    entryPrice: roundTradingPrice(price),
    quantity: getOrderQuantity(price),
    stopLoss: null,
    takeProfit: null,
    status: 'pending',
    setupType: null,
    marketType,
    openedAt: new Date(),
    triggerKlineOpenTime: null,
    fibonacciProjection: null,
  }]);
  orderLoadingMapRef.current.set(optimisticId, Date.now());
  manager?.markDirty('overlays');

  return optimisticId;
};

export interface SubmitEntryOrderParams {
  backendWalletId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  price: number;
  marketPrice: number;
  quantity: string;
  reduceOnly: boolean;
  addBackendOrder: (params: {
    walletId: string;
    symbol: string;
    side: 'BUY' | 'SELL';
    type: 'LIMIT' | 'STOP_MARKET';
    price?: string;
    stopPrice?: string;
    quantity: string;
    reduceOnly?: boolean;
    marketType?: MarketType;
  }) => Promise<unknown>;
}

export const submitEntryOrder = async ({
  backendWalletId,
  symbol,
  side,
  price,
  marketPrice,
  quantity,
  reduceOnly,
  addBackendOrder,
}: SubmitEntryOrderParams): Promise<void> => {
  const isBuy = side === 'BUY';
  const isAboveMarket = marketPrice > 0 && price > marketPrice;
  const isBelowMarket = marketPrice > 0 && price < marketPrice;
  const useStopMarket = isBuy ? isAboveMarket : isBelowMarket;

  await addBackendOrder({
    walletId: backendWalletId,
    symbol,
    side,
    type: useStopMarket ? 'STOP_MARKET' : 'LIMIT',
    price: useStopMarket ? undefined : roundTradingPrice(price),
    stopPrice: useStopMarket ? roundTradingPrice(price) : undefined,
    quantity,
    reduceOnly,
  });
};

export const mapExecutionToOrder = (exec: BackendExecution, backendWalletId: string): Order => ({
  id: exec.id,
  symbol: exec.symbol,
  orderId: '0',
  orderListId: '-1',
  clientOrderId: exec.id,
  price: exec.entryPrice,
  origQty: exec.quantity,
  executedQty: exec.status === 'pending' ? '0' : exec.quantity,
  cummulativeQuoteQty: '0',
  status: exec.status === 'pending' ? 'NEW' as const : 'FILLED' as const,
  timeInForce: 'GTC' as const,
  type: (exec.entryOrderType ?? (exec.status === 'pending' ? 'LIMIT' : 'MARKET')) as Order['type'],
  side: exec.side === 'LONG' ? 'BUY' : 'SELL',
  time: Date.now(),
  updateTime: Date.now(),
  isWorking: true,
  origQuoteOrderQty: '0',
  entryPrice: parseFloat(exec.entryPrice),
  quantity: parseFloat(exec.quantity),
  orderDirection: exec.side === 'LONG' ? 'long' : 'short',
  stopLoss: exec.stopLoss ? parseFloat(exec.stopLoss) : undefined,
  takeProfit: exec.takeProfit ? parseFloat(exec.takeProfit) : undefined,
  isAutoTrade: !!exec.setupType,
  walletId: backendWalletId,
  setupType: exec.setupType ?? undefined,
  isPendingLimitOrder: exec.status === 'pending',
} as Order);

export const getOrderQuantity = (
  price: number,
  activeWalletBalance: string | undefined,
  quickTradeSizePercent: number,
): string => {
  const balance = parseFloat(activeWalletBalance ?? '0');
  const pct = quickTradeSizePercent / 100;
  const qty = balance > 0 && price > 0 ? (balance * pct) / price : 1;
  return roundTradingQty(qty);
};
