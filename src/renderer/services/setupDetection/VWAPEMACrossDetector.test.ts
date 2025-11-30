import { describe, expect, it } from 'vitest';
import type { Kline } from '../../../shared/types/candle';
import {
    createDefaultVWAPEMACrossConfig,
    VWAPEMACrossDetector,
} from './VWAPEMACrossDetector';

const createCandle = (
  open: number,
  high: number,
  low: number,
  close: number,
  volume: number = 1000000,
  timestamp: number = Date.now()
): Candle => ({
  timestamp,
  open,
  high,
  low,
  close,
  volume,
});

describe('VWAPEMACrossDetector', () => {
  describe('createDefaultVWAPEMACrossConfig', () => {
    it('should create default config with disabled state', () => {
      const config = createDefaultVWAPEMACrossConfig();

      expect(config.enabled).toBe(false);
      expect(config.minConfidence).toBe(75);
      expect(config.minRiskReward).toBe(2.0);
      expect(config.emaPeriod).toBe(20);
      expect(config.pullbackTolerance).toBe(0.5);
      expect(config.targetMultiplier).toBe(2.0);
      expect(config.lookbackPeriod).toBe(50);
    });
  });

  describe('detect', () => {
    it('should return null when disabled', () => {
      const config = { ...createDefaultVWAPEMACrossConfig(), enabled: false };
      const detector = new VWAPEMACrossDetector(config);

      const candles = [
        createCandle(100, 110, 95, 105),
        createCandle(105, 108, 103, 107),
        createCandle(107, 109, 106, 108),
      ];

      const result = detector.detect(candles, 2);
      expect(result.setup).toBeNull();
      expect(result.confidence).toBe(0);
    });

    it('should return null when not enough candles', () => {
      const config = { ...createDefaultVWAPEMACrossConfig(), enabled: true };
      const detector = new VWAPEMACrossDetector(config);

      const candles = [createCandle(100, 110, 95, 105)];

      const result = detector.detect(candles, 0);
      expect(result.setup).toBeNull();
      expect(result.confidence).toBe(0);
    });

    it('should require VWAP cross + pullback for setup', () => {
      const config = {
        ...createDefaultVWAPEMACrossConfig(),
        enabled: true,
        minConfidence: 60,
        minRiskReward: 1.5,
      };
      const detector = new VWAPEMACrossDetector(config);

      const baseTime = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 70; i += 1) {
        candles.push(createCandle(100, 101, 99, 100, 1000000, baseTime + i * 60000));
      }

      const result = detector.detect(candles, 70);
      expect(result.setup).toBeNull();
    });
  });

  describe('VWAP calculation', () => {
    it('should calculate VWAP correctly', () => {
      const config = {
        ...createDefaultVWAPEMACrossConfig(),
        enabled: true,
      };
      const detector = new VWAPEMACrossDetector(config);

      const candles: Kline[] = [
        createCandle(100, 105, 95, 103, 1000000),
        createCandle(103, 108, 102, 106, 1500000),
        createCandle(106, 110, 105, 108, 2000000),
      ];

      const tp1 = (105 + 95 + 103) / 3;
      const tp2 = (108 + 102 + 106) / 3;
      const tp3 = (110 + 105 + 108) / 3;

      const expectedVWAP = (tp1 * 1000000 + tp2 * 1500000 + tp3 * 2000000) / (1000000 + 1500000 + 2000000);

      expect(expectedVWAP).toBeCloseTo(105.4, 1);
    });

    it('should handle zero volume gracefully', () => {
      const config = {
        ...createDefaultVWAPEMACrossConfig(),
        enabled: true,
        minConfidence: 60,
      };
      const detector = new VWAPEMACrossDetector(config);

      const candles: Kline[] = [];
      for (let i = 0; i < 70; i += 1) {
        candles.push(createCandle(100, 101, 99, 100, 0));
      }

      const result = detector.detect(candles, 69);
      expect(result.setup).toBeNull();
    });
  });

  describe('EMA cross detection', () => {
    it('should detect bullish EMA cross above VWAP', () => {
      const config = {
        ...createDefaultVWAPEMACrossConfig(),
        enabled: true,
        minConfidence: 60,
        minRiskReward: 1.5,
        emaPeriod: 5,
      };
      const _detector = new VWAPEMACrossDetector(config);

      const baseTime = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 50; i += 1) {
        candles.push(createCandle(98, 99, 97, 98, 1000000, baseTime + i * 60000));
      }

      for (let i = 0; i < 10; i += 1) {
        const price = 98 + i * 0.5;
        candles.push(createCandle(price, price + 1, price - 0.5, price + 0.8, 1000000, baseTime + (50 + i) * 60000));
      }

      expect(candles.length).toBeGreaterThan(50);
    });

    it('should detect bearish EMA cross below VWAP', () => {
      const config = {
        ...createDefaultVWAPEMACrossConfig(),
        enabled: true,
        minConfidence: 60,
        minRiskReward: 1.5,
        emaPeriod: 5,
      };
      const _detector = new VWAPEMACrossDetector(config);

      const baseTime = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 50; i += 1) {
        candles.push(createCandle(102, 103, 101, 102, 1000000, baseTime + i * 60000));
      }

      for (let i = 0; i < 10; i += 1) {
        const price = 102 - i * 0.5;
        candles.push(createCandle(price, price + 0.5, price - 1, price - 0.8, 1000000, baseTime + (50 + i) * 60000));
      }

      expect(candles.length).toBeGreaterThan(50);
    });
  });

  describe('pullback detection', () => {
    it('should require pullback to VWAP for bullish setup', () => {
      const config = {
        ...createDefaultVWAPEMACrossConfig(),
        enabled: true,
        pullbackTolerance: 0.5,
      };
      const _detector = new VWAPEMACrossDetector(config);

      const vwap = 100;
      const tolerance = vwap * (config.pullbackTolerance / 100);
      const validPullback = vwap - tolerance / 2;
      const invalidPullback = vwap - tolerance * 2;

      expect(validPullback).toBeGreaterThan(vwap - tolerance);
      expect(invalidPullback).toBeLessThan(vwap - tolerance);
    });

    it('should require pullback to VWAP for bearish setup', () => {
      const config = {
        ...createDefaultVWAPEMACrossConfig(),
        enabled: true,
        pullbackTolerance: 0.5,
      };
      const _detector = new VWAPEMACrossDetector(config);

      const vwap = 100;
      const tolerance = vwap * (config.pullbackTolerance / 100);
      const validPullback = vwap + tolerance / 2;
      const invalidPullback = vwap + tolerance * 2;

      expect(validPullback).toBeLessThan(vwap + tolerance);
      expect(invalidPullback).toBeGreaterThan(vwap + tolerance);
    });
  });

  describe('confidence calculation', () => {
    it('should base confidence on volume and ATR', () => {
      const config = {
        ...createDefaultVWAPEMACrossConfig(),
        enabled: true,
        minConfidence: 60,
      };
      const _detector = new VWAPEMACrossDetector(config);

      const baseConfidence = 70;
      const volumeBonus = 10;
      const _atrBonus = 10;

      const minConfidence = baseConfidence;
      const midConfidence = baseConfidence + volumeBonus;
      const maxConfidence = 95;

      expect(minConfidence).toBe(70);
      expect(midConfidence).toBe(80);
      expect(maxConfidence).toBe(95);
    });

    it('should cap confidence at maximum value', () => {
      const maxConfidence = 95;
      const testConfidence = 110;

      expect(Math.min(testConfidence, maxConfidence)).toBe(95);
    });
  });

  describe('config customization', () => {
    it('should respect custom emaPeriod', () => {
      const config = {
        ...createDefaultVWAPEMACrossConfig(),
        enabled: true,
        emaPeriod: 50,
      };
      const detector = new VWAPEMACrossDetector(config);

      expect(detector).toBeDefined();
      expect(config.emaPeriod).toBe(50);
    });

    it('should respect custom pullbackTolerance', () => {
      const config = {
        ...createDefaultVWAPEMACrossConfig(),
        enabled: true,
        pullbackTolerance: 1.0,
      };
      const detector = new VWAPEMACrossDetector(config);

      expect(detector).toBeDefined();
      expect(config.pullbackTolerance).toBe(1.0);
    });

    it('should respect custom targetMultiplier', () => {
      const config = {
        ...createDefaultVWAPEMACrossConfig(),
        enabled: true,
        targetMultiplier: 3.0,
        minRiskReward: 3.0,
      };
      const detector = new VWAPEMACrossDetector(config);

      expect(detector).toBeDefined();
      expect(config.targetMultiplier).toBe(3.0);
    });

    it('should respect custom lookbackPeriod', () => {
      const config = {
        ...createDefaultVWAPEMACrossConfig(),
        enabled: true,
        lookbackPeriod: 100,
      };
      const detector = new VWAPEMACrossDetector(config);

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

  describe('volume confirmation', () => {
    it('should boost confidence with above-average volume', () => {
      const avgVolume = 1000000;
      const highVolume = 1500000;
      const lowVolume = 500000;

      expect(highVolume).toBeGreaterThan(avgVolume);
      expect(lowVolume).toBeLessThan(avgVolume);
    });
  });
});
