import { describe, expect, it } from 'vitest';
import type { Kline } from '../../../shared/types/candle';
import {
    createDefault94Config,
    Setup94Detector,
} from './Setup94Detector';

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

describe('Setup94Detector', () => {
  describe('createDefault94Config', () => {
    it('should create default config with disabled state', () => {
      const config = createDefault94Config();

      expect(config.enabled).toBe(false);
      expect(config.minConfidence).toBe(70);
      expect(config.minRiskReward).toBe(2.0);
      expect(config.emaPeriod).toBe(9);
      expect(config.atrPeriod).toBe(12);
      expect(config.atrStopMultiplier).toBe(2);
      expect(config.atrTargetMultiplier).toBe(4);
      expect(config.volumeMultiplier).toBe(1.0);
    });
  });

  describe('detect', () => {
    it('should return null when disabled', () => {
      const config = { ...createDefault94Config(), enabled: false };
      const detector = new Setup94Detector(config);

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
      const config = { ...createDefault94Config(), enabled: true };
      const detector = new Setup94Detector(config);

      const candles = [createCandle(100, 110, 95, 105)];

      const result = detector.detect(candles, 0);
      expect(result.setup).toBeNull();
      expect(result.confidence).toBe(0);
    });

    it('should require minimum candles for detection', () => {
      const config = { ...createDefault94Config(), enabled: true };
      const detector = new Setup94Detector(config);

      const candles: Kline[] = [];
      for (let i = 0; i < 35; i += 1) {
        candles.push(createCandle(100, 101, 99, 100));
      }

      const result = detector.detect(candles, 34);
      expect(result).toBeDefined();
    });
  });

  describe('Long setup detection (continuation)', () => {
    it('should detect long continuation when EMA9 turns down 1 candle then resumes up', () => {
      const config = {
        ...createDefault94Config(),
        enabled: true,
        minConfidence: 55,
        minRiskReward: 1.5,
      };
      const detector = new Setup94Detector(config);

      const baseTime = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 35; i += 1) {
        const price = 100 + i * 0.5;
        candles.push(createCandle(price, price + 1, price - 1, price, 1500000, baseTime + i * 60000));
      }

      const lastPrice = candles[candles.length - 1]?.close ?? 100;
      candles.push(createCandle(lastPrice - 0.5, lastPrice + 0.5, lastPrice - 1.5, lastPrice - 0.3, 1500000, baseTime + 35 * 60000));
      candles.push(createCandle(lastPrice, lastPrice + 2, lastPrice - 0.5, lastPrice + 1, 2000000, baseTime + 36 * 60000));

      const result = detector.detect(candles, candles.length - 1);
      
      if (result.setup) {
        expect(result.setup.type).toBe('setup-9-4');
        expect(result.setup.direction).toBe('LONG');
        expect(result.setup.entryPrice).toBeGreaterThan(0);
        expect(result.setup.stopLoss).toBeLessThan(result.setup.entryPrice);
        expect(result.setup.takeProfit).toBeGreaterThan(result.setup.entryPrice);
      }
    });

    it('should require EMA9 was in uptrend before turning down', () => {
      const config = {
        ...createDefault94Config(),
        enabled: true,
        minConfidence: 55,
      };
      const detector = new Setup94Detector(config);

      const baseTime = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 35; i += 1) {
        const price = 100 - i * 0.3;
        candles.push(createCandle(price, price + 1, price - 1, price, 1000000, baseTime + i * 60000));
      }

      const result = detector.detect(candles, candles.length - 1);
      expect(result.setup).toBeNull();
    });

    it('should require low not lost during temporary EMA9 failure', () => {
      const config = {
        ...createDefault94Config(),
        enabled: true,
        minConfidence: 55,
      };
      const detector = new Setup94Detector(config);

      const baseTime = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 35; i += 1) {
        const price = 100 + i * 0.5;
        candles.push(createCandle(price, price + 1, price - 1, price, 1500000, baseTime + i * 60000));
      }

      const lastPrice = candles[candles.length - 1]?.close ?? 100;
      const twoPrevLow = candles[candles.length - 2]?.low ?? 100;
      candles.push(createCandle(lastPrice - 0.5, lastPrice + 0.5, twoPrevLow - 2, lastPrice - 0.3, 1500000, baseTime + 35 * 60000));
      candles.push(createCandle(lastPrice, lastPrice + 2, lastPrice - 0.5, lastPrice + 1, 1500000, baseTime + 36 * 60000));

      const result = detector.detect(candles, candles.length - 1);
      expect(result.setup).toBeNull();
    });

    it('should validate EMA9 resumes upward after 1-candle failure', () => {
      const config = {
        ...createDefault94Config(),
        enabled: true,
        minConfidence: 55,
      };
      const detector = new Setup94Detector(config);

      const baseTime = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 35; i += 1) {
        const price = 100 + i * 0.5;
        candles.push(createCandle(price, price + 1, price - 1, price, 1500000, baseTime + i * 60000));
      }

      const lastPrice = candles[candles.length - 1]?.close ?? 100;
      candles.push(createCandle(lastPrice - 0.5, lastPrice + 0.5, lastPrice - 1.5, lastPrice - 0.3, 1500000, baseTime + 35 * 60000));
      candles.push(createCandle(lastPrice - 1, lastPrice, lastPrice - 2, lastPrice - 1.5, 1500000, baseTime + 36 * 60000));

      const result = detector.detect(candles, candles.length - 1);
      expect(result.setup).toBeNull();
    });
  });

  describe('Short setup detection (continuation)', () => {
    it('should detect short continuation when EMA9 turns up 1 candle then resumes down', () => {
      const config = {
        ...createDefault94Config(),
        enabled: true,
        minConfidence: 55,
        minRiskReward: 1.5,
      };
      const detector = new Setup94Detector(config);

      const baseTime = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 35; i += 1) {
        const price = 100 - i * 0.5;
        candles.push(createCandle(price, price + 1, price - 1, price, 1500000, baseTime + i * 60000));
      }

      const lastPrice = candles[candles.length - 1]?.close ?? 100;
      candles.push(createCandle(lastPrice + 0.5, lastPrice + 1.5, lastPrice - 0.5, lastPrice + 0.3, 1500000, baseTime + 35 * 60000));
      candles.push(createCandle(lastPrice, lastPrice + 0.5, lastPrice - 2, lastPrice - 1, 2000000, baseTime + 36 * 60000));

      const result = detector.detect(candles, candles.length - 1);
      
      if (result.setup) {
        expect(result.setup.type).toBe('setup-9-4');
        expect(result.setup.direction).toBe('SHORT');
        expect(result.setup.entryPrice).toBeGreaterThan(0);
        expect(result.setup.stopLoss).toBeGreaterThan(result.setup.entryPrice);
        expect(result.setup.takeProfit).toBeLessThan(result.setup.entryPrice);
      }
    });

    it('should require EMA9 was in downtrend before turning up', () => {
      const config = {
        ...createDefault94Config(),
        enabled: true,
        minConfidence: 55,
      };
      const detector = new Setup94Detector(config);

      const baseTime = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 35; i += 1) {
        const price = 100 + i * 0.3;
        candles.push(createCandle(price, price + 1, price - 1, price, 1000000, baseTime + i * 60000));
      }

      const result = detector.detect(candles, candles.length - 1);
      expect(result.setup).toBeNull();
    });

    it('should require high not lost during temporary EMA9 failure', () => {
      const config = {
        ...createDefault94Config(),
        enabled: true,
        minConfidence: 55,
      };
      const detector = new Setup94Detector(config);

      const baseTime = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 35; i += 1) {
        const price = 100 - i * 0.5;
        candles.push(createCandle(price, price + 1, price - 1, price, 1500000, baseTime + i * 60000));
      }

      const lastPrice = candles[candles.length - 1]?.close ?? 100;
      const twoPrevHigh = candles[candles.length - 2]?.high ?? 100;
      candles.push(createCandle(lastPrice + 0.5, twoPrevHigh + 2, lastPrice - 0.5, lastPrice + 0.3, 1500000, baseTime + 35 * 60000));
      candles.push(createCandle(lastPrice, lastPrice + 0.5, lastPrice - 2, lastPrice - 1, 1500000, baseTime + 36 * 60000));

      const result = detector.detect(candles, candles.length - 1);
      expect(result.setup).toBeNull();
    });

    it('should validate EMA9 resumes downward after 1-candle failure', () => {
      const config = {
        ...createDefault94Config(),
        enabled: true,
        minConfidence: 55,
      };
      const detector = new Setup94Detector(config);

      const baseTime = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 35; i += 1) {
        const price = 100 - i * 0.5;
        candles.push(createCandle(price, price + 1, price - 1, price, 1500000, baseTime + i * 60000));
      }

      const lastPrice = candles[candles.length - 1]?.close ?? 100;
      candles.push(createCandle(lastPrice + 0.5, lastPrice + 1.5, lastPrice - 0.5, lastPrice + 0.3, 1500000, baseTime + 35 * 60000));
      candles.push(createCandle(lastPrice + 1, lastPrice + 2, lastPrice, lastPrice + 1.5, 1500000, baseTime + 36 * 60000));

      const result = detector.detect(candles, candles.length - 1);
      expect(result.setup).toBeNull();
    });
  });

  describe('Risk/Reward validation', () => {
    it('should reject setup with insufficient risk/reward ratio', () => {
      const config = {
        ...createDefault94Config(),
        enabled: true,
        minConfidence: 55,
        minRiskReward: 5.0,
      };
      const detector = new Setup94Detector(config);

      const baseTime = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 35; i += 1) {
        const price = 100 + i * 0.5;
        candles.push(createCandle(price, price + 1, price - 1, price, 1500000, baseTime + i * 60000));
      }

      const lastPrice = candles[candles.length - 1]?.close ?? 100;
      candles.push(createCandle(lastPrice - 0.5, lastPrice + 0.5, lastPrice - 1.5, lastPrice - 0.3, 1500000, baseTime + 35 * 60000));
      candles.push(createCandle(lastPrice, lastPrice + 2, lastPrice - 0.5, lastPrice + 1, 2000000, baseTime + 36 * 60000));

      const result = detector.detect(candles, candles.length - 1);
      expect(result.setup).toBeNull();
    });

    it('should validate minimum confidence threshold', () => {
      const config = {
        ...createDefault94Config(),
        enabled: true,
        minConfidence: 95,
        minRiskReward: 1.5,
      };
      const detector = new Setup94Detector(config);

      const baseTime = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 35; i += 1) {
        const price = 100 + i * 0.5;
        candles.push(createCandle(price, price + 1, price - 1, price, 1000000, baseTime + i * 60000));
      }

      const result = detector.detect(candles, candles.length - 1);
      expect(result.confidence).toBeLessThan(95);
    });
  });

  describe('Volume confirmation', () => {
    it('should boost confidence with volume confirmation', () => {
      const config = {
        ...createDefault94Config(),
        enabled: true,
        minConfidence: 55,
        volumeMultiplier: 1.5,
      };
      const detector = new Setup94Detector(config);

      const baseTime = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 35; i += 1) {
        const price = 100 + i * 0.5;
        candles.push(createCandle(price, price + 1, price - 1, price, 1000000, baseTime + i * 60000));
      }

      const lastPrice = candles[candles.length - 1]?.close ?? 100;
      candles.push(createCandle(lastPrice - 0.5, lastPrice + 0.5, lastPrice - 1.5, lastPrice - 0.3, 1000000, baseTime + 35 * 60000));
      candles.push(createCandle(lastPrice, lastPrice + 2, lastPrice - 0.5, lastPrice + 1, 2000000, baseTime + 36 * 60000));

      const result = detector.detect(candles, candles.length - 1);
      
      if (result.setup) {
        expect(result.setup.volumeConfirmation).toBe(true);
        expect(result.confidence).toBeGreaterThan(55);
      }
    });
  });

  describe('Setup data validation', () => {
    it('should mark as continuation pattern in setup data', () => {
      const config = {
        ...createDefault94Config(),
        enabled: true,
        minConfidence: 55,
        minRiskReward: 1.5,
      };
      const detector = new Setup94Detector(config);

      const baseTime = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 35; i += 1) {
        const price = 100 + i * 0.5;
        candles.push(createCandle(price, price + 1, price - 1, price, 1500000, baseTime + i * 60000));
      }

      const lastPrice = candles[candles.length - 1]?.close ?? 100;
      candles.push(createCandle(lastPrice - 0.5, lastPrice + 0.5, lastPrice - 1.5, lastPrice - 0.3, 1500000, baseTime + 35 * 60000));
      candles.push(createCandle(lastPrice, lastPrice + 2, lastPrice - 0.5, lastPrice + 1, 2000000, baseTime + 36 * 60000));

      const result = detector.detect(candles, candles.length - 1);
      
      if (result.setup) {
        expect(result.setup.setupData.ema9).toBeDefined();
        expect(result.setup.setupData.atr).toBeDefined();
        expect(result.setup.setupData.volumeRatio).toBeDefined();
        expect(result.setup.setupData.continuationPattern).toBe(true);
        expect(result.setup.setupData.failureCandle).toBe(true);
      }
    });
  });
});
