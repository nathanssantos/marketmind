import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { mlPredictions } from '../../db/schema';
import type { Kline, TradingSetup } from '@marketmind/types';
import {
  FeatureExtractor,
  ModelRegistry,
  ModelLoader,
  RealtimePredictor,
  type PredictionResult,
  type MarketContext,
  type EnhancedSetup,
  type ModelRegistryConfig,
} from '@marketmind/ml';
import { generateId } from '../../utils/id';

export interface MLServiceConfig {
  modelsDir: string;
  autoInitialize?: boolean;
  defaultModelType?: 'setup-classifier' | 'confidence-enhancer';
  blendWeight?: number;
}

const DEFAULT_CONFIG: MLServiceConfig = {
  modelsDir: './models',
  autoInitialize: false,
  defaultModelType: 'setup-classifier',
  blendWeight: 0.4,
};

interface MLStats {
  predictions: number;
  accepted: number;
  rejected: number;
  avgProbability: number;
  avgLatencyMs: number;
}

class MLServiceImpl {
  private config: MLServiceConfig;
  private registry: ModelRegistry | null = null;
  private loader: ModelLoader | null = null;
  private featureExtractor: FeatureExtractor | null = null;
  private realtimePredictor: RealtimePredictor | null = null;
  private isInitialized = false;
  private activeModelId: string | null = null;
  private predictorCache: Map<string, RealtimePredictor> = new Map();
  private modelIdByInterval: Map<string, string> = new Map();
  private statsByInterval: Map<string, MLStats> = new Map();

  constructor(config: Partial<MLServiceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async initialize(modelType?: 'setup-classifier' | 'confidence-enhancer'): Promise<{
    success: boolean;
    modelVersion?: string;
    modelType: string;
    featureCount: number;
  }> {
    const type = modelType ?? this.config.defaultModelType ?? 'setup-classifier';

    const registryConfig: ModelRegistryConfig = {
      modelsDir: this.config.modelsDir,
    };

    this.registry = new ModelRegistry(registryConfig);
    await this.registry.initialize();

    this.loader = new ModelLoader(this.registry, {
      autoWarmup: true,
      cacheEngines: true,
    });

    const engine = await this.loader.loadLatestModel(type);
    this.featureExtractor = new FeatureExtractor();

    this.realtimePredictor = new RealtimePredictor(engine, this.featureExtractor, {
      cacheFeatures: true,
      cacheTTLMs: 60000,
    });

    this.isInitialized = true;
    this.activeModelId = this.loader.getActiveModelId();

    const modelInfo = engine.getModelInfo();

    return {
      success: true,
      modelVersion: modelInfo.version,
      modelType: type,
      featureCount: modelInfo.featureCount,
    };
  }

  async predictSetup(
    klines: Kline[],
    setup: TradingSetup,
    marketContext?: MarketContext,
    symbol?: string,
    interval?: string
  ): Promise<PredictionResult & { setupId: string }> {
    this.ensureInitialized();

    const predictor = await this.getPredictorForInterval(interval ?? '1h');
    const prediction = await predictor.predictSetup(klines, setup, marketContext);

    await this.logPrediction(setup, prediction, symbol, interval);

    return {
      ...prediction,
      setupId: setup.id,
    };
  }

  private async getPredictorForInterval(interval: string): Promise<RealtimePredictor> {
    if (this.predictorCache.has(interval)) {
      return this.predictorCache.get(interval)!;
    }

    const engine = await this.loader!.loadModelForInterval('setup-classifier', interval);
    const modelId = this.loader!.getActiveModelId();
    const modelInfo = engine.getModelInfo();

    console.log(`[ML] 📊 Loading model for interval ${interval}:`, {
      modelId,
      version: modelInfo.version,
      featureCount: modelInfo.featureCount,
    });

    this.modelIdByInterval.set(interval, modelId ?? 'unknown');

    if (!this.statsByInterval.has(interval)) {
      this.statsByInterval.set(interval, {
        predictions: 0,
        accepted: 0,
        rejected: 0,
        avgProbability: 0,
        avgLatencyMs: 0,
      });
    }

    const predictor = new RealtimePredictor(engine, this.featureExtractor!, {
      cacheFeatures: true,
      cacheTTLMs: 60000,
    });

    this.predictorCache.set(interval, predictor);
    return predictor;
  }

  recordPredictionOutcome(interval: string, probability: number, accepted: boolean, latencyMs: number): void {
    const stats = this.statsByInterval.get(interval);
    if (!stats) return;

    stats.predictions++;
    if (accepted) stats.accepted++;
    else stats.rejected++;

    stats.avgProbability = (stats.avgProbability * (stats.predictions - 1) + probability) / stats.predictions;
    stats.avgLatencyMs = (stats.avgLatencyMs * (stats.predictions - 1) + latencyMs) / stats.predictions;
  }

  getMLStats(): Record<string, MLStats & { modelId: string; acceptanceRate: number }> {
    const result: Record<string, MLStats & { modelId: string; acceptanceRate: number }> = {};

    for (const [interval, stats] of this.statsByInterval) {
      result[interval] = {
        ...stats,
        modelId: this.modelIdByInterval.get(interval) ?? 'unknown',
        acceptanceRate: stats.predictions > 0 ? (stats.accepted / stats.predictions) * 100 : 0,
      };
    }

    return result;
  }

  logMLStatsReport(): void {
    const stats = this.getMLStats();
    const intervals = Object.keys(stats);

    if (intervals.length === 0) {
      console.log('[ML] 📊 No ML predictions recorded yet');
      return;
    }

    console.log('\n[ML] ═══════════════════════════════════════════════════════════════');
    console.log('[ML] 📊 ML IMPACT REPORT');
    console.log('[ML] ═══════════════════════════════════════════════════════════════');

    let totalPredictions = 0;
    let totalAccepted = 0;

    for (const interval of intervals) {
      const s = stats[interval]!;
      totalPredictions += s.predictions;
      totalAccepted += s.accepted;

      console.log(`[ML] ${interval.padEnd(4)} | Model: ${s.modelId}`);
      console.log(`[ML]      | Predictions: ${s.predictions} | Accepted: ${s.accepted} | Rejected: ${s.rejected}`);
      console.log(`[ML]      | Acceptance Rate: ${s.acceptanceRate.toFixed(1)}% | Avg Prob: ${(s.avgProbability * 100).toFixed(1)}% | Avg Latency: ${s.avgLatencyMs.toFixed(0)}ms`);
    }

    const overallRate = totalPredictions > 0 ? (totalAccepted / totalPredictions) * 100 : 0;
    console.log('[ML] ───────────────────────────────────────────────────────────────');
    console.log(`[ML] TOTAL: ${totalPredictions} predictions | ${totalAccepted} accepted | ${overallRate.toFixed(1)}% acceptance rate`);
    console.log('[ML] ═══════════════════════════════════════════════════════════════\n');
  }

  async enhanceSetup(
    klines: Kline[],
    setup: TradingSetup,
    marketContext?: MarketContext,
    blendWeight?: number
  ): Promise<EnhancedSetup> {
    this.ensureInitialized();

    const weight = blendWeight ?? this.config.blendWeight ?? 0.4;
    const enhanced = await this.realtimePredictor!.enhanceSetup(klines, setup, marketContext, weight);

    if (enhanced.mlPrediction) {
      await this.logPrediction(setup, enhanced.mlPrediction);
    }

    return enhanced;
  }

  async enhanceSetups(
    klines: Kline[],
    setups: TradingSetup[],
    marketContexts?: Map<number, MarketContext>,
    blendWeight?: number
  ): Promise<EnhancedSetup[]> {
    this.ensureInitialized();

    const weight = blendWeight ?? this.config.blendWeight ?? 0.4;
    const enhanced = await this.realtimePredictor!.enhanceSetups(klines, setups, marketContexts, weight);

    for (const setup of enhanced) {
      if (setup.mlPrediction) {
        await this.logPrediction(setup, setup.mlPrediction);
      }
    }

    return enhanced;
  }

  async filterByMLConfidence(
    klines: Kline[],
    setups: TradingSetup[],
    minProbability: number = 0.5,
    marketContexts?: Map<number, MarketContext>
  ): Promise<TradingSetup[]> {
    this.ensureInitialized();

    return this.realtimePredictor!.filterByMLConfidence(klines, setups, minProbability, marketContexts);
  }

  async rankSetups(
    klines: Kline[],
    setups: TradingSetup[],
    marketContexts?: Map<number, MarketContext>
  ): Promise<Array<{ setup: TradingSetup; prediction: PredictionResult }>> {
    this.ensureInitialized();

    return this.realtimePredictor!.rankSetups(klines, setups, marketContexts);
  }

  async switchModel(modelId: string): Promise<{ success: boolean; modelVersion?: string }> {
    this.ensureInitialized();

    const engine = await this.loader!.switchModel(modelId);
    this.activeModelId = modelId;

    this.realtimePredictor = new RealtimePredictor(engine, this.featureExtractor!, {
      cacheFeatures: true,
      cacheTTLMs: 60000,
    });

    const modelInfo = engine.getModelInfo();

    return {
      success: true,
      modelVersion: modelInfo.version,
    };
  }

  async getModelInfo(): Promise<{
    activeModel: {
      id: string | null;
      version?: string;
      featureCount: number;
      isReady: boolean;
    } | null;
    isInitialized: boolean;
    availableModels: Array<{
      id: string;
      name: string;
      version: string;
      type: string;
      status: string;
    }>;
  }> {
    if (!this.isInitialized || !this.registry || !this.loader) {
      return {
        activeModel: null,
        isInitialized: false,
        availableModels: [],
      };
    }

    const activeEngine = this.loader.getActiveEngine();
    const models = await this.registry.listModels();

    return {
      activeModel: activeEngine
        ? {
            id: this.activeModelId,
            version: activeEngine.getModelInfo().version,
            featureCount: activeEngine.getFeatureCount?.() ?? activeEngine.getModelInfo().featureCount,
            isReady: activeEngine.isReady(),
          }
        : null,
      isInitialized: this.isInitialized,
      availableModels: models.map((m) => ({
        id: m.id,
        name: m.name,
        version: m.version,
        type: m.type,
        status: m.status,
      })),
    };
  }

  async listModels(): Promise<
    Array<{
      id: string;
      name: string;
      version: string;
      type: string;
      status: string;
      trainedAt?: Date;
      metrics?: Record<string, number>;
    }>
  > {
    if (!this.registry) {
      return [];
    }

    const models = await this.registry.listModels();
    return models.map((m) => ({
      id: m.id,
      name: m.name,
      version: m.version,
      type: m.type,
      status: m.status,
      trainedAt: m.trainedAt,
      metrics: m.metrics,
    }));
  }

  async recordOutcome(predictionId: string, actualLabel: number): Promise<void> {
    await db
      .update(mlPredictions)
      .set({
        actualLabel,
        outcomeRecordedAt: new Date(),
      })
      .where(eq(mlPredictions.id, predictionId));
  }

  getFeatureNames(): string[] {
    this.ensureInitialized();
    return this.featureExtractor!.getFeatureNames();
  }

  getFeatureCount(): number {
    this.ensureInitialized();
    return this.featureExtractor!.getFeatureCount();
  }

  clearCache(): void {
    this.realtimePredictor?.clearCache();
  }

  getCacheSize(): number {
    return this.realtimePredictor?.getCacheSize() ?? 0;
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  async dispose(): Promise<void> {
    if (this.loader) {
      await this.loader.unloadAll();
    }
    this.isInitialized = false;
    this.activeModelId = null;
    this.realtimePredictor = null;
    this.featureExtractor = null;
    this.loader = null;
    this.registry = null;
    this.predictorCache.clear();
    this.modelIdByInterval.clear();
    this.statsByInterval.clear();
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('ML Service not initialized. Call initialize() first.');
    }
  }

  private async logPrediction(
    setup: TradingSetup,
    prediction: PredictionResult,
    symbol?: string,
    interval?: string
  ): Promise<void> {
    try {
      await db.insert(mlPredictions).values({
        id: generateId(21),
        modelId: this.activeModelId ?? 'unknown',
        setupDetectionId: setup.id,
        probability: prediction.probability.toString(),
        confidence: prediction.confidence,
        predictedLabel: prediction.label,
        inferenceLatencyMs: prediction.latencyMs.toString(),
        symbol: symbol ?? 'UNKNOWN',
        interval: interval ?? '1h',
      });
    } catch (error) {
      console.error('Failed to log ML prediction:', error);
    }
  }
}

export const mlService = new MLServiceImpl();
export { MLServiceImpl };
