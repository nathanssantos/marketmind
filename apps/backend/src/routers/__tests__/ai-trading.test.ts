import type { TradingSetup } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import { contextAggregator } from '../ai-trading';

describe('aiTrading router', () => {
  describe('ContextAggregator integration', () => {
    it('should build context for a symbol without detected setups', async () => {
      const context = await contextAggregator.buildContext('BTCUSDT', []);

      expect(context.detectedSetups).toEqual([]);
      expect(context.news).toBeInstanceOf(Array);
      expect(context.calendarEvents).toBeInstanceOf(Array);
      expect(typeof context.fearGreedIndex).toBe('number');
      expect(context.fearGreedIndex).toBeGreaterThanOrEqual(0);
      expect(context.fearGreedIndex).toBeLessThanOrEqual(100);
      expect(typeof context.btcDominance).toBe('number');
      expect(context.marketSentiment).toMatch(/bullish|bearish|neutral/);
      expect(typeof context.volatility).toBe('number');
      expect(context.liquidityLevel).toMatch(/high|medium|low/);
    });

    it('should build context with detected setups', async () => {
      const mockSetups: TradingSetup[] = [
        {
          id: 'test-1',
          type: 'larry-williams-9.2',
          symbol: 'BTCUSDT',
          timeframe: '15m',
          direction: 'LONG',
          entryPrice: 50000,
          stopLoss: 49000,
          takeProfit: 52000,
          confidence: 80,
          riskReward: 2,
          detectedAt: Date.now(),
          status: 'pending',
        },
      ];

      const context = await contextAggregator.buildContext('BTCUSDT', mockSetups);

      expect(context.detectedSetups).toHaveLength(1);
      expect(context.detectedSetups[0].type).toBe('larry-williams-9.2');
    });

    it('should handle different symbols', async () => {
      const context = await contextAggregator.buildContext('ETHUSDT', []);

      expect(context).toBeDefined();
      expect(context.detectedSetups).toEqual([]);
    });

    it('should return valid context structure', async () => {
      const context = await contextAggregator.buildContext('BTCUSDT', []);

      expect(context).toHaveProperty('detectedSetups');
      expect(context).toHaveProperty('news');
      expect(context).toHaveProperty('calendarEvents');
      expect(context).toHaveProperty('fearGreedIndex');
      expect(context).toHaveProperty('btcDominance');
      expect(context).toHaveProperty('marketSentiment');
      expect(context).toHaveProperty('volatility');
      expect(context).toHaveProperty('liquidityLevel');
    });
  });

  describe('configuration management', () => {
    it('should return current configuration', () => {
      const config = contextAggregator.getConfig();

      expect(config).toHaveProperty('newsLookbackHours');
      expect(config).toHaveProperty('eventsLookforwardDays');
      expect(config).toHaveProperty('enableFearGreedIndex');
      expect(config).toHaveProperty('enableBTCDominance');
      expect(config).toHaveProperty('enableFundingRate');
      expect(config).toHaveProperty('enableOpenInterest');
    });

    it('should return default values', () => {
      const config = contextAggregator.getConfig();

      expect(config.newsLookbackHours).toBe(24);
      expect(config.eventsLookforwardDays).toBe(7);
      expect(config.enableFearGreedIndex).toBe(true);
      expect(config.enableBTCDominance).toBe(true);
    });

    it('should update configuration', () => {
      const newConfig = {
        newsLookbackHours: 48,
        enableFearGreedIndex: false,
      };

      contextAggregator.updateConfig(newConfig);
      const config = contextAggregator.getConfig();

      expect(config.newsLookbackHours).toBe(48);
      expect(config.enableFearGreedIndex).toBe(false);
    });

    it('should preserve unmodified config values', () => {
      const initialConfig = contextAggregator.getConfig();

      contextAggregator.updateConfig({
        newsLookbackHours: 72,
      });

      const updatedConfig = contextAggregator.getConfig();
      expect(updatedConfig.eventsLookforwardDays).toBe(initialConfig.eventsLookforwardDays);
      expect(updatedConfig.enableBTCDominance).toBe(initialConfig.enableBTCDominance);
    });

    it('should handle partial config updates', () => {
      const partialUpdate = {
        enableFundingRate: false,
        enableOpenInterest: false,
      };

      contextAggregator.updateConfig(partialUpdate);
      const config = contextAggregator.getConfig();

      expect(config.enableFundingRate).toBe(false);
      expect(config.enableOpenInterest).toBe(false);
    });
  });

  describe('data aggregation', () => {
    it('should aggregate multiple data sources', async () => {
      const context = await contextAggregator.buildContext('BTCUSDT', []);

      expect(context.fearGreedIndex).toBeGreaterThanOrEqual(0);
      expect(context.fearGreedIndex).toBeLessThanOrEqual(100);
      expect(context.btcDominance).toBeGreaterThanOrEqual(0);
      expect(context.btcDominance).toBeLessThanOrEqual(100);
      expect(['bullish', 'bearish', 'neutral']).toContain(context.marketSentiment);
      expect(['high', 'medium', 'low']).toContain(context.liquidityLevel);
    });

    it('should filter news by relevance', async () => {
      const context = await contextAggregator.buildContext('BTCUSDT', []);

      expect(context.news).toBeInstanceOf(Array);
      expect(context.news.length).toBeLessThanOrEqual(10);
    });

    it('should filter calendar events', async () => {
      const context = await contextAggregator.buildContext('BTCUSDT', []);

      expect(context.calendarEvents).toBeInstanceOf(Array);
    });
  });
});
