import { describe, expect, it } from 'vitest';
import { PortfolioHeatTracker, type Position } from './PortfolioHeatTracker';

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

describe('PortfolioHeatTracker', () => {
  describe('calculatePositionRisk', () => {
    it('should calculate risk for long position', () => {
      const position = createPosition('BTCUSDT', 100, 105, 10, 95, 'long');
      const capital = 10000;

      const risk = PortfolioHeatTracker.calculatePositionRisk(position, capital);

      expect(risk.symbol).toBe('BTCUSDT');
      expect(risk.riskAmount).toBe(50);
      expect(risk.riskPercent).toBe(0.005);
      expect(risk.positionSize).toBe(1050);
      expect(risk.positionSizePercent).toBe(0.105);
    });

    it('should calculate risk for short position', () => {
      const position = createPosition('ETHUSDT', 100, 95, 10, 105, 'short');
      const capital = 10000;

      const risk = PortfolioHeatTracker.calculatePositionRisk(position, capital);

      expect(risk.symbol).toBe('ETHUSDT');
      expect(risk.riskAmount).toBe(50);
      expect(risk.riskPercent).toBe(0.005);
    });

    it('should calculate R:R ratio for winning long position', () => {
      const position = createPosition('BTCUSDT', 100, 110, 10, 95, 'long');
      const capital = 10000;

      const risk = PortfolioHeatTracker.calculatePositionRisk(position, capital);

      expect(risk.rRatio).toBe(2);
    });

    it('should handle position at breakeven', () => {
      const position = createPosition('BTCUSDT', 100, 100, 10, 95, 'long');
      const capital = 10000;

      const risk = PortfolioHeatTracker.calculatePositionRisk(position, capital);

      expect(risk.rRatio).toBe(0);
    });

    it('should handle losing position', () => {
      const position = createPosition('BTCUSDT', 100, 90, 10, 95, 'long');
      const capital = 10000;

      const risk = PortfolioHeatTracker.calculatePositionRisk(position, capital);

      expect(risk.riskAmount).toBe(50);
      expect(risk.riskPercent).toBe(0.005);
    });
  });

  describe('calculatePortfolioHeat', () => {
    it('should calculate total heat for multiple positions', () => {
      const positions = [
        createPosition('BTCUSDT', 100, 105, 10, 95, 'long'),
        createPosition('ETHUSDT', 50, 52, 20, 48, 'long'),
      ];
      const capital = 10000;

      const heat = PortfolioHeatTracker.calculatePortfolioHeat(positions, capital);

      expect(heat.positionCount).toBe(2);
      expect(heat.totalHeat).toBe(90);
      expect(heat.totalHeatPercent).toBe(0.009);
    });

    it('should flag low heat level', () => {
      const positions = [createPosition('BTCUSDT', 100, 105, 10, 98, 'long')];
      const capital = 10000;

      const heat = PortfolioHeatTracker.calculatePortfolioHeat(positions, capital);

      expect(heat.heatLevel).toBe('low');
      expect(heat.isOverheated).toBe(false);
    });

    it('should flag moderate heat level', () => {
      const positions = [createPosition('BTCUSDT', 100, 105, 100, 97, 'long')];
      const capital = 10000;

      const heat = PortfolioHeatTracker.calculatePortfolioHeat(positions, capital);

      expect(heat.heatLevel).toBe('moderate');
      expect(heat.isOverheated).toBe(false);
    });

    it('should flag high heat level', () => {
      const positions = [createPosition('BTCUSDT', 100, 105, 200, 97, 'long')];
      const capital = 10000;

      const heat = PortfolioHeatTracker.calculatePortfolioHeat(positions, capital);

      expect(heat.heatLevel).toBe('high');
      expect(heat.isOverheated).toBe(false);
    });

    it('should flag extreme heat level', () => {
      const positions = [createPosition('BTCUSDT', 100, 105, 300, 97, 'long')];
      const capital = 10000;

      const heat = PortfolioHeatTracker.calculatePortfolioHeat(positions, capital);

      expect(heat.heatLevel).toBe('extreme');
      expect(heat.isOverheated).toBe(true);
    });

    it('should provide appropriate recommendations', () => {
      const lowHeat = PortfolioHeatTracker.calculatePortfolioHeat(
        [createPosition('BTCUSDT', 100, 105, 10, 98, 'long')],
        10000
      );
      expect(lowHeat.recommendation).toContain('low');

      const extremeHeat = PortfolioHeatTracker.calculatePortfolioHeat(
        [createPosition('BTCUSDT', 100, 105, 300, 97, 'long')],
        10000
      );
      expect(extremeHeat.recommendation).toContain('EXTREME');
    });
  });

  describe('canAddPosition', () => {
    it('should allow adding position when within limits', () => {
      const currentPositions = [createPosition('BTCUSDT', 100, 105, 10, 95, 'long')];
      const newPosition = createPosition('ETHUSDT', 50, 52, 10, 48, 'long');
      const capital = 10000;

      const result = PortfolioHeatTracker.canAddPosition(
        currentPositions,
        newPosition,
        capital
      );

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should reject position exceeding max position heat', () => {
      const currentPositions: Position[] = [];
      const newPosition = createPosition('BTCUSDT', 100, 105, 300, 97, 'long');
      const capital = 10000;

      const result = PortfolioHeatTracker.canAddPosition(
        currentPositions,
        newPosition,
        capital
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Position risk');
      expect(result.reason).toContain('exceeds max position heat');
    });

    it('should reject position exceeding total portfolio heat', () => {
      const currentPositions = [createPosition('BTCUSDT', 100, 105, 200, 97, 'long')];
      const newPosition = createPosition('ETHUSDT', 50, 52, 100, 48, 'long');
      const capital = 10000;

      const result = PortfolioHeatTracker.canAddPosition(
        currentPositions,
        newPosition,
        capital
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Total portfolio heat');
      expect(result.reason).toContain('exceeding limit');
    });

    it('should return heat levels', () => {
      const currentPositions = [createPosition('BTCUSDT', 100, 105, 10, 95, 'long')];
      const newPosition = createPosition('ETHUSDT', 50, 52, 10, 48, 'long');
      const capital = 10000;

      const result = PortfolioHeatTracker.canAddPosition(
        currentPositions,
        newPosition,
        capital
      );

      expect(result.currentHeat).toBeGreaterThan(0);
      expect(result.newHeat).toBeGreaterThan(result.currentHeat);
    });
  });

  describe('calculateCorrelatedHeat', () => {
    it('should calculate heat for correlated positions', () => {
      const positions = [
        createPosition('BTCUSDT', 100, 105, 10, 95, 'long'),
        createPosition('BTCBUSD', 100, 105, 10, 95, 'long'),
        createPosition('ETHUSDT', 50, 52, 20, 48, 'long'),
      ];
      const capital = 10000;

      const correlatedHeat = PortfolioHeatTracker.calculateCorrelatedHeat(
        positions,
        capital,
        'BTC'
      );

      expect(correlatedHeat).toBe(0.01);
    });

    it('should return 0 for no correlated positions', () => {
      const positions = [createPosition('ETHUSDT', 50, 52, 20, 48, 'long')];
      const capital = 10000;

      const correlatedHeat = PortfolioHeatTracker.calculateCorrelatedHeat(
        positions,
        capital,
        'BTC'
      );

      expect(correlatedHeat).toBe(0);
    });
  });

  describe('getRecommendedPositionSize', () => {
    it('should recommend position size based on available heat', () => {
      const currentPositions = [createPosition('BTCUSDT', 100, 105, 10, 95, 'long')];
      const capital = 10000;
      const targetRiskPercent = 0.02;

      const recommendedSize = PortfolioHeatTracker.getRecommendedPositionSize(
        currentPositions,
        capital,
        targetRiskPercent
      );

      expect(recommendedSize).toBeGreaterThan(0);
      expect(recommendedSize).toBeLessThanOrEqual(capital * targetRiskPercent);
    });

    it('should limit to max position heat', () => {
      const currentPositions: Position[] = [];
      const capital = 10000;
      const targetRiskPercent = 0.05;

      const recommendedSize = PortfolioHeatTracker.getRecommendedPositionSize(
        currentPositions,
        capital,
        targetRiskPercent
      );

      expect(recommendedSize).toBeLessThanOrEqual(capital * 0.02);
    });

    it('should return 0 when portfolio is at max heat', () => {
      const currentPositions = [createPosition('BTCUSDT', 100, 105, 300, 97, 'long')];
      const capital = 10000;
      const targetRiskPercent = 0.02;

      const recommendedSize = PortfolioHeatTracker.getRecommendedPositionSize(
        currentPositions,
        capital,
        targetRiskPercent
      );

      expect(recommendedSize).toBe(0);
    });
  });

  describe('calculateHeatReduction', () => {
    it('should suggest no reduction when within target', () => {
      const positions = [createPosition('BTCUSDT', 100, 105, 10, 95, 'long')];
      const capital = 10000;
      const targetHeat = 0.02;

      const result = PortfolioHeatTracker.calculateHeatReduction(positions, capital, targetHeat);

      expect(result.reductionNeeded).toBe(0);
      expect(result.positionsToClose).toBe(0);
      expect(result.suggestions[0]).toContain('within target');
    });

    it('should calculate reduction needed when overheated', () => {
      const positions = [
        createPosition('BTCUSDT', 100, 105, 100, 95, 'long'),
        createPosition('ETHUSDT', 50, 52, 100, 48, 'long'),
      ];
      const capital = 10000;
      const targetHeat = 0.03;

      const result = PortfolioHeatTracker.calculateHeatReduction(positions, capital, targetHeat);

      expect(result.reductionNeeded).toBeGreaterThan(0);
      expect(result.positionsToClose).toBeGreaterThan(0);
    });

    it('should suggest closing highest risk positions first', () => {
      const positions = [
        createPosition('BTCUSDT', 100, 105, 50, 95, 'long'),
        createPosition('ETHUSDT', 50, 52, 100, 48, 'long'),
      ];
      const capital = 10000;
      const targetHeat = 0.03;

      const result = PortfolioHeatTracker.calculateHeatReduction(positions, capital, targetHeat);

      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions.some((s) => s.includes('Highest risk positions'))).toBe(true);
    });

    it('should provide actionable suggestions', () => {
      const positions = [createPosition('BTCUSDT', 100, 105, 300, 97, 'long')];
      const capital = 10000;
      const targetHeat = 0.03;

      const result = PortfolioHeatTracker.calculateHeatReduction(positions, capital, targetHeat);

      expect(result.suggestions.some((s) => s.includes('Reduce portfolio heat'))).toBe(true);
      expect(result.suggestions.some((s) => s.includes('closing'))).toBe(true);
      expect(result.suggestions.some((s) => s.includes('tighten stop losses'))).toBe(true);
    });
  });

  describe('getHeatDistribution', () => {
    it('should return heat distribution map', () => {
      const positions = [
        createPosition('BTCUSDT', 100, 105, 10, 95, 'long'),
        createPosition('ETHUSDT', 50, 52, 20, 48, 'long'),
      ];
      const capital = 10000;

      const distribution = PortfolioHeatTracker.getHeatDistribution(positions, capital);

      expect(distribution.size).toBe(2);
      expect(distribution.get('BTCUSDT')).toBe(0.005);
      expect(distribution.get('ETHUSDT')).toBe(0.004);
    });

    it('should return empty map for no positions', () => {
      const distribution = PortfolioHeatTracker.getHeatDistribution([], 10000);

      expect(distribution.size).toBe(0);
    });
  });

  describe('calculateDiversificationScore', () => {
    it('should return 1 for no positions', () => {
      const score = PortfolioHeatTracker.calculateDiversificationScore([], 10000);

      expect(score).toBe(1);
    });

    it('should return 0 for single position', () => {
      const positions = [createPosition('BTCUSDT', 100, 105, 10, 95, 'long')];
      const score = PortfolioHeatTracker.calculateDiversificationScore(positions, 10000);

      expect(score).toBe(0);
    });

    it('should return high score for evenly distributed risk', () => {
      const positions = [
        createPosition('BTCUSDT', 100, 105, 10, 95, 'long'),
        createPosition('ETHUSDT', 50, 52, 20, 48, 'long'),
        createPosition('BNBUSDT', 200, 205, 5, 195, 'long'),
      ];
      const score = PortfolioHeatTracker.calculateDiversificationScore(positions, 10000);

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should return lower score for concentrated risk', () => {
      const evenPositions = [
        createPosition('BTCUSDT', 100, 105, 10, 95, 'long'),
        createPosition('ETHUSDT', 50, 52, 20, 48, 'long'),
      ];

      const concentratedPositions = [
        createPosition('BTCUSDT', 100, 105, 100, 95, 'long'),
        createPosition('ETHUSDT', 50, 52, 5, 48, 'long'),
      ];

      const evenScore = PortfolioHeatTracker.calculateDiversificationScore(evenPositions, 10000);
      const concentratedScore = PortfolioHeatTracker.calculateDiversificationScore(
        concentratedPositions,
        10000
      );

      expect(concentratedScore).toBeLessThan(evenScore);
    });
  });

  describe('getHeatStatus', () => {
    it('should return low heat status', () => {
      const status = PortfolioHeatTracker.getHeatStatus(0.01);

      expect(status).toContain('Low heat');
      expect(status).toContain('Safe to add positions');
    });

    it('should return moderate heat status', () => {
      const status = PortfolioHeatTracker.getHeatStatus(0.03);

      expect(status).toContain('Moderate heat');
      expect(status).toContain('Monitor closely');
    });

    it('should return high heat status', () => {
      const status = PortfolioHeatTracker.getHeatStatus(0.05);

      expect(status).toContain('High heat');
      expect(status).toContain('Avoid new positions');
    });

    it('should return extreme heat status', () => {
      const status = PortfolioHeatTracker.getHeatStatus(0.08);

      expect(status).toContain('EXTREME heat');
      expect(status).toContain('Reduce positions immediately');
    });
  });
});
