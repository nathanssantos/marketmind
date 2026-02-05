import { IB_ORDER_TYPES, IB_ORDER_ACTIONS, IB_TIME_IN_FORCE } from './constants';
import type { IBOrderParams, IBStockContract } from './types';

export interface TrailingStopConfig {
  trailingType: 'PERCENT' | 'AMOUNT';
  trailingValue: number;
  auxPrice?: number;
}

export interface CreateTrailingStopParams {
  symbol: string;
  side: 'LONG' | 'SHORT';
  quantity: number;
  trailPercent?: number;
  trailAmount?: number;
  initialStopPrice?: number;
  outsideRth?: boolean;
}

export interface TrailingStopResult {
  orderParams: IBOrderParams;
  trailingType: 'PERCENT' | 'AMOUNT';
  trailingValue: number;
}

export const createTrailingStopOrderParams = (params: CreateTrailingStopParams): TrailingStopResult => {
  const {
    symbol,
    side,
    quantity,
    trailPercent,
    trailAmount,
    initialStopPrice,
    outsideRth = true,
  } = params;

  const action = side === 'LONG' ? IB_ORDER_ACTIONS.SELL : IB_ORDER_ACTIONS.BUY;
  const trailingType: 'PERCENT' | 'AMOUNT' = trailPercent !== undefined ? 'PERCENT' : 'AMOUNT';
  const trailingValue = trailingType === 'PERCENT' ? (trailPercent ?? 1) : (trailAmount ?? 1);

  const contract: IBStockContract = {
    symbol,
    secType: 'STK' as any,
    exchange: 'SMART',
    currency: 'USD',
  };

  const orderParams: IBOrderParams = {
    contract,
    action,
    orderType: IB_ORDER_TYPES.TRAILING_STOP,
    totalQuantity: quantity,
    tif: IB_TIME_IN_FORCE.GTC,
    outsideRth,
    transmit: true,
  };

  if (trailingType === 'PERCENT') {
    orderParams.trailingPercent = trailingValue;
  } else {
    orderParams.auxPrice = trailingValue;
  }

  if (initialStopPrice !== undefined) {
    orderParams.trailStopPrice = initialStopPrice;
  }

  return {
    orderParams,
    trailingType,
    trailingValue,
  };
};

export const calculateTrailingDistance = (
  entryPrice: number,
  distancePercent: number,
  side: 'LONG' | 'SHORT'
): { stopPrice: number; trailAmount: number } => {
  const trailAmount = entryPrice * (distancePercent / 100);
  const stopPrice = side === 'LONG'
    ? entryPrice - trailAmount
    : entryPrice + trailAmount;

  return { stopPrice, trailAmount };
};

export const convertToIBTrailingPercent = (marketmindPercent: number): number => {
  return marketmindPercent * 100;
};

export const convertFromIBTrailingPercent = (ibPercent: number): number => {
  return ibPercent / 100;
};

export interface TrailingStopUpdate {
  orderId: number;
  newTrailPercent?: number;
  newTrailAmount?: number;
  newAuxPrice?: number;
}

export const createModifyTrailingStopParams = (
  _existingOrderId: number,
  existingParams: IBOrderParams,
  update: Partial<TrailingStopUpdate>
): IBOrderParams => {
  const modifiedParams = { ...existingParams };

  if (update.newTrailPercent !== undefined) {
    modifiedParams.trailingPercent = update.newTrailPercent;
    delete modifiedParams.auxPrice;
  }

  if (update.newTrailAmount !== undefined) {
    modifiedParams.auxPrice = update.newTrailAmount;
    delete modifiedParams.trailingPercent;
  }

  if (update.newAuxPrice !== undefined) {
    modifiedParams.trailStopPrice = update.newAuxPrice;
  }

  return modifiedParams;
};

export const shouldUseNativeTrailing = (exchange: string): boolean => {
  return exchange === 'INTERACTIVE_BROKERS';
};

export const mapMarketMindTrailingToIB = (
  entryPrice: number,
  currentPrice: number,
  side: 'LONG' | 'SHORT',
  activationPercent: number,
  distancePercent: number
): { trailPercent: number; initialStopPrice: number } | null => {
  const profitPercent = side === 'LONG'
    ? ((currentPrice - entryPrice) / entryPrice) * 100
    : ((entryPrice - currentPrice) / entryPrice) * 100;

  if (profitPercent < activationPercent) {
    return null;
  }

  const peakPrice = side === 'LONG' ? currentPrice : currentPrice;
  const trailDistance = peakPrice * (distancePercent / 100);
  const initialStopPrice = side === 'LONG'
    ? peakPrice - trailDistance
    : peakPrice + trailDistance;

  return {
    trailPercent: distancePercent,
    initialStopPrice,
  };
};
