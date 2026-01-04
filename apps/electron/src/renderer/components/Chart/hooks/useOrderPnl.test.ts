import type { Order } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import { calculateOrderPnl, type PositionData } from './useOrderPnl';

const createMockOrder = (overrides: Partial<Order> = {}): Order => ({
  id: '1',
  symbol: 'BTCUSDT',
  side: 'BUY',
  type: 'LIMIT',
  status: 'FILLED',
  price: '100',
  quantity: '1',
  executedQty: '1',
  cummulativeQuoteQty: '100',
  timeInForce: 'GTC',
  time: Date.now(),
  updateTime: Date.now(),
  ...overrides,
});

describe('calculateOrderPnl', () => {
  describe('regular orders', () => {
    it('should calculate profit for long order when price goes up', () => {
      const order = createMockOrder({ side: 'BUY', price: '100', quantity: '1' });
      const result = calculateOrderPnl({ order, currentPrice: 110 });

      expect(result.pnl).toBe(10);
      expect(result.pnlPercent).toBe(10);
      expect(result.isProfitable).toBe(true);
    });

    it('should calculate loss for long order when price goes down', () => {
      const order = createMockOrder({ side: 'BUY', price: '100', quantity: '1' });
      const result = calculateOrderPnl({ order, currentPrice: 90 });

      expect(result.pnl).toBe(-10);
      expect(result.pnlPercent).toBe(-10);
      expect(result.isProfitable).toBe(false);
    });

    it('should calculate profit for short order when price goes down', () => {
      const order = createMockOrder({ side: 'SELL', price: '100', quantity: '1' });
      const result = calculateOrderPnl({ order, currentPrice: 90 });

      expect(result.pnl).toBe(10);
      expect(result.pnlPercent).toBe(10);
      expect(result.isProfitable).toBe(true);
    });

    it('should calculate loss for short order when price goes up', () => {
      const order = createMockOrder({ side: 'SELL', price: '100', quantity: '1' });
      const result = calculateOrderPnl({ order, currentPrice: 110 });

      expect(result.pnl).toBe(-10);
      expect(result.pnlPercent).toBe(-10);
      expect(result.isProfitable).toBe(false);
    });

    it('should handle zero P&L correctly', () => {
      const order = createMockOrder({ side: 'BUY', price: '100', quantity: '1' });
      const result = calculateOrderPnl({ order, currentPrice: 100 });

      expect(result.pnl).toBe(0);
      expect(result.pnlPercent).toBe(0);
      expect(result.isProfitable).toBe(true);
    });

    it('should scale P&L by quantity', () => {
      const order = createMockOrder({ side: 'BUY', price: '100', quantity: '5' });
      const result = calculateOrderPnl({ order, currentPrice: 110 });

      expect(result.pnl).toBe(50);
      expect(result.pnlPercent).toBe(10);
    });

    it('should handle fractional quantities', () => {
      const order = createMockOrder({ side: 'BUY', price: '100', quantity: '0.5' });
      const result = calculateOrderPnl({ order, currentPrice: 120 });

      expect(result.pnl).toBe(10);
      expect(result.pnlPercent).toBe(20);
    });

    it('should handle large price movements', () => {
      const order = createMockOrder({ side: 'BUY', price: '50000', quantity: '0.1' });
      const result = calculateOrderPnl({ order, currentPrice: 60000 });

      expect(result.pnl).toBe(1000);
      expect(result.pnlPercent).toBe(20);
    });
  });

  describe('positions', () => {
    it('should use positionData for P&L when isPosition is true', () => {
      const order = createMockOrder({ price: '100', quantity: '1' });
      const positionData: PositionData = {
        avgPrice: 100,
        totalQuantity: 2,
        totalPnL: 50,
      };

      const result = calculateOrderPnl({
        order,
        currentPrice: 125,
        isPosition: true,
        positionData,
      });

      expect(result.pnl).toBe(50);
      expect(result.pnlPercent).toBe(25);
      expect(result.isProfitable).toBe(true);
    });

    it('should handle negative position P&L', () => {
      const order = createMockOrder({ price: '100', quantity: '1' });
      const positionData: PositionData = {
        avgPrice: 100,
        totalQuantity: 2,
        totalPnL: -30,
      };

      const result = calculateOrderPnl({
        order,
        currentPrice: 85,
        isPosition: true,
        positionData,
      });

      expect(result.pnl).toBe(-30);
      expect(result.pnlPercent).toBe(-15);
      expect(result.isProfitable).toBe(false);
    });

    it('should handle zero position P&L', () => {
      const order = createMockOrder();
      const positionData: PositionData = {
        avgPrice: 100,
        totalQuantity: 1,
        totalPnL: 0,
      };

      const result = calculateOrderPnl({
        order,
        currentPrice: 100,
        isPosition: true,
        positionData,
      });

      expect(result.pnl).toBe(0);
      expect(result.pnlPercent).toBe(0);
      expect(result.isProfitable).toBe(true);
    });

    it('should fall back to regular calculation when positionData is null', () => {
      const order = createMockOrder({ side: 'BUY', price: '100', quantity: '1' });

      const result = calculateOrderPnl({
        order,
        currentPrice: 110,
        isPosition: true,
        positionData: null,
      });

      expect(result.pnl).toBe(10);
      expect(result.pnlPercent).toBe(10);
    });

    it('should fall back to regular calculation when isPosition is false', () => {
      const order = createMockOrder({ side: 'BUY', price: '100', quantity: '1' });
      const positionData: PositionData = {
        avgPrice: 100,
        totalQuantity: 2,
        totalPnL: 50,
      };

      const result = calculateOrderPnl({
        order,
        currentPrice: 110,
        isPosition: false,
        positionData,
      });

      expect(result.pnl).toBe(10);
      expect(result.pnlPercent).toBe(10);
    });

    it('should handle large position values', () => {
      const order = createMockOrder();
      const positionData: PositionData = {
        avgPrice: 50000,
        totalQuantity: 10,
        totalPnL: 100000,
      };

      const result = calculateOrderPnl({
        order,
        currentPrice: 60000,
        isPosition: true,
        positionData,
      });

      expect(result.pnl).toBe(100000);
      expect(result.pnlPercent).toBe(20);
    });
  });

  describe('edge cases', () => {
    it('should handle zero quantity', () => {
      const order = createMockOrder({ price: '100', quantity: '0' });
      const result = calculateOrderPnl({ order, currentPrice: 110 });

      expect(result.pnl).toBe(0);
      expect(result.pnlPercent).toBe(0);
    });

    it('should handle zero price', () => {
      const order = createMockOrder({ price: '0', quantity: '1' });
      const result = calculateOrderPnl({ order, currentPrice: 100 });

      expect(result.pnl).toBe(100);
      expect(result.pnlPercent).toBe(0);
    });

    it('should handle zero current price', () => {
      const order = createMockOrder({ side: 'BUY', price: '100', quantity: '1' });
      const result = calculateOrderPnl({ order, currentPrice: 0 });

      expect(result.pnl).toBe(-100);
      expect(result.pnlPercent).toBe(-100);
      expect(result.isProfitable).toBe(false);
    });

    it('should handle position with zero investment', () => {
      const order = createMockOrder();
      const positionData: PositionData = {
        avgPrice: 0,
        totalQuantity: 0,
        totalPnL: 0,
      };

      const result = calculateOrderPnl({
        order,
        currentPrice: 100,
        isPosition: true,
        positionData,
      });

      expect(result.pnl).toBe(0);
      expect(result.pnlPercent).toBe(0);
    });
  });
});
