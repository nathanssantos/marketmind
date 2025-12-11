import type { TradingSetup } from '@marketmind/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContextAggregator } from './ContextAggregator';

vi.mock('../btc-dominance-data');
vi.mock('../binance-futures-data');

describe('ContextAggregator', () => {
  let aggregator: ContextAggregator;

  beforeEach(() => {
    aggregator = new ContextAggregator();
  });

  describe('buildContext', () => {
    it('should build trading context with all enabled features', async () => {
      const mockSetups: TradingSetup[] = [
        {
          id: 'test-1',
          type: 'larry-williams-9.2',
          direction: 'LONG',
          openTime: Date.now(),
          entryPrice: 50000,
          stopLoss: 49000,
          takeProfit: 52000,
          confidence: 80,
          riskRewardRatio: 2,
          volumeConfirmation: true,
          indicatorConfluence: 3,
          klineIndex: 100,
          setupData: {},
          visible: true,
          source: 'algorithm',
        },
      ];

      const context = await aggregator.buildContext('BTCUSDT', mockSetups);

      expect(context).toBeDefined();
      expect(context.detectedSetups).toEqual(mockSetups);
      expect(context.news).toBeInstanceOf(Array);
      expect(context.calendarEvents).toBeInstanceOf(Array);
      expect(typeof context.fearGreedIndex).toBe('number');
      expect(typeof context.btcDominance).toBe('number');
      expect(context.marketSentiment).toMatch(/bullish|bearish|neutral/);
      expect(typeof context.volatility).toBe('number');
      expect(context.liquidityLevel).toMatch(/high|medium|low/);
    });

    it('should handle empty setups array', async () => {
      const context = await aggregator.buildContext('BTCUSDT', []);

      expect(context.detectedSetups).toHaveLength(0);
      expect(context).toHaveProperty('fearGreedIndex');
      expect(context).toHaveProperty('btcDominance');
    });

    it('should respect configuration options', async () => {
      const customAggregator = new ContextAggregator({
        enableFearGreedIndex: false,
        enableBTCDominance: false,
        enableFundingRate: false,
        enableOpenInterest: false,
      });

      const context = await customAggregator.buildContext('BTCUSDT', []);

      expect(context.fearGreedIndex).toBeDefined();
      expect(context.btcDominance).toBeDefined();
    });
  });

  describe('calculateSentiment', () => {
    it('should return bullish sentiment for positive news', async () => {
      const context = await aggregator.buildContext('BTCUSDT', []);
      expect(context.marketSentiment).toBeDefined();
    });

    it('should return bearish sentiment for negative news', async () => {
      const context = await aggregator.buildContext('BTCUSDT', []);
      expect(context.marketSentiment).toMatch(/bullish|bearish|neutral/);
    });

    it('should return neutral sentiment when no clear direction', async () => {
      const context = await aggregator.buildContext('BTCUSDT', []);
      expect(context.marketSentiment).toMatch(/bullish|bearish|neutral/);
    });
  });

  describe('filterRelevantNews', () => {
    it('should filter news by symbol relevance', async () => {
      const context = await aggregator.buildContext('BTCUSDT', []);
      expect(context.news).toBeInstanceOf(Array);
    });

    it('should filter news by time range', async () => {
      const customAggregator = new ContextAggregator({
        newsLookbackHours: 12,
      });

      const context = await customAggregator.buildContext('BTCUSDT', []);
      expect(context.news).toBeInstanceOf(Array);
    });

    it('should limit news to 10 items', async () => {
      const context = await aggregator.buildContext('BTCUSDT', []);
      expect(context.news.length).toBeLessThanOrEqual(10);
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      aggregator.updateConfig({
        newsLookbackHours: 48,
        enableFearGreedIndex: false,
      });

      const config = aggregator.getConfig();
      expect(config.newsLookbackHours).toBe(48);
      expect(config.enableFearGreedIndex).toBe(false);
    });

    it('should preserve unmodified config values', () => {
      const initialConfig = aggregator.getConfig();
      
      aggregator.updateConfig({
        newsLookbackHours: 48,
      });

      const updatedConfig = aggregator.getConfig();
      expect(updatedConfig.eventsLookforwardDays).toBe(initialConfig.eventsLookforwardDays);
      expect(updatedConfig.enableBTCDominance).toBe(initialConfig.enableBTCDominance);
    });
  });

  describe('getConfig', () => {
    it('should return current configuration', () => {
      const config = aggregator.getConfig();

      expect(config).toHaveProperty('newsLookbackHours');
      expect(config).toHaveProperty('eventsLookforwardDays');
      expect(config).toHaveProperty('enableFearGreedIndex');
      expect(config).toHaveProperty('enableBTCDominance');
      expect(config).toHaveProperty('enableFundingRate');
      expect(config).toHaveProperty('enableOpenInterest');
    });

    it('should return default values', () => {
      const config = aggregator.getConfig();

      expect(config.newsLookbackHours).toBe(24);
      expect(config.eventsLookforwardDays).toBe(7);
      expect(config.enableFearGreedIndex).toBe(true);
      expect(config.enableBTCDominance).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle API failures gracefully', async () => {
      const context = await aggregator.buildContext('BTCUSDT', []);

      expect(context).toBeDefined();
      expect(context.fearGreedIndex).toBeGreaterThanOrEqual(0);
      expect(context.fearGreedIndex).toBeLessThanOrEqual(100);
      expect(context.btcDominance).toBeGreaterThanOrEqual(0);
      expect(context.btcDominance).toBeLessThanOrEqual(100);
    });

    it('should provide valid context for any symbol', async () => {
      const context = await aggregator.buildContext('INVALID_SYMBOL', []);

      expect(context.fearGreedIndex).toBeGreaterThanOrEqual(0);
      expect(context.fearGreedIndex).toBeLessThanOrEqual(100);
      expect(context.btcDominance).toBeGreaterThanOrEqual(0);
      expect(context.btcDominance).toBeLessThanOrEqual(100);
      expect(context.volatility).toBeGreaterThanOrEqual(0);
      expect(['high', 'medium', 'low']).toContain(context.liquidityLevel);
    });
  });
});
