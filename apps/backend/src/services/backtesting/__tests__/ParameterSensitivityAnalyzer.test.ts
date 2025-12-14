import { describe, it, expect, vi } from 'vitest';
import {
  ParameterSensitivityAnalyzer,
  type ParameterTestConfig,
  type SensitivityAnalysis,
} from '../ParameterSensitivityAnalyzer';
import type { BacktestConfig, BacktestResult, Interval } from '@marketmind/types';

const createMockBacktestResult = (sharpeRatio: number, totalPnlPercent: number): BacktestResult => ({
  id: 'test-result',
  status: 'SUCCESS',
  startDate: '2024-01-01',
  endDate: '2024-03-01',
  trades: [],
  metrics: {
    totalTrades: 10,
    winRate: 50,
    totalPnl: 1000,
    totalPnlPercent,
    maxDrawdown: 0.1,
    maxDrawdownPercent: 10,
    profitFactor: 1.5,
    sharpeRatio,
    avgWin: 200,
    avgLoss: 100,
    avgWinPercent: 2,
    avgLossPercent: 1,
    largestWin: 500,
    largestLoss: 200,
    avgTradeDuration: 24,
    avgBarsInTrade: 6,
  },
  equityCurve: [],
  drawdownCurve: [],
  config: {} as BacktestConfig,
});

const createBaseConfig = (): BacktestConfig => ({
  symbol: 'BTCUSDT',
  interval: '1d' as Interval,
  startDate: '2024-01-01',
  endDate: '2024-03-01',
  initialCapital: 10000,
  setupTypes: ['test-setup'],
});

describe('ParameterSensitivityAnalyzer', () => {
  describe('analyze', () => {
    it('should run sensitivity analysis for single parameter', async () => {
      const config: ParameterTestConfig = {
        baseConfig: createBaseConfig(),
        parametersToTest: [{ name: 'stopLoss', min: 1, max: 3, step: 1 }],
        metric: 'sharpeRatio',
      };

      let callCount = 0;
      const mockRunner = vi.fn(async () => {
        callCount++;
        return createMockBacktestResult(1 + callCount * 0.1, 10 + callCount);
      });

      const result = await ParameterSensitivityAnalyzer.analyze(config, mockRunner);

      expect(result.allTests).toHaveLength(3);
      expect(result.parameterAnalyses).toHaveLength(1);
      expect(result.bestParameters).toBeDefined();
      expect(result.worstParameters).toBeDefined();
      expect(result.robustnessScore).toBeGreaterThanOrEqual(0);
      expect(result.robustnessScore).toBeLessThanOrEqual(100);
    });

    it('should run sensitivity analysis for two parameters', async () => {
      const config: ParameterTestConfig = {
        baseConfig: createBaseConfig(),
        parametersToTest: [
          { name: 'stopLoss', min: 1, max: 2, step: 1 },
          { name: 'takeProfit', min: 3, max: 4, step: 1 },
        ],
        metric: 'sharpeRatio',
      };

      const mockRunner = vi.fn(async (cfg: BacktestConfig) => {
        const sl = (cfg as Record<string, number>).stopLoss ?? 1;
        const tp = (cfg as Record<string, number>).takeProfit ?? 3;
        return createMockBacktestResult(sl + tp * 0.1, sl * tp);
      });

      const result = await ParameterSensitivityAnalyzer.analyze(config, mockRunner);

      expect(result.allTests).toHaveLength(4);
      expect(result.parameterAnalyses).toHaveLength(2);
      expect(result.heatmap).toBeDefined();
      expect(result.heatmap).toHaveLength(4);
    });

    it('should identify best and worst parameters', async () => {
      const config: ParameterTestConfig = {
        baseConfig: createBaseConfig(),
        parametersToTest: [{ name: 'param', min: 1, max: 5, step: 1 }],
        metric: 'sharpeRatio',
      };

      const sharpeValues = [0.5, 1.0, 2.0, 1.5, 0.8];
      let index = 0;
      const mockRunner = vi.fn(async () => {
        return createMockBacktestResult(sharpeValues[index++] ?? 0, 10);
      });

      const result = await ParameterSensitivityAnalyzer.analyze(config, mockRunner);

      expect(result.bestParameters.param).toBe(3);
      expect(result.worstParameters.param).toBe(1);
    });

    it('should generate heatmap only for two parameters', async () => {
      const configOne: ParameterTestConfig = {
        baseConfig: createBaseConfig(),
        parametersToTest: [{ name: 'param', min: 1, max: 2, step: 1 }],
        metric: 'sharpeRatio',
      };

      const configThree: ParameterTestConfig = {
        baseConfig: createBaseConfig(),
        parametersToTest: [
          { name: 'a', min: 1, max: 2, step: 1 },
          { name: 'b', min: 1, max: 2, step: 1 },
          { name: 'c', min: 1, max: 2, step: 1 },
        ],
        metric: 'sharpeRatio',
      };

      const mockRunner = vi.fn(async () => createMockBacktestResult(1.5, 10));

      const resultOne = await ParameterSensitivityAnalyzer.analyze(configOne, mockRunner);
      const resultThree = await ParameterSensitivityAnalyzer.analyze(configThree, mockRunner);

      expect(resultOne.heatmap).toBeUndefined();
      expect(resultThree.heatmap).toBeUndefined();
    });

    it('should support different metrics', async () => {
      const metrics: Array<'sharpeRatio' | 'totalReturn' | 'profitFactor' | 'winRate'> = [
        'sharpeRatio',
        'totalReturn',
        'profitFactor',
        'winRate',
      ];

      for (const metric of metrics) {
        const config: ParameterTestConfig = {
          baseConfig: createBaseConfig(),
          parametersToTest: [{ name: 'param', min: 1, max: 2, step: 1 }],
          metric,
        };

        const mockRunner = vi.fn(async () => createMockBacktestResult(1.5, 10));
        const result = await ParameterSensitivityAnalyzer.analyze(config, mockRunner);

        expect(result.allTests[0]?.metricValue).toBeDefined();
      }
    });
  });

  describe('sensitivity classification', () => {
    it('should classify LOW sensitivity correctly', async () => {
      const config: ParameterTestConfig = {
        baseConfig: createBaseConfig(),
        parametersToTest: [{ name: 'param', min: 1, max: 5, step: 1 }],
        metric: 'sharpeRatio',
      };

      const mockRunner = vi.fn(async () => createMockBacktestResult(1.5, 10));
      const result = await ParameterSensitivityAnalyzer.analyze(config, mockRunner);

      expect(result.parameterAnalyses[0]?.sensitivity).toBe('LOW');
      expect(result.robustnessScore).toBe(100);
    });

    it('should classify HIGH sensitivity for large variations', async () => {
      const config: ParameterTestConfig = {
        baseConfig: createBaseConfig(),
        parametersToTest: [{ name: 'param', min: 1, max: 3, step: 1 }],
        metric: 'sharpeRatio',
      };

      const values = [0.5, 2.0, 0.3];
      let index = 0;
      const mockRunner = vi.fn(async () => createMockBacktestResult(values[index++] ?? 1, 10));

      const result = await ParameterSensitivityAnalyzer.analyze(config, mockRunner);

      expect(['HIGH', 'CRITICAL']).toContain(result.parameterAnalyses[0]?.sensitivity);
    });
  });

  describe('findOptimalPlateau', () => {
    it('should find stable region in results', () => {
      const analysis: SensitivityAnalysis = {
        parameterName: 'test',
        results: [
          { parameterValue: 1, metricValue: 1.0, percentageChange: -0.2 },
          { parameterValue: 2, metricValue: 1.5, percentageChange: 0.0 },
          { parameterValue: 3, metricValue: 1.6, percentageChange: 0.05 },
          { parameterValue: 4, metricValue: 1.4, percentageChange: -0.05 },
          { parameterValue: 5, metricValue: 0.8, percentageChange: -0.4 },
        ],
        sensitivity: 'MEDIUM',
        maxDeviation: 0.4,
        avgDeviation: 0.15,
        recommendedRange: { min: 2, max: 4 },
      };

      const plateau = ParameterSensitivityAnalyzer.findOptimalPlateau(analysis, 3);

      expect(plateau).not.toBeNull();
      expect(plateau?.start).toBeGreaterThanOrEqual(1);
      expect(plateau?.end).toBeLessThanOrEqual(5);
      expect(plateau?.avgMetric).toBeGreaterThan(0);
    });

    it('should return null for insufficient data', () => {
      const analysis: SensitivityAnalysis = {
        parameterName: 'test',
        results: [
          { parameterValue: 1, metricValue: 1.0, percentageChange: 0 },
          { parameterValue: 2, metricValue: 1.5, percentageChange: 0.5 },
        ],
        sensitivity: 'LOW',
        maxDeviation: 0.5,
        avgDeviation: 0.25,
        recommendedRange: { min: 1, max: 2 },
      };

      const plateau = ParameterSensitivityAnalyzer.findOptimalPlateau(analysis, 3);
      expect(plateau).toBeNull();
    });

    it('should prefer stable high-value plateau over volatile high-value region', () => {
      const analysis: SensitivityAnalysis = {
        parameterName: 'test',
        results: [
          { parameterValue: 1, metricValue: 2.0, percentageChange: 0 },
          { parameterValue: 2, metricValue: 1.8, percentageChange: -0.1 },
          { parameterValue: 3, metricValue: 2.1, percentageChange: 0.05 },
          { parameterValue: 4, metricValue: 3.0, percentageChange: 0.5 },
          { parameterValue: 5, metricValue: 0.5, percentageChange: -0.75 },
        ],
        sensitivity: 'HIGH',
        maxDeviation: 0.75,
        avgDeviation: 0.28,
        recommendedRange: { min: 1, max: 3 },
      };

      const plateau = ParameterSensitivityAnalyzer.findOptimalPlateau(analysis, 3);

      expect(plateau).not.toBeNull();
      expect(plateau?.end).toBeLessThanOrEqual(4);
    });
  });

  describe('detectOverOptimization', () => {
    it('should detect critical sensitivity as over-optimized', () => {
      const analysis: SensitivityAnalysis = {
        parameterName: 'stopLoss',
        results: [],
        sensitivity: 'CRITICAL',
        maxDeviation: 1.5,
        avgDeviation: 0.8,
        recommendedRange: { min: 1, max: 2 },
      };

      const result = ParameterSensitivityAnalyzer.detectOverOptimization(analysis);

      expect(result.isOverOptimized).toBe(true);
      expect(result.reason).toContain('critical sensitivity');
    });

    it('should detect high deviation as over-optimized', () => {
      const analysis: SensitivityAnalysis = {
        parameterName: 'takeProfit',
        results: [],
        sensitivity: 'HIGH',
        maxDeviation: 0.6,
        avgDeviation: 0.45,
        recommendedRange: { min: 2, max: 4 },
      };

      const result = ParameterSensitivityAnalyzer.detectOverOptimization(analysis);

      expect(result.isOverOptimized).toBe(true);
      expect(result.reason).toContain('high average deviation');
    });

    it('should detect low stability as over-optimized', () => {
      const analysis: SensitivityAnalysis = {
        parameterName: 'rsi',
        results: [
          { parameterValue: 10, metricValue: 0.5, percentageChange: -0.5 },
          { parameterValue: 14, metricValue: 2.0, percentageChange: 1.0 },
          { parameterValue: 18, metricValue: 0.3, percentageChange: -0.7 },
          { parameterValue: 22, metricValue: 1.8, percentageChange: 0.8 },
          { parameterValue: 26, metricValue: 0.4, percentageChange: -0.6 },
        ],
        sensitivity: 'MEDIUM',
        maxDeviation: 1.0,
        avgDeviation: 0.3,
        recommendedRange: { min: 10, max: 26 },
      };

      const result = ParameterSensitivityAnalyzer.detectOverOptimization(analysis);

      expect(result.isOverOptimized).toBe(true);
      expect(result.reason).toContain('stable performance');
    });

    it('should accept robust parameters', () => {
      const analysis: SensitivityAnalysis = {
        parameterName: 'period',
        results: [
          { parameterValue: 10, metricValue: 1.4, percentageChange: -0.1 },
          { parameterValue: 12, metricValue: 1.5, percentageChange: 0.0 },
          { parameterValue: 14, metricValue: 1.6, percentageChange: 0.07 },
          { parameterValue: 16, metricValue: 1.5, percentageChange: 0.0 },
          { parameterValue: 18, metricValue: 1.4, percentageChange: -0.07 },
        ],
        sensitivity: 'LOW',
        maxDeviation: 0.1,
        avgDeviation: 0.05,
        recommendedRange: { min: 10, max: 18 },
      };

      const result = ParameterSensitivityAnalyzer.detectOverOptimization(analysis);

      expect(result.isOverOptimized).toBe(false);
      expect(result.reason).toContain('acceptable robustness');
    });
  });

  describe('robustness score calculation', () => {
    it('should return 100 for all LOW sensitivity', async () => {
      const config: ParameterTestConfig = {
        baseConfig: createBaseConfig(),
        parametersToTest: [
          { name: 'a', min: 1, max: 2, step: 1 },
          { name: 'b', min: 1, max: 2, step: 1 },
        ],
        metric: 'sharpeRatio',
      };

      const mockRunner = vi.fn(async () => createMockBacktestResult(1.5, 10));
      const result = await ParameterSensitivityAnalyzer.analyze(config, mockRunner);

      expect(result.robustnessScore).toBe(100);
    });

    it('should return lower score for higher sensitivity', async () => {
      const config: ParameterTestConfig = {
        baseConfig: createBaseConfig(),
        parametersToTest: [{ name: 'param', min: 1, max: 3, step: 1 }],
        metric: 'sharpeRatio',
      };

      const values = [0.1, 5.0, 0.2];
      let index = 0;
      const mockRunner = vi.fn(async () => createMockBacktestResult(values[index++] ?? 1, 10));

      const result = await ParameterSensitivityAnalyzer.analyze(config, mockRunner);

      expect(result.robustnessScore).toBeLessThan(100);
    });
  });

  describe('edge cases', () => {
    it('should handle empty parameter list', async () => {
      const config: ParameterTestConfig = {
        baseConfig: createBaseConfig(),
        parametersToTest: [],
        metric: 'sharpeRatio',
      };

      const mockRunner = vi.fn(async () => createMockBacktestResult(1.5, 10));
      const result = await ParameterSensitivityAnalyzer.analyze(config, mockRunner);

      expect(result.allTests).toHaveLength(1);
      expect(result.parameterAnalyses).toHaveLength(0);
    });
  });
});
