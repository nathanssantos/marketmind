import type { Order, OrderSide, OrderStatus } from '@marketmind/types';
import { parsePrice, parseQty } from './priceUtils';

export const getOrderId = (order: Order): string => 
  order.id ?? order.clientOrderId;

export const getOrderSide = (order: Order): OrderSide => 
  order.side ?? (order.orderDirection === 'long' ? 'BUY' : 'SELL');

export const getOrderStatus = (order: Order): OrderStatus => 
  order.status;

export const getOrderPrice = (order: Order): number => 
  order.entryPrice ?? parsePrice(order.price);

export const getOrderQuantity = (order: Order): number => 
  order.quantity ?? parseQty(order.origQty);

export const getOrderCreatedAt = (order: Order): Date => 
  order.createdAt ?? new Date(order.time);

export const isOrderLong = (order: Order): boolean => 
  order.orderDirection === 'long' || order.side === 'BUY';

export const isOrderShort = (order: Order): boolean => 
  order.orderDirection === 'short' || order.side === 'SELL';

export const isOrderPending = (order: Order): boolean => 
  order.status === 'NEW' || order.status === 'PENDING_NEW';

export const isOrderActive = (order: Order): boolean => 
  !order.closedAt && (order.status === 'FILLED' || order.status === 'PARTIALLY_FILLED');

export const isOrderClosed = (order: Order): boolean =>
  !!order.closedAt || order.status === 'CANCELED' || order.status === 'EXPIRED' || order.status === 'EXPIRED_IN_MATCH';

export const getOrderType = (order: Order): 'long' | 'short' => {
  if (order.orderDirection === 'long' || order.orderDirection === 'short') return order.orderDirection;
  return order.side === 'BUY' ? 'long' : 'short';
};
