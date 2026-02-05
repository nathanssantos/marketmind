import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IBPriceStream } from '../../exchange/interactive-brokers/price-stream';

describe('IB Price Stream', () => {
  describe('Initialization', () => {
    it('should create price stream instance', () => {
      const stream = new IBPriceStream();

      expect(stream.exchangeId).toBe('INTERACTIVE_BROKERS');
    });
  });

  describe('Subscription Management', () => {
    let stream: IBPriceStream;

    beforeEach(() => {
      stream = new IBPriceStream();
    });

    it('should start and stop without subscriptions', () => {
      stream.start();
      stream.stop();
    });

    it('should check subscription status', () => {
      expect(stream.isSubscribed('AAPL')).toBe(false);
    });

    it('should return undefined for price of unsubscribed symbol', () => {
      expect(stream.getPrice('AAPL')).toBeUndefined();
    });

    it('should return undefined for price data of unsubscribed symbol', () => {
      expect(stream.getPriceData('AAPL')).toBeUndefined();
    });

    it('should return empty map for all prices when no subscriptions', () => {
      const prices = stream.getAllPrices();
      expect(prices.size).toBe(0);
    });
  });

  describe('Handler Management', () => {
    let stream: IBPriceStream;

    beforeEach(() => {
      stream = new IBPriceStream();
    });

    it('should accept price update handler', () => {
      const handler = vi.fn();
      stream.onPriceUpdate(handler);
      expect(true).toBe(true);
    });
  });

  describe.skip('Integration Tests (require IB Gateway)', () => {
    let stream: IBPriceStream;

    beforeEach(() => {
      stream = new IBPriceStream();
    });

    afterEach(() => {
      stream.stop();
    });

    it('should subscribe to AAPL price updates', async () => {
      const updates: any[] = [];

      stream.onPriceUpdate((update) => {
        updates.push(update);
      });

      stream.start();
      stream.subscribe('AAPL', 'SPOT');

      expect(stream.isSubscribed('AAPL')).toBe(true);

      await new Promise((resolve) => setTimeout(resolve, 3000));

      expect(updates.length).toBeGreaterThan(0);
      expect(updates[0]?.symbol).toBe('AAPL');
      expect(updates[0]?.price).toBeGreaterThan(0);
    });

    it('should get real-time price after subscription', async () => {
      stream.start();
      stream.subscribe('AAPL', 'SPOT');

      await new Promise((resolve) => setTimeout(resolve, 3000));

      const price = stream.getPrice('AAPL');
      expect(price).toBeDefined();
      expect(price).toBeGreaterThan(0);
    });

    it('should get detailed price data after subscription', async () => {
      stream.start();
      stream.subscribe('AAPL', 'SPOT');

      await new Promise((resolve) => setTimeout(resolve, 3000));

      const priceData = stream.getPriceData('AAPL');
      expect(priceData).toBeDefined();
      expect(priceData?.symbol).toBe('AAPL');
      expect(priceData?.bid).toBeGreaterThanOrEqual(0);
      expect(priceData?.ask).toBeGreaterThanOrEqual(0);
      expect(priceData?.last).toBeGreaterThan(0);
    });

    it('should subscribe to multiple symbols', async () => {
      stream.start();
      stream.subscribe('AAPL', 'SPOT');
      stream.subscribe('MSFT', 'SPOT');
      stream.subscribe('GOOGL', 'SPOT');

      await new Promise((resolve) => setTimeout(resolve, 3000));

      expect(stream.isSubscribed('AAPL')).toBe(true);
      expect(stream.isSubscribed('MSFT')).toBe(true);
      expect(stream.isSubscribed('GOOGL')).toBe(true);

      const prices = stream.getAllPrices();
      expect(prices.size).toBe(3);
    });

    it('should unsubscribe from symbol', async () => {
      stream.start();
      stream.subscribe('AAPL', 'SPOT');

      expect(stream.isSubscribed('AAPL')).toBe(true);

      stream.unsubscribe('AAPL');

      expect(stream.isSubscribed('AAPL')).toBe(false);
      expect(stream.getPrice('AAPL')).toBeUndefined();
    });

    it('should handle symbol case insensitivity', async () => {
      stream.start();
      stream.subscribe('aapl', 'SPOT');

      expect(stream.isSubscribed('AAPL')).toBe(true);
      expect(stream.isSubscribed('aapl')).toBe(true);
    });

    it('should not duplicate subscriptions', async () => {
      stream.start();
      stream.subscribe('AAPL', 'SPOT');
      stream.subscribe('AAPL', 'SPOT');
      stream.subscribe('aapl', 'SPOT');

      const prices = stream.getAllPrices();
      expect(prices.size).toBeLessThanOrEqual(1);
    });
  });

  describe.skip('Data Quality Tests (require IB Gateway)', () => {
    let stream: IBPriceStream;

    beforeEach(() => {
      stream = new IBPriceStream();
    });

    afterEach(() => {
      stream.stop();
    });

    it('should have valid bid/ask spread', async () => {
      stream.start();
      stream.subscribe('AAPL', 'SPOT');

      await new Promise((resolve) => setTimeout(resolve, 3000));

      const priceData = stream.getPriceData('AAPL');
      expect(priceData).toBeDefined();

      if (priceData?.bid && priceData?.ask && priceData.bid > 0 && priceData.ask > 0) {
        expect(priceData.ask).toBeGreaterThanOrEqual(priceData.bid);
      }
    });

    it('should have last price within bid/ask spread', async () => {
      stream.start();
      stream.subscribe('AAPL', 'SPOT');

      await new Promise((resolve) => setTimeout(resolve, 3000));

      const priceData = stream.getPriceData('AAPL');
      expect(priceData).toBeDefined();

      if (priceData?.bid && priceData?.ask && priceData.last) {
        if (priceData.bid > 0 && priceData.ask > 0) {
          expect(priceData.last).toBeGreaterThanOrEqual(priceData.bid * 0.99);
          expect(priceData.last).toBeLessThanOrEqual(priceData.ask * 1.01);
        }
      }
    });

    it('should update prices over time', async () => {
      const priceHistory: number[] = [];

      stream.onPriceUpdate((update) => {
        if (update.symbol === 'AAPL') {
          priceHistory.push(update.price);
        }
      });

      stream.start();
      stream.subscribe('AAPL', 'SPOT');

      await new Promise((resolve) => setTimeout(resolve, 10000));

      expect(priceHistory.length).toBeGreaterThan(1);
    });
  });

  describe.skip('Performance Tests (require IB Gateway)', () => {
    let stream: IBPriceStream;

    beforeEach(() => {
      stream = new IBPriceStream();
    });

    afterEach(() => {
      stream.stop();
    });

    it('should handle high-frequency updates', async () => {
      let updateCount = 0;

      stream.onPriceUpdate(() => {
        updateCount++;
      });

      stream.start();
      stream.subscribe('SPY', 'SPOT');

      await new Promise((resolve) => setTimeout(resolve, 10000));

      expect(updateCount).toBeGreaterThan(10);
    });

    it('should handle many symbols concurrently', async () => {
      const symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA', 'JPM', 'V', 'WMT'];

      stream.start();
      for (const symbol of symbols) {
        stream.subscribe(symbol, 'SPOT');
      }

      await new Promise((resolve) => setTimeout(resolve, 5000));

      const prices = stream.getAllPrices();
      expect(prices.size).toBeGreaterThanOrEqual(5);
    });
  });
});
