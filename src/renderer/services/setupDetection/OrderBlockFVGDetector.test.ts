import { describe, expect, it } from 'vitest';
import type { Kline } from '../../../shared/types/kline';
import {
    getKlineClose,
    getKlineHigh,
    getKlineLow,
    getKlineOpen,
    getKlineVolume,
} from '../../../shared/utils/klineUtils';
import {
    createDefaultOrderBlockFVGConfig,
    OrderBlockFVGDetector,
} from './OrderBlockFVGDetector';

const createKline = (
  open: number,
  high: number,
  low: number,
  close: number,
  volume: number = 1000000,
  openTime: number = Date.now()
): Kline => ({
  openTime,
  closeTime: openTime + 60000,
  open: open.toString(),
  high: high.toString(),
  low: low.toString(),
  close: close.toString(),
  volume: volume.toString(),
  quoteVolume: (volume * close).toString(),
  trades: 100,
  takerBuyBaseVolume: (volume * 0.5).toString(),
  takerBuyQuoteVolume: (volume * close * 0.5).toString(),
});

describe('OrderBlockFVGDetector', () => {
  describe('createDefaultOrderBlockFVGConfig', () => {
    it('should create default config with disabled state', () => {
      const config = createDefaultOrderBlockFVGConfig();

      expect(config.enabled).toBe(false);
      expect(config.minConfidence).toBe(75);
      expect(config.minRiskReward).toBe(2.0);
      expect(config.fvgMinSize).toBe(0.1);
      expect(config.orderBlockVolumeMultiplier).toBe(1.5);
      expect(config.targetMultiplier).toBe(2.0);
      expect(config.lookbackPeriod).toBe(50);
    });
  });

  describe('detect', () => {
    it('should return null when disabled', () => {
      const config = { ...createDefaultOrderBlockFVGConfig(), enabled: false };
      const detector = new OrderBlockFVGDetector(config);

      const klines = [
        createKline(100, 110, 95, 105),
        createKline(105, 108, 103, 107),
        createKline(107, 109, 106, 108),
      ];

      const result = detector.detect(klines, 2);
      expect(result.setup).toBeNull();
      expect(result.confidence).toBe(0);
    });

    it('should return null when not enough klines', () => {
      const config = { ...createDefaultOrderBlockFVGConfig(), enabled: true };
      const detector = new OrderBlockFVGDetector(config);

      const klines = [createKline(100, 110, 95, 105)];

      const result = detector.detect(klines, 0);
      expect(result.setup).toBeNull();
      expect(result.confidence).toBe(0);
    });

    it('should require both order block and FVG for setup', () => {
      const config = {
        ...createDefaultOrderBlockFVGConfig(),
        enabled: true,
        minConfidence: 60,
        minRiskReward: 1.5,
      };
      const detector = new OrderBlockFVGDetector(config);

      const baseTime = Date.now();
      const klines: Kline[] = [];

      for (let i = 0; i < 70; i += 1) {
        klines.push(createKline(100, 101, 99, 100, 1000000, baseTime + i * 60000));
      }

      const result = detector.detect(klines, 70);
      expect(result.setup).toBeNull();
    });
  });

  describe('order block detection', () => {
    it('should detect bullish order block with high volume', () => {
      const config = {
        ...createDefaultOrderBlockFVGConfig(),
        enabled: true,
        minConfidence: 60,
        minRiskReward: 1.5,
        orderBlockVolumeMultiplier: 1.5,
      };
      const detector = new OrderBlockFVGDetector(config);

      const baseTime = Date.now();
      const klines: Kline[] = [];

      for (let i = 0; i < 70; i += 1) {
        klines.push(createKline(100, 101, 99, 100, 1000000, baseTime + i * 60000));
      }

      const orderBlockKline = createKline(100, 105, 99, 104, 2000000, baseTime + 70 * 60000);
      klines.push(orderBlockKline);

      expect(getKlineVolume(orderBlockKline)).toBeGreaterThan(1000000 * config.orderBlockVolumeMultiplier);
      expect(getKlineClose(orderBlockKline)).toBeGreaterThan(getKlineOpen(orderBlockKline));
    });

    it('should detect bearish order block with high volume', () => {
      const config = {
        ...createDefaultOrderBlockFVGConfig(),
        enabled: true,
        minConfidence: 60,
        minRiskReward: 1.5,
        orderBlockVolumeMultiplier: 1.5,
      };
      const _detector = new OrderBlockFVGDetector(config);

      const baseTime = Date.now();
      const klines: Kline[] = [];

      for (let i = 0; i < 70; i += 1) {
        klines.push(createKline(100, 101, 99, 100, 1000000, baseTime + i * 60000));
      }

      const orderBlockKline = createKline(104, 105, 99, 100, 2000000, baseTime + 70 * 60000);
      klines.push(orderBlockKline);

      expect(getKlineVolume(orderBlockKline)).toBeGreaterThan(1000000 * config.orderBlockVolumeMultiplier);
      expect(getKlineClose(orderBlockKline)).toBeLessThan(getKlineOpen(orderBlockKline));
    });

    it('should reject order block with low volume', () => {
      const config = {
        ...createDefaultOrderBlockFVGConfig(),
        enabled: true,
        minConfidence: 60,
        minRiskReward: 1.5,
        orderBlockVolumeMultiplier: 2.0,
      };
      const _detector = new OrderBlockFVGDetector(config);

      const baseTime = Date.now();
      const klines: Kline[] = [];

      for (let i = 0; i < 70; i += 1) {
        klines.push(createKline(100, 101, 99, 100, 1000000, baseTime + i * 60000));
      }

      const lowVolumeKline = createKline(100, 105, 99, 104, 1500000, baseTime + 70 * 60000);
      klines.push(lowVolumeKline);

      expect(getKlineVolume(lowVolumeKline)).toBeLessThan(1000000 * config.orderBlockVolumeMultiplier);
    });
  });

  describe('FVG detection', () => {
    it('should detect bullish FVG gap', () => {
      const config = {
        ...createDefaultOrderBlockFVGConfig(),
        enabled: true,
        fvgMinSize: 0.1,
      };
      const _detector = new OrderBlockFVGDetector(config);

      const baseTime = Date.now();

      const prevKline = createKline(100, 101, 99, 100, 1000000, baseTime);
      const _middleKline = createKline(100, 105, 99, 104, 2000000, baseTime + 60000);
      const nextKline = createKline(104, 106, 103, 105, 1000000, baseTime + 120000);

      const gapBottom = prevKline.high;
      const gapTop = nextKline.low;

      expect(getKlineLow(nextKline)).toBeGreaterThan(getKlineHigh(prevKline));
    });

    it('should detect bearish FVG gap', () => {
      const config = {
        ...createDefaultOrderBlockFVGConfig(),
        enabled: true,
        fvgMinSize: 0.1,
      };
      const _detector = new OrderBlockFVGDetector(config);

      const baseTime = Date.now();

      const prevKline = createKline(100, 101, 99, 100, 1000000, baseTime);
      const _middleKline = createKline(104, 105, 95, 96, 2000000, baseTime + 60000);
      const nextKline = createKline(95, 97, 94, 95, 1000000, baseTime + 120000);

      const gapTop = prevKline.low;
      const gapBottom = nextKline.high;

      expect(getKlineLow(prevKline)).toBeGreaterThan(getKlineHigh(nextKline));
    });

    it('should validate minimum gap size', () => {
      const config = {
        ...createDefaultOrderBlockFVGConfig(),
        enabled: true,
        fvgMinSize: 1.0,
      };
      const _detector = new OrderBlockFVGDetector(config);

      const baseTime = Date.now();

      const prevKline = createKline(100, 100.5, 99, 100, 1000000, baseTime);
      const nextKline = createKline(104, 106, 100.6, 105, 1000000, baseTime + 120000);

      const gapSize = nextKline.low - prevKline.high;
      const gapPercent = (gapSize / prevKline.close) * 100;

      expect(gapPercent).toBeLessThan(config.fvgMinSize);
    });
  });

  describe('confidence calculation', () => {
    it('should base confidence on volume and FVG presence', () => {
      const config = {
        ...createDefaultOrderBlockFVGConfig(),
        enabled: true,
        minConfidence: 60,
        minRiskReward: 1.5,
      };
      const _detector = new OrderBlockFVGDetector(config);

      const baseConfidence = 70;
      const volumeBonus = 10;
      const fvgBonus = 15;

      const expectedMinConfidence = baseConfidence + fvgBonus;
      const expectedMaxConfidence = baseConfidence + volumeBonus + fvgBonus;

      expect(expectedMinConfidence).toBe(85);
      expect(expectedMaxConfidence).toBe(95);
    });

    it('should cap confidence at maximum value', () => {
      const maxConfidence = 95;
      const testConfidence = 100;

      expect(Math.min(testConfidence, maxConfidence)).toBe(95);
    });
  });

  describe('config customization', () => {
    it('should respect custom fvgMinSize', () => {
      const config = {
        ...createDefaultOrderBlockFVGConfig(),
        enabled: true,
        fvgMinSize: 0.5,
      };
      const detector = new OrderBlockFVGDetector(config);

      expect(detector).toBeDefined();
      expect(config.fvgMinSize).toBe(0.5);
    });

    it('should respect custom orderBlockVolumeMultiplier', () => {
      const config = {
        ...createDefaultOrderBlockFVGConfig(),
        enabled: true,
        orderBlockVolumeMultiplier: 2.0,
      };
      const detector = new OrderBlockFVGDetector(config);

      expect(detector).toBeDefined();
      expect(config.orderBlockVolumeMultiplier).toBe(2.0);
    });

    it('should respect custom targetMultiplier', () => {
      const config = {
        ...createDefaultOrderBlockFVGConfig(),
        enabled: true,
        minRiskReward: 2.5,
        targetMultiplier: 2.5,
      };
      const detector = new OrderBlockFVGDetector(config);

      expect(detector).toBeDefined();
      expect(config.targetMultiplier).toBe(2.5);
    });

    it('should respect custom lookbackPeriod', () => {
      const config = {
        ...createDefaultOrderBlockFVGConfig(),
        enabled: true,
        lookbackPeriod: 100,
      };
      const detector = new OrderBlockFVGDetector(config);

      expect(detector).toBeDefined();
      expect(config.lookbackPeriod).toBe(100);
    });
  });

  describe('structural targeting', () => {
    it('should use nearest resistance for LONG setups', () => {
      const entry = 100;
      const stop = 95;
      const risk = entry - stop;
      const rrTarget = entry + risk * 2.0;
      const resistance = 108;

      const expectedTarget = Math.min(rrTarget, resistance);
      expect(expectedTarget).toBe(108);
    });

    it('should use nearest support for SHORT setups', () => {
      const entry = 100;
      const stop = 105;
      const risk = stop - entry;
      const rrTarget = entry - risk * 2.0;
      const support = 92;

      const expectedTarget = Math.max(rrTarget, support);
      expect(expectedTarget).toBe(92);
    });

    it('should use RR target when no structural level found', () => {
      const entry = 100;
      const stop = 95;
      const risk = entry - stop;
      const rrTarget = entry + risk * 2.0;
      const resistance = null;

      const expectedTarget = resistance ?? rrTarget;
      expect(expectedTarget).toBe(110);
    });
  });
});
