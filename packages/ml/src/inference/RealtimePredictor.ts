import type { Kline, TradingSetup } from '@marketmind/types';
import type { FeatureExtractor } from '../features/FeatureExtractor';
import type { MarketContext, NormalizedFeatureVector, PredictionResult } from '../types';
import type { InferenceEngine } from './InferenceEngine';

export interface RealtimePredictorConfig {
  cacheFeatures?: boolean;
  cacheTTLMs?: number;
}

export interface EnhancedSetup extends TradingSetup {
  mlPrediction?: PredictionResult;
  mlConfidence?: number;
  originalConfidence: number;
  blendedConfidence: number;
}

interface CachedFeatures {
  features: NormalizedFeatureVector;
  timestamp: number;
}

export class RealtimePredictor {
  private inferenceEngine: InferenceEngine;
  private featureExtractor: FeatureExtractor;
  private config: RealtimePredictorConfig;
  private featureCache: Map<string, CachedFeatures> = new Map();

  constructor(
    inferenceEngine: InferenceEngine,
    featureExtractor: FeatureExtractor,
    config: RealtimePredictorConfig = {}
  ) {
    this.inferenceEngine = inferenceEngine;
    this.featureExtractor = featureExtractor;
    this.config = {
      cacheFeatures: config.cacheFeatures ?? true,
      cacheTTLMs: config.cacheTTLMs ?? 60000,
    };
  }

  async predictSetup(
    klines: Kline[],
    setup: TradingSetup,
    marketContext?: MarketContext
  ): Promise<PredictionResult> {
    const features = this.extractOrGetCached(klines, setup, marketContext);
    return this.inferenceEngine.predict(features.features);
  }

  async enhanceSetup(
    klines: Kline[],
    setup: TradingSetup,
    marketContext?: MarketContext,
    blendWeight: number = 0.4
  ): Promise<EnhancedSetup> {
    const prediction = await this.predictSetup(klines, setup, marketContext);

    const originalConfidence = setup.confidence;
    const mlConfidence = prediction.confidence;
    const blendedConfidence = Math.round(
      originalConfidence * (1 - blendWeight) + mlConfidence * blendWeight
    );

    return {
      ...setup,
      mlPrediction: prediction,
      mlConfidence,
      originalConfidence,
      blendedConfidence,
      confidence: blendedConfidence,
    };
  }

  async enhanceSetups(
    klines: Kline[],
    setups: TradingSetup[],
    marketContexts?: Map<number, MarketContext>,
    blendWeight: number = 0.4
  ): Promise<EnhancedSetup[]> {
    this.featureExtractor.precompute(klines);

    const enhanced: EnhancedSetup[] = [];

    for (const setup of setups) {
      const marketContext = marketContexts?.get(setup.openTime);
      const result = await this.enhanceSetup(klines, setup, marketContext, blendWeight);
      enhanced.push(result);
    }

    return enhanced;
  }

  async filterByMLConfidence(
    klines: Kline[],
    setups: TradingSetup[],
    minProbability: number = 0.5,
    marketContexts?: Map<number, MarketContext>
  ): Promise<TradingSetup[]> {
    this.featureExtractor.precompute(klines);

    const filtered: TradingSetup[] = [];

    for (const setup of setups) {
      const marketContext = marketContexts?.get(setup.openTime);
      const prediction = await this.predictSetup(klines, setup, marketContext);

      if (prediction.probability >= minProbability) {
        filtered.push(setup);
      }
    }

    return filtered;
  }

  async rankSetups(
    klines: Kline[],
    setups: TradingSetup[],
    marketContexts?: Map<number, MarketContext>
  ): Promise<Array<{ setup: TradingSetup; prediction: PredictionResult }>> {
    this.featureExtractor.precompute(klines);

    const results: Array<{ setup: TradingSetup; prediction: PredictionResult }> = [];

    for (const setup of setups) {
      const marketContext = marketContexts?.get(setup.openTime);
      const prediction = await this.predictSetup(klines, setup, marketContext);
      results.push({ setup, prediction });
    }

    return results.sort((a, b) => b.prediction.probability - a.prediction.probability);
  }

  private extractOrGetCached(
    klines: Kline[],
    setup: TradingSetup,
    marketContext?: MarketContext
  ): NormalizedFeatureVector {
    if (!this.config.cacheFeatures) {
      return this.featureExtractor.extractForSetup(klines, setup, marketContext);
    }

    const cacheKey = `${setup.id}:${setup.openTime}`;
    const cached = this.featureCache.get(cacheKey);
    const now = Date.now();

    if (cached && now - cached.timestamp < this.config.cacheTTLMs!) {
      return cached.features;
    }

    const features = this.featureExtractor.extractForSetup(klines, setup, marketContext);

    this.featureCache.set(cacheKey, {
      features,
      timestamp: now,
    });

    this.cleanupCache();

    return features;
  }

  private cleanupCache(): void {
    const now = Date.now();
    const ttl = this.config.cacheTTLMs!;

    for (const [key, value] of this.featureCache.entries()) {
      if (now - value.timestamp > ttl) {
        this.featureCache.delete(key);
      }
    }
  }

  clearCache(): void {
    this.featureCache.clear();
  }

  getCacheSize(): number {
    return this.featureCache.size;
  }
}
