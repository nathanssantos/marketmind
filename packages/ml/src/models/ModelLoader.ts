import { InferenceEngine } from '../inference/InferenceEngine';
import type { ModelRegistry, RegisteredModel } from './ModelRegistry';
import type { MLModelType } from '../types';

export interface ModelLoaderConfig {
  autoWarmup?: boolean;
  cacheEngines?: boolean;
  maxCachedEngines?: number;
}

export class ModelLoader {
  private registry: ModelRegistry;
  private config: ModelLoaderConfig;
  private engineCache: Map<string, InferenceEngine> = new Map();
  private activeEngine: InferenceEngine | null = null;
  private activeModelId: string | null = null;

  constructor(registry: ModelRegistry, config: ModelLoaderConfig = {}) {
    this.registry = registry;
    this.config = {
      autoWarmup: config.autoWarmup ?? true,
      cacheEngines: config.cacheEngines ?? true,
      maxCachedEngines: config.maxCachedEngines ?? 3,
    };
  }

  async loadModel(modelId: string): Promise<InferenceEngine> {
    if (this.config.cacheEngines && this.engineCache.has(modelId)) {
      const engine = this.engineCache.get(modelId)!;
      this.activeEngine = engine;
      this.activeModelId = modelId;
      return engine;
    }

    const model = await this.registry.getModel(modelId);
    const engine = await this.createEngine(model);

    if (this.config.cacheEngines) {
      this.addToCache(modelId, engine);
    }

    this.activeEngine = engine;
    this.activeModelId = modelId;

    return engine;
  }

  async loadLatestModel(type: MLModelType): Promise<InferenceEngine> {
    const model = await this.registry.getLatestModel(type);
    return this.loadModel(model.id);
  }

  async switchModel(modelId: string): Promise<InferenceEngine> {
    if (this.activeModelId === modelId && this.activeEngine) {
      return this.activeEngine;
    }

    return this.loadModel(modelId);
  }

  getActiveEngine(): InferenceEngine | null {
    return this.activeEngine;
  }

  getActiveModelId(): string | null {
    return this.activeModelId;
  }

  isModelLoaded(modelId: string): boolean {
    return this.engineCache.has(modelId);
  }

  async unloadModel(modelId: string): Promise<void> {
    const engine = this.engineCache.get(modelId);
    if (engine) {
      await engine.dispose();
      this.engineCache.delete(modelId);

      if (this.activeModelId === modelId) {
        this.activeEngine = null;
        this.activeModelId = null;
      }
    }
  }

  async unloadAll(): Promise<void> {
    for (const [modelId, engine] of this.engineCache.entries()) {
      await engine.dispose();
      this.engineCache.delete(modelId);
    }
    this.activeEngine = null;
    this.activeModelId = null;
  }

  private async createEngine(model: RegisteredModel): Promise<InferenceEngine> {
    const engine = new InferenceEngine(model.filePath, {
      warmupIterations: this.config.autoWarmup ? 3 : 0,
    });

    await engine.initialize();
    return engine;
  }

  private addToCache(modelId: string, engine: InferenceEngine): void {
    if (this.engineCache.size >= this.config.maxCachedEngines!) {
      const oldestKey = this.engineCache.keys().next().value;
      if (oldestKey) {
        const oldEngine = this.engineCache.get(oldestKey);
        oldEngine?.dispose();
        this.engineCache.delete(oldestKey);
      }
    }
    this.engineCache.set(modelId, engine);
  }

  getCacheStats(): {
    cachedModels: string[];
    cacheSize: number;
    maxCacheSize: number;
  } {
    return {
      cachedModels: Array.from(this.engineCache.keys()),
      cacheSize: this.engineCache.size,
      maxCacheSize: this.config.maxCachedEngines!,
    };
  }
}
