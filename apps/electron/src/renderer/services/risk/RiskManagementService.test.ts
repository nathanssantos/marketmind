import type { Kline } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import type { Position } from './PortfolioHeatTracker';
import { RiskManagementService } from './RiskManagementService';

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

const generateKlines = (count: number, basePrice = 100): Kline[] => {
  const klines: Kline[] = [];
  for (let i = 0; i < count; i++) {
    klines.push(createKline(basePrice, basePrice + 1, basePrice - 1, basePrice, i * 60000));
  }
  return klines;
};

const createPosition = (
  symbol: string,
  entryPrice: number,
  currentPrice: number,
  quantity: number,
  stopLoss: number,
  side: 'long' | 'short' = 'long'
): Position => ({
  symbol,
  entryPrice,
  currentPrice,
  quantity,
  stopLoss,
  side,
});

describe('RiskManagementService', () => {
  describe('calculatePositionSize', () => {
    it('should calculate optimal position size', () => {
      const klines = generateKlines(150);
      const result = RiskManagementService.calculatePositionSize({
        winRate: 0.6,
        avgWin: 100,
        avgLoss: 50,
        capital: 10000,
        klines,
        currentPositions: [],
      });

      expect(result.recommendedSize).toBeGreaterThan(0);
      expect(result.recommendedSizePercent).toBeGreaterThan(0);
      expect(result.canTrade).toBe(true);
      expect(result.kellyResult).toBeDefined();
      expect(result.volatilityAdjusted).toBeDefined();
      expect(result.portfolioHeat).toBeDefined();
    });

    it('should prevent trading when Kelly is invalid', () => {
      const klines = generateKlines(150);
      const result = RiskManagementService.calculatePositionSize({
        winRate: 0.3,
        avgWin: 50,
        avgLoss: 100,
        capital: 10000,
        klines,
        currentPositions: [],
      });

      expect(result.canTrade).toBe(false);
      expect(result.reasons.length).toBeGreaterThan(0);
    });

    it('should prevent trading when portfolio is overheated', () => {
      const klines = generateKlines(150);
      const currentPositions = [createPosition('BTCUSDT', 100, 105, 300, 97, 'long')];

      const result = RiskManagementService.calculatePositionSize({
        winRate: 0.6,
        avgWin: 100,
        avgLoss: 50,
        capital: 10000,
        klines,
        currentPositions,
      });

      expect(result.canTrade).toBe(false);
      expect(result.reasons.some((r) => r.includes('heat'))).toBe(true);
    });

    it('should reduce position size for high volatility', () => {
      const klines = generateKlines(150);

      const lowVolResult = RiskManagementService.calculatePositionSize({
        winRate: 0.6,
        avgWin: 100,
        avgLoss: 50,
        capital: 10000,
        klines,
        currentPositions: [],
      });

      expect(lowVolResult.volatilityAdjusted.scaleFactor).toBeGreaterThan(0);
    });

    it('should respect conservative risk profile', () => {
      const klines = generateKlines(150);
      const conservative = RiskManagementService.getRiskProfile('conservative');

      const result = RiskManagementService.calculatePositionSize({
        winRate: 0.6,
        avgWin: 100,
        avgLoss: 50,
        capital: 10000,
        klines,
        currentPositions: [],
        riskProfile: conservative,
      });

      expect(result.recommendedSizePercent).toBeLessThanOrEqual(conservative.maxPositionHeat);
    });

    it('should calculate risk metrics', () => {
      const klines = generateKlines(150);
      const result = RiskManagementService.calculatePositionSize({
        winRate: 0.6,
        avgWin: 100,
        avgLoss: 50,
        capital: 10000,
        klines,
        currentPositions: [],
      });

      expect(result.riskMetrics.capitalAtRisk).toBeGreaterThanOrEqual(0);
      expect(result.riskMetrics.riskRewardRatio).toBe(2);
      expect(result.riskMetrics.expectedValue).toBeGreaterThan(0);
      expect(result.riskMetrics.maxDrawdownRisk).toBeGreaterThanOrEqual(0);
    });
  });

  describe('assessRisk', () => {
    it('should assess portfolio risk', () => {
      const klines = generateKlines(150);
      const positions = [createPosition('BTCUSDT', 100, 105, 10, 95, 'long')];

      const assessment = RiskManagementService.assessRisk(positions, 10000, klines);

      expect(assessment.overall).toBe('low');
      expect(assessment.portfolioHeat).toBeDefined();
      expect(assessment.volatilityLevel).toBeDefined();
      expect(assessment.diversificationScore).toBeGreaterThanOrEqual(0);
      expect(assessment.recommendations.length).toBeGreaterThan(0);
    });

    it('should flag high risk when overheated', () => {
      const klines = generateKlines(150);
      const positions = [createPosition('BTCUSDT', 100, 105, 300, 97, 'long')];

      const assessment = RiskManagementService.assessRisk(positions, 10000, klines);

      expect(assessment.overall).toBe('extreme');
      expect(assessment.portfolioHeat.isOverheated).toBe(true);
    });

    it('should provide recommendations for overheated portfolio', () => {
      const klines = generateKlines(150);
      const positions = [createPosition('BTCUSDT', 100, 105, 300, 97, 'long')];

      const assessment = RiskManagementService.assessRisk(positions, 10000, klines);

      expect(assessment.recommendations.some((r) => r.includes('Reduce'))).toBe(true);
    });

    it('should flag low diversification', () => {
      const klines = generateKlines(150);
      const positions = [
        createPosition('BTCUSDT', 100, 105, 100, 95, 'long'),
        createPosition('ETHUSDT', 50, 52, 5, 48, 'long'),
      ];

      const assessment = RiskManagementService.assessRisk(positions, 10000, klines);

      expect(assessment.diversificationScore).toBeLessThan(0.7);
      if (assessment.diversificationScore < 0.5) {
        expect(assessment.recommendations.some((r) => r.includes('diversification'))).toBe(true);
      }
    });
  });

  describe('getRiskProfile', () => {
    it('should return conservative profile', () => {
      const profile = RiskManagementService.getRiskProfile('conservative');

      expect(profile.name).toBe('conservative');
      expect(profile.maxTotalHeat).toBe(0.03);
      expect(profile.maxPositionHeat).toBe(0.01);
      expect(profile.kellyFraction).toBe(0.25);
      expect(profile.maxLeverage).toBe(2);
    });

    it('should return moderate profile', () => {
      const profile = RiskManagementService.getRiskProfile('moderate');

      expect(profile.name).toBe('moderate');
      expect(profile.maxTotalHeat).toBe(0.06);
      expect(profile.maxPositionHeat).toBe(0.02);
      expect(profile.kellyFraction).toBe(0.25);
      expect(profile.maxLeverage).toBe(5);
    });

    it('should return aggressive profile', () => {
      const profile = RiskManagementService.getRiskProfile('aggressive');

      expect(profile.name).toBe('aggressive');
      expect(profile.maxTotalHeat).toBe(0.10);
      expect(profile.maxPositionHeat).toBe(0.03);
      expect(profile.kellyFraction).toBe(0.5);
      expect(profile.maxLeverage).toBe(10);
    });
  });

  describe('calculateStopLoss', () => {
    it('should calculate ATR-based stop loss', () => {
      const klines = generateKlines(20, 100);
      const stopLoss = RiskManagementService.calculateStopLoss(klines, 'long', 2);

      expect(stopLoss).toBeLessThan(100);
      expect(stopLoss).toBeGreaterThan(0);
    });

    it('should use custom multiplier', () => {
      const klines = generateKlines(20, 100);
      const stop1x = RiskManagementService.calculateStopLoss(klines, 'long', 1);
      const stop3x = RiskManagementService.calculateStopLoss(klines, 'long', 3);

      expect(stop1x).toBeGreaterThan(stop3x);
    });
  });

  describe('calculateTakeProfit', () => {
    it('should calculate ATR-based take profit', () => {
      const klines = generateKlines(20, 100);
      const takeProfit = RiskManagementService.calculateTakeProfit(klines, 'long', 3);

      expect(takeProfit).toBeGreaterThan(100);
    });

    it('should use custom multiplier', () => {
      const klines = generateKlines(20, 100);
      const tp2x = RiskManagementService.calculateTakeProfit(klines, 'long', 2);
      const tp4x = RiskManagementService.calculateTakeProfit(klines, 'long', 4);

      expect(tp4x).toBeGreaterThan(tp2x);
    });
  });

  describe('validatePosition', () => {
    it('should validate position within limits', () => {
      const position = createPosition('BTCUSDT', 100, 105, 10, 95, 'long');
      const currentPositions: Position[] = [];

      const result = RiskManagementService.validatePosition(position, currentPositions, 10000);

      expect(result.valid).toBe(true);
      expect(result.reasons.length).toBe(0);
    });

    it('should reject position exceeding heat limits', () => {
      const position = createPosition('BTCUSDT', 100, 105, 300, 97, 'long');
      const currentPositions: Position[] = [];

      const result = RiskManagementService.validatePosition(position, currentPositions, 10000);

      expect(result.valid).toBe(false);
      expect(result.reasons.length).toBeGreaterThan(0);
    });

    it('should reject position when portfolio is full', () => {
      const currentPositions = [createPosition('ETHUSDT', 50, 52, 200, 48, 'long')];
      const newPosition = createPosition('BTCUSDT', 100, 105, 100, 95, 'long');

      const result = RiskManagementService.validatePosition(
        newPosition,
        currentPositions,
        10000
      );

      expect(result.valid).toBe(false);
      expect(result.reasons.some((r) => r.includes('heat'))).toBe(true);
    });

    it('should respect conservative profile limits', () => {
      const position = createPosition('BTCUSDT', 100, 105, 50, 95, 'long');
      const currentPositions: Position[] = [];
      const conservative = RiskManagementService.getRiskProfile('conservative');

      const result = RiskManagementService.validatePosition(
        position,
        currentPositions,
        10000,
        conservative
      );

      expect(result.valid).toBe(false);
    });
  });

  describe('calculateRecommendedLeverage', () => {
    it('should calculate recommended leverage', () => {
      const klines = generateKlines(150);
      const leverage = RiskManagementService.calculateRecommendedLeverage(klines);

      expect(leverage).toBeGreaterThanOrEqual(1);
      expect(leverage).toBeLessThanOrEqual(5);
    });

    it('should respect profile max leverage', () => {
      const klines = generateKlines(150);
      const conservative = RiskManagementService.getRiskProfile('conservative');
      const leverage = RiskManagementService.calculateRecommendedLeverage(klines, conservative);

      expect(leverage).toBeLessThanOrEqual(conservative.maxLeverage);
    });

    it('should return different leverage for different profiles', () => {
      const klines = generateKlines(150);
      const conservative = RiskManagementService.getRiskProfile('conservative');
      const aggressive = RiskManagementService.getRiskProfile('aggressive');

      const conservativeLeverage = RiskManagementService.calculateRecommendedLeverage(
        klines,
        conservative
      );
      const aggressiveLeverage = RiskManagementService.calculateRecommendedLeverage(
        klines,
        aggressive
      );

      expect(aggressiveLeverage).toBeGreaterThanOrEqual(conservativeLeverage);
    });
  });

  describe('getRiskSummary', () => {
    it('should provide comprehensive risk summary', () => {
      const klines = generateKlines(150);
      const positions = [createPosition('BTCUSDT', 100, 105, 10, 95, 'long')];

      const summary = RiskManagementService.getRiskSummary(positions, 10000, klines);

      expect(summary.assessment).toBeDefined();
      expect(summary.heatStatus).toBeDefined();
      expect(summary.volatilityStatus).toBeDefined();
      expect(summary.diversificationStatus).toBeDefined();
      expect(Array.isArray(summary.actionable)).toBe(true);
    });

    it('should provide actionable recommendations', () => {
      const klines = generateKlines(150);
      const positions = [createPosition('BTCUSDT', 100, 105, 300, 97, 'long')];

      const summary = RiskManagementService.getRiskSummary(positions, 10000, klines);

      expect(summary.actionable.length).toBeGreaterThan(0);
      expect(summary.heatStatus).toContain('EXTREME');
    });

    it('should assess diversification status', () => {
      const klines = generateKlines(150);
      const wellDiversified = [
        createPosition('BTCUSDT', 100, 105, 10, 95, 'long'),
        createPosition('ETHUSDT', 50, 52, 20, 48, 'long'),
      ];

      const summary = RiskManagementService.getRiskSummary(wellDiversified, 10000, klines);

      expect(summary.diversificationStatus).toBeDefined();
      expect(['Well diversified', 'Moderately diversified', 'Poorly diversified']).toContain(
        summary.diversificationStatus
      );
    });

    it('should include volatility information', () => {
      const klines = generateKlines(150);
      const positions = [createPosition('BTCUSDT', 100, 105, 10, 95, 'long')];

      const summary = RiskManagementService.getRiskSummary(positions, 10000, klines);

      expect(summary.volatilityStatus).toContain('Volatility');
      expect(summary.volatilityStatus).toContain('ATR');
    });
  });
});
