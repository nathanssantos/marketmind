import type {
  BacktestConfig,
  BacktestMetrics,
  Kline,
  FullSystemOptimizationConfig,
  OptimizationResult as FullOptimizationResult,
  OptimizationResultEntry,
  WalkForwardResult as WFResult,
  PyramidingConfig,
  TrailingStopOptimizationConfig,
} from '@marketmind/types';
import { randomBytes } from 'crypto';
import { BacktestEngine } from './BacktestEngine';
import { WalkForwardOptimizer, type WalkForwardConfig } from './WalkForwardOptimizer';
import { ParameterGenerator } from './ParameterGenerator';
import { DEFAULT_PYRAMIDING_CONFIG } from '../pyramiding';
import { DEFAULT_TRAILING_STOP_CONFIG } from '../trailing-stop';

const generateId = (): string => randomBytes(16).toString('hex');

export interface FullSystemCombination {
  mlThreshold: number;
  pyramiding: Partial<PyramidingConfig>;
  trailingStop: Partial<TrailingStopOptimizationConfig>;
}

export interface FullSystemPreset {
  name: 'quick' | 'balanced' | 'thorough';
  mlThresholds: number[];
  pyramiding: {
    profitThreshold: number[];
    scaleFactor: number[];
    maxEntries: number[];
  };
  trailingStop: {
    breakevenProfitThreshold: number[];
    minTrailingDistancePercent: number[];
  };
  walkForward: boolean;
  topResultsForValidation: number;
}

export const OPTIMIZATION_PRESETS: Record<string, FullSystemPreset> = {
  quick: {
    name: 'quick',
    mlThresholds: [0.05, 0.07],
    pyramiding: {
      profitThreshold: [0.01],
      scaleFactor: [0.8],
      maxEntries: [3, 5],
    },
    trailingStop: {
      breakevenProfitThreshold: [0.0075],
      minTrailingDistancePercent: [0.002],
    },
    walkForward: false,
    topResultsForValidation: 0,
  },
  balanced: {
    name: 'balanced',
    mlThresholds: [0.03, 0.05, 0.07, 0.10],
    pyramiding: {
      profitThreshold: [0.005, 0.01, 0.015],
      scaleFactor: [0.7, 0.8, 0.9],
      maxEntries: [3, 5],
    },
    trailingStop: {
      breakevenProfitThreshold: [0.005, 0.0075, 0.01],
      minTrailingDistancePercent: [0.001, 0.002],
    },
    walkForward: true,
    topResultsForValidation: 10,
  },
  thorough: {
    name: 'thorough',
    mlThresholds: [0.02, 0.03, 0.05, 0.07, 0.10, 0.15],
    pyramiding: {
      profitThreshold: [0.003, 0.005, 0.01, 0.015, 0.02],
      scaleFactor: [0.6, 0.7, 0.8, 0.9, 1.0],
      maxEntries: [2, 3, 4, 5],
    },
    trailingStop: {
      breakevenProfitThreshold: [0.005, 0.0075, 0.01, 0.012, 0.015],
      minTrailingDistancePercent: [0.001, 0.0015, 0.002, 0.003],
    },
    walkForward: true,
    topResultsForValidation: 20,
  },
};

export class FullSystemOptimizer {
  private engine: BacktestEngine;

  constructor() {
    this.engine = new BacktestEngine();
  }

  generateCombinations(preset: FullSystemPreset): FullSystemCombination[] {
    const combinations: FullSystemCombination[] = [];

    for (const mlThreshold of preset.mlThresholds) {
      for (const profitThreshold of preset.pyramiding.profitThreshold) {
        for (const scaleFactor of preset.pyramiding.scaleFactor) {
          for (const maxEntries of preset.pyramiding.maxEntries) {
            for (const breakevenProfitThreshold of preset.trailingStop.breakevenProfitThreshold) {
              for (const minTrailingDistancePercent of preset.trailingStop.minTrailingDistancePercent) {
                combinations.push({
                  mlThreshold,
                  pyramiding: { profitThreshold, scaleFactor, maxEntries },
                  trailingStop: { breakevenProfitThreshold, minTrailingDistancePercent },
                });
              }
            }
          }
        }
      }
    }

    return combinations;
  }

  async optimize(
    baseConfig: BacktestConfig,
    klines: Kline[],
    preset: FullSystemPreset,
    options: {
      parallelWorkers?: number;
      minTrades?: number;
      onProgress?: (current: number, total: number, currentBest?: OptimizationResultEntry) => void;
    } = {}
  ): Promise<FullOptimizationResult> {
    const { parallelWorkers = 1, minTrades = 10, onProgress } = options;

    const id = generateId();
    const startTime = new Date().toISOString();

    const combinations = this.generateCombinations(preset);
    const totalCombinations = combinations.length;

    console.log(`[FullSystemOptimizer] Generated ${totalCombinations} combinations`);
    console.log(`[FullSystemOptimizer] Using preset: ${preset.name}`);
    console.log(`[FullSystemOptimizer] Walk-forward validation: ${preset.walkForward ? 'enabled' : 'disabled'}`);

    const results: OptimizationResultEntry[] = [];
    let completed = 0;
    let currentBest: OptimizationResultEntry | undefined;

    const runBacktest = async (combination: FullSystemCombination): Promise<OptimizationResultEntry | null> => {
      try {
        const config = this.applySystemParams(baseConfig, combination);
        const result = await this.engine.run(config, klines);

        if (result.status === 'FAILED' || result.metrics.totalTrades < minTrades) {
          return null;
        }

        const entry: OptimizationResultEntry = {
          id: generateId(),
          params: {
            mlThreshold: combination.mlThreshold,
            pyramiding: combination.pyramiding,
            trailingStop: combination.trailingStop,
          },
          metrics: result.metrics,
        };

        return entry;
      } catch (error) {
        console.error('[FullSystemOptimizer] Error running backtest:', error);
        return null;
      }
    };

    if (parallelWorkers > 1) {
      const chunks = ParameterGenerator.chunk(combinations, parallelWorkers);

      for (const chunk of chunks) {
        const batchResults = await Promise.all(chunk.map(runBacktest));

        for (const result of batchResults) {
          completed++;
          if (result) {
            results.push(result);
            if (!currentBest || this.compareResults(result, currentBest) > 0) {
              currentBest = result;
            }
          }
          if (onProgress) {
            onProgress(completed, totalCombinations, currentBest);
          }
        }
      }
    } else {
      for (const combination of combinations) {
        const result = await runBacktest(combination);
        completed++;
        if (result) {
          results.push(result);
          if (!currentBest || this.compareResults(result, currentBest) > 0) {
            currentBest = result;
          }
        }
        if (onProgress) {
          onProgress(completed, totalCombinations, currentBest);
        }
      }
    }

    const sortedResults = this.sortResults(results);

    for (let i = 0; i < sortedResults.length; i++) {
      sortedResults[i]!.rank = i + 1;
    }

    let walkForwardResults: WFResult[] | undefined;

    if (preset.walkForward && preset.topResultsForValidation > 0) {
      const topResults = sortedResults.slice(0, preset.topResultsForValidation);
      walkForwardResults = await this.validateWithWalkForward(baseConfig, klines, topResults);

      for (let i = 0; i < topResults.length; i++) {
        const wfResult = walkForwardResults[i];
        if (wfResult) {
          topResults[i]!.walkForwardValidated = wfResult.isRobust;
          topResults[i]!.degradationPercent = wfResult.degradationPercent;
        }
      }
    }

    const endTime = new Date().toISOString();
    const duration = new Date(endTime).getTime() - new Date(startTime).getTime();

    const optimizationConfig: FullSystemOptimizationConfig = {
      symbol: baseConfig.symbol,
      interval: baseConfig.interval,
      startDate: baseConfig.startDate,
      endDate: baseConfig.endDate,
      initialCapital: baseConfig.initialCapital,
      mlThresholds: preset.mlThresholds,
      pyramidingConfigs: this.extractPyramidingConfigs(combinations),
      trailingStopConfigs: this.extractTrailingStopConfigs(combinations),
      walkForward: {
        trainingMonths: 6,
        testingMonths: 2,
        stepMonths: 2,
        minWindows: 3,
      },
      minTrades,
      maxDegradation: 0.3,
      topResultsForValidation: preset.topResultsForValidation,
    };

    return {
      id,
      config: optimizationConfig,
      totalCombinations,
      completedCombinations: completed,
      results: sortedResults,
      bestResult: sortedResults[0],
      walkForwardResults,
      status: 'COMPLETED',
      startTime,
      endTime,
      duration,
    };
  }

  private applySystemParams(
    baseConfig: BacktestConfig,
    combination: FullSystemCombination
  ): BacktestConfig {
    const pyramidingConfig = { ...DEFAULT_PYRAMIDING_CONFIG, ...combination.pyramiding };
    const trailingConfig = { ...DEFAULT_TRAILING_STOP_CONFIG, ...combination.trailingStop };

    return {
      ...baseConfig,
      minConfidence: combination.mlThreshold * 100,
      strategyParams: {
        ...baseConfig.strategyParams,
        pyramidProfitThreshold: pyramidingConfig.profitThreshold,
        pyramidScaleFactor: pyramidingConfig.scaleFactor,
        pyramidMaxEntries: pyramidingConfig.maxEntries,
        trailingBreakeven: trailingConfig.breakevenProfitThreshold,
        trailingMinDistance: trailingConfig.minTrailingDistancePercent,
      },
    };
  }

  private async validateWithWalkForward(
    baseConfig: BacktestConfig,
    klines: Kline[],
    topResults: OptimizationResultEntry[]
  ): Promise<WFResult[]> {
    const wfResults: WFResult[] = [];

    const wfConfig: WalkForwardConfig = {
      trainingWindowMonths: 6,
      testingWindowMonths: 2,
      stepMonths: 2,
      minWindowCount: 3,
    };

    for (const result of topResults) {
      try {
        const combination: FullSystemCombination = {
          mlThreshold: result.params.mlThreshold,
          pyramiding: result.params.pyramiding,
          trailingStop: result.params.trailingStop,
        };

        const config = this.applySystemParams(baseConfig, combination);

        const wfResult = await WalkForwardOptimizer.run(klines, config, [], wfConfig);

        wfResults.push({
          windowIndex: 0,
          trainingStart: baseConfig.startDate,
          trainingEnd: baseConfig.endDate,
          testingStart: baseConfig.startDate,
          testingEnd: baseConfig.endDate,
          inSampleMetrics: result.metrics,
          outOfSampleMetrics: wfResult.aggregatedMetrics as unknown as BacktestMetrics,
          degradationPercent: wfResult.aggregatedMetrics.degradation * 100,
          isRobust: wfResult.isRobust,
        });
      } catch (error) {
        console.error('[FullSystemOptimizer] Walk-forward validation error:', error);
        wfResults.push({
          windowIndex: 0,
          trainingStart: baseConfig.startDate,
          trainingEnd: baseConfig.endDate,
          testingStart: baseConfig.startDate,
          testingEnd: baseConfig.endDate,
          inSampleMetrics: result.metrics,
          outOfSampleMetrics: result.metrics,
          degradationPercent: 100,
          isRobust: false,
        });
      }
    }

    return wfResults;
  }

  private compareResults(a: OptimizationResultEntry, b: OptimizationResultEntry): number {
    const aScore = this.calculateScore(a.metrics);
    const bScore = this.calculateScore(b.metrics);
    return aScore - bScore;
  }

  private calculateScore(metrics: BacktestMetrics): number {
    const sharpeWeight = 0.35;
    const profitFactorWeight = 0.25;
    const drawdownWeight = 0.20;
    const winRateWeight = 0.20;

    const normalizedSharpe = Math.max(0, Math.min((metrics.sharpeRatio ?? 0) / 3, 1));
    const normalizedPF = Math.max(0, Math.min((metrics.profitFactor - 1) / 2, 1));
    const normalizedDD = Math.max(0, 1 - metrics.maxDrawdownPercent / 100);
    const normalizedWR = metrics.winRate / 100;

    return (
      normalizedSharpe * sharpeWeight +
      normalizedPF * profitFactorWeight +
      normalizedDD * drawdownWeight +
      normalizedWR * winRateWeight
    );
  }

  private sortResults(results: OptimizationResultEntry[]): OptimizationResultEntry[] {
    return [...results].sort((a, b) => this.compareResults(b, a));
  }

  private extractPyramidingConfigs(combinations: FullSystemCombination[]): Partial<PyramidingConfig>[] {
    const seen = new Set<string>();
    const configs: Partial<PyramidingConfig>[] = [];

    for (const c of combinations) {
      const key = JSON.stringify(c.pyramiding);
      if (!seen.has(key)) {
        seen.add(key);
        configs.push(c.pyramiding);
      }
    }

    return configs;
  }

  private extractTrailingStopConfigs(combinations: FullSystemCombination[]): Partial<TrailingStopOptimizationConfig>[] {
    const seen = new Set<string>();
    const configs: Partial<TrailingStopOptimizationConfig>[] = [];

    for (const c of combinations) {
      const key = JSON.stringify(c.trailingStop);
      if (!seen.has(key)) {
        seen.add(key);
        configs.push(c.trailingStop);
      }
    }

    return configs;
  }

  async calibrateThresholdsForTimeframe(
    baseConfig: BacktestConfig,
    klines: Kline[],
    interval: string,
    thresholdsToTest: number[] = [0.02, 0.03, 0.05, 0.07, 0.10, 0.15]
  ): Promise<{ minProbability: number; minConfidence: number }> {
    let bestThreshold = 0.05;
    let bestScore = -Infinity;

    for (const threshold of thresholdsToTest) {
      const config: BacktestConfig = {
        ...baseConfig,
        minConfidence: threshold * 100,
      };

      try {
        const result = await this.engine.run(config, klines);

        if (result.status === 'COMPLETED' && result.metrics.totalTrades >= 10) {
          const score = this.calculateScore(result.metrics);

          if (score > bestScore) {
            bestScore = score;
            bestThreshold = threshold;
          }
        }
      } catch {
        continue;
      }
    }

    console.log(`[FullSystemOptimizer] Calibrated threshold for ${interval}: ${bestThreshold}`);

    return {
      minProbability: bestThreshold,
      minConfidence: bestThreshold * 100,
    };
  }

  getPreset(name: string): FullSystemPreset | undefined {
    return OPTIMIZATION_PRESETS[name];
  }

  listPresets(): string[] {
    return Object.keys(OPTIMIZATION_PRESETS);
  }

  countCombinations(preset: FullSystemPreset): number {
    return (
      preset.mlThresholds.length *
      preset.pyramiding.profitThreshold.length *
      preset.pyramiding.scaleFactor.length *
      preset.pyramiding.maxEntries.length *
      preset.trailingStop.breakevenProfitThreshold.length *
      preset.trailingStop.minTrailingDistancePercent.length
    );
  }
}

export const fullSystemOptimizer = new FullSystemOptimizer();
