import type { ModelInfo, PredictionResult } from '../types';

/* eslint-disable @typescript-eslint/no-explicit-any */
type OrtModule = any;
type OrtSession = any;

export interface InferenceEngineConfig {
  warmupIterations?: number;
  enableMemoryOptimization?: boolean;
}

export class InferenceEngine {
  private session: OrtSession | null = null;
  private modelPath: string;
  private featureNames: string[] = [];
  private warmupCompleted: boolean = false;
  private modelVersion?: string;
  private trainedAt?: string;
  private config: InferenceEngineConfig;
  private ort: OrtModule | null = null;

  constructor(modelPath: string, config: InferenceEngineConfig = {}) {
    this.modelPath = modelPath;
    this.config = {
      warmupIterations: config.warmupIterations ?? 3,
      enableMemoryOptimization: config.enableMemoryOptimization ?? true,
    };
  }

  async initialize(): Promise<void> {
    this.ort = await import('onnxruntime-node');

    const sessionOptions: Record<string, unknown> = {
      executionProviders: ['cpu'],
      graphOptimizationLevel: 'all',
    };

    if (this.config.enableMemoryOptimization) {
      sessionOptions['enableCpuMemArena'] = true;
      sessionOptions['enableMemPattern'] = true;
    }

    this.session = await this.ort.InferenceSession.create(this.modelPath, sessionOptions);

    const metadata = this.session?.modelMetadata as { customMetadataMap?: Record<string, string> } | undefined;
    if (metadata?.customMetadataMap) {
      if (metadata.customMetadataMap.feature_names) {
        this.featureNames = JSON.parse(metadata.customMetadataMap.feature_names);
      }
      this.modelVersion = metadata.customMetadataMap.model_version;
      this.trainedAt = metadata.customMetadataMap.trained_at;
    }

    await this.warmup();
  }

  private async warmup(): Promise<void> {
    if (!this.session || this.warmupCompleted || !this.ort) return;

    const dummyInput = new Float32Array(this.featureNames.length).fill(0);
    for (let i = 0; i < (this.config.warmupIterations ?? 3); i++) {
      await this.predict(dummyInput);
    }
    this.warmupCompleted = true;
  }

  async predict(features: Float32Array): Promise<PredictionResult> {
    if (!this.session || !this.ort) {
      throw new Error('Model not initialized. Call initialize() first.');
    }

    const startTime = performance.now();

    const inputTensor = new this.ort.Tensor('float32', features, [1, features.length]);

    const results = await (this.session as { run: (inputs: Record<string, unknown>) => Promise<Record<string, { data: Float32Array }>> }).run({
      input: inputTensor,
    });

    const endTime = performance.now();

    const probabilities = results['probabilities']?.data as Float32Array | undefined;
    const probability = probabilities ? probabilities[1] ?? 0.5 : 0.5;

    return {
      probability,
      confidence: Math.round(probability * 100),
      label: probability >= 0.5 ? 1 : 0,
      latencyMs: endTime - startTime,
    };
  }

  async predictBatch(featuresBatch: Float32Array[]): Promise<PredictionResult[]> {
    if (!this.session || !this.ort) {
      throw new Error('Model not initialized');
    }

    const batchSize = featuresBatch.length;
    const featureCount = this.featureNames.length;

    const flatFeatures = new Float32Array(batchSize * featureCount);
    for (let i = 0; i < batchSize; i++) {
      flatFeatures.set(featuresBatch[i]!, i * featureCount);
    }

    const startTime = performance.now();

    const inputTensor = new this.ort.Tensor('float32', flatFeatures, [batchSize, featureCount]);
    const results = await (this.session as { run: (inputs: Record<string, unknown>) => Promise<Record<string, { data: Float32Array }>> }).run({
      input: inputTensor,
    });

    const endTime = performance.now();
    const latencyMs = (endTime - startTime) / batchSize;

    const probabilities = results['probabilities']?.data as Float32Array | undefined;

    return Array.from({ length: batchSize }, (_, i) => {
      const probability = probabilities ? probabilities[i * 2 + 1] ?? 0.5 : 0.5;
      return {
        probability,
        confidence: Math.round(probability * 100),
        label: probability >= 0.5 ? 1 : 0,
        latencyMs,
      };
    });
  }

  getModelInfo(): ModelInfo {
    return {
      path: this.modelPath,
      featureNames: this.featureNames,
      featureCount: this.featureNames.length,
      isInitialized: this.session !== null,
      version: this.modelVersion,
      trainedAt: this.trainedAt,
    };
  }

  isReady(): boolean {
    return this.session !== null && this.warmupCompleted;
  }

  getFeatureNames(): string[] {
    return [...this.featureNames];
  }

  getFeatureCount(): number {
    return this.featureNames.length;
  }

  async dispose(): Promise<void> {
    if (this.session) {
      await (this.session as { release: () => Promise<void> }).release();
      this.session = null;
    }
    this.warmupCompleted = false;
  }
}
