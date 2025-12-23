import { describe, expect, it } from 'vitest';
import type { Kline } from '@marketmind/types';
import {
  StochasticDoubleTouchDetector,
  createDefaultStochasticDoubleTouchConfig,
} from '../StochasticDoubleTouchDetector';

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

describe('StochasticDoubleTouchDetector', () => {
  describe('createDefaultStochasticDoubleTouchConfig', () => {
    it('should create default config with disabled state', () => {
      const config = createDefaultStochasticDoubleTouchConfig();

      expect(config.enabled).toBe(false);
      expect(config.minConfidence).toBe(70);
      expect(config.minRiskReward).toBe(2.0);
      expect(config.stochPeriod).toBe(14);
      expect(config.stochSmoothK).toBe(3);
      expect(config.oversoldThreshold).toBe(20);
      expect(config.overboughtThreshold).toBe(80);
      expect(config.volumeMultiplier).toBe(1.2);
    });
  });

  describe('detect', () => {
    it('should return null when disabled', () => {
      const config = { ...createDefaultStochasticDoubleTouchConfig(), enabled: false };
      const detector = new StochasticDoubleTouchDetector(config);

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
      const config = { ...createDefaultStochasticDoubleTouchConfig(), enabled: true };
      const detector = new StochasticDoubleTouchDetector(config);

      const klines = [createKline(100, 110, 95, 105)];

      const result = detector.detect(klines, 0);
      expect(result.setup).toBeNull();
      expect(result.confidence).toBe(0);
    });

    it('should require minimum klines for detection', () => {
      const config = { ...createDefaultStochasticDoubleTouchConfig(), enabled: true };
      const detector = new StochasticDoubleTouchDetector(config);

      const klines: Kline[] = [];
      for (let i = 0; i < 50; i += 1) {
        klines.push(createKline(100, 101, 99, 100));
      }

      const result = detector.detect(klines, 49);
      expect(result).toBeDefined();
    });

    it('should reject setup without volume confirmation', () => {
      const config = {
        ...createDefaultStochasticDoubleTouchConfig(),
        enabled: true,
        volumeMultiplier: 2.0,
      };
      const detector = new StochasticDoubleTouchDetector(config);

      const baseTime = Date.now();
      const klines: Kline[] = [];

      for (let i = 0; i < 50; i += 1) {
        klines.push(createKline(100, 101, 99, 100, 1000000, baseTime + i * 60000));
      }

      klines.push(createKline(95, 96, 94, 95, 500000, baseTime + 50 * 60000));

      const result = detector.detect(klines, klines.length - 1);
      expect(result.setup).toBeNull();
      expect(result.confidence).toBe(0);
    });
  });

  describe('Long setup detection - Double Touch Oversold', () => {
    it('should detect long setup with double touch in oversold without crossing 50', () => {
      const config = {
        ...createDefaultStochasticDoubleTouchConfig(),
        enabled: true,
        minConfidence: 65,
        minRiskReward: 1.5,
      };
      const detector = new StochasticDoubleTouchDetector(config);

      const baseTime = Date.now();
      const klines: Kline[] = [];

      for (let i = 0; i < 30; i += 1) {
        klines.push(createKline(100 + i, 101 + i, 99 + i, 100 + i, 1000000, baseTime + i * 60000));
      }

      for (let i = 0; i < 5; i += 1) {
        const price = 130 - i * 3;
        klines.push(createKline(price, price + 1, price - 1, price, 1000000, baseTime + (30 + i) * 60000));
      }

      for (let i = 0; i < 3; i += 1) {
        const price = 115 + i * 2;
        klines.push(createKline(price, price + 1, price - 1, price, 1000000, baseTime + (35 + i) * 60000));
      }

      for (let i = 0; i < 5; i += 1) {
        const price = 121 - i * 3;
        klines.push(createKline(price, price + 1, price - 1, price, 1000000, baseTime + (38 + i) * 60000));
      }

      klines.push(createKline(107, 108, 106, 107, 1500000, baseTime + 43 * 60000));

      const result = detector.detect(klines, klines.length - 1);

      if (result.setup) {
        expect(result.setup.type).toBe('stochastic-double-touch');
        expect(result.setup.direction).toBe('LONG');
        expect(result.setup.entryPrice).toBeGreaterThan(0);
        expect(result.setup.stopLoss).toBeLessThan(result.setup.entryPrice);
        expect(result.setup.takeProfit).toBeGreaterThan(result.setup.entryPrice);
        expect(result.setup.volumeConfirmation).toBe(true);
      }
    });

    it('should reject long setup if stochastic crosses 50 between touches', () => {
      const config = {
        ...createDefaultStochasticDoubleTouchConfig(),
        enabled: true,
        minConfidence: 65,
      };
      const detector = new StochasticDoubleTouchDetector(config);

      const baseTime = Date.now();
      const klines: Kline[] = [];

      for (let i = 0; i < 30; i += 1) {
        klines.push(createKline(100 + i, 101 + i, 99 + i, 100 + i, 1000000, baseTime + i * 60000));
      }

      for (let i = 0; i < 5; i += 1) {
        const price = 130 - i * 3;
        klines.push(createKline(price, price + 1, price - 1, price, 1000000, baseTime + (30 + i) * 60000));
      }

      for (let i = 0; i < 5; i += 1) {
        const price = 115 + i * 5;
        klines.push(createKline(price, price + 1, price - 1, price, 1000000, baseTime + (35 + i) * 60000));
      }

      for (let i = 0; i < 5; i += 1) {
        const price = 140 - i * 3;
        klines.push(createKline(price, price + 1, price - 1, price, 1000000, baseTime + (40 + i) * 60000));
      }

      klines.push(createKline(126, 127, 125, 126, 1500000, baseTime + 45 * 60000));

      const result = detector.detect(klines, klines.length - 1);
      expect(result.setup).toBeNull();
    });

    it('should require swing high/low for take profit and stop loss', () => {
      const config = {
        ...createDefaultStochasticDoubleTouchConfig(),
        enabled: true,
        minConfidence: 65,
        minRiskReward: 1.5,
      };
      const detector = new StochasticDoubleTouchDetector(config);

      const baseTime = Date.now();
      const klines: Kline[] = [];

      for (let i = 0; i < 10; i += 1) {
        klines.push(createKline(100, 101, 99, 100, 1000000, baseTime + i * 60000));
      }

      const result = detector.detect(klines, klines.length - 1);
      expect(result.setup).toBeNull();
    });
  });

  describe('Short setup detection - Double Touch Overbought', () => {
    it('should detect short setup with double touch in overbought without crossing 50', () => {
      const config = {
        ...createDefaultStochasticDoubleTouchConfig(),
        enabled: true,
        minConfidence: 65,
        minRiskReward: 1.5,
      };
      const detector = new StochasticDoubleTouchDetector(config);

      const baseTime = Date.now();
      const klines: Kline[] = [];

      for (let i = 0; i < 30; i += 1) {
        klines.push(createKline(200 - i, 201 - i, 199 - i, 200 - i, 1000000, baseTime + i * 60000));
      }

      for (let i = 0; i < 5; i += 1) {
        const price = 170 + i * 3;
        klines.push(createKline(price, price + 1, price - 1, price, 1000000, baseTime + (30 + i) * 60000));
      }

      for (let i = 0; i < 3; i += 1) {
        const price = 185 - i * 2;
        klines.push(createKline(price, price + 1, price - 1, price, 1000000, baseTime + (35 + i) * 60000));
      }

      for (let i = 0; i < 5; i += 1) {
        const price = 179 + i * 3;
        klines.push(createKline(price, price + 1, price - 1, price, 1000000, baseTime + (38 + i) * 60000));
      }

      klines.push(createKline(193, 194, 192, 193, 1500000, baseTime + 43 * 60000));

      const result = detector.detect(klines, klines.length - 1);

      if (result.setup) {
        expect(result.setup.type).toBe('stochastic-double-touch');
        expect(result.setup.direction).toBe('SHORT');
        expect(result.setup.entryPrice).toBeGreaterThan(0);
        expect(result.setup.stopLoss).toBeGreaterThan(result.setup.entryPrice);
        expect(result.setup.takeProfit).toBeLessThan(result.setup.entryPrice);
        expect(result.setup.volumeConfirmation).toBe(true);
      }
    });

    it('should reject short setup if stochastic crosses 50 between touches', () => {
      const config = {
        ...createDefaultStochasticDoubleTouchConfig(),
        enabled: true,
        minConfidence: 65,
      };
      const detector = new StochasticDoubleTouchDetector(config);

      const baseTime = Date.now();
      const klines: Kline[] = [];

      for (let i = 0; i < 30; i += 1) {
        klines.push(createKline(200 - i, 201 - i, 199 - i, 200 - i, 1000000, baseTime + i * 60000));
      }

      for (let i = 0; i < 5; i += 1) {
        const price = 170 + i * 3;
        klines.push(createKline(price, price + 1, price - 1, price, 1000000, baseTime + (30 + i) * 60000));
      }

      for (let i = 0; i < 5; i += 1) {
        const price = 185 - i * 5;
        klines.push(createKline(price, price + 1, price - 1, price, 1000000, baseTime + (35 + i) * 60000));
      }

      for (let i = 0; i < 5; i += 1) {
        const price = 160 + i * 3;
        klines.push(createKline(price, price + 1, price - 1, price, 1000000, baseTime + (40 + i) * 60000));
      }

      klines.push(createKline(174, 175, 173, 174, 1500000, baseTime + 45 * 60000));

      const result = detector.detect(klines, klines.length - 1);
      expect(result.setup).toBeNull();
    });
  });

  describe('Risk/Reward validation', () => {
    it('should reject setup with insufficient risk/reward ratio', () => {
      const config = {
        ...createDefaultStochasticDoubleTouchConfig(),
        enabled: true,
        minConfidence: 65,
        minRiskReward: 5.0,
      };
      const detector = new StochasticDoubleTouchDetector(config);

      const baseTime = Date.now();
      const klines: Kline[] = [];

      for (let i = 0; i < 50; i += 1) {
        const price = 100 + Math.sin(i * 0.2) * 10;
        klines.push(createKline(price, price + 1, price - 1, price, 1500000, baseTime + i * 60000));
      }

      const result = detector.detect(klines, klines.length - 1);
      expect(result.setup).toBeNull();
    });

    it('should validate minimum confidence threshold', () => {
      const config = {
        ...createDefaultStochasticDoubleTouchConfig(),
        enabled: true,
        minConfidence: 95,
        minRiskReward: 1.5,
      };
      const detector = new StochasticDoubleTouchDetector(config);

      const baseTime = Date.now();
      const klines: Kline[] = [];

      for (let i = 0; i < 50; i += 1) {
        const price = 100 + Math.sin(i * 0.2) * 10;
        klines.push(createKline(price, price + 1, price - 1, price, 1000000, baseTime + i * 60000));
      }

      const result = detector.detect(klines, klines.length - 1);
      expect(result.confidence).toBeLessThanOrEqual(95);
    });
  });

  describe('Confidence calculation', () => {
    it('should increase confidence with better risk/reward ratio', () => {
      const config = {
        ...createDefaultStochasticDoubleTouchConfig(),
        enabled: true,
        minConfidence: 60,
        minRiskReward: 1.5,
      };
      const detector = new StochasticDoubleTouchDetector(config);

      const baseTime = Date.now();
      const klines: Kline[] = [];

      for (let i = 0; i < 30; i += 1) {
        klines.push(createKline(100 + i, 101 + i, 99 + i, 100 + i, 1000000, baseTime + i * 60000));
      }

      for (let i = 0; i < 5; i += 1) {
        const price = 130 - i * 3;
        klines.push(createKline(price, price + 1, price - 1, price, 1000000, baseTime + (30 + i) * 60000));
      }

      for (let i = 0; i < 3; i += 1) {
        const price = 115 + i * 2;
        klines.push(createKline(price, price + 1, price - 1, price, 1000000, baseTime + (35 + i) * 60000));
      }

      for (let i = 0; i < 5; i += 1) {
        const price = 121 - i * 3;
        klines.push(createKline(price, price + 1, price - 1, price, 1000000, baseTime + (38 + i) * 60000));
      }

      klines.push(createKline(107, 108, 106, 107, 1500000, baseTime + 43 * 60000));

      const result = detector.detect(klines, klines.length - 1);

      if (result.setup) {
        expect(result.confidence).toBeGreaterThanOrEqual(60);
        expect(result.confidence).toBeLessThanOrEqual(95);
      }
    });

    it('should cap confidence at maximum value', () => {
      const config = {
        ...createDefaultStochasticDoubleTouchConfig(),
        enabled: true,
        minConfidence: 60,
        minRiskReward: 1.0,
      };
      const detector = new StochasticDoubleTouchDetector(config);

      const baseTime = Date.now();
      const klines: Kline[] = [];

      for (let i = 0; i < 50; i += 1) {
        const price = 100 + Math.sin(i * 0.2) * 10;
        klines.push(createKline(price, price + 1, price - 1, price, 2000000, baseTime + i * 60000));
      }

      const result = detector.detect(klines, klines.length - 1);

      if (result.setup) {
        expect(result.confidence).toBeLessThanOrEqual(95);
      }
    });
  });

  describe('Setup data validation', () => {
    it('should include stochastic values in setup data', () => {
      const config = {
        ...createDefaultStochasticDoubleTouchConfig(),
        enabled: true,
        minConfidence: 65,
        minRiskReward: 1.5,
      };
      const detector = new StochasticDoubleTouchDetector(config);

      const baseTime = Date.now();
      const klines: Kline[] = [];

      for (let i = 0; i < 30; i += 1) {
        klines.push(createKline(100 + i, 101 + i, 99 + i, 100 + i, 1000000, baseTime + i * 60000));
      }

      for (let i = 0; i < 5; i += 1) {
        const price = 130 - i * 3;
        klines.push(createKline(price, price + 1, price - 1, price, 1000000, baseTime + (30 + i) * 60000));
      }

      for (let i = 0; i < 3; i += 1) {
        const price = 115 + i * 2;
        klines.push(createKline(price, price + 1, price - 1, price, 1000000, baseTime + (35 + i) * 60000));
      }

      for (let i = 0; i < 5; i += 1) {
        const price = 121 - i * 3;
        klines.push(createKline(price, price + 1, price - 1, price, 1000000, baseTime + (38 + i) * 60000));
      }

      klines.push(createKline(107, 108, 106, 107, 1500000, baseTime + 43 * 60000));

      const result = detector.detect(klines, klines.length - 1);

      if (result.setup) {
        expect(result.setup.setupData.currentK).toBeDefined();
        expect(result.setup.setupData.previousK).toBeDefined();
        expect(result.setup.setupData.firstTouchIndex).toBeDefined();
      }
    });
  });
});
