import type {
  MLFeatureVector,
  NormalizedFeatureVector,
  NormalizationParams,
  FeatureNormalizationConfig,
} from '../types';
import { NORMALIZATION_CONFIG } from '../constants/modelConfig';
import {
  TECHNICAL_FEATURE_NAMES,
  MARKET_FEATURE_NAMES,
  TEMPORAL_FEATURE_NAMES,
  SETUP_FEATURE_NAMES,
  SETUP_TYPE_ENCODING_LENGTH,
} from '../constants/featureConfig';

export class Normalizer {
  private config: FeatureNormalizationConfig;
  private featureNames: string[];

  constructor(config?: Partial<FeatureNormalizationConfig>) {
    this.config = {
      method: config?.method ?? NORMALIZATION_CONFIG.defaultMethod,
      params: config?.params ?? {},
    };

    const setupEncodingNames = Array.from(
      { length: SETUP_TYPE_ENCODING_LENGTH },
      (_, i) => `setup_type_${i}`
    );

    this.featureNames = [
      ...TECHNICAL_FEATURE_NAMES,
      ...MARKET_FEATURE_NAMES,
      ...TEMPORAL_FEATURE_NAMES,
      ...setupEncodingNames,
      ...SETUP_FEATURE_NAMES,
    ];
  }

  normalize(features: MLFeatureVector): NormalizedFeatureVector {
    const rawValues = this.flattenFeatures(features);
    const normalizedValues = new Float32Array(rawValues.length);

    for (let i = 0; i < rawValues.length; i++) {
      const featureName = this.featureNames[i];
      const value = rawValues[i] ?? 0;

      if (featureName && this.shouldSkipNormalization(featureName)) {
        normalizedValues[i] = value;
        continue;
      }

      const params = featureName ? this.config.params[featureName] : undefined;
      if (params) {
        normalizedValues[i] = this.normalizeValue(value, params);
      } else {
        normalizedValues[i] = this.normalizeWithDefaults(value, featureName ?? '');
      }
    }

    return {
      features: normalizedValues,
      featureNames: this.featureNames,
      timestamp: Date.now(),
    };
  }

  fit(samples: MLFeatureVector[]): void {
    const numFeatures = this.featureNames.length;
    const featureValues: number[][] = Array.from({ length: numFeatures }, () => []);

    for (const sample of samples) {
      const flattened = this.flattenFeatures(sample);
      for (let i = 0; i < numFeatures; i++) {
        const value = flattened[i];
        if (value !== undefined && !isNaN(value) && isFinite(value)) {
          featureValues[i]?.push(value);
        }
      }
    }

    for (let i = 0; i < numFeatures; i++) {
      const featureName = this.featureNames[i];
      const values = featureValues[i];

      if (!featureName || !values || values.length === 0) continue;
      if (this.shouldSkipNormalization(featureName)) continue;

      const params = this.calculateParams(values);
      this.config.params[featureName] = params;
    }
  }

  getConfig(): FeatureNormalizationConfig {
    return { ...this.config };
  }

  setConfig(config: FeatureNormalizationConfig): void {
    this.config = config;
  }

  private flattenFeatures(features: MLFeatureVector): number[] {
    const result: number[] = [];

    for (const key of TECHNICAL_FEATURE_NAMES) {
      result.push(features.technical[key] ?? 0);
    }

    for (const key of MARKET_FEATURE_NAMES) {
      result.push(features.market[key] ?? 0);
    }

    for (const key of TEMPORAL_FEATURE_NAMES) {
      result.push(features.temporal[key] ?? 0);
    }

    result.push(...features.setup.setup_type_encoded);

    for (const key of SETUP_FEATURE_NAMES) {
      result.push(features.setup[key] ?? 0);
    }

    return result;
  }

  private shouldSkipNormalization(featureName: string): boolean {
    if (featureName.startsWith('setup_type_')) return true;
    if (featureName.startsWith('is_')) return true;

    const binaryFeatures = [
      'volume_confirmation',
      'is_doji',
      'is_hammer',
      'is_engulfing',
    ];
    return binaryFeatures.includes(featureName);
  }

  private normalizeValue(value: number, params: NormalizationParams): number {
    if (this.config.method === 'z-score') {
      if (params.std < NORMALIZATION_CONFIG.minVariance) {
        return 0;
      }
      let normalized = (value - params.mean) / params.std;
      if (NORMALIZATION_CONFIG.clipOutliers) {
        normalized = Math.max(
          -NORMALIZATION_CONFIG.outlierStdThreshold,
          Math.min(NORMALIZATION_CONFIG.outlierStdThreshold, normalized)
        );
      }
      return normalized;
    }

    if (this.config.method === 'min-max') {
      const range = params.max - params.min;
      if (range < NORMALIZATION_CONFIG.minVariance) {
        return 0.5;
      }
      return (value - params.min) / range;
    }

    if (this.config.method === 'robust') {
      if (params.std < NORMALIZATION_CONFIG.minVariance) {
        return 0;
      }
      return (value - params.mean) / params.std;
    }

    return value;
  }

  private normalizeWithDefaults(value: number, featureName: string): number {
    const defaults = this.getDefaultParams(featureName);
    return this.normalizeValue(value, defaults);
  }

  private calculateParams(values: number[]): NormalizationParams {
    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;

    const mean = values.reduce((a, b) => a + b, 0) / n;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n;
    const std = Math.sqrt(variance);

    const min = sorted[0] ?? 0;
    const max = sorted[n - 1] ?? 0;

    return { mean, std, min, max };
  }

  private getDefaultParams(featureName: string): NormalizationParams {
    const defaultRanges: Record<string, NormalizationParams> = {
      rsi_2: { mean: 50, std: 25, min: 0, max: 100 },
      rsi_7: { mean: 50, std: 20, min: 0, max: 100 },
      rsi_14: { mean: 50, std: 20, min: 0, max: 100 },
      rsi_21: { mean: 50, std: 20, min: 0, max: 100 },
      stoch_k: { mean: 50, std: 25, min: 0, max: 100 },
      stoch_d: { mean: 50, std: 25, min: 0, max: 100 },
      mfi_14: { mean: 50, std: 20, min: 0, max: 100 },
      williams_r: { mean: -50, std: 25, min: -100, max: 0 },
      bb_position: { mean: 0.5, std: 0.25, min: 0, max: 1 },
      bb_percent_b: { mean: 0.5, std: 0.25, min: 0, max: 1 },
      keltner_position: { mean: 0.5, std: 0.25, min: 0, max: 1 },
      price_channel_position: { mean: 0.5, std: 0.25, min: 0, max: 1 },
      fear_greed_index: { mean: 50, std: 20, min: 0, max: 100 },
      setup_confidence_original: { mean: 70, std: 15, min: 0, max: 100 },
      risk_reward_ratio: { mean: 2, std: 1, min: 0.5, max: 10 },
      adx_value: { mean: 25, std: 15, min: 0, max: 100 },
    };

    if (defaultRanges[featureName]) {
      return defaultRanges[featureName];
    }

    if (featureName.includes('sin') || featureName.includes('cos')) {
      return { mean: 0, std: 0.7, min: -1, max: 1 };
    }

    if (featureName.includes('change') || featureName.includes('momentum')) {
      return { mean: 0, std: 5, min: -50, max: 50 };
    }

    if (featureName.includes('crossover') || featureName.includes('signal')) {
      return { mean: 0, std: 0.5, min: -1, max: 1 };
    }

    if (featureName.includes('ratio')) {
      return { mean: 1, std: 0.5, min: 0, max: 5 };
    }

    return { mean: 0, std: 1, min: -10, max: 10 };
  }
}
