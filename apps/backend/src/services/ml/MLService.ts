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

class MLServiceImpl {
  private config: MLServiceConfig;
  private registry: ModelRegistry | null = null;
  private loader: ModelLoader | null = null;
  private featureExtractor: FeatureExtractor | null = null;
  private realtimePredictor: RealtimePredictor | null = null;
  private isInitialized = false;
  private activeModelId: string | null = null;

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

    const prediction = await this.realtimePredictor!.predictSetup(klines, setup, marketContext);

    await this.logPrediction(setup, prediction, symbol, interval);

    return {
      ...prediction,
      setupId: setup.id,
    };
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
            featureCount: activeEngine.getFeatureCount(),
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
