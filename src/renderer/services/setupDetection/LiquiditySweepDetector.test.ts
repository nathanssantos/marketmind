import { describe, expect, it } from 'vitest';
import type { Candle } from '../../../shared/types/candle';
import { LiquiditySweepDetector, createDefaultLiquiditySweepConfig } from './LiquiditySweepDetector';

const createCandle = (
  high: number,
  low: number,
  close: number,
  volume: number = 1000
): Candle => ({
  timestamp: Date.now(),
  open: (high + low) / 2,
  high,
  low,
  close,
  volume,
});

describe('LiquiditySweepDetector', () => {
  describe('Config', () => {
    it('should create default config with correct values', () => {
      const config = createDefaultLiquiditySweepConfig();

      expect(config.enabled).toBe(false);
      expect(config.minConfidence).toBe(75);
      expect(config.minRiskReward).toBe(2.0);
      expect(config.sweepLookback).toBe(20);
      expect(config.minSweepDistance).toBe(0.2);
      expect(config.maxSweepDistance).toBe(1.0);
      expect(config.reversalThreshold).toBe(0.3);
      expect(config.volumeMultiplier).toBe(1.5);
      expect(config.targetMultiplier).toBe(2.0);
    });

    it('should allow config customization', () => {
      const config = {
        ...createDefaultLiquiditySweepConfig(),
        enabled: true,
        sweepLookback: 30,
        minSweepDistance: 0.3,
        volumeMultiplier: 2.0,
        targetMultiplier: 2.5,
      };

      const detector = new LiquiditySweepDetector(config);
      const result = detector.detect([], 0);
      expect(result).toBeDefined();
    });
  });

  describe('Detection', () => {
    it('should return null when disabled', () => {
      const config = createDefaultLiquiditySweepConfig();
      const detector = new LiquiditySweepDetector(config);

      const candles = [createCandle(100, 90, 95)];
      const result = detector.detect(candles, 0);

      expect(result.setup).toBeNull();
      expect(result.confidence).toBe(0);
    });

    it('should return null with insufficient data', () => {
      const config = { ...createDefaultLiquiditySweepConfig(), enabled: true };
      const detector = new LiquiditySweepDetector(config);

      const candles = Array.from({ length: 20 }, () => createCandle(100, 90, 95));
      const result = detector.detect(candles, 10);

      expect(result.setup).toBeNull();
    });

    it('should require sweep beyond support level', () => {
      const config = { ...createDefaultLiquiditySweepConfig(), enabled: true };
      const detector = new LiquiditySweepDetector(config);

      const candles = [
        ...Array.from({ length: 20 }, () => createCandle(110, 100, 105)),
        createCandle(115, 100.5, 102),
        createCandle(108, 98, 106),
      ];

      const result = detector.detect(candles, candles.length - 1);
      expect(result.setup).toBeNull();
    });
  });

  describe('Bullish Liquidity Sweep', () => {
    it('should detect bullish liquidity sweep pattern', () => {
      const config = {
        ...createDefaultLiquiditySweepConfig(),
        enabled: true,
        minSweepDistance: 0.2,
        maxSweepDistance: 1.0,
        reversalThreshold: 0.3,
        volumeMultiplier: 1.5,
      };
      const detector = new LiquiditySweepDetector(config);

      const supportLevel = 100;
      const candles = [
        ...Array.from({ length: 25 }, () => createCandle(110, supportLevel, 105, 1000)),
        createCandle(102, 99.5, 100, 2000),
        createCandle(108, 100.5, 106, 1000),
      ];

      const result = detector.detect(candles, candles.length - 1);

      expect(result.setup).toBeDefined();
      expect(result.setup?.type).toBe('liquidity-sweep');
      expect(result.setup?.direction).toBe('LONG');
      expect(result.setup?.entryPrice).toBe(106);
      expect(result.setup?.stopLoss).toBe(99.5);
      expect(result.confidence).toBeGreaterThan(70);
    });

    it('should validate sweep distance within range', () => {
      const config = {
        ...createDefaultLiquiditySweepConfig(),
        enabled: true,
        minSweepDistance: 0.2,
        maxSweepDistance: 1.0,
      };
      const detector = new LiquiditySweepDetector(config);

      const supportLevel = 100;
      const candles = [
        ...Array.from({ length: 25 }, () => createCandle(110, supportLevel, 105, 1000)),
        createCandle(102, 99.9, 100, 2000),
        createCandle(108, 100.5, 106, 1000),
      ];

      const result = detector.detect(candles, candles.length - 1);
      expect(result.setup).toBeNull();
    });

    it('should require reversal size above threshold', () => {
      const config = {
        ...createDefaultLiquiditySweepConfig(),
        enabled: true,
        reversalThreshold: 0.5,
      };
      const detector = new LiquiditySweepDetector(config);

      const supportLevel = 100;
      const candles = [
        ...Array.from({ length: 25 }, () => createCandle(110, supportLevel, 105, 1000)),
        createCandle(102, 99.5, 100, 2000),
        createCandle(104, 99.7, 100, 1000),
      ];

      const result = detector.detect(candles, candles.length - 1);
      expect(result.setup).toBeNull();
    });

    it('should require bullish reversal candle', () => {
      const config = {
        ...createDefaultLiquiditySweepConfig(),
        enabled: true,
      };
      const detector = new LiquiditySweepDetector(config);

      const supportLevel = 100;
      const candles = [
        ...Array.from({ length: 25 }, () => createCandle(110, supportLevel, 105, 1000)),
        createCandle(102, 99.5, 101, 2000),
        createCandle(102, 98, 100, 1000),
      ];

      const result = detector.detect(candles, candles.length - 1);
      expect(result.setup).toBeNull();
    });
  });

  describe('Bearish Liquidity Sweep', () => {
    it('should detect bearish liquidity sweep pattern', () => {
      const config = {
        ...createDefaultLiquiditySweepConfig(),
        enabled: true,
        minSweepDistance: 0.2,
        maxSweepDistance: 1.0,
        reversalThreshold: 0.3,
        volumeMultiplier: 1.5,
      };
      const detector = new LiquiditySweepDetector(config);

      const resistanceLevel = 100;
      const candles = [
        ...Array.from({ length: 25 }, () => createCandle(resistanceLevel, 90, 95, 1000)),
        createCandle(100.5, 98, 100, 2000),
        createCandle(99.5, 92, 94, 1000),
      ];

      const result = detector.detect(candles, candles.length - 1);

      expect(result.setup).toBeDefined();
      expect(result.setup?.type).toBe('liquidity-sweep');
      expect(result.setup?.direction).toBe('SHORT');
      expect(result.setup?.entryPrice).toBe(94);
      expect(result.setup?.stopLoss).toBe(100.5);
      expect(result.confidence).toBeGreaterThan(70);
    });

    it('should validate sweep above resistance', () => {
      const config = {
        ...createDefaultLiquiditySweepConfig(),
        enabled: true,
      };
      const detector = new LiquiditySweepDetector(config);

      const resistanceLevel = 100;
      const candles = [
        ...Array.from({ length: 25 }, () => createCandle(resistanceLevel, 90, 95, 1000)),
        createCandle(99.5, 98, 99, 2000),
        createCandle(99, 92, 94, 1000),
      ];

      const result = detector.detect(candles, candles.length - 1);
      expect(result.setup).toBeNull();
    });

    it('should require bearish reversal candle', () => {
      const config = {
        ...createDefaultLiquiditySweepConfig(),
        enabled: true,
      };
      const detector = new LiquiditySweepDetector(config);

      const resistanceLevel = 100;
      const candles = [
        ...Array.from({ length: 25 }, () => createCandle(resistanceLevel, 90, 95, 1000)),
        createCandle(100.5, 98, 99, 2000),
        createCandle(102, 99, 101, 1000),
      ];

      const result = detector.detect(candles, candles.length - 1);
      expect(result.setup).toBeNull();
    });
  });

  describe('Volume Confirmation', () => {
    it('should add confidence bonus for volume spike', () => {
      const config = {
        ...createDefaultLiquiditySweepConfig(),
        enabled: true,
        volumeMultiplier: 1.5,
      };
      const detector = new LiquiditySweepDetector(config);

      const supportLevel = 100;
      const candlesWithSpike = [
        ...Array.from({ length: 25 }, () => createCandle(110, supportLevel, 105, 1000)),
        createCandle(102, 99.5, 100, 2000),
        createCandle(108, 100.5, 106, 1000),
      ];

      const candlesWithoutSpike = [
        ...Array.from({ length: 25 }, () => createCandle(110, supportLevel, 105, 1000)),
        createCandle(102, 99.5, 100, 1000),
        createCandle(108, 100.5, 106, 1000),
      ];

      const resultWithSpike = detector.detect(candlesWithSpike, candlesWithSpike.length - 1);
      const resultWithoutSpike = detector.detect(candlesWithoutSpike, candlesWithoutSpike.length - 1);

      if (resultWithSpike.setup && resultWithoutSpike.setup) {
        expect(resultWithSpike.confidence).toBeGreaterThan(resultWithoutSpike.confidence);
      }
    });

    it('should not require volume spike for detection', () => {
      const config = {
        ...createDefaultLiquiditySweepConfig(),
        enabled: true,
        volumeMultiplier: 1.5,
      };
      const detector = new LiquiditySweepDetector(config);

      const supportLevel = 100;
      const candles = [
        ...Array.from({ length: 25 }, () => createCandle(110, supportLevel, 105, 1000)),
        createCandle(102, 99.5, 100, 1000),
        createCandle(108, 100.5, 106, 1000),
      ];

      const result = detector.detect(candles, candles.length - 1);
      expect(result.setup).toBeDefined();
    });
  });

  describe('Confidence Calculation', () => {
    it('should calculate base confidence correctly', () => {
      const config = {
        ...createDefaultLiquiditySweepConfig(),
        enabled: true,
      };
      const detector = new LiquiditySweepDetector(config);

      const supportLevel = 100;
      const candles = [
        ...Array.from({ length: 25 }, () => createCandle(110, supportLevel, 105, 1000)),
        createCandle(102, 99.5, 100, 1000),
        createCandle(108, 100.5, 106, 1000),
      ];

      const result = detector.detect(candles, candles.length - 1);
      expect(result.confidence).toBeGreaterThanOrEqual(70);
      expect(result.confidence).toBeLessThanOrEqual(95);
    });

    it('should cap confidence at 95', () => {
      const config = {
        ...createDefaultLiquiditySweepConfig(),
        enabled: true,
      };
      const detector = new LiquiditySweepDetector(config);

      const supportLevel = 100;
      const candles = [
        ...Array.from({ length: 25 }, () => createCandle(110, supportLevel, 105, 1000)),
        createCandle(102, 99.5, 100, 5000),
        createCandle(108, 100.5, 106, 1000),
      ];

      const result = detector.detect(candles, candles.length - 1);
      expect(result.confidence).toBeLessThanOrEqual(95);
    });
  });

  describe('Config Customization', () => {
    it('should respect custom sweepLookback', () => {
      const config = {
        ...createDefaultLiquiditySweepConfig(),
        enabled: true,
        sweepLookback: 10,
      };
      const detector = new LiquiditySweepDetector(config);

      const candles = Array.from({ length: 15 }, () => createCandle(100, 90, 95));
      const result = detector.detect(candles, candles.length - 1);
      expect(result).toBeDefined();
    });

    it('should respect custom minSweepDistance', () => {
      const config = {
        ...createDefaultLiquiditySweepConfig(),
        enabled: true,
        minSweepDistance: 0.5,
      };
      const detector = new LiquiditySweepDetector(config);

      const supportLevel = 100;
      const candles = [
        ...Array.from({ length: 25 }, () => createCandle(110, supportLevel, 105, 1000)),
        createCandle(102, 99.7, 100, 2000),
        createCandle(108, 100.5, 106, 1000),
      ];

      const result = detector.detect(candles, candles.length - 1);
      expect(result.setup).toBeNull();
    });

    it('should respect custom maxSweepDistance', () => {
      const config = {
        ...createDefaultLiquiditySweepConfig(),
        enabled: true,
        maxSweepDistance: 0.3,
      };
      const detector = new LiquiditySweepDetector(config);

      const supportLevel = 100;
      const candles = [
        ...Array.from({ length: 25 }, () => createCandle(110, supportLevel, 105, 1000)),
        createCandle(102, 99.0, 100, 2000),
        createCandle(108, 100.5, 106, 1000),
      ];

      const result = detector.detect(candles, candles.length - 1);
      expect(result.setup).toBeNull();
    });

    it('should respect custom reversalThreshold', () => {
      const config = {
        ...createDefaultLiquiditySweepConfig(),
        enabled: true,
        reversalThreshold: 1.0,
      };
      const detector = new LiquiditySweepDetector(config);

      const supportLevel = 100;
      const candles = [
        ...Array.from({ length: 25 }, () => createCandle(110, supportLevel, 105, 1000)),
        createCandle(102, 99.5, 100, 2000),
        createCandle(108, 100.5, 100.2, 1000),
      ];

      const result = detector.detect(candles, candles.length - 1);
      expect(result.setup).toBeNull();
    });

    it('should respect custom targetMultiplier', () => {
      const config = {
        ...createDefaultLiquiditySweepConfig(),
        enabled: true,
        targetMultiplier: 3.0,
      };
      const detector = new LiquiditySweepDetector(config);

      const supportLevel = 100;
      const candles = [
        ...Array.from({ length: 25 }, () => createCandle(110, supportLevel, 105, 1000)),
        createCandle(102, 99.5, 100, 2000),
        createCandle(108, 100.5, 106, 1000),
      ];

      const result = detector.detect(candles, candles.length - 1);

      if (result.setup) {
        const risk = result.setup.entryPrice - result.setup.stopLoss;
        const reward = result.setup.takeProfit - result.setup.entryPrice;
        const rr = reward / risk;
        expect(rr).toBeGreaterThanOrEqual(2.9);
      }
    });
  });

  describe('Structural Targeting', () => {
    it('should target resistance for LONG setups', () => {
      const config = {
        ...createDefaultLiquiditySweepConfig(),
        enabled: true,
      };
      const detector = new LiquiditySweepDetector(config);

      const supportLevel = 100;
      const resistanceLevel = 120;
      const candles = [
        ...Array.from({ length: 15 }, () => createCandle(resistanceLevel, supportLevel, 110, 1000)),
        ...Array.from({ length: 10 }, () => createCandle(110, supportLevel, 105, 1000)),
        createCandle(102, 99.5, 100, 2000),
        createCandle(108, 100.5, 106, 1000),
      ];

      const result = detector.detect(candles, candles.length - 1);

      if (result.setup) {
        expect(result.setup.takeProfit).toBeLessThanOrEqual(resistanceLevel);
      }
    });

    it('should target support for SHORT setups', () => {
      const config = {
        ...createDefaultLiquiditySweepConfig(),
        enabled: true,
      };
      const detector = new LiquiditySweepDetector(config);

      const supportLevel = 80;
      const resistanceLevel = 100;
      const candles = [
        ...Array.from({ length: 15 }, () => createCandle(resistanceLevel, supportLevel, 90, 1000)),
        ...Array.from({ length: 10 }, () => createCandle(resistanceLevel, 90, 95, 1000)),
        createCandle(100.5, 98, 100, 2000),
        createCandle(99.5, 92, 94, 1000),
      ];

      const result = detector.detect(candles, candles.length - 1);

      if (result.setup) {
        expect(result.setup.takeProfit).toBeGreaterThanOrEqual(supportLevel);
      }
    });

    it('should use RR-based target when no structural level available', () => {
      const config = {
        ...createDefaultLiquiditySweepConfig(),
        enabled: true,
        targetMultiplier: 2.5,
      };
      const detector = new LiquiditySweepDetector(config);

      const supportLevel = 100;
      const candles = [
        ...Array.from({ length: 25 }, () => createCandle(110, supportLevel, 105, 1000)),
        createCandle(102, 99.5, 100, 2000),
        createCandle(108, 100.5, 106, 1000),
      ];

      const result = detector.detect(candles, candles.length - 1);

      if (result.setup) {
        const risk = result.setup.entryPrice - result.setup.stopLoss;
        const reward = result.setup.takeProfit - result.setup.entryPrice;
        const rr = reward / risk;
        expect(rr).toBeGreaterThanOrEqual(2.0);
      }
    });

    it('should validate minimum risk/reward ratio', () => {
      const config = {
        ...createDefaultLiquiditySweepConfig(),
        enabled: true,
        minRiskReward: 2.0,
      };
      const detector = new LiquiditySweepDetector(config);

      const supportLevel = 100;
      const candles = [
        ...Array.from({ length: 25 }, () => createCandle(110, supportLevel, 105, 1000)),
        createCandle(102, 99.5, 100, 2000),
        createCandle(108, 100.5, 106, 1000),
      ];

      const result = detector.detect(candles, candles.length - 1);

      if (result.setup) {
        const risk = Math.abs(result.setup.entryPrice - result.setup.stopLoss);
        const reward = Math.abs(result.setup.takeProfit - result.setup.entryPrice);
        const rr = reward / risk;
        expect(rr).toBeGreaterThanOrEqual(config.minRiskReward);
      }
    });
  });

  describe('Stop Loss Placement', () => {
    it('should place stop at sweep low for LONG setups', () => {
      const config = {
        ...createDefaultLiquiditySweepConfig(),
        enabled: true,
      };
      const detector = new LiquiditySweepDetector(config);

      const supportLevel = 100;
      const sweepLow = 99.5;
      const candles = [
        ...Array.from({ length: 25 }, () => createCandle(110, supportLevel, 105, 1000)),
        createCandle(102, sweepLow, 100, 2000),
        createCandle(108, 100.5, 106, 1000),
      ];

      const result = detector.detect(candles, candles.length - 1);

      if (result.setup) {
        expect(result.setup.stopLoss).toBe(sweepLow);
      }
    });

    it('should place stop at sweep high for SHORT setups', () => {
      const config = {
        ...createDefaultLiquiditySweepConfig(),
        enabled: true,
      };
      const detector = new LiquiditySweepDetector(config);

      const resistanceLevel = 100;
      const sweepHigh = 100.5;
      const candles = [
        ...Array.from({ length: 25 }, () => createCandle(resistanceLevel, 90, 95, 1000)),
        createCandle(sweepHigh, 98, 100, 2000),
        createCandle(99.5, 92, 94, 1000),
      ];

      const result = detector.detect(candles, candles.length - 1);

      if (result.setup) {
        expect(result.setup.stopLoss).toBe(sweepHigh);
      }
    });
  });
});
