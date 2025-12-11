import type { Kline, TradingSetup } from '@marketmind/types';
import type { FeatureExtractor } from '../features/FeatureExtractor';
import type { MarketContext, NormalizedFeatureVector, PredictionResult } from '../types';
import type { InferenceEngine } from './InferenceEngine';

export interface BatchPredictorConfig {
  maxBatchSize?: number;
  enableParallelExtraction?: boolean;
}

export interface BatchPredictionInput {
  setup: TradingSetup;
  marketContext?: MarketContext;
}

export interface BatchPredictionResult {
  setupId: string;
  prediction: PredictionResult;
  features: NormalizedFeatureVector;
}

export class BatchPredictor {
  private inferenceEngine: InferenceEngine;
  private featureExtractor: FeatureExtractor;
  private config: BatchPredictorConfig;

  constructor(
    inferenceEngine: InferenceEngine,
    featureExtractor: FeatureExtractor,
    config: BatchPredictorConfig = {}
  ) {
    this.inferenceEngine = inferenceEngine;
    this.featureExtractor = featureExtractor;
    this.config = {
      maxBatchSize: config.maxBatchSize ?? 100,
      enableParallelExtraction: config.enableParallelExtraction ?? true,
    };
  }

  async predictBatch(
    klines: Kline[],
    inputs: BatchPredictionInput[]
  ): Promise<BatchPredictionResult[]> {
    if (inputs.length === 0) {
      return [];
    }

    this.featureExtractor.precompute(klines);

    const features: NormalizedFeatureVector[] = [];
    const setupIds: string[] = [];

    for (const input of inputs) {
      const extracted = this.featureExtractor.extractForSetup(
        klines,
        input.setup,
        input.marketContext
      );
      features.push(extracted);
      setupIds.push(input.setup.id);
    }

    const results: BatchPredictionResult[] = [];

    for (let i = 0; i < features.length; i += this.config.maxBatchSize!) {
      const batchFeatures = features.slice(i, i + this.config.maxBatchSize!);
      const batchSetupIds = setupIds.slice(i, i + this.config.maxBatchSize!);

      const predictions = await this.inferenceEngine.predictBatch(
        batchFeatures.map((f) => f.features)
      );

      for (let j = 0; j < predictions.length; j++) {
        results.push({
          setupId: batchSetupIds[j]!,
          prediction: predictions[j]!,
          features: batchFeatures[j]!,
        });
      }
    }

    return results;
  }

  async predictWithThreshold(
    klines: Kline[],
    inputs: BatchPredictionInput[],
    minProbability: number = 0.5
  ): Promise<BatchPredictionResult[]> {
    const allResults = await this.predictBatch(klines, inputs);
    return allResults.filter((r) => r.prediction.probability >= minProbability);
  }

  async predictTopN(
    klines: Kline[],
    inputs: BatchPredictionInput[],
    n: number
  ): Promise<BatchPredictionResult[]> {
    const allResults = await this.predictBatch(klines, inputs);
    return allResults
      .sort((a, b) => b.prediction.probability - a.prediction.probability)
      .slice(0, n);
  }

  getStats(results: BatchPredictionResult[]): {
    totalPredictions: number;
    avgProbability: number;
    avgLatencyMs: number;
    positiveCount: number;
    negativeCount: number;
  } {
    if (results.length === 0) {
      return {
        totalPredictions: 0,
        avgProbability: 0,
        avgLatencyMs: 0,
        positiveCount: 0,
        negativeCount: 0,
      };
    }

    const totalProbability = results.reduce((sum, r) => sum + r.prediction.probability, 0);
    const totalLatency = results.reduce((sum, r) => sum + r.prediction.latencyMs, 0);
    const positiveCount = results.filter((r) => r.prediction.label === 1).length;

    return {
      totalPredictions: results.length,
      avgProbability: totalProbability / results.length,
      avgLatencyMs: totalLatency / results.length,
      positiveCount,
      negativeCount: results.length - positiveCount,
    };
  }
}
