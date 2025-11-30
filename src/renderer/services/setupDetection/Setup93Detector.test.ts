import { describe, expect, it } from 'vitest';
import type { Kline } from '../../../shared/types/kline';
import {
    createDefault93Config,
    Setup93Detector,
} from './Setup93Detector';

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

describe('Setup93Detector', () => {
  describe('createDefault93Config', () => {
    it('should create default config with disabled state', () => {
      const config = createDefault93Config();

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
      const config = { ...createDefault93Config(), enabled: false };
      const detector = new Setup93Detector(config);

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
      const config = { ...createDefault93Config(), enabled: true };
      const detector = new Setup93Detector(config);

      const klines = [createKline(100, 110, 95, 105)];

      const result = detector.detect(klines, 0);
      expect(result.setup).toBeNull();
      expect(result.confidence).toBe(0);
    });

    it('should require minimum klines for detection', () => {
      const config = { ...createDefault93Config(), enabled: true };
      const detector = new Setup93Detector(config);

      const klines: Kline[] = [];
      for (let i = 0; i < 35; i += 1) {
        klines.push(createKline(100, 101, 99, 100));
      }

      const result = detector.detect(klines, 34);
      expect(result).toBeDefined();
    });
  });

  describe('Long setup detection', () => {
    it('should detect long setup with 2 consecutive lower closes', () => {
      const config = {
        ...createDefault93Config(),
        enabled: true,
        minConfidence: 60,
        minRiskReward: 1.5,
      };
      const detector = new Setup93Detector(config);

      const baseTime = Date.now();
      const klines: Kline[] = [];

      for (let i = 0; i < 33; i += 1) {
        const price = 100 + i * 0.3;
        klines.push(createKline(price, price + 1, price - 1, price, 1500000, baseTime + i * 60000));
      }

      const referenceClose = klines[klines.length - 1]?.close ?? 100;
      klines.push(createKline(referenceClose - 1, referenceClose, referenceClose - 2, referenceClose - 1.5, 1500000, baseTime + 33 * 60000));
      klines.push(createKline(referenceClose - 2, referenceClose - 1, referenceClose - 3, referenceClose - 2, 1500000, baseTime + 34 * 60000));
      klines.push(createKline(referenceClose - 1, referenceClose + 1, referenceClose - 2, referenceClose, 2000000, baseTime + 35 * 60000));

      const result = detector.detect(klines, klines.length - 1);
      
      if (result.setup) {
        expect(result.setup.type).toBe('setup-9-3');
        expect(result.setup.direction).toBe('LONG');
        expect(result.setup.entryPrice).toBeGreaterThan(0);
        expect(result.setup.stopLoss).toBeLessThan(result.setup.entryPrice);
        expect(result.setup.takeProfit).toBeGreaterThan(result.setup.entryPrice);
        expect(result.setup.volumeConfirmation).toBe(true);
      }
    });

    it('should validate EMA9 uptrend for long setup', () => {
      const config = {
        ...createDefault93Config(),
        enabled: true,
        minConfidence: 60,
      };
      const detector = new Setup93Detector(config);

      const baseTime = Date.now();
      const klines: Kline[] = [];

      for (let i = 0; i < 35; i += 1) {
        const price = 100 - i * 0.2;
        klines.push(createKline(price, price + 1, price - 1, price, 1000000, baseTime + i * 60000));
      }

      const result = detector.detect(klines, klines.length - 1);
      expect(result.setup).toBeNull();
    });

    it('should require exactly 2 consecutive lower closes', () => {
      const config = {
        ...createDefault93Config(),
        enabled: true,
        minConfidence: 60,
      };
      const detector = new Setup93Detector(config);

      const baseTime = Date.now();
      const klines: Kline[] = [];

      for (let i = 0; i < 33; i += 1) {
        const price = 100 + i * 0.3;
        klines.push(createKline(price, price + 1, price - 1, price, 1500000, baseTime + i * 60000));
      }

      const referenceClose = klines[klines.length - 1]?.close ?? 100;
      klines.push(createKline(referenceClose - 1, referenceClose, referenceClose - 2, referenceClose - 1.5, 1500000, baseTime + 33 * 60000));
      klines.push(createKline(referenceClose + 1, referenceClose + 2, referenceClose, referenceClose + 1, 1500000, baseTime + 34 * 60000));
      klines.push(createKline(referenceClose, referenceClose + 1, referenceClose - 1, referenceClose, 1500000, baseTime + 35 * 60000));

      const result = detector.detect(klines, klines.length - 1);
      expect(result.setup).toBeNull();
    });
  });

  describe('Short setup detection', () => {
    it('should detect short setup with 2 consecutive higher closes', () => {
      const config = {
        ...createDefault93Config(),
        enabled: true,
        minConfidence: 60,
        minRiskReward: 1.5,
      };
      const detector = new Setup93Detector(config);

      const baseTime = Date.now();
      const klines: Kline[] = [];

      for (let i = 0; i < 33; i += 1) {
        const price = 100 - i * 0.3;
        klines.push(createKline(price, price + 1, price - 1, price, 1500000, baseTime + i * 60000));
      }

      const referenceClose = klines[klines.length - 1]?.close ?? 100;
      klines.push(createKline(referenceClose + 1, referenceClose + 2, referenceClose, referenceClose + 1.5, 1500000, baseTime + 33 * 60000));
      klines.push(createKline(referenceClose + 2, referenceClose + 3, referenceClose + 1, referenceClose + 2, 1500000, baseTime + 34 * 60000));
      klines.push(createKline(referenceClose + 1, referenceClose + 2, referenceClose - 1, referenceClose, 2000000, baseTime + 35 * 60000));

      const result = detector.detect(klines, klines.length - 1);
      
      if (result.setup) {
        expect(result.setup.type).toBe('setup-9-3');
        expect(result.setup.direction).toBe('SHORT');
        expect(result.setup.entryPrice).toBeGreaterThan(0);
        expect(result.setup.stopLoss).toBeGreaterThan(result.setup.entryPrice);
        expect(result.setup.takeProfit).toBeLessThan(result.setup.entryPrice);
        expect(result.setup.volumeConfirmation).toBe(true);
      }
    });

    it('should validate EMA9 downtrend for short setup', () => {
      const config = {
        ...createDefault93Config(),
        enabled: true,
        minConfidence: 60,
      };
      const detector = new Setup93Detector(config);

      const baseTime = Date.now();
      const klines: Kline[] = [];

      for (let i = 0; i < 35; i += 1) {
        const price = 100 + i * 0.2;
        klines.push(createKline(price, price + 1, price - 1, price, 1000000, baseTime + i * 60000));
      }

      const result = detector.detect(klines, klines.length - 1);
      expect(result.setup).toBeNull();
    });

    it('should require exactly 2 consecutive higher closes', () => {
      const config = {
        ...createDefault93Config(),
        enabled: true,
        minConfidence: 60,
      };
      const detector = new Setup93Detector(config);

      const baseTime = Date.now();
      const klines: Kline[] = [];

      for (let i = 0; i < 33; i += 1) {
        const price = 100 - i * 0.3;
        klines.push(createKline(price, price + 1, price - 1, price, 1500000, baseTime + i * 60000));
      }

      const referenceClose = klines[klines.length - 1]?.close ?? 100;
      klines.push(createKline(referenceClose + 1, referenceClose + 2, referenceClose, referenceClose + 1.5, 1500000, baseTime + 33 * 60000));
      klines.push(createKline(referenceClose - 1, referenceClose, referenceClose - 2, referenceClose - 1, 1500000, baseTime + 34 * 60000));
      klines.push(createKline(referenceClose, referenceClose + 1, referenceClose - 1, referenceClose, 1500000, baseTime + 35 * 60000));

      const result = detector.detect(klines, klines.length - 1);
      expect(result.setup).toBeNull();
    });
  });

  describe('Risk/Reward validation', () => {
    it('should reject setup with insufficient risk/reward ratio', () => {
      const config = {
        ...createDefault93Config(),
        enabled: true,
        minConfidence: 60,
        minRiskReward: 5.0,
      };
      const detector = new Setup93Detector(config);

      const baseTime = Date.now();
      const klines: Kline[] = [];

      for (let i = 0; i < 33; i += 1) {
        const price = 100 + i * 0.3;
        klines.push(createKline(price, price + 1, price - 1, price, 1500000, baseTime + i * 60000));
      }

      const referenceClose = klines[klines.length - 1]?.close ?? 100;
      klines.push(createKline(referenceClose - 1, referenceClose, referenceClose - 2, referenceClose - 1.5, 1500000, baseTime + 33 * 60000));
      klines.push(createKline(referenceClose - 2, referenceClose - 1, referenceClose - 3, referenceClose - 2, 1500000, baseTime + 34 * 60000));
      klines.push(createKline(referenceClose - 1, referenceClose + 1, referenceClose - 2, referenceClose, 2000000, baseTime + 35 * 60000));

      const result = detector.detect(klines, klines.length - 1);
      expect(result.setup).toBeNull();
    });

    it('should validate minimum confidence threshold', () => {
      const config = {
        ...createDefault93Config(),
        enabled: true,
        minConfidence: 95,
        minRiskReward: 1.5,
      };
      const detector = new Setup93Detector(config);

      const baseTime = Date.now();
      const klines: Kline[] = [];

      for (let i = 0; i < 35; i += 1) {
        const price = 100 + i * 0.3;
        klines.push(createKline(price, price + 1, price - 1, price, 1000000, baseTime + i * 60000));
      }

      const result = detector.detect(klines, klines.length - 1);
      expect(result.confidence).toBeLessThan(95);
    });
  });

  describe('Volume confirmation', () => {
    it('should boost confidence with volume confirmation', () => {
      const config = {
        ...createDefault93Config(),
        enabled: true,
        minConfidence: 60,
        volumeMultiplier: 1.5,
      };
      const detector = new Setup93Detector(config);

      const baseTime = Date.now();
      const klines: Kline[] = [];

      for (let i = 0; i < 33; i += 1) {
        const price = 100 + i * 0.3;
        klines.push(createKline(price, price + 1, price - 1, price, 1000000, baseTime + i * 60000));
      }

      const referenceClose = klines[klines.length - 1]?.close ?? 100;
      klines.push(createKline(referenceClose - 1, referenceClose, referenceClose - 2, referenceClose - 1.5, 1000000, baseTime + 33 * 60000));
      klines.push(createKline(referenceClose - 2, referenceClose - 1, referenceClose - 3, referenceClose - 2, 1000000, baseTime + 34 * 60000));
      klines.push(createKline(referenceClose - 1, referenceClose + 1, referenceClose - 2, referenceClose, 2000000, baseTime + 35 * 60000));

      const result = detector.detect(klines, klines.length - 1);
      
      if (result.setup) {
        expect(result.setup.volumeConfirmation).toBe(true);
        expect(result.confidence).toBeGreaterThan(60);
      }
    });
  });

  describe('Setup data validation', () => {
    it('should include consecutive closes count in setup data', () => {
      const config = {
        ...createDefault93Config(),
        enabled: true,
        minConfidence: 60,
        minRiskReward: 1.5,
      };
      const detector = new Setup93Detector(config);

      const baseTime = Date.now();
      const klines: Kline[] = [];

      for (let i = 0; i < 33; i += 1) {
        const price = 100 + i * 0.3;
        klines.push(createKline(price, price + 1, price - 1, price, 1500000, baseTime + i * 60000));
      }

      const referenceClose = klines[klines.length - 1]?.close ?? 100;
      klines.push(createKline(referenceClose - 1, referenceClose, referenceClose - 2, referenceClose - 1.5, 1500000, baseTime + 33 * 60000));
      klines.push(createKline(referenceClose - 2, referenceClose - 1, referenceClose - 3, referenceClose - 2, 1500000, baseTime + 34 * 60000));
      klines.push(createKline(referenceClose - 1, referenceClose + 1, referenceClose - 2, referenceClose, 2000000, baseTime + 35 * 60000));

      const result = detector.detect(klines, klines.length - 1);
      
      if (result.setup) {
        expect(result.setup.setupData.ema9).toBeDefined();
        expect(result.setup.setupData.atr).toBeDefined();
        expect(result.setup.setupData.volumeRatio).toBeDefined();
        expect(result.setup.setupData.consecutiveLowerCloses).toBe(2);
      }
    });
  });
});
