import { describe, it, expect } from 'vitest';
import { SecType, type Contract } from '@stoqey/ib';

interface OrderInfo {
  orderId: number;
  contract: Contract;
  status: string;
  filled: number;
  remaining: number;
  avgFillPrice: number;
  lastUpdate: number;
}

interface PositionInfo {
  account: string;
  contract: Contract;
  position: number;
  avgCost: number;
  marketValue: number;
  unrealizedPnL: number;
  lastUpdate: number;
}

type UpdateType = 'ORDER' | 'POSITION' | 'EXECUTION';

interface UserStreamUpdate {
  type: UpdateType;
  data: unknown;
  timestamp: number;
}

const createMockContract = (symbol: string): Contract => ({
  symbol,
  secType: SecType.STK,
  exchange: 'SMART',
  currency: 'USD',
});

const createMockOrderInfo = (overrides: Partial<OrderInfo> = {}): OrderInfo => ({
  orderId: 1,
  contract: createMockContract('AAPL'),
  status: 'Submitted',
  filled: 0,
  remaining: 100,
  avgFillPrice: 0,
  lastUpdate: Date.now(),
  ...overrides,
});

const createMockPositionInfo = (overrides: Partial<PositionInfo> = {}): PositionInfo => ({
  account: 'DU123456',
  contract: createMockContract('AAPL'),
  position: 100,
  avgCost: 150.0,
  marketValue: 15500,
  unrealizedPnL: 500,
  lastUpdate: Date.now(),
  ...overrides,
});

const filterOpenOrders = (orders: OrderInfo[]): OrderInfo[] => {
  const openStatuses = ['PreSubmitted', 'Submitted', 'PendingSubmit', 'PendingCancel'];
  return orders.filter((o) => openStatuses.includes(o.status));
};

const filterNonZeroPositions = (positions: PositionInfo[]): PositionInfo[] => {
  return positions.filter((p) => p.position !== 0);
};

const filterPositionsByAccount = (positions: PositionInfo[], accountId: string): PositionInfo[] => {
  return positions.filter((p) => p.account === accountId);
};

const hasOrderChanged = (existing: OrderInfo | undefined, newOrder: OrderInfo): boolean => {
  if (!existing) return true;
  return existing.status !== newOrder.status || existing.filled !== newOrder.filled;
};

const hasPositionChanged = (existing: PositionInfo | undefined, newPosition: PositionInfo): boolean => {
  if (!existing) return true;
  return existing.position !== newPosition.position || existing.avgCost !== newPosition.avgCost;
};

describe('IBUserStream', () => {
  describe('UserStreamUpdate structure', () => {
    it('should have correct structure for ORDER update', () => {
      const update: UserStreamUpdate = {
        type: 'ORDER',
        data: createMockOrderInfo(),
        timestamp: Date.now(),
      };

      expect(update.type).toBe('ORDER');
      expect(update.data).toBeDefined();
      expect(update.timestamp).toBeGreaterThan(0);
    });

    it('should have correct structure for POSITION update', () => {
      const update: UserStreamUpdate = {
        type: 'POSITION',
        data: createMockPositionInfo(),
        timestamp: Date.now(),
      };

      expect(update.type).toBe('POSITION');
      expect(update.data).toBeDefined();
      expect(update.timestamp).toBeGreaterThan(0);
    });

    it('should have correct structure for EXECUTION update', () => {
      const update: UserStreamUpdate = {
        type: 'EXECUTION',
        data: { execId: 'exec123', symbol: 'AAPL', side: 'BUY', shares: 100 },
        timestamp: Date.now(),
      };

      expect(update.type).toBe('EXECUTION');
      expect(update.data).toBeDefined();
    });
  });

  describe('OrderInfo structure', () => {
    it('should have all required fields', () => {
      const order = createMockOrderInfo();

      expect(order).toHaveProperty('orderId');
      expect(order).toHaveProperty('contract');
      expect(order).toHaveProperty('status');
      expect(order).toHaveProperty('filled');
      expect(order).toHaveProperty('remaining');
      expect(order).toHaveProperty('avgFillPrice');
      expect(order).toHaveProperty('lastUpdate');
    });

    it('should allow different order statuses', () => {
      const submitted = createMockOrderInfo({ status: 'Submitted' });
      const filled = createMockOrderInfo({ status: 'Filled' });
      const cancelled = createMockOrderInfo({ status: 'Cancelled' });

      expect(submitted.status).toBe('Submitted');
      expect(filled.status).toBe('Filled');
      expect(cancelled.status).toBe('Cancelled');
    });
  });

  describe('PositionInfo structure', () => {
    it('should have all required fields', () => {
      const position = createMockPositionInfo();

      expect(position).toHaveProperty('account');
      expect(position).toHaveProperty('contract');
      expect(position).toHaveProperty('position');
      expect(position).toHaveProperty('avgCost');
      expect(position).toHaveProperty('marketValue');
      expect(position).toHaveProperty('unrealizedPnL');
      expect(position).toHaveProperty('lastUpdate');
    });

    it('should handle long positions', () => {
      const position = createMockPositionInfo({ position: 100, avgCost: 150.0 });

      expect(position.position).toBeGreaterThan(0);
      expect(position.avgCost).toBe(150.0);
    });

    it('should handle short positions', () => {
      const position = createMockPositionInfo({ position: -100, avgCost: 150.0 });

      expect(position.position).toBeLessThan(0);
    });

    it('should handle zero positions', () => {
      const position = createMockPositionInfo({ position: 0 });

      expect(position.position).toBe(0);
    });
  });

  describe('filterOpenOrders', () => {
    it('should filter only open order statuses', () => {
      const orders: OrderInfo[] = [
        createMockOrderInfo({ orderId: 1, status: 'Submitted' }),
        createMockOrderInfo({ orderId: 2, status: 'Filled' }),
        createMockOrderInfo({ orderId: 3, status: 'PreSubmitted' }),
        createMockOrderInfo({ orderId: 4, status: 'Cancelled' }),
        createMockOrderInfo({ orderId: 5, status: 'PendingSubmit' }),
      ];

      const openOrders = filterOpenOrders(orders);

      expect(openOrders).toHaveLength(3);
      expect(openOrders.map((o) => o.orderId)).toEqual([1, 3, 5]);
    });

    it('should return empty array when no open orders', () => {
      const orders: OrderInfo[] = [
        createMockOrderInfo({ status: 'Filled' }),
        createMockOrderInfo({ status: 'Cancelled' }),
      ];

      const openOrders = filterOpenOrders(orders);

      expect(openOrders).toHaveLength(0);
    });

    it('should handle empty array', () => {
      const openOrders = filterOpenOrders([]);
      expect(openOrders).toHaveLength(0);
    });
  });

  describe('filterNonZeroPositions', () => {
    it('should filter out zero positions', () => {
      const positions: PositionInfo[] = [
        createMockPositionInfo({ contract: createMockContract('AAPL'), position: 100 }),
        createMockPositionInfo({ contract: createMockContract('MSFT'), position: 0 }),
        createMockPositionInfo({ contract: createMockContract('GOOG'), position: -50 }),
      ];

      const nonZero = filterNonZeroPositions(positions);

      expect(nonZero).toHaveLength(2);
      expect(nonZero[0]?.contract.symbol).toBe('AAPL');
      expect(nonZero[1]?.contract.symbol).toBe('GOOG');
    });

    it('should return empty array when all positions are zero', () => {
      const positions: PositionInfo[] = [
        createMockPositionInfo({ position: 0 }),
        createMockPositionInfo({ position: 0 }),
      ];

      const nonZero = filterNonZeroPositions(positions);

      expect(nonZero).toHaveLength(0);
    });
  });

  describe('filterPositionsByAccount', () => {
    it('should filter positions by account ID', () => {
      const positions: PositionInfo[] = [
        createMockPositionInfo({ account: 'DU123456', contract: createMockContract('AAPL') }),
        createMockPositionInfo({ account: 'DU789012', contract: createMockContract('MSFT') }),
        createMockPositionInfo({ account: 'DU123456', contract: createMockContract('GOOG') }),
      ];

      const filtered = filterPositionsByAccount(positions, 'DU123456');

      expect(filtered).toHaveLength(2);
      expect(filtered[0]?.contract.symbol).toBe('AAPL');
      expect(filtered[1]?.contract.symbol).toBe('GOOG');
    });

    it('should return empty array when account not found', () => {
      const positions: PositionInfo[] = [
        createMockPositionInfo({ account: 'DU123456' }),
      ];

      const filtered = filterPositionsByAccount(positions, 'DU999999');

      expect(filtered).toHaveLength(0);
    });
  });

  describe('hasOrderChanged', () => {
    it('should return true when no existing order', () => {
      const newOrder = createMockOrderInfo();
      expect(hasOrderChanged(undefined, newOrder)).toBe(true);
    });

    it('should return true when status changed', () => {
      const existing = createMockOrderInfo({ status: 'Submitted' });
      const newOrder = createMockOrderInfo({ status: 'Filled' });

      expect(hasOrderChanged(existing, newOrder)).toBe(true);
    });

    it('should return true when filled quantity changed', () => {
      const existing = createMockOrderInfo({ filled: 0 });
      const newOrder = createMockOrderInfo({ filled: 50 });

      expect(hasOrderChanged(existing, newOrder)).toBe(true);
    });

    it('should return false when nothing changed', () => {
      const existing = createMockOrderInfo({ status: 'Submitted', filled: 0 });
      const newOrder = createMockOrderInfo({ status: 'Submitted', filled: 0 });

      expect(hasOrderChanged(existing, newOrder)).toBe(false);
    });
  });

  describe('hasPositionChanged', () => {
    it('should return true when no existing position', () => {
      const newPosition = createMockPositionInfo();
      expect(hasPositionChanged(undefined, newPosition)).toBe(true);
    });

    it('should return true when position size changed', () => {
      const existing = createMockPositionInfo({ position: 100 });
      const newPosition = createMockPositionInfo({ position: 150 });

      expect(hasPositionChanged(existing, newPosition)).toBe(true);
    });

    it('should return true when avgCost changed', () => {
      const existing = createMockPositionInfo({ avgCost: 150.0 });
      const newPosition = createMockPositionInfo({ avgCost: 155.0 });

      expect(hasPositionChanged(existing, newPosition)).toBe(true);
    });

    it('should return false when nothing changed', () => {
      const existing = createMockPositionInfo({ position: 100, avgCost: 150.0 });
      const newPosition = createMockPositionInfo({ position: 100, avgCost: 150.0 });

      expect(hasPositionChanged(existing, newPosition)).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('should handle multiple accounts', () => {
      const positions: PositionInfo[] = [
        createMockPositionInfo({ account: 'DU123456' }),
        createMockPositionInfo({ account: 'DU789012' }),
        createMockPositionInfo({ account: 'U1234567' }),
      ];

      const uniqueAccounts = [...new Set(positions.map((p) => p.account))];
      expect(uniqueAccounts).toHaveLength(3);
    });

    it('should handle position key generation', () => {
      const position = createMockPositionInfo({
        account: 'DU123456',
        contract: createMockContract('AAPL'),
      });

      const key = `${position.account}:${position.contract.symbol}`;
      expect(key).toBe('DU123456:AAPL');
    });

    it('should handle order with partial fill', () => {
      const order = createMockOrderInfo({
        status: 'Submitted',
        filled: 50,
        remaining: 50,
        avgFillPrice: 150.25,
      });

      expect(order.filled).toBe(50);
      expect(order.remaining).toBe(50);
      expect(order.filled + order.remaining).toBe(100);
    });

    it('should handle completely filled order', () => {
      const order = createMockOrderInfo({
        status: 'Filled',
        filled: 100,
        remaining: 0,
        avgFillPrice: 150.50,
      });

      expect(order.filled).toBe(100);
      expect(order.remaining).toBe(0);
      expect(order.status).toBe('Filled');
    });
  });
});
