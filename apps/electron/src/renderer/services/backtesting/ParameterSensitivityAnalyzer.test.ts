import { describe, expect, it } from 'vitest';
import { ParameterSensitivityAnalyzer } from './ParameterSensitivityAnalyzer';
import type { BacktestConfig, BacktestResult, ParameterRange } from './types';

describe('ParameterSensitivityAnalyzer', () => {
  const createMockResult = (sharpe: number, totalReturn: number): BacktestResult => ({
    trades: [],
    metrics: {
      totalTrades: 10,
      winningTrades: 6,
      losingTrades: 4,
      winRate: 0.6,
      totalReturn,
      sharpeRatio: sharpe,
      profitFactor: 1.5,
      maxDrawdown: 0.15,
      avgWin: 150,
      avgLoss: -80,
      expectancy: 50,
      consecutiveWins: 3,
      consecutiveLosses: 2,
    },
    equityCurve: [],
    drawdownCurve: [],
    initialCapital: 10000,
    finalCapital: 10000 + totalReturn * 10000,
    startDate: new Date(),
    endDate: new Date(),
  });

  const createBaseConfig = (): BacktestConfig => ({
    symbol: 'BTCUSDT',
    interval: '1h',
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-12-31'),
    initialCapital: 10000,
    setupName: 'TestSetup',
    setupConfig: {},
    riskPerTrade: 0.02,
    commission: 0.001,
  });

  describe('analyze', () => {
    it('should analyze parameter sensitivity successfully', async () => {
      const config = {
        baseConfig: createBaseConfig(),
        parametersToTest: [
          { name: 'threshold', min: 0.5, max: 1.5, step: 0.5 },
        ] as ParameterRange[],
        metric: 'sharpeRatio' as const,
      };

      let callCount = 0;
      const backtestRunner = async () => {
        callCount++;
        return createMockResult(1.5 + callCount * 0.1, 0.25);
      };

      const result = await ParameterSensitivityAnalyzer.analyze(config, backtestRunner);

      expect(result.allTests.length).toBeGreaterThan(0);
      expect(result.parameterAnalyses).toHaveLength(1);
      expect(result.bestParameters).toBeDefined();
      expect(result.worstParameters).toBeDefined();
      expect(result.robustnessScore).toBeGreaterThanOrEqual(0);
      expect(result.robustnessScore).toBeLessThanOrEqual(100);
    });

    it('should test multiple parameter combinations', async () => {
      const config = {
        baseConfig: createBaseConfig(),
        parametersToTest: [
          { name: 'param1', min: 1, max: 2, step: 1 },
          { name: 'param2', min: 10, max: 20, step: 10 },
        ] as ParameterRange[],
        metric: 'sharpeRatio' as const,
      };

      const backtestRunner = async () => createMockResult(1.5, 0.25);

      const result = await ParameterSensitivityAnalyzer.analyze(config, backtestRunner);

      expect(result.allTests).toHaveLength(4);
      expect(result.parameterAnalyses).toHaveLength(2);
    });

    it('should generate heatmap for two parameters', async () => {
      const config = {
        baseConfig: createBaseConfig(),
        parametersToTest: [
          { name: 'param1', min: 1, max: 2, step: 1 },
          { name: 'param2', min: 10, max: 20, step: 10 },
        ] as ParameterRange[],
        metric: 'sharpeRatio' as const,
      };

      const backtestRunner = async () => createMockResult(1.5, 0.25);

      const result = await ParameterSensitivityAnalyzer.analyze(config, backtestRunner);

      expect(result.heatmap).toBeDefined();
      expect(result.heatmap).toHaveLength(4);
      result.heatmap?.forEach((point) => {
        expect(point.param1Value).toBeDefined();
        expect(point.param2Value).toBeDefined();
        expect(point.metricValue).toBeDefined();
      });
    });

    it('should not generate heatmap for non-2D parameter space', async () => {
      const config = {
        baseConfig: createBaseConfig(),
        parametersToTest: [
          { name: 'param1', min: 1, max: 2, step: 1 },
        ] as ParameterRange[],
        metric: 'sharpeRatio' as const,
      };

      const backtestRunner = async () => createMockResult(1.5, 0.25);

      const result = await ParameterSensitivityAnalyzer.analyze(config, backtestRunner);

      expect(result.heatmap).toBeUndefined();
    });

    it('should identify best and worst parameter combinations', async () => {
      const config = {
        baseConfig: createBaseConfig(),
        parametersToTest: [
          { name: 'threshold', min: 0.5, max: 1.5, step: 0.5 },
        ] as ParameterRange[],
        metric: 'sharpeRatio' as const,
      };

      let callCount = 0;
      const backtestRunner = async () => {
        callCount++;
        const sharpe = callCount === 2 ? 2.5 : 1.0;
        return createMockResult(sharpe, 0.25);
      };

      const result = await ParameterSensitivityAnalyzer.analyze(config, backtestRunner);

      const bestMetric = result.allTests.find(
        (t) => JSON.stringify(t.parameters) === JSON.stringify(result.bestParameters)
      )?.metricValue;
      const worstMetric = result.allTests.find(
        (t) => JSON.stringify(t.parameters) === JSON.stringify(result.worstParameters)
      )?.metricValue;

      expect(bestMetric).toBeGreaterThan(worstMetric!);
    });

    it('should calculate robustness score correctly', async () => {
      const config = {
        baseConfig: createBaseConfig(),
        parametersToTest: [
          { name: 'stable', min: 1, max: 3, step: 1 },
        ] as ParameterRange[],
        metric: 'sharpeRatio' as const,
      };

      const backtestRunner = async () => createMockResult(1.5, 0.25);

      const result = await ParameterSensitivityAnalyzer.analyze(config, backtestRunner);

      expect(result.robustnessScore).toBeGreaterThan(70);
    });

    it('should handle different metrics', async () => {
      const baseConfig = createBaseConfig();
      const parameterRange: ParameterRange[] = [
        { name: 'threshold', min: 0.5, max: 1.0, step: 0.5 },
      ];

      const backtestRunner = async () => createMockResult(1.5, 0.25);

      const metrics: Array<'sharpeRatio' | 'totalReturn' | 'profitFactor' | 'winRate'> = [
        'sharpeRatio',
        'totalReturn',
        'profitFactor',
        'winRate',
      ];

      for (const metric of metrics) {
        const result = await ParameterSensitivityAnalyzer.analyze(
          { baseConfig, parametersToTest: parameterRange, metric },
          backtestRunner
        );

        expect(result.allTests.length).toBeGreaterThan(0);
        expect(result.parameterAnalyses).toHaveLength(1);
      }
    });
  });

  describe('findOptimalPlateau', () => {
    it('should find optimal plateau in stable region', () => {
      const analysis = {
        parameterName: 'test',
        results: [
          { parameterValue: 1, metricValue: 1.0, percentageChange: 0 },
          { parameterValue: 2, metricValue: 1.5, percentageChange: 0.5 },
          { parameterValue: 3, metricValue: 1.48, percentageChange: 0.48 },
          { parameterValue: 4, metricValue: 1.52, percentageChange: 0.52 },
          { parameterValue: 5, metricValue: 1.0, percentageChange: 0 },
        ],
        sensitivity: 'LOW' as const,
        maxDeviation: 0.52,
        avgDeviation: 0.3,
        recommendedRange: { min: 1, max: 5 },
      };

      const plateau = ParameterSensitivityAnalyzer.findOptimalPlateau(analysis);

      expect(plateau).not.toBeNull();
      expect(plateau!.start).toBeGreaterThanOrEqual(1);
      expect(plateau!.end).toBeLessThanOrEqual(5);
      expect(plateau!.avgMetric).toBeGreaterThan(0);
    });

    it('should return null for insufficient data', () => {
      const analysis = {
        parameterName: 'test',
        results: [
          { parameterValue: 1, metricValue: 1.0, percentageChange: 0 },
          { parameterValue: 2, metricValue: 1.5, percentageChange: 0.5 },
        ],
        sensitivity: 'LOW' as const,
        maxDeviation: 0.5,
        avgDeviation: 0.25,
        recommendedRange: { min: 1, max: 2 },
      };

      const plateau = ParameterSensitivityAnalyzer.findOptimalPlateau(analysis);

      expect(plateau).toBeNull();
    });

    it('should respect minimum plateau size', () => {
      const analysis = {
        parameterName: 'test',
        results: Array.from({ length: 10 }, (_, i) => ({
          parameterValue: i,
          metricValue: 1.5,
          percentageChange: 0,
        })),
        sensitivity: 'LOW' as const,
        maxDeviation: 0,
        avgDeviation: 0,
        recommendedRange: { min: 0, max: 9 },
      };

      const plateau5 = ParameterSensitivityAnalyzer.findOptimalPlateau(analysis, 5);
      const plateau8 = ParameterSensitivityAnalyzer.findOptimalPlateau(analysis, 8);

      expect(plateau5).not.toBeNull();
      expect(plateau8).not.toBeNull();
      expect(plateau5!.end - plateau5!.start).toBeGreaterThanOrEqual(4);
      expect(plateau8!.end - plateau8!.start).toBeGreaterThanOrEqual(7);
    });
  });

  describe('detectOverOptimization', () => {
    it('should detect critical sensitivity', () => {
      const analysis = {
        parameterName: 'test',
        results: [],
        sensitivity: 'CRITICAL' as const,
        maxDeviation: 1.2,
        avgDeviation: 0.8,
        recommendedRange: { min: 1, max: 5 },
      };

      const result = ParameterSensitivityAnalyzer.detectOverOptimization(analysis);

      expect(result.isOverOptimized).toBe(true);
      expect(result.reason).toContain('critical sensitivity');
    });

    it('should detect high average deviation', () => {
      const analysis = {
        parameterName: 'test',
        results: [],
        sensitivity: 'HIGH' as const,
        maxDeviation: 0.6,
        avgDeviation: 0.5,
        recommendedRange: { min: 1, max: 5 },
      };

      const result = ParameterSensitivityAnalyzer.detectOverOptimization(analysis);

      expect(result.isOverOptimized).toBe(true);
      expect(result.reason).toContain('high average deviation');
    });

    it('should detect low stability ratio', () => {
      const analysis = {
        parameterName: 'test',
        results: [
          { parameterValue: 1, metricValue: 1.0, percentageChange: 0.5 },
          { parameterValue: 2, metricValue: 1.5, percentageChange: -0.3 },
          { parameterValue: 3, metricValue: 2.0, percentageChange: 0.4 },
          { parameterValue: 4, metricValue: 1.2, percentageChange: -0.25 },
          { parameterValue: 5, metricValue: 1.8, percentageChange: 0.35 },
        ],
        sensitivity: 'MEDIUM' as const,
        maxDeviation: 0.5,
        avgDeviation: 0.35,
        recommendedRange: { min: 1, max: 5 },
      };

      const result = ParameterSensitivityAnalyzer.detectOverOptimization(analysis);

      expect(result.isOverOptimized).toBe(true);
      expect(result.reason).toContain('stable performance');
    });

    it('should accept robust parameters', () => {
      const analysis = {
        parameterName: 'test',
        results: [
          { parameterValue: 1, metricValue: 1.45, percentageChange: 0.05 },
          { parameterValue: 2, metricValue: 1.48, percentageChange: 0.08 },
          { parameterValue: 3, metricValue: 1.52, percentageChange: 0.12 },
          { parameterValue: 4, metricValue: 1.50, percentageChange: 0.10 },
          { parameterValue: 5, metricValue: 1.47, percentageChange: 0.07 },
        ],
        sensitivity: 'LOW' as const,
        maxDeviation: 0.12,
        avgDeviation: 0.08,
        recommendedRange: { min: 1, max: 5 },
      };

      const result = ParameterSensitivityAnalyzer.detectOverOptimization(analysis);

      expect(result.isOverOptimized).toBe(false);
      expect(result.reason).toContain('acceptable robustness');
    });
  });
});
