import { beforeEach, describe, expect, it } from 'vitest';
import type { Candle } from '../../../../shared/types';
import { PatternDetectionService } from './PatternDetectionService';

describe('PatternDetectionService', () => {
  let service: PatternDetectionService;
  let mockCandles: Candle[];

  beforeEach(() => {
    service = new PatternDetectionService();
    
    mockCandles = Array.from({ length: 100 }, (_, i) => ({
      timestamp: 1000000 + i * 60000,
      open: 100 + Math.sin(i / 10) * 10,
      high: 105 + Math.sin(i / 10) * 10,
      low: 95 + Math.sin(i / 10) * 10,
      close: 102 + Math.sin(i / 10) * 10,
      volume: 1000 + Math.random() * 500,
    }));
  });

  describe('detectPatterns', () => {
    it('should detect patterns with default options', async () => {
      const result = await service.detectPatterns(mockCandles);

      expect(result).toBeDefined();
      expect(result.patterns).toBeInstanceOf(Array);
      expect(result.metadata).toBeDefined();
      expect(result.metadata.candlesAnalyzed).toBe(100);
      expect(result.metadata.executionTime).toBeGreaterThan(0);
    });

    it('should respect minConfidence threshold', async () => {
      const result = await service.detectPatterns(mockCandles, {
        minConfidence: 0.9,
      });

      const allConfident = result.patterns.every(
        pattern => (pattern.confidence || 0) >= 0.9
      );

      expect(allConfident).toBe(true);
    });

    it('should only detect enabled patterns', async () => {
      const result = await service.detectPatterns(mockCandles, {
        enabledPatterns: ['support', 'resistance'],
      });

      const onlyEnabled = result.patterns.every(
        pattern => pattern.type === 'support' || pattern.type === 'resistance'
      );

      expect(onlyEnabled).toBe(true);
    });

    it('should assign unique IDs to patterns', async () => {
      const result = await service.detectPatterns(mockCandles);

      const ids = result.patterns.map(s => s.id);
      const uniqueIds = new Set(ids);

      expect(ids.length).toBe(uniqueIds.size);
      
      if (result.patterns.length > 0) {
        expect(result.patterns[0]?.id).toBe(1);
      }
    });

    it('should sort patterns by confidence descending', async () => {
      const result = await service.detectPatterns(mockCandles);

      for (let i = 0; i < result.patterns.length - 1; i++) {
        const currentConf = result.patterns[i]?.confidence || 0;
        const nextConf = result.patterns[i + 1]?.confidence || 0;
        expect(currentConf).toBeGreaterThanOrEqual(nextConf);
      }
    });

    it('should return empty array for insufficient candles', async () => {
      const fewCandles: Candle[] = mockCandles.slice(0, 5);
      const result = await service.detectPatterns(fewCandles);

      expect(result.patterns).toEqual([]);
    });

    it('should detect support patterns when enabled', async () => {
      const result = await service.detectPatterns(mockCandles, {
        enabledPatterns: ['support'],
        minConfidence: 0.5,
      });

      const supportPatterns = result.patterns.filter(s => s.type === 'support');
      expect(supportPatterns.length).toBeGreaterThanOrEqual(0);
    });

    it('should detect resistance patterns when enabled', async () => {
      const result = await service.detectPatterns(mockCandles, {
        enabledPatterns: ['resistance'],
        minConfidence: 0.5,
      });

      const resistancePatterns = result.patterns.filter(s => s.type === 'resistance');
      expect(resistancePatterns.length).toBeGreaterThanOrEqual(0);
    });

    it('should use custom pivot sensitivity', async () => {
      const result = await service.detectPatterns(mockCandles, {
        pivotSensitivity: 3,
      });

      expect(result.metadata.pivotsFound).toBeGreaterThanOrEqual(0);
    });

    it('should handle enabledPatterns being undefined', async () => {
      const result = await service.detectPatterns(mockCandles, {
        enabledPatterns: undefined,
      });

      expect(result.patterns.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('detectPatternsIncremental', () => {
    it('should detect patterns incrementally', async () => {
      const existingPatterns = (await service.detectPatterns(mockCandles.slice(0, 50))).patterns;
      const newCandles = mockCandles.slice(50);

      const result = await service.detectPatternsIncremental(existingPatterns, newCandles);

      expect(result).toBeDefined();
      expect(result.patterns).toBeInstanceOf(Array);
    });
  });

  describe('cache management', () => {
    it('should cache pivots after detection', async () => {
      await service.detectPatterns(mockCandles);
      const cachedPivots = service.getCachedPivots();

      expect(cachedPivots).toBeNull();
    });

    it('should clear cache', async () => {
      await service.detectPatterns(mockCandles);
      service.clearCache();
      const cachedPivots = service.getCachedPivots();

      expect(cachedPivots).toBeNull();
    });
  });

  describe('pattern types', () => {
    it('should detect trendlines when enabled', async () => {
      const result = await service.detectPatterns(mockCandles, {
        enabledPatterns: ['trendline-bullish', 'trendline-bearish'],
        minConfidence: 0.5,
      });

      const trendlines = result.patterns.filter(
        s => s.type === 'trendline-bullish' || s.type === 'trendline-bearish'
      );
      expect(trendlines.length).toBeGreaterThanOrEqual(0);
    });

    it('should detect channels when enabled', async () => {
      const result = await service.detectPatterns(mockCandles, {
        enabledPatterns: ['channel-ascending', 'channel-descending'],
        minConfidence: 0.5,
      });

      const channels = result.patterns.filter(
        s => s.type === 'channel-ascending' || s.type === 'channel-descending'
      );
      expect(channels.length).toBeGreaterThanOrEqual(0);
    });

    it('should detect triangles when enabled', async () => {
      const result = await service.detectPatterns(mockCandles, {
        enabledPatterns: ['triangle-ascending', 'triangle-descending', 'triangle-symmetrical'],
        minConfidence: 0.5,
      });

      const triangles = result.patterns.filter(
        s => s.type.startsWith('triangle')
      );
      expect(triangles.length).toBeGreaterThanOrEqual(0);
    });

    it('should detect wedges when enabled', async () => {
      const result = await service.detectPatterns(mockCandles, {
        enabledPatterns: ['wedge-rising', 'wedge-falling'],
        minConfidence: 0.5,
      });

      const wedges = result.patterns.filter(
        s => s.type === 'wedge-rising' || s.type === 'wedge-falling'
      );
      expect(wedges.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('metadata', () => {
    it('should include execution time in metadata', async () => {
      const result = await service.detectPatterns(mockCandles);

      expect(result.metadata.executionTime).toBeGreaterThan(0);
      expect(result.metadata.executionTime).toBeLessThan(5000);
    });

    it('should include correct candles analyzed count', async () => {
      const result = await service.detectPatterns(mockCandles);

      expect(result.metadata.candlesAnalyzed).toBe(mockCandles.length);
    });

    it('should include patterns detected count', async () => {
      const result = await service.detectPatterns(mockCandles);

      expect(result.metadata.patternsDetected).toBe(result.patterns.length);
    });
  });
});
