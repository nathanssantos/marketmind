import { describe, expect, it } from 'vitest';
import { KellyCriterionCalculator } from './KellyCriterionCalculator';

describe('KellyCriterionCalculator', () => {
  describe('calculate', () => {
    it('should calculate Kelly fraction correctly with positive edge', () => {
      const result = KellyCriterionCalculator.calculate({
        winRate: 0.6,
        avgWin: 100,
        avgLoss: 50,
      });

      expect(result.isValid).toBe(true);
      expect(result.kellyFraction).toBeGreaterThan(0);
      expect(result.kellyPercent).toBe(result.kellyFraction * 100);
      expect(result.halfKelly).toBe(result.kellyFraction * 0.5);
      expect(result.quarterKelly).toBe(result.kellyFraction * 0.25);
      expect(result.recommended).toBe(result.quarterKelly);
    });

    it('should calculate Kelly with 60% win rate and 2:1 R:R', () => {
      const result = KellyCriterionCalculator.calculate({
        winRate: 0.6,
        avgWin: 200,
        avgLoss: 100,
      });

      const rawKelly = (0.6 * 2 - 0.4) / 2;
      const expected = Math.min(rawKelly, 0.25);

      expect(result.kellyFraction).toBeCloseTo(expected, 5);
      expect(result.isValid).toBe(true);
    });

    it('should cap Kelly fraction at 25%', () => {
      const result = KellyCriterionCalculator.calculate({
        winRate: 0.9,
        avgWin: 1000,
        avgLoss: 100,
      });

      expect(result.kellyFraction).toBeLessThanOrEqual(0.25);
      expect(result.warning).toContain('exceeds max');
    });

    it('should return zero for negative edge (losing strategy)', () => {
      const result = KellyCriterionCalculator.calculate({
        winRate: 0.3,
        avgWin: 100,
        avgLoss: 200,
      });

      expect(result.kellyFraction).toBe(0);
      expect(result.isValid).toBe(false);
      expect(result.warning).toContain('Negative Kelly');
    });

    it('should handle edge case: 50% win rate with 1:1 R:R', () => {
      const result = KellyCriterionCalculator.calculate({
        winRate: 0.5,
        avgWin: 100,
        avgLoss: 100,
      });

      expect(result.kellyFraction).toBeCloseTo(0, 5);
      expect(result.isValid).toBe(false);
    });

    it('should reject invalid win rate (>1)', () => {
      const result = KellyCriterionCalculator.calculate({
        winRate: 1.5,
        avgWin: 100,
        avgLoss: 50,
      });

      expect(result.isValid).toBe(false);
      expect(result.warning).toContain('Invalid inputs');
    });

    it('should reject invalid win rate (<0)', () => {
      const result = KellyCriterionCalculator.calculate({
        winRate: -0.1,
        avgWin: 100,
        avgLoss: 50,
      });

      expect(result.isValid).toBe(false);
      expect(result.warning).toContain('Invalid inputs');
    });

    it('should reject negative average win', () => {
      const result = KellyCriterionCalculator.calculate({
        winRate: 0.6,
        avgWin: -100,
        avgLoss: 50,
      });

      expect(result.isValid).toBe(false);
      expect(result.warning).toContain('Invalid inputs');
    });

    it('should reject zero average loss', () => {
      const result = KellyCriterionCalculator.calculate({
        winRate: 0.6,
        avgWin: 100,
        avgLoss: 0,
      });

      expect(result.isValid).toBe(false);
      expect(result.warning).toContain('Invalid inputs');
    });

    it('should include risk-free rate in edge calculation', () => {
      const withoutRiskFree = KellyCriterionCalculator.calculate({
        winRate: 0.6,
        avgWin: 100,
        avgLoss: 50,
        riskFreeRate: 0,
      });

      const withRiskFree = KellyCriterionCalculator.calculate({
        winRate: 0.6,
        avgWin: 100,
        avgLoss: 50,
        riskFreeRate: 5,
      });

      expect(withRiskFree.kellyFraction).toBeLessThanOrEqual(withoutRiskFree.kellyFraction);
    });
  });

  describe('fromTradeHistory', () => {
    it('should calculate Kelly from winning trades', () => {
      const trades = [
        { pnl: 100 },
        { pnl: 150 },
        { pnl: -50 },
        { pnl: 120 },
        { pnl: -60 },
      ];

      const result = KellyCriterionCalculator.fromTradeHistory(trades);

      expect(result.isValid).toBe(true);
      expect(result.kellyFraction).toBeGreaterThan(0);
    });

    it('should handle all winning trades', () => {
      const trades = [{ pnl: 100 }, { pnl: 150 }, { pnl: 200 }];

      const result = KellyCriterionCalculator.fromTradeHistory(trades);

      expect(result.isValid).toBe(true);
      expect(result.kellyFraction).toBe(0.25);
      expect(result.warning).toContain('No losing trades');
    });

    it('should handle all losing trades', () => {
      const trades = [{ pnl: -100 }, { pnl: -50 }, { pnl: -75 }];

      const result = KellyCriterionCalculator.fromTradeHistory(trades);

      expect(result.isValid).toBe(false);
      expect(result.kellyFraction).toBe(0);
    });

    it('should return invalid for empty trade history', () => {
      const result = KellyCriterionCalculator.fromTradeHistory([]);

      expect(result.isValid).toBe(false);
      expect(result.warning).toContain('No trade history');
    });

    it('should calculate correct win rate from history', () => {
      const trades = [
        { pnl: 100 },
        { pnl: -50 },
        { pnl: 80 },
        { pnl: -40 },
        { pnl: 120 },
      ];

      const result = KellyCriterionCalculator.fromTradeHistory(trades);

      expect(result.isValid).toBe(true);
    });

    it('should treat zero P&L as loss', () => {
      const trades = [{ pnl: 100 }, { pnl: 0 }, { pnl: -50 }];

      const result = KellyCriterionCalculator.fromTradeHistory(trades);

      expect(result.isValid).toBe(true);
    });
  });

  describe('calculatePositionSize', () => {
    it('should calculate position size with full Kelly', () => {
      const capital = 10000;
      const kellyFraction = 0.2;

      const positionSize = KellyCriterionCalculator.calculatePositionSize(
        capital,
        kellyFraction,
        false
      );

      expect(positionSize).toBe(2000);
    });

    it('should calculate position size with quarter Kelly (default)', () => {
      const capital = 10000;
      const kellyFraction = 0.2;

      const positionSize = KellyCriterionCalculator.calculatePositionSize(
        capital,
        kellyFraction,
        true,
        0.25
      );

      expect(positionSize).toBe(500);
    });

    it('should calculate position size with half Kelly', () => {
      const capital = 10000;
      const kellyFraction = 0.2;

      const positionSize = KellyCriterionCalculator.calculatePositionSize(
        capital,
        kellyFraction,
        true,
        0.5
      );

      expect(positionSize).toBe(1000);
    });

    it('should handle zero Kelly fraction', () => {
      const capital = 10000;
      const kellyFraction = 0;

      const positionSize = KellyCriterionCalculator.calculatePositionSize(capital, kellyFraction);

      expect(positionSize).toBe(0);
    });
  });

  describe('calculateRiskAdjusted', () => {
    it('should reduce Kelly during drawdown', () => {
      const baseResult = KellyCriterionCalculator.calculate({
        winRate: 0.6,
        avgWin: 100,
        avgLoss: 50,
      });

      const adjustedResult = KellyCriterionCalculator.calculateRiskAdjusted(
        {
          winRate: 0.6,
          avgWin: 100,
          avgLoss: 50,
        },
        0.1,
        0.2
      );

      expect(adjustedResult.kellyFraction).toBeLessThan(baseResult.kellyFraction);
    });

    it('should apply full Kelly when no drawdown', () => {
      const baseResult = KellyCriterionCalculator.calculate({
        winRate: 0.6,
        avgWin: 100,
        avgLoss: 50,
      });

      const adjustedResult = KellyCriterionCalculator.calculateRiskAdjusted(
        {
          winRate: 0.6,
          avgWin: 100,
          avgLoss: 50,
        },
        0,
        0.2
      );

      expect(adjustedResult.kellyFraction).toBe(baseResult.kellyFraction);
    });

    it('should reduce to zero at max drawdown', () => {
      const adjustedResult = KellyCriterionCalculator.calculateRiskAdjusted(
        {
          winRate: 0.6,
          avgWin: 100,
          avgLoss: 50,
        },
        0.2,
        0.2
      );

      expect(adjustedResult.kellyFraction).toBe(0);
    });

    it('should show warning for high drawdown', () => {
      const adjustedResult = KellyCriterionCalculator.calculateRiskAdjusted(
        {
          winRate: 0.6,
          avgWin: 100,
          avgLoss: 50,
        },
        0.15,
        0.2
      );

      expect(adjustedResult.warning).toContain('High drawdown');
    });

    it('should preserve original warning if drawdown is low', () => {
      const adjustedResult = KellyCriterionCalculator.calculateRiskAdjusted(
        {
          winRate: 0.9,
          avgWin: 1000,
          avgLoss: 100,
        },
        0.05,
        0.2
      );

      expect(adjustedResult.warning).toContain('exceeds max');
    });
  });

  describe('calculateExpectedGrowth', () => {
    it('should calculate positive growth for profitable strategy', () => {
      const growth = KellyCriterionCalculator.calculateExpectedGrowth(
        {
          winRate: 0.6,
          avgWin: 100,
          avgLoss: 50,
        },
        0.2
      );

      expect(growth).toBeGreaterThan(0);
    });

    it('should calculate zero growth at optimal Kelly', () => {
      const inputs = {
        winRate: 0.6,
        avgWin: 100,
        avgLoss: 50,
      };

      const result = KellyCriterionCalculator.calculate(inputs);
      const growth = KellyCriterionCalculator.calculateExpectedGrowth(
        inputs,
        result.kellyFraction
      );

      expect(growth).toBeGreaterThan(0);
    });

    it('should calculate lower growth for over-betting beyond optimal', () => {
      const inputs = {
        winRate: 0.6,
        avgWin: 100,
        avgLoss: 50,
      };

      const rawKelly = (inputs.winRate * 2 - (1 - inputs.winRate)) / 2;
      const optimalGrowth = KellyCriterionCalculator.calculateExpectedGrowth(inputs, rawKelly);
      const overBetGrowth = KellyCriterionCalculator.calculateExpectedGrowth(inputs, rawKelly * 2);

      expect(overBetGrowth).toBeLessThan(optimalGrowth);
    });
  });

  describe('calculateRuinProbability', () => {
    it('should return low ruin probability for conservative Kelly', () => {
      const ruinProb = KellyCriterionCalculator.calculateRuinProbability(0.6, 2, 0.05, 0.5);

      expect(ruinProb).toBeGreaterThanOrEqual(0);
      expect(ruinProb).toBeLessThanOrEqual(1);
    });

    it('should return high ruin probability for aggressive Kelly', () => {
      const ruinProb = KellyCriterionCalculator.calculateRuinProbability(0.6, 2, 0.25, 0.5);

      expect(ruinProb).toBeGreaterThanOrEqual(0);
      expect(ruinProb).toBeLessThanOrEqual(1);
    });

    it('should return 1 for negative Kelly', () => {
      const ruinProb = KellyCriterionCalculator.calculateRuinProbability(0.4, 1, -0.1, 0.5);

      expect(ruinProb).toBe(1);
    });

    it('should return 1 for losing strategy', () => {
      const ruinProb = KellyCriterionCalculator.calculateRuinProbability(0.3, 1, 0.1, 0.5);

      expect(ruinProb).toBe(1);
    });

    it('should return lower ruin probability with larger max drawdown tolerance', () => {
      const ruinProb50 = KellyCriterionCalculator.calculateRuinProbability(0.6, 2, 0.1, 0.5);
      const ruinProb80 = KellyCriterionCalculator.calculateRuinProbability(0.6, 2, 0.1, 0.8);

      expect(ruinProb50).toBeGreaterThanOrEqual(0);
      expect(ruinProb50).toBeLessThanOrEqual(1);
      expect(ruinProb80).toBeGreaterThanOrEqual(0);
      expect(ruinProb80).toBeLessThanOrEqual(1);
    });
  });
});
