import { describe, expect, it, beforeEach } from 'vitest';
import { OrderBookManager } from '../../../services/scalping/order-book-manager';
import type { DepthUpdate } from '@marketmind/types';
import { SCALPING_DEFAULTS } from '@marketmind/types';

const makeDepthUpdate = (
  symbol: string,
  bids: Array<{ price: number; quantity: number }>,
  asks: Array<{ price: number; quantity: number }>,
): DepthUpdate => ({
  symbol,
  bids,
  asks,
  lastUpdateId: Date.now(),
  timestamp: Date.now(),
});

describe('OrderBookManager', () => {
  let manager: OrderBookManager;

  beforeEach(() => {
    manager = new OrderBookManager();
  });

  describe('processDepthUpdate', () => {
    it('should store bids and asks', () => {
      const update = makeDepthUpdate('BTCUSDT', [
        { price: 50000, quantity: 1.5 },
      ], [
        { price: 50001, quantity: 2.0 },
      ]);

      manager.processDepthUpdate(update);
      expect(manager.hasBook('BTCUSDT')).toBe(true);
    });

    it('should overwrite previous book on new update', () => {
      manager.processDepthUpdate(makeDepthUpdate('BTCUSDT', [
        { price: 50000, quantity: 1 },
      ], [
        { price: 50001, quantity: 1 },
      ]));

      manager.processDepthUpdate(makeDepthUpdate('BTCUSDT', [
        { price: 49999, quantity: 2 },
      ], [
        { price: 50002, quantity: 3 },
      ]));

      const spread = manager.getSpread('BTCUSDT');
      expect(spread.spread).toBeCloseTo(3);
    });
  });

  describe('getImbalance', () => {
    it('should return 0 for unknown symbol', () => {
      const result = manager.getImbalance('UNKNOWN');
      expect(result.ratio).toBe(0);
      expect(result.bidVolume).toBe(0);
      expect(result.askVolume).toBe(0);
    });

    it('should compute positive ratio when bids dominate', () => {
      manager.processDepthUpdate(makeDepthUpdate('BTCUSDT', [
        { price: 50000, quantity: 10 },
      ], [
        { price: 50001, quantity: 2 },
      ]));

      const result = manager.getImbalance('BTCUSDT');
      expect(result.ratio).toBeCloseTo((10 - 2) / 12);
      expect(result.bidVolume).toBe(10);
      expect(result.askVolume).toBe(2);
    });

    it('should compute negative ratio when asks dominate', () => {
      manager.processDepthUpdate(makeDepthUpdate('BTCUSDT', [
        { price: 50000, quantity: 2 },
      ], [
        { price: 50001, quantity: 10 },
      ]));

      const result = manager.getImbalance('BTCUSDT');
      expect(result.ratio).toBeCloseTo((2 - 10) / 12);
    });

    it('should return 0 ratio for balanced book', () => {
      manager.processDepthUpdate(makeDepthUpdate('BTCUSDT', [
        { price: 50000, quantity: 5 },
      ], [
        { price: 50001, quantity: 5 },
      ]));

      const result = manager.getImbalance('BTCUSDT');
      expect(result.ratio).toBeCloseTo(0);
    });

    it('should limit to top N levels sorted by price', () => {
      const bids = Array.from({ length: 30 }, (_, i) => ({ price: 50000 - i, quantity: 1 }));
      const asks = Array.from({ length: 30 }, (_, i) => ({ price: 50001 + i, quantity: 1 }));

      manager.processDepthUpdate(makeDepthUpdate('BTCUSDT', bids, asks));

      const result = manager.getImbalance('BTCUSDT', 5);
      expect(result.bidVolume).toBe(5);
      expect(result.askVolume).toBe(5);
    });

    it('should use default DEPTH_LEVELS', () => {
      const bids = Array.from({ length: 25 }, (_, i) => ({ price: 50000 - i, quantity: 1 }));
      const asks = Array.from({ length: 25 }, (_, i) => ({ price: 50001 + i, quantity: 1 }));

      manager.processDepthUpdate(makeDepthUpdate('BTCUSDT', bids, asks));

      const result = manager.getImbalance('BTCUSDT');
      expect(result.bidVolume).toBe(SCALPING_DEFAULTS.DEPTH_LEVELS);
      expect(result.askVolume).toBe(SCALPING_DEFAULTS.DEPTH_LEVELS);
    });
  });

  describe('getMicroprice', () => {
    it('should return 0 for unknown symbol', () => {
      expect(manager.getMicroprice('UNKNOWN')).toBe(0);
    });

    it('should compute volume-weighted microprice', () => {
      manager.processDepthUpdate(makeDepthUpdate('BTCUSDT', [
        { price: 50000, quantity: 3 },
      ], [
        { price: 50010, quantity: 1 },
      ]));

      const microprice = manager.getMicroprice('BTCUSDT');
      const expected = (50000 * 1 + 50010 * 3) / (3 + 1);
      expect(microprice).toBeCloseTo(expected);
    });

    it('should return midpoint when quantities are zero', () => {
      manager.processDepthUpdate(makeDepthUpdate('BTCUSDT', [
        { price: 50000, quantity: 0 },
      ], [
        { price: 50010, quantity: 0 },
      ]));

      const microprice = manager.getMicroprice('BTCUSDT');
      expect(microprice).toBeCloseTo(50005);
    });

    it('should return 0 when no bids exist', () => {
      manager.processDepthUpdate(makeDepthUpdate('BTCUSDT', [], [
        { price: 50010, quantity: 1 },
      ]));

      expect(manager.getMicroprice('BTCUSDT')).toBe(0);
    });

    it('should return 0 when no asks exist', () => {
      manager.processDepthUpdate(makeDepthUpdate('BTCUSDT', [
        { price: 50000, quantity: 1 },
      ], []));

      expect(manager.getMicroprice('BTCUSDT')).toBe(0);
    });
  });

  describe('getSpread', () => {
    it('should return 0 for unknown symbol', () => {
      const result = manager.getSpread('UNKNOWN');
      expect(result.spread).toBe(0);
      expect(result.spreadPercent).toBe(0);
    });

    it('should compute absolute and percentage spread', () => {
      manager.processDepthUpdate(makeDepthUpdate('BTCUSDT', [
        { price: 50000, quantity: 1 },
      ], [
        { price: 50010, quantity: 1 },
      ]));

      const result = manager.getSpread('BTCUSDT');
      expect(result.spread).toBeCloseTo(10);
      expect(result.spreadPercent).toBeCloseTo((10 / 50010) * 100);
    });

    it('should pick best bid and best ask', () => {
      manager.processDepthUpdate(makeDepthUpdate('BTCUSDT', [
        { price: 49990, quantity: 1 },
        { price: 50000, quantity: 1 },
      ], [
        { price: 50005, quantity: 1 },
        { price: 50010, quantity: 1 },
      ]));

      const result = manager.getSpread('BTCUSDT');
      expect(result.spread).toBeCloseTo(5);
    });
  });

  describe('getWalls', () => {
    it('should return empty for unknown symbol', () => {
      expect(manager.getWalls('UNKNOWN', 3)).toEqual([]);
    });

    it('should detect levels with volume above threshold × avgQty', () => {
      manager.processDepthUpdate(makeDepthUpdate('BTCUSDT', [
        { price: 50000, quantity: 100 },
        { price: 49999, quantity: 1 },
        { price: 49998, quantity: 1 },
      ], [
        { price: 50001, quantity: 1 },
        { price: 50002, quantity: 1 },
      ]));

      const walls = manager.getWalls('BTCUSDT', 3);
      expect(walls.length).toBe(1);
      expect(walls[0]!.price).toBe(50000);
      expect(walls[0]!.quantity).toBe(100);
    });

    it('should return empty when no levels exceed threshold', () => {
      manager.processDepthUpdate(makeDepthUpdate('BTCUSDT', [
        { price: 50000, quantity: 1 },
      ], [
        { price: 50001, quantity: 1 },
      ]));

      const walls = manager.getWalls('BTCUSDT', 5);
      expect(walls.length).toBe(0);
    });
  });

  describe('detectAbsorption', () => {
    it('should return null for unknown symbol', () => {
      expect(manager.detectAbsorption('UNKNOWN')).toBeNull();
    });

    it('should return null on first update (no previous state)', () => {
      manager.processDepthUpdate(makeDepthUpdate('BTCUSDT', [
        { price: 50000, quantity: 100 },
      ], [
        { price: 50001, quantity: 1 },
      ]));

      expect(manager.detectAbsorption('BTCUSDT')).toBeNull();
    });

    it('should detect bid absorption when large volume held at price', () => {
      const smallQty = 1;
      const largeQty = 30;

      const smallBids = Array.from({ length: 9 }, (_, i) => ({
        price: 49991 + i,
        quantity: smallQty,
      }));

      manager.processDepthUpdate(makeDepthUpdate('BTCUSDT', [
        { price: 50000, quantity: largeQty },
        ...smallBids,
      ], [
        { price: 50001, quantity: smallQty },
      ]));

      manager.processDepthUpdate(makeDepthUpdate('BTCUSDT', [
        { price: 50000, quantity: largeQty },
        ...smallBids,
      ], [
        { price: 50001, quantity: smallQty },
      ]));

      const absorption = manager.detectAbsorption('BTCUSDT');
      expect(absorption).not.toBeNull();
      expect(absorption!.side).toBe('bid');
      expect(absorption!.price).toBe(50000);
      expect(absorption!.priceHeld).toBe(true);
      expect(absorption!.score).toBeGreaterThanOrEqual(SCALPING_DEFAULTS.ABSORPTION_VOLUME_THRESHOLD);
    });

    it('should not detect absorption when volume dropped significantly', () => {
      manager.processDepthUpdate(makeDepthUpdate('BTCUSDT', [
        { price: 50000, quantity: 100 },
      ], [
        { price: 50001, quantity: 1 },
      ]));

      manager.processDepthUpdate(makeDepthUpdate('BTCUSDT', [
        { price: 50000, quantity: 10 },
      ], [
        { price: 50001, quantity: 1 },
      ]));

      expect(manager.detectAbsorption('BTCUSDT')).toBeNull();
    });
  });

  describe('hasBook', () => {
    it('should return false for unknown symbol', () => {
      expect(manager.hasBook('UNKNOWN')).toBe(false);
    });

    it('should return true after processing', () => {
      manager.processDepthUpdate(makeDepthUpdate('BTCUSDT', [
        { price: 50000, quantity: 1 },
      ], [
        { price: 50001, quantity: 1 },
      ]));
      expect(manager.hasBook('BTCUSDT')).toBe(true);
    });
  });

  describe('clear', () => {
    it('should remove all books', () => {
      manager.processDepthUpdate(makeDepthUpdate('BTCUSDT', [
        { price: 50000, quantity: 1 },
      ], [
        { price: 50001, quantity: 1 },
      ]));
      manager.processDepthUpdate(makeDepthUpdate('ETHUSDT', [
        { price: 3000, quantity: 1 },
      ], [
        { price: 3001, quantity: 1 },
      ]));

      manager.clear();
      expect(manager.hasBook('BTCUSDT')).toBe(false);
      expect(manager.hasBook('ETHUSDT')).toBe(false);
    });
  });
});
