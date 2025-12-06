import type { Kline } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import {
    createDefaultPinInsideConfig,
    PinInsideDetector,
} from './PinInsideDetector';

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

describe('PinInsideDetector', () => {
  describe('createDefaultPinInsideConfig', () => {
    it('should create default config with disabled state', () => {
      const config = createDefaultPinInsideConfig();

      expect(config.enabled).toBe(false);
      expect(config.minConfidence).toBe(75);
      expect(config.minRiskReward).toBe(2.0);
      expect(config.pinBarRatio).toBe(2.0);
      expect(config.srTolerance).toBe(1.0);
      expect(config.targetMultiplier).toBe(2.0);
      expect(config.lookbackPeriod).toBe(50);
    });
  });

  describe('detect', () => {
    it('should return null when disabled', () => {
      const config = { ...createDefaultPinInsideConfig(), enabled: false };
      const detector = new PinInsideDetector(config);

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
      const config = { ...createDefaultPinInsideConfig(), enabled: true };
      const detector = new PinInsideDetector(config);

      const klines = [createKline(100, 110, 95, 105)];

      const result = detector.detect(klines, 0);
      expect(result.setup).toBeNull();
      expect(result.confidence).toBe(0);
    });

    it('should require pin bar to be near S/R level', () => {
      const config = {
        ...createDefaultPinInsideConfig(),
        enabled: true,
        minConfidence: 60,
        minRiskReward: 1.5,
      };
      const detector = new PinInsideDetector(config);

      const baseTime = Date.now();
      const klines: Kline[] = [];

      for (let i = 0; i < 70; i += 1) {
        klines.push(createKline(100, 101, 99, 100, 1000000, baseTime + i * 60000));
      }

      const pinBarKline = createKline(100, 102, 95, 100, 1500000, baseTime + 70 * 60000);
      klines.push(pinBarKline);

      const insideBarKline = createKline(98, 99, 97, 98, 800000, baseTime + 71 * 60000);
      klines.push(insideBarKline);

      const result = detector.detect(klines, 71);
      expect(result.setup).toBeNull();
    });

    it('should reject when inside bar is not truly inside', () => {
      const config = {
        ...createDefaultPinInsideConfig(),
        enabled: true,
        minConfidence: 60,
        minRiskReward: 1.5,
      };
      const detector = new PinInsideDetector(config);

      const baseTime = Date.now();
      const klines: Kline[] = [];

      for (let i = 0; i < 70; i += 1) {
        klines.push(createKline(100, 101, 99, 100, 1000000, baseTime + i * 60000));
      }

      const pinBarKline = createKline(100, 102, 95, 100, 1500000, baseTime + 70 * 60000);
      klines.push(pinBarKline);

      const notInsideKline = createKline(98, 103, 97, 98, 800000, baseTime + 71 * 60000);
      klines.push(notInsideKline);

      const result = detector.detect(klines, 71);
      expect(result.setup).toBeNull();
    });

    it('should reject when pin bar wick is too small', () => {
      const config = {
        ...createDefaultPinInsideConfig(),
        enabled: true,
        minConfidence: 60,
        minRiskReward: 1.5,
      };
      const detector = new PinInsideDetector(config);

      const baseTime = Date.now();
      const klines: Kline[] = [];

      for (let i = 0; i < 70; i += 1) {
        klines.push(createKline(100, 101, 99, 100, 1000000, baseTime + i * 60000));
      }

      const noPinKline = createKline(100, 101, 99, 100, 1500000, baseTime + 70 * 60000);
      klines.push(noPinKline);

      const insideBarKline = createKline(99.5, 100.5, 99, 99.5, 800000, baseTime + 71 * 60000);
      klines.push(insideBarKline);

      const result = detector.detect(klines, 71);
      expect(result.setup).toBeNull();
    });
  });

  describe('config customization', () => {
    it('should respect custom pinBarRatio', () => {
      const config = {
        ...createDefaultPinInsideConfig(),
        enabled: true,
        minConfidence: 60,
        minRiskReward: 1.5,
        pinBarRatio: 3.0,
      };
      const detector = new PinInsideDetector(config);

      expect(detector).toBeDefined();
      expect(config.pinBarRatio).toBe(3.0);
    });

    it('should respect custom targetMultiplier', () => {
      const config = {
        ...createDefaultPinInsideConfig(),
        enabled: true,
        minConfidence: 60,
        minRiskReward: 2.5,
        targetMultiplier: 2.5,
      };
      const detector = new PinInsideDetector(config);

      expect(detector).toBeDefined();
      expect(config.targetMultiplier).toBe(2.5);
    });

    it('should respect custom lookbackPeriod', () => {
      const config = {
        ...createDefaultPinInsideConfig(),
        enabled: true,
        lookbackPeriod: 100,
      };
      const detector = new PinInsideDetector(config);

      expect(detector).toBeDefined();
      expect(config.lookbackPeriod).toBe(100);
    });
  });
});
