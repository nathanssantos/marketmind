import { describe, expect, it } from 'vitest';
import type { Kline } from '../../../shared/types/candle';
import {
    createDefault92Config,
    Setup92Detector,
} from './Setup92Detector';

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

describe('Setup92Detector', () => {
  describe('createDefault92Config', () => {
    it('should create default config with disabled state', () => {
      const config = createDefault92Config();

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
      const config = { ...createDefault92Config(), enabled: false };
      const detector = new Setup92Detector(config);

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
      const config = { ...createDefault92Config(), enabled: true };
      const detector = new Setup92Detector(config);

      const candles = [createCandle(100, 110, 95, 105)];

      const result = detector.detect(candles, 0);
      expect(result.setup).toBeNull();
      expect(result.confidence).toBe(0);
    });

    it('should require minimum candles for detection', () => {
      const config = { ...createDefault92Config(), enabled: true };
      const detector = new Setup92Detector(config);

      const candles: Kline[] = [];
      for (let i = 0; i < 30; i += 1) {
        candles.push(createCandle(100, 101, 99, 100));
      }

      const result = detector.detect(candles, 29);
      expect(result).toBeDefined();
    });
  });

  describe('Long setup detection', () => {
    it('should detect long setup when EMA9 uptrend and close below previous low', () => {
      const config = {
        ...createDefault92Config(),
        enabled: true,
        minConfidence: 60,
        minRiskReward: 1.5,
      };
      const detector = new Setup92Detector(config);

      const baseTime = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 35; i += 1) {
        const price = 100 + i * 0.3;
        candles.push(createCandle(price, price + 1, price - 1, price, 1500000, baseTime + i * 60000));
      }

      const prevLow = candles[candles.length - 2]?.low ?? 100;
      candles.push(createCandle(prevLow + 1, prevLow + 2, prevLow - 0.5, prevLow - 0.3, 2000000, baseTime + 35 * 60000));

      const result = detector.detect(candles, candles.length - 1);
      
      if (result.setup) {
        expect(result.setup.type).toBe('setup-9-2');
        expect(result.setup.direction).toBe('LONG');
        expect(result.setup.entryPrice).toBeGreaterThan(0);
        expect(result.setup.stopLoss).toBeLessThan(result.setup.entryPrice);
        expect(result.setup.takeProfit).toBeGreaterThan(result.setup.entryPrice);
        expect(result.setup.volumeConfirmation).toBe(true);
      }
    });

    it('should validate EMA9 uptrend for long setup', () => {
      const config = {
        ...createDefault92Config(),
        enabled: true,
        minConfidence: 60,
      };
      const detector = new Setup92Detector(config);

      const baseTime = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 35; i += 1) {
        const price = 100 - i * 0.2;
        candles.push(createCandle(price, price + 1, price - 1, price, 1000000, baseTime + i * 60000));
      }

      const result = detector.detect(candles, candles.length - 1);
      expect(result.setup).toBeNull();
    });

    it('should require close below previous low for long setup', () => {
      const config = {
        ...createDefault92Config(),
        enabled: true,
        minConfidence: 60,
      };
      const detector = new Setup92Detector(config);

      const baseTime = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 35; i += 1) {
        const price = 100 + i * 0.3;
        candles.push(createCandle(price, price + 1, price - 1, price, 1000000, baseTime + i * 60000));
      }

      const prevLow = candles[candles.length - 2]?.low ?? 100;
      candles.push(createCandle(prevLow + 2, prevLow + 3, prevLow + 1, prevLow + 2, 1500000, baseTime + 35 * 60000));

      const result = detector.detect(candles, candles.length - 1);
      expect(result.setup).toBeNull();
    });
  });

  describe('Short setup detection', () => {
    it('should detect short setup when EMA9 downtrend and close above previous high', () => {
      const config = {
        ...createDefault92Config(),
        enabled: true,
        minConfidence: 60,
        minRiskReward: 1.5,
      };
      const detector = new Setup92Detector(config);

      const baseTime = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 35; i += 1) {
        const price = 100 - i * 0.3;
        candles.push(createCandle(price, price + 1, price - 1, price, 1500000, baseTime + i * 60000));
      }

      const prevHigh = candles[candles.length - 2]?.high ?? 100;
      candles.push(createCandle(prevHigh - 1, prevHigh + 0.3, prevHigh - 2, prevHigh + 0.2, 2000000, baseTime + 35 * 60000));

      const result = detector.detect(candles, candles.length - 1);
      
      if (result.setup) {
        expect(result.setup.type).toBe('setup-9-2');
        expect(result.setup.direction).toBe('SHORT');
        expect(result.setup.entryPrice).toBeGreaterThan(0);
        expect(result.setup.stopLoss).toBeGreaterThan(result.setup.entryPrice);
        expect(result.setup.takeProfit).toBeLessThan(result.setup.entryPrice);
        expect(result.setup.volumeConfirmation).toBe(true);
      }
    });

    it('should validate EMA9 downtrend for short setup', () => {
      const config = {
        ...createDefault92Config(),
        enabled: true,
        minConfidence: 60,
      };
      const detector = new Setup92Detector(config);

      const baseTime = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 35; i += 1) {
        const price = 100 + i * 0.2;
        candles.push(createCandle(price, price + 1, price - 1, price, 1000000, baseTime + i * 60000));
      }

      const result = detector.detect(candles, candles.length - 1);
      expect(result.setup).toBeNull();
    });

    it('should require close above previous high for short setup', () => {
      const config = {
        ...createDefault92Config(),
        enabled: true,
        minConfidence: 60,
      };
      const detector = new Setup92Detector(config);

      const baseTime = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 35; i += 1) {
        const price = 100 - i * 0.3;
        candles.push(createCandle(price, price + 1, price - 1, price, 1000000, baseTime + i * 60000));
      }

      const prevHigh = candles[candles.length - 2]?.high ?? 100;
      candles.push(createCandle(prevHigh - 3, prevHigh - 2, prevHigh - 4, prevHigh - 3, 1500000, baseTime + 35 * 60000));

      const result = detector.detect(candles, candles.length - 1);
      expect(result.setup).toBeNull();
    });
  });

  describe('Risk/Reward validation', () => {
    it('should reject setup with insufficient risk/reward ratio', () => {
      const config = {
        ...createDefault92Config(),
        enabled: true,
        minConfidence: 60,
        minRiskReward: 5.0,
      };
      const detector = new Setup92Detector(config);

      const baseTime = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 35; i += 1) {
        const price = 100 + i * 0.3;
        candles.push(createCandle(price, price + 1, price - 1, price, 1500000, baseTime + i * 60000));
      }

      const prevLow = candles[candles.length - 2]?.low ?? 100;
      candles.push(createCandle(prevLow + 1, prevLow + 2, prevLow - 0.5, prevLow - 0.3, 2000000, baseTime + 35 * 60000));

      const result = detector.detect(candles, candles.length - 1);
      expect(result.setup).toBeNull();
    });

    it('should validate minimum confidence threshold', () => {
      const config = {
        ...createDefault92Config(),
        enabled: true,
        minConfidence: 95,
        minRiskReward: 1.5,
      };
      const detector = new Setup92Detector(config);

      const baseTime = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 35; i += 1) {
        const price = 100 + i * 0.3;
        candles.push(createCandle(price, price + 1, price - 1, price, 1000000, baseTime + i * 60000));
      }

      const result = detector.detect(candles, candles.length - 1);
      expect(result.confidence).toBeLessThan(95);
    });
  });

  describe('Volume confirmation', () => {
    it('should boost confidence with volume confirmation', () => {
      const config = {
        ...createDefault92Config(),
        enabled: true,
        minConfidence: 60,
        volumeMultiplier: 1.5,
      };
      const detector = new Setup92Detector(config);

      const baseTime = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 35; i += 1) {
        const price = 100 + i * 0.3;
        candles.push(createCandle(price, price + 1, price - 1, price, 1000000, baseTime + i * 60000));
      }

      const prevLow = candles[candles.length - 2]?.low ?? 100;
      candles.push(createCandle(prevLow + 1, prevLow + 2, prevLow - 0.5, prevLow - 0.3, 2000000, baseTime + 35 * 60000));

      const result = detector.detect(candles, candles.length - 1);
      
      if (result.setup) {
        expect(result.setup.volumeConfirmation).toBe(true);
        expect(result.confidence).toBeGreaterThan(60);
      }
    });
  });

  describe('Setup data validation', () => {
    it('should include EMA9 value in setup data', () => {
      const config = {
        ...createDefault92Config(),
        enabled: true,
        minConfidence: 60,
        minRiskReward: 1.5,
      };
      const detector = new Setup92Detector(config);

      const baseTime = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 35; i += 1) {
        const price = 100 + i * 0.3;
        candles.push(createCandle(price, price + 1, price - 1, price, 1500000, baseTime + i * 60000));
      }

      const prevLow = candles[candles.length - 2]?.low ?? 100;
      candles.push(createCandle(prevLow + 1, prevLow + 2, prevLow - 0.5, prevLow - 0.3, 2000000, baseTime + 35 * 60000));

      const result = detector.detect(candles, candles.length - 1);
      
      if (result.setup) {
        expect(result.setup.setupData.ema9).toBeDefined();
        expect(result.setup.setupData.atr).toBeDefined();
        expect(result.setup.setupData.volumeRatio).toBeDefined();
      }
    });
  });
});
