import type { Order } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import {
  getOrderCreatedAt,
  getOrderId,
  getOrderPrice,
  getOrderQuantity,
  getOrderSide,
  getOrderStatus,
  getOrderType,
  isOrderActive,
  isOrderClosed,
  isOrderLong,
  isOrderPending,
  isOrderShort,
} from './orderUtils';

const createOrder = (overrides: Partial<Order> = {}): Order =>
  ({
    id: 'order-123',
    clientOrderId: 'client-order-123',
    symbol: 'BTCUSDT',
    side: 'BUY',
    status: 'NEW',
    price: '42000',
    origQty: '1',
    time: 1700000000000,
    entryPrice: 42000,
    quantity: 1,
    orderDirection: 'long',
    createdAt: new Date(1700000000000),
    ...overrides,
  }) as Order;

describe('orderUtils', () => {
  describe('getOrderId', () => {
    it('should return id when available', () => {
      const order = createOrder({ id: 'order-123' });
      expect(getOrderId(order)).toBe('order-123');
    });

    it('should return clientOrderId when id is not available', () => {
      const order = createOrder({ id: undefined, clientOrderId: 'client-123' });
      expect(getOrderId(order)).toBe('client-123');
    });
  });

  describe('getOrderSide', () => {
    it('should return side when available', () => {
      const order = createOrder({ side: 'SELL' });
      expect(getOrderSide(order)).toBe('SELL');
    });

    it('should return BUY for long direction', () => {
      const order = createOrder({ side: undefined, orderDirection: 'long' });
      expect(getOrderSide(order)).toBe('BUY');
    });

    it('should return SELL for short direction', () => {
      const order = createOrder({ side: undefined, orderDirection: 'short' });
      expect(getOrderSide(order)).toBe('SELL');
    });
  });

  describe('getOrderStatus', () => {
    it('should return order status', () => {
      const order = createOrder({ status: 'FILLED' });
      expect(getOrderStatus(order)).toBe('FILLED');
    });
  });

  describe('getOrderPrice', () => {
    it('should return entryPrice when available', () => {
      const order = createOrder({ entryPrice: 42500, price: '42000' });
      expect(getOrderPrice(order)).toBe(42500);
    });

    it('should parse price string when entryPrice is not available', () => {
      const order = createOrder({ entryPrice: undefined, price: '42000' });
      expect(getOrderPrice(order)).toBe(42000);
    });
  });

  describe('getOrderQuantity', () => {
    it('should return quantity when available', () => {
      const order = createOrder({ quantity: 1.5, origQty: '1' });
      expect(getOrderQuantity(order)).toBe(1.5);
    });

    it('should parse origQty when quantity is not available', () => {
      const order = createOrder({ quantity: undefined, origQty: '2.5' });
      expect(getOrderQuantity(order)).toBe(2.5);
    });
  });

  describe('getOrderCreatedAt', () => {
    it('should return createdAt when available', () => {
      const date = new Date(1700000000000);
      const order = createOrder({ createdAt: date });
      expect(getOrderCreatedAt(order)).toEqual(date);
    });

    it('should create date from time when createdAt is not available', () => {
      const order = createOrder({ createdAt: undefined, time: 1700000000000 });
      expect(getOrderCreatedAt(order)).toEqual(new Date(1700000000000));
    });
  });

  describe('isOrderLong', () => {
    it('should return true for long direction', () => {
      const order = createOrder({ orderDirection: 'long' });
      expect(isOrderLong(order)).toBe(true);
    });

    it('should return true for BUY side', () => {
      const order = createOrder({ orderDirection: undefined, side: 'BUY' });
      expect(isOrderLong(order)).toBe(true);
    });

    it('should return false for short direction', () => {
      const order = createOrder({ orderDirection: 'short', side: 'SELL' });
      expect(isOrderLong(order)).toBe(false);
    });
  });

  describe('isOrderShort', () => {
    it('should return true for short direction', () => {
      const order = createOrder({ orderDirection: 'short' });
      expect(isOrderShort(order)).toBe(true);
    });

    it('should return true for SELL side', () => {
      const order = createOrder({ orderDirection: undefined, side: 'SELL' });
      expect(isOrderShort(order)).toBe(true);
    });

    it('should return false for long direction', () => {
      const order = createOrder({ orderDirection: 'long', side: 'BUY' });
      expect(isOrderShort(order)).toBe(false);
    });
  });

  describe('isOrderPending', () => {
    it('should return true for NEW status', () => {
      const order = createOrder({ status: 'NEW' });
      expect(isOrderPending(order)).toBe(true);
    });

    it('should return true for PENDING_NEW status', () => {
      const order = createOrder({ status: 'PENDING_NEW' });
      expect(isOrderPending(order)).toBe(true);
    });

    it('should return false for FILLED status', () => {
      const order = createOrder({ status: 'FILLED' });
      expect(isOrderPending(order)).toBe(false);
    });

    it('should return false for CANCELED status', () => {
      const order = createOrder({ status: 'CANCELED' });
      expect(isOrderPending(order)).toBe(false);
    });
  });

  describe('isOrderActive', () => {
    it('should return true for FILLED status without closedAt', () => {
      const order = createOrder({ status: 'FILLED', closedAt: undefined });
      expect(isOrderActive(order)).toBe(true);
    });

    it('should return true for PARTIALLY_FILLED status without closedAt', () => {
      const order = createOrder({ status: 'PARTIALLY_FILLED', closedAt: undefined });
      expect(isOrderActive(order)).toBe(true);
    });

    it('should return false when closedAt is set', () => {
      const order = createOrder({ status: 'FILLED', closedAt: new Date() });
      expect(isOrderActive(order)).toBe(false);
    });

    it('should return false for NEW status', () => {
      const order = createOrder({ status: 'NEW', closedAt: undefined });
      expect(isOrderActive(order)).toBe(false);
    });
  });

  describe('isOrderClosed', () => {
    it('should return true when closedAt is set', () => {
      const order = createOrder({ closedAt: new Date(), status: 'FILLED' });
      expect(isOrderClosed(order)).toBe(true);
    });

    it('should return true for CANCELED status', () => {
      const order = createOrder({ status: 'CANCELED', closedAt: undefined });
      expect(isOrderClosed(order)).toBe(true);
    });

    it('should return true for EXPIRED status', () => {
      const order = createOrder({ status: 'EXPIRED', closedAt: undefined });
      expect(isOrderClosed(order)).toBe(true);
    });

    it('should return true for EXPIRED_IN_MATCH status', () => {
      const order = createOrder({ status: 'EXPIRED_IN_MATCH', closedAt: undefined });
      expect(isOrderClosed(order)).toBe(true);
    });

    it('should return false for NEW status without closedAt', () => {
      const order = createOrder({ status: 'NEW', closedAt: undefined });
      expect(isOrderClosed(order)).toBe(false);
    });

    it('should return false for FILLED status without closedAt', () => {
      const order = createOrder({ status: 'FILLED', closedAt: undefined });
      expect(isOrderClosed(order)).toBe(false);
    });
  });

  describe('getOrderType', () => {
    it('should return long for long direction', () => {
      const order = createOrder({ orderDirection: 'long' });
      expect(getOrderType(order)).toBe('long');
    });

    it('should return short for short direction', () => {
      const order = createOrder({ orderDirection: 'short' });
      expect(getOrderType(order)).toBe('short');
    });

    it('should return long for BUY side when direction not set', () => {
      const order = createOrder({ orderDirection: undefined, side: 'BUY' });
      expect(getOrderType(order)).toBe('long');
    });

    it('should return short for SELL side when direction not set', () => {
      const order = createOrder({ orderDirection: undefined, side: 'SELL' });
      expect(getOrderType(order)).toBe('short');
    });
  });
});
