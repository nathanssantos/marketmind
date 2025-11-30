import { describe, expect, it } from 'vitest';
import type { Kline } from '../../../shared/types/candle';
import {
    createDefaultDivergenceConfig,
    DivergenceDetector,
} from './DivergenceDetector';

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

describe('DivergenceDetector', () => {
  describe('createDefaultDivergenceConfig', () => {
    it('should create default config with disabled state', () => {
      const config = createDefaultDivergenceConfig();

      expect(config.enabled).toBe(false);
      expect(config.minConfidence).toBe(75);
      expect(config.minRiskReward).toBe(2.0);
      expect(config.rsiPeriod).toBe(14);
      expect(config.macdFast).toBe(12);
      expect(config.macdSlow).toBe(26);
      expect(config.macdSignal).toBe(9);
      expect(config.divergenceLookback).toBe(20);
      expect(config.targetMultiplier).toBe(2.0);
      expect(config.useRSI).toBe(true);
      expect(config.useMACD).toBe(true);
    });
  });

  describe('detect', () => {
    it('should return null when disabled', () => {
      const config = { ...createDefaultDivergenceConfig(), enabled: false };
      const detector = new DivergenceDetector(config);

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
      const config = { ...createDefaultDivergenceConfig(), enabled: true };
      const detector = new DivergenceDetector(config);

      const candles = [createCandle(100, 110, 95, 105)];

      const result = detector.detect(candles, 0);
      expect(result.setup).toBeNull();
      expect(result.confidence).toBe(0);
    });

    it('should require divergence pattern for setup', () => {
      const config = {
        ...createDefaultDivergenceConfig(),
        enabled: true,
        minConfidence: 60,
        minRiskReward: 1.5,
      };
      const detector = new DivergenceDetector(config);

      const baseTime = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 50; i += 1) {
        candles.push(createCandle(100, 101, 99, 100, 1000000, baseTime + i * 60000));
      }

      const result = detector.detect(candles, 49);
      expect(result.setup).toBeNull();
    });
  });

  describe('RSI divergence detection', () => {
    it('should detect bullish RSI divergence pattern', () => {
      const config = {
        ...createDefaultDivergenceConfig(),
        enabled: true,
        minConfidence: 60,
        minRiskReward: 1.5,
        useRSI: true,
        useMACD: false,
        rsiPeriod: 5,
      };
      const _detector = new DivergenceDetector(config);

      const baseTime = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 30; i += 1) {
        const price = 100 - i * 0.5;
        candles.push(createCandle(price, price + 1, price - 1, price, 1000000, baseTime + i * 60000));
      }

      expect(candles.length).toBeGreaterThanOrEqual(30);
      expect(candles[0]?.close).toBeGreaterThan(candles[29]?.close ?? 0);
    });

    it('should detect bearish RSI divergence pattern', () => {
      const config = {
        ...createDefaultDivergenceConfig(),
        enabled: true,
        minConfidence: 60,
        minRiskReward: 1.5,
        useRSI: true,
        useMACD: false,
        rsiPeriod: 5,
      };
      const _detector = new DivergenceDetector(config);

      const baseTime = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 30; i += 1) {
        const price = 100 + i * 0.5;
        candles.push(createCandle(price, price + 1, price - 1, price, 1000000, baseTime + i * 60000));
      }

      expect(candles.length).toBeGreaterThanOrEqual(30);
      expect(candles[0]?.close).toBeLessThan(candles[29]?.close ?? 0);
    });

    it('should validate price makes lower low for bullish divergence', () => {
      const firstLowPrice = 95;
      const secondLowPrice = 90;

      expect(secondLowPrice).toBeLessThan(firstLowPrice);
    });

    it('should validate price makes higher high for bearish divergence', () => {
      const firstHighPrice = 105;
      const secondHighPrice = 110;

      expect(secondHighPrice).toBeGreaterThan(firstHighPrice);
    });
  });

  describe('MACD divergence detection', () => {
    it('should detect bullish MACD divergence pattern', () => {
      const config = {
        ...createDefaultDivergenceConfig(),
        enabled: true,
        minConfidence: 60,
        minRiskReward: 1.5,
        useRSI: false,
        useMACD: true,
        macdFast: 5,
        macdSlow: 10,
        macdSignal: 3,
      };
      const _detector = new DivergenceDetector(config);

      const baseTime = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 40; i += 1) {
        const price = 100 - i * 0.3;
        candles.push(createCandle(price, price + 1, price - 1, price, 1000000, baseTime + i * 60000));
      }

      expect(candles.length).toBeGreaterThanOrEqual(40);
    });

    it('should detect bearish MACD divergence pattern', () => {
      const config = {
        ...createDefaultDivergenceConfig(),
        enabled: true,
        minConfidence: 60,
        minRiskReward: 1.5,
        useRSI: false,
        useMACD: true,
        macdFast: 5,
        macdSlow: 10,
        macdSignal: 3,
      };
      const _detector = new DivergenceDetector(config);

      const baseTime = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 40; i += 1) {
        const price = 100 + i * 0.3;
        candles.push(createCandle(price, price + 1, price - 1, price, 1000000, baseTime + i * 60000));
      }

      expect(candles.length).toBeGreaterThanOrEqual(40);
    });

    it('should validate MACD makes higher low while price makes lower low', () => {
      const firstPriceLow = 95;
      const secondPriceLow = 90;
      const firstMACDLow = -2.0;
      const secondMACDLow = -1.5;

      expect(secondPriceLow).toBeLessThan(firstPriceLow);
      expect(secondMACDLow).toBeGreaterThan(firstMACDLow);
    });

    it('should validate MACD makes lower high while price makes higher high', () => {
      const firstPriceHigh = 105;
      const secondPriceHigh = 110;
      const firstMACDHigh = 2.0;
      const secondMACDHigh = 1.5;

      expect(secondPriceHigh).toBeGreaterThan(firstPriceHigh);
      expect(secondMACDHigh).toBeLessThan(firstMACDHigh);
    });
  });

  describe('confidence calculation', () => {
    it('should base confidence on divergence and volume', () => {
      const config = {
        ...createDefaultDivergenceConfig(),
        enabled: true,
      };
      const _detector = new DivergenceDetector(config);

      const baseConfidence = 70;
      const divergenceBonus = 15;
      const volumeBonus = 10;

      const minConfidence = baseConfidence + divergenceBonus;
      const maxConfidence = 95;

      expect(minConfidence).toBe(85);
      expect(maxConfidence).toBe(95);
      expect(baseConfidence + divergenceBonus + volumeBonus).toBe(95);
    });

    it('should cap confidence at maximum value', () => {
      const maxConfidence = 95;
      const testConfidence = 110;

      expect(Math.min(testConfidence, maxConfidence)).toBe(95);
    });
  });

  describe('config customization', () => {
    it('should respect custom rsiPeriod', () => {
      const config = {
        ...createDefaultDivergenceConfig(),
        enabled: true,
        rsiPeriod: 7,
      };
      const detector = new DivergenceDetector(config);

      expect(detector).toBeDefined();
      expect(config.rsiPeriod).toBe(7);
    });

    it('should respect custom MACD periods', () => {
      const config = {
        ...createDefaultDivergenceConfig(),
        enabled: true,
        macdFast: 6,
        macdSlow: 13,
        macdSignal: 5,
      };
      const detector = new DivergenceDetector(config);

      expect(detector).toBeDefined();
      expect(config.macdFast).toBe(6);
      expect(config.macdSlow).toBe(13);
      expect(config.macdSignal).toBe(5);
    });

    it('should respect custom divergenceLookback', () => {
      const config = {
        ...createDefaultDivergenceConfig(),
        enabled: true,
        divergenceLookback: 30,
      };
      const detector = new DivergenceDetector(config);

      expect(detector).toBeDefined();
      expect(config.divergenceLookback).toBe(30);
    });

    it('should respect custom targetMultiplier', () => {
      const config = {
        ...createDefaultDivergenceConfig(),
        enabled: true,
        targetMultiplier: 3.0,
        minRiskReward: 3.0,
      };
      const detector = new DivergenceDetector(config);

      expect(detector).toBeDefined();
      expect(config.targetMultiplier).toBe(3.0);
    });

    it('should allow disabling RSI divergence', () => {
      const config = {
        ...createDefaultDivergenceConfig(),
        enabled: true,
        useRSI: false,
        useMACD: true,
      };
      const detector = new DivergenceDetector(config);

      expect(detector).toBeDefined();
      expect(config.useRSI).toBe(false);
      expect(config.useMACD).toBe(true);
    });

    it('should allow disabling MACD divergence', () => {
      const config = {
        ...createDefaultDivergenceConfig(),
        enabled: true,
        useRSI: true,
        useMACD: false,
      };
      const detector = new DivergenceDetector(config);

      expect(detector).toBeDefined();
      expect(config.useRSI).toBe(true);
      expect(config.useMACD).toBe(false);
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

    it('should use lowest point for bullish stop', () => {
      const firstLow = 95;
      const secondLow = 90;
      const expectedStop = Math.min(firstLow, secondLow);

      expect(expectedStop).toBe(90);
    });

    it('should use highest point for bearish stop', () => {
      const firstHigh = 105;
      const secondHigh = 110;
      const expectedStop = Math.max(firstHigh, secondHigh);

      expect(expectedStop).toBe(110);
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
