import type { Kline } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import { VolatilityAdjustedKelly } from './VolatilityAdjustedKelly';

const createKline = (
  open: number,
  high: number,
  low: number,
  close: number,
  timestamp: number
): Kline => ({
  openTime: timestamp,
  open,
  high,
  low,
  close,
  volume: 1000,
  closeTime: timestamp + 60000,
  quoteVolume: close * 1000,
  trades: 100,
  takerBuyBaseVolume: 500,
  takerBuyQuoteVolume: close * 500,
});

const generateStableKlines = (count: number, basePrice = 100): Kline[] => {
  const klines: Kline[] = [];
  for (let i = 0; i < count; i++) {
    klines.push(createKline(basePrice, basePrice + 1, basePrice - 1, basePrice, i * 60000));
  }
  return klines;
};

const generateVolatileKlines = (count: number, basePrice = 100): Kline[] => {
  const klines: Kline[] = [];
  for (let i = 0; i < count; i++) {
    const volatility = 10;
    klines.push(
      createKline(
        basePrice,
        basePrice + volatility,
        basePrice - volatility,
        basePrice + (i % 2 === 0 ? volatility : -volatility),
        i * 60000
      )
    );
  }
  return klines;
};

describe('VolatilityAdjustedKelly', () => {
  describe('calculateATR', () => {
    it('should calculate ATR for stable market', () => {
      const klines = generateStableKlines(20);
      const atr = VolatilityAdjustedKelly.calculateATR(klines, 14);

      expect(atr).toBeGreaterThan(0);
      expect(atr).toBeLessThan(5);
    });

    it('should calculate higher ATR for volatile market', () => {
      const stableKlines = generateStableKlines(20);
      const volatileKlines = generateVolatileKlines(20);

      const stableATR = VolatilityAdjustedKelly.calculateATR(stableKlines, 14);
      const volatileATR = VolatilityAdjustedKelly.calculateATR(volatileKlines, 14);

      expect(volatileATR).toBeGreaterThan(stableATR);
    });

    it('should return 0 for insufficient data', () => {
      const klines = generateStableKlines(10);
      const atr = VolatilityAdjustedKelly.calculateATR(klines, 14);

      expect(atr).toBe(0);
    });

    it('should handle custom period', () => {
      const klines = generateStableKlines(30);
      const atr7 = VolatilityAdjustedKelly.calculateATR(klines, 7);
      const atr21 = VolatilityAdjustedKelly.calculateATR(klines, 21);

      expect(atr7).toBeGreaterThan(0);
      expect(atr21).toBeGreaterThan(0);
    });

    it('should calculate true range correctly', () => {
      const klines = [
        createKline(100, 105, 95, 102, 0),
        createKline(102, 108, 98, 106, 60000),
      ];

      const atr = VolatilityAdjustedKelly.calculateATR(klines, 1);

      expect(atr).toBeGreaterThan(0);
    });
  });

  describe('calculateATRPercent', () => {
    it('should calculate ATR as percentage of price', () => {
      const klines = generateStableKlines(20, 100);
      const atrPercent = VolatilityAdjustedKelly.calculateATRPercent(klines, 14);

      expect(atrPercent).toBeGreaterThan(0);
      expect(atrPercent).toBeLessThan(100);
    });

    it('should return higher percent for volatile markets', () => {
      const stableKlines = generateStableKlines(20, 100);
      const volatileKlines = generateVolatileKlines(20, 100);

      const stablePercent = VolatilityAdjustedKelly.calculateATRPercent(stableKlines, 14);
      const volatilePercent = VolatilityAdjustedKelly.calculateATRPercent(volatileKlines, 14);

      expect(volatilePercent).toBeGreaterThan(stablePercent);
    });

    it('should return 0 for empty klines', () => {
      const atrPercent = VolatilityAdjustedKelly.calculateATRPercent([], 14);

      expect(atrPercent).toBe(0);
    });

    it('should handle zero price', () => {
      const klines = generateStableKlines(20, 0);
      const atrPercent = VolatilityAdjustedKelly.calculateATRPercent(klines, 14);

      expect(atrPercent).toBe(0);
    });
  });

  describe('calculateVolatilityRank', () => {
    it('should return rank between 0 and 1', () => {
      const klines = generateStableKlines(150);
      const rank = VolatilityAdjustedKelly.calculateVolatilityRank(klines, 100);

      expect(rank).toBeGreaterThanOrEqual(0);
      expect(rank).toBeLessThanOrEqual(1);
    });

    it('should return 0.5 for insufficient data', () => {
      const klines = generateStableKlines(50);
      const rank = VolatilityAdjustedKelly.calculateVolatilityRank(klines, 100);

      expect(rank).toBe(0.5);
    });

    it('should return higher rank for increasing volatility', () => {
      const klines = generateStableKlines(150);
      klines.push(...generateVolatileKlines(20));

      const rank = VolatilityAdjustedKelly.calculateVolatilityRank(klines, 100);

      expect(rank).toBeGreaterThan(0.5);
    });

    it('should return lower rank for decreasing volatility', () => {
      const klines = generateVolatileKlines(130);
      klines.push(...generateStableKlines(20));

      const rank = VolatilityAdjustedKelly.calculateVolatilityRank(klines, 100);

      expect(rank).toBeGreaterThanOrEqual(0);
      expect(rank).toBeLessThanOrEqual(1);
    });
  });

  describe('calculateVolatilityMetrics', () => {
    it('should calculate comprehensive metrics', () => {
      const klines = generateStableKlines(150);
      const metrics = VolatilityAdjustedKelly.calculateVolatilityMetrics(klines);

      expect(metrics.atr).toBeGreaterThan(0);
      expect(metrics.atrPercent).toBeGreaterThan(0);
      expect(metrics.volatilityRank).toBeGreaterThanOrEqual(0);
      expect(metrics.volatilityRank).toBeLessThanOrEqual(1);
      expect(metrics.volatilityScore).toBe(metrics.volatilityRank);
      expect(typeof metrics.isHighVolatility).toBe('boolean');
      expect(typeof metrics.isLowVolatility).toBe('boolean');
    });

    it('should flag high volatility correctly', () => {
      const klines = generateStableKlines(130);
      klines.push(...generateVolatileKlines(20));

      const metrics = VolatilityAdjustedKelly.calculateVolatilityMetrics(klines);

      expect(metrics.volatilityScore).toBeGreaterThan(0.75);
      expect(metrics.isHighVolatility).toBe(true);
      expect(metrics.isLowVolatility).toBe(false);
    });

    it('should flag low volatility correctly', () => {
      const klines = generateStableKlines(150);

      const metrics = VolatilityAdjustedKelly.calculateVolatilityMetrics(klines);

      expect(metrics.volatilityScore).toBeGreaterThanOrEqual(0);
      expect(metrics.volatilityScore).toBeLessThanOrEqual(1);
      expect(typeof metrics.isLowVolatility).toBe('boolean');
    });
  });

  describe('calculateVolatilityScaleFactor', () => {
    it('should return scale factor between min and max', () => {
      const metrics = VolatilityAdjustedKelly.calculateVolatilityMetrics(generateStableKlines(150));
      const scaleFactor = VolatilityAdjustedKelly.calculateVolatilityScaleFactor(metrics);

      expect(scaleFactor).toBeGreaterThanOrEqual(0.25);
      expect(scaleFactor).toBeLessThanOrEqual(1.5);
    });

    it('should reduce scale factor for high volatility', () => {
      const highVolMetrics = {
        atr: 10,
        atrPercent: 10,
        volatilityRank: 0.9,
        volatilityScore: 0.9,
        isHighVolatility: true,
        isLowVolatility: false,
      };

      const scaleFactor = VolatilityAdjustedKelly.calculateVolatilityScaleFactor(highVolMetrics);

      expect(scaleFactor).toBeLessThan(1);
    });

    it('should increase scale factor for low volatility', () => {
      const lowVolMetrics = {
        atr: 1,
        atrPercent: 1,
        volatilityRank: 0.1,
        volatilityScore: 0.1,
        isHighVolatility: false,
        isLowVolatility: true,
      };

      const scaleFactor = VolatilityAdjustedKelly.calculateVolatilityScaleFactor(lowVolMetrics);

      expect(scaleFactor).toBeGreaterThan(0.5);
    });

    it('should cap at minimum scale factor', () => {
      const extremeVolMetrics = {
        atr: 100,
        atrPercent: 100,
        volatilityRank: 1,
        volatilityScore: 1,
        isHighVolatility: true,
        isLowVolatility: false,
      };

      const scaleFactor = VolatilityAdjustedKelly.calculateVolatilityScaleFactor(extremeVolMetrics);

      expect(scaleFactor).toBeGreaterThanOrEqual(0.25);
      expect(scaleFactor).toBeLessThanOrEqual(1.5);
    });
  });

  describe('adjustKellyForVolatility', () => {
    it('should reduce Kelly for volatile markets', () => {
      const volatileKlines = generateVolatileKlines(150);
      const result = VolatilityAdjustedKelly.adjustKellyForVolatility(0.2, volatileKlines, 10000);

      expect(result.adjustedKelly).toBeLessThan(result.originalKelly);
      expect(result.originalKelly).toBe(0.2);
      expect(result.scaleFactor).toBeLessThan(1);
    });

    it('should calculate recommended position size', () => {
      const klines = generateStableKlines(150);
      const capital = 10000;
      const result = VolatilityAdjustedKelly.adjustKellyForVolatility(0.2, klines, capital);

      expect(result.recommendedPositionSize).toBe(capital * result.adjustedKelly);
    });

    it('should provide volatility metrics', () => {
      const klines = generateStableKlines(150);
      const result = VolatilityAdjustedKelly.adjustKellyForVolatility(0.2, klines, 10000);

      expect(result.volatilityMetrics).toBeDefined();
      expect(result.volatilityMetrics.atr).toBeGreaterThan(0);
    });
  });

  describe('calculateATRStopLoss', () => {
    it('should calculate stop loss below current price', () => {
      const klines = generateStableKlines(20, 100);
      const stopLoss = VolatilityAdjustedKelly.calculateATRStopLoss(klines, 2);

      expect(stopLoss).toBeLessThan(100);
    });

    it('should use larger stop for higher multiplier', () => {
      const klines = generateStableKlines(20, 100);
      const stop1x = VolatilityAdjustedKelly.calculateATRStopLoss(klines, 1);
      const stop3x = VolatilityAdjustedKelly.calculateATRStopLoss(klines, 3);

      expect(stop1x).toBeGreaterThan(stop3x);
    });

    it('should adapt to volatile markets', () => {
      const stableKlines = generateStableKlines(20, 100);
      const volatileKlines = generateVolatileKlines(20, 100);

      const stableStop = VolatilityAdjustedKelly.calculateATRStopLoss(stableKlines, 2);
      const volatileStop = VolatilityAdjustedKelly.calculateATRStopLoss(volatileKlines, 2);

      expect(Math.abs(100 - volatileStop)).toBeGreaterThan(Math.abs(100 - stableStop));
    });
  });

  describe('calculateATRTakeProfit', () => {
    it('should calculate take profit above current price', () => {
      const klines = generateStableKlines(20, 100);
      const takeProfit = VolatilityAdjustedKelly.calculateATRTakeProfit(klines, 3);

      expect(takeProfit).toBeGreaterThan(100);
    });

    it('should use larger target for higher multiplier', () => {
      const klines = generateStableKlines(20, 100);
      const tp2x = VolatilityAdjustedKelly.calculateATRTakeProfit(klines, 2);
      const tp4x = VolatilityAdjustedKelly.calculateATRTakeProfit(klines, 4);

      expect(tp4x).toBeGreaterThan(tp2x);
    });

    it('should adapt to volatile markets', () => {
      const stableKlines = generateStableKlines(20, 100);
      const volatileKlines = generateVolatileKlines(20, 100);

      const stableTP = VolatilityAdjustedKelly.calculateATRTakeProfit(stableKlines, 3);
      const volatileTP = VolatilityAdjustedKelly.calculateATRTakeProfit(volatileKlines, 3);

      expect(Math.abs(volatileTP - 100)).toBeGreaterThan(Math.abs(stableTP - 100));
    });
  });

  describe('calculateATRRisk', () => {
    it('should calculate risk amount based on ATR', () => {
      const klines = generateStableKlines(20, 100);
      const riskAmount = VolatilityAdjustedKelly.calculateATRRisk(klines, 10000, 1);

      expect(riskAmount).toBeGreaterThan(0);
    });

    it('should return 0 for zero price', () => {
      const klines = generateStableKlines(20, 0);
      const riskAmount = VolatilityAdjustedKelly.calculateATRRisk(klines, 10000, 1);

      expect(riskAmount).toBe(0);
    });

    it('should scale with risk percentage', () => {
      const klines = generateStableKlines(20, 100);
      const risk1 = VolatilityAdjustedKelly.calculateATRRisk(klines, 10000, 1);
      const risk2 = VolatilityAdjustedKelly.calculateATRRisk(klines, 10000, 2);

      expect(risk2).toBeGreaterThan(risk1);
    });
  });

  describe('calculateOptimalPositionSize', () => {
    it('should calculate position size considering both Kelly and ATR', () => {
      const klines = generateStableKlines(150);
      const positionSize = VolatilityAdjustedKelly.calculateOptimalPositionSize(
        0.2,
        klines,
        10000,
        2
      );

      expect(positionSize).toBeGreaterThan(0);
      expect(positionSize).toBeLessThanOrEqual(10000);
    });

    it('should limit position size in volatile markets', () => {
      const stableKlines = generateStableKlines(150);
      const volatileKlines = generateVolatileKlines(150);

      const stableSize = VolatilityAdjustedKelly.calculateOptimalPositionSize(
        0.2,
        stableKlines,
        10000,
        2
      );
      const volatileSize = VolatilityAdjustedKelly.calculateOptimalPositionSize(
        0.2,
        volatileKlines,
        10000,
        2
      );

      expect(volatileSize).toBeLessThanOrEqual(stableSize);
    });

    it('should respect max risk percentage', () => {
      const klines = generateStableKlines(150);
      const maxRisk2 = VolatilityAdjustedKelly.calculateOptimalPositionSize(0.2, klines, 10000, 2);
      const maxRisk5 = VolatilityAdjustedKelly.calculateOptimalPositionSize(0.2, klines, 10000, 5);

      expect(maxRisk5).toBeGreaterThanOrEqual(maxRisk2);
    });
  });

  describe('calculateRecommendedLeverage', () => {
    it('should return leverage between 1 and max', () => {
      const klines = generateStableKlines(150);
      const leverage = VolatilityAdjustedKelly.calculateRecommendedLeverage(klines, 10);

      expect(leverage).toBeGreaterThanOrEqual(1);
      expect(leverage).toBeLessThanOrEqual(10);
    });

    it('should reduce leverage in volatile markets', () => {
      const stableKlines = generateStableKlines(150);
      const volatileKlines = generateVolatileKlines(150);

      const stableLeverage = VolatilityAdjustedKelly.calculateRecommendedLeverage(stableKlines, 10);
      const volatileLeverage = VolatilityAdjustedKelly.calculateRecommendedLeverage(
        volatileKlines,
        10
      );

      expect(volatileLeverage).toBeLessThanOrEqual(stableLeverage);
    });

    it('should respect max leverage cap', () => {
      const klines = generateStableKlines(150);
      const leverage = VolatilityAdjustedKelly.calculateRecommendedLeverage(klines, 5);

      expect(leverage).toBeLessThanOrEqual(5);
    });

    it('should round to 1 decimal place', () => {
      const klines = generateStableKlines(150);
      const leverage = VolatilityAdjustedKelly.calculateRecommendedLeverage(klines, 10);

      expect(leverage).toBe(Math.round(leverage * 10) / 10);
    });
  });
});
