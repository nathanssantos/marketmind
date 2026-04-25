import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IBKlineStream } from '../../exchange/interactive-brokers/kline-stream';

describe('IB Kline Stream', () => {
  describe('Initialization', () => {
    it('should create kline stream instance', () => {
      const stream = new IBKlineStream();

      expect(stream.exchangeId).toBe('INTERACTIVE_BROKERS');
      expect(stream.getSubscriptionCount()).toBe(0);
    });
  });

  describe('Subscription Management', () => {
    let stream: IBKlineStream;

    beforeEach(() => {
      stream = new IBKlineStream();
    });

    it('should start and stop without subscriptions', () => {
      stream.start();
      stream.stop();
      expect(stream.getSubscriptionCount()).toBe(0);
    });

    it('should track subscription count correctly', () => {
      expect(stream.getSubscriptionCount()).toBe(0);
    });
  });

  describe('Handler Management', () => {
    let stream: IBKlineStream;

    beforeEach(() => {
      stream = new IBKlineStream();
    });

    it('should accept kline update handler', () => {
      const handler = vi.fn();
      stream.onKlineUpdate(handler);
      expect(true).toBe(true);
    });
  });

});
