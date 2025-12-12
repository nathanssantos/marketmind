import { readFile } from 'fs/promises';
import type { PredictionResult } from '../types';

interface XGBoostTree {
  base_weights: number[];
  split_conditions: number[];
  split_indices: number[];
  left_children: number[];
  right_children: number[];
  default_left: number[];
}

interface XGBoostModel {
  learner: {
    learner_model_param: {
      base_score: string;
      num_class: string;
    };
    gradient_booster: {
      model: {
        gbtree_model_param: {
          num_trees: string;
        };
        trees: XGBoostTree[];
      };
    };
  };
}

export interface XGBoostInferenceConfig {
  threshold?: number;
}

export class XGBoostInferenceEngine {
  private model: XGBoostModel | null = null;
  private modelPath: string;
  private trees: XGBoostTree[] = [];
  private baseScore: number = 0.5;
  private numTrees: number = 0;
  private config: XGBoostInferenceConfig;

  constructor(modelPath: string, config: XGBoostInferenceConfig = {}) {
    this.modelPath = modelPath;
    this.config = {
      threshold: config.threshold ?? 0.5,
    };
  }

  async initialize(): Promise<void> {
    const content = await readFile(this.modelPath, 'utf-8');
    this.model = JSON.parse(content) as XGBoostModel;

    this.trees = this.model.learner.gradient_booster.model.trees;
    this.numTrees = parseInt(this.model.learner.gradient_booster.model.gbtree_model_param.num_trees, 10);

    const baseScoreStr = this.model.learner.learner_model_param?.base_score;
    this.baseScore = baseScoreStr ? parseFloat(baseScoreStr) : 0.5;
  }

  private traverseTree(tree: XGBoostTree, features: number[]): number {
    let nodeIdx = 0;

    while (tree.left_children[nodeIdx] !== -1) {
      const featureIdx = tree.split_indices[nodeIdx]!;
      const threshold = tree.split_conditions[nodeIdx]!;
      const featureValue = features[featureIdx] ?? 0;

      const goLeft = featureValue < threshold ||
        (isNaN(featureValue) && tree.default_left[nodeIdx] === 1);

      nodeIdx = goLeft ? tree.left_children[nodeIdx]! : tree.right_children[nodeIdx]!;
    }

    return tree.base_weights[nodeIdx]!;
  }

  private sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
  }

  predict(features: number[] | Float32Array): PredictionResult {
    if (!this.model || this.trees.length === 0) {
      throw new Error('Model not initialized. Call initialize() first.');
    }

    const startTime = performance.now();

    const featuresArray = features instanceof Float32Array ? Array.from(features) : features;

    let rawScore = 0;
    for (let i = 0; i < this.numTrees; i++) {
      rawScore += this.traverseTree(this.trees[i]!, featuresArray);
    }

    const probability = this.sigmoid(rawScore);

    const endTime = performance.now();

    return {
      probability,
      confidence: Math.round(probability * 100),
      label: probability >= (this.config.threshold ?? 0.5) ? 1 : 0,
      latencyMs: endTime - startTime,
    };
  }

  predictBatch(featuresBatch: (number[] | Float32Array)[]): PredictionResult[] {
    return featuresBatch.map(features => this.predict(features));
  }

  isReady(): boolean {
    return this.model !== null && this.trees.length > 0;
  }

  getModelInfo(): { path: string; numTrees: number; baseScore: number } {
    return {
      path: this.modelPath,
      numTrees: this.numTrees,
      baseScore: this.baseScore,
    };
  }
}
