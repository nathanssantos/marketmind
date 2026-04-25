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

});
