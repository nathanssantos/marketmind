import type { ModelInfo as _ModelInfo, MLModelType, MLModelStatus } from '../types';

export type { _ModelInfo };

export interface RegisteredModel {
  id: string;
  name: string;
  version: string;
  type: MLModelType;
  status: MLModelStatus;
  filePath: string;
  fileSize?: number;
  checksum?: string;
  trainedAt?: Date;
  trainingDataStart?: Date;
  trainingDataEnd?: Date;
  samplesCount?: number;
  metrics?: Record<string, number>;
  featureConfig?: {
    featureNames: string[];
    normalizationParams?: Record<string, unknown>;
  };
  intervals?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ModelRegistryConfig {
  modelsDir: string;
  manifestPath?: string;
}

export interface ModelManifest {
  models: Array<{
    id: string;
    name: string;
    version: string;
    type: string;
    file: string;
    model_type?: string;
    feature_count?: number;
    trained_at?: string;
    metrics?: Record<string, number>;
    intervals?: string[];
  }>;
  default_model?: string;
  fallback_model?: string;
}

export class ModelRegistry {
  private models: Map<string, RegisteredModel> = new Map();
  private config: ModelRegistryConfig;
  private manifest: ModelManifest | null = null;
  private defaultModelId: string | null = null;
  private fallbackModelId: string | null = null;

  constructor(config: ModelRegistryConfig) {
    this.config = {
      modelsDir: config.modelsDir,
      manifestPath: config.manifestPath ?? `${config.modelsDir}/manifest.json`,
    };
  }

  async initialize(): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const manifestContent = await fs.readFile(this.config.manifestPath!, 'utf-8');
      this.manifest = JSON.parse(manifestContent);

      this.defaultModelId = this.manifest?.default_model ?? null;
      this.fallbackModelId = this.manifest?.fallback_model ?? null;

      for (const model of this.manifest!.models) {
        const registered: RegisteredModel = {
          id: model.id,
          name: model.name,
          version: model.version,
          type: model.type as MLModelType,
          status: 'active',
          filePath: `${this.config.modelsDir}/${model.file}`,
          trainedAt: model.trained_at ? new Date(model.trained_at) : undefined,
          metrics: model.metrics,
          featureConfig: model.feature_count
            ? { featureNames: Array(model.feature_count).fill('') }
            : undefined,
          intervals: model.intervals,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        this.models.set(model.id, registered);
      }
    } catch {
      this.manifest = { models: [] };
    }
  }

  async getModel(modelId: string): Promise<RegisteredModel> {
    const model = this.models.get(modelId);
    if (!model) {
      throw new Error(`Model not found: ${modelId}`);
    }
    return model;
  }

  async getLatestModel(type: MLModelType): Promise<RegisteredModel> {
    const modelsOfType = Array.from(this.models.values())
      .filter((m) => m.type === type && m.status === 'active')
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    if (modelsOfType.length === 0) {
      throw new Error(`No active models found for type: ${type}`);
    }

    return modelsOfType[0]!;
  }

  async getModelForInterval(type: MLModelType, interval: string): Promise<RegisteredModel> {
    const modelsOfType = Array.from(this.models.values())
      .filter((m) => m.type === type && m.status === 'active');

    const matchingModel = modelsOfType.find(m =>
      m.intervals?.includes(interval) || m.intervals?.includes('*')
    );

    if (matchingModel) return matchingModel;

    if (this.fallbackModelId) {
      const fallback = this.models.get(this.fallbackModelId);
      if (fallback && fallback.status === 'active') return fallback;
    }

    if (this.defaultModelId) {
      const defaultModel = this.models.get(this.defaultModelId);
      if (defaultModel && defaultModel.status === 'active') return defaultModel;
    }

    return this.getLatestModel(type);
  }

  getDefaultModelId(): string | null {
    return this.defaultModelId;
  }

  getFallbackModelId(): string | null {
    return this.fallbackModelId;
  }

  async listModels(type?: MLModelType): Promise<RegisteredModel[]> {
    const models = Array.from(this.models.values());
    if (type) {
      return models.filter((m) => m.type === type);
    }
    return models;
  }

  async listActiveModels(): Promise<RegisteredModel[]> {
    return Array.from(this.models.values()).filter((m) => m.status === 'active');
  }

  async registerModel(model: Omit<RegisteredModel, 'createdAt' | 'updatedAt'>): Promise<RegisteredModel> {
    const registered: RegisteredModel = {
      ...model,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.models.set(model.id, registered);
    await this.saveManifest();

    return registered;
  }

  async updateModelStatus(modelId: string, status: MLModelStatus): Promise<RegisteredModel> {
    const model = await this.getModel(modelId);
    model.status = status;
    model.updatedAt = new Date();

    this.models.set(modelId, model);
    await this.saveManifest();

    return model;
  }

  async archiveModel(modelId: string): Promise<void> {
    await this.updateModelStatus(modelId, 'archived');
  }

  async deleteModel(modelId: string): Promise<void> {
    const model = await this.getModel(modelId);

    try {
      const fs = await import('fs/promises');
      await fs.unlink(model.filePath);
    } catch {
      // File may not exist
    }

    this.models.delete(modelId);
    await this.saveManifest();
  }

  private async saveManifest(): Promise<void> {
    const manifest: ModelManifest = {
      models: Array.from(this.models.values()).map((m) => ({
        id: m.id,
        name: m.name,
        version: m.version,
        type: m.type,
        file: m.filePath.split('/').pop()!,
        feature_count: m.featureConfig?.featureNames.length,
        trained_at: m.trainedAt?.toISOString(),
        metrics: m.metrics,
      })),
    };

    try {
      const fs = await import('fs/promises');
      await fs.writeFile(this.config.manifestPath!, JSON.stringify(manifest, null, 2));
    } catch {
      // Ignore write errors in read-only environments
    }
  }

  getModelCount(): number {
    return this.models.size;
  }

  hasModel(modelId: string): boolean {
    return this.models.has(modelId);
  }
}
