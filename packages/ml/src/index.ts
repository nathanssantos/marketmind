/**
 * @marketmind/ml - Machine Learning Package
 *
 * Placeholder package for future ML model integration.
 * This package will contain:
 * - Feature extraction pipelines
 * - Model definitions and training
 * - Model evaluation metrics
 * - Deployment utilities
 *
 * @packageDocumentation
 */

export const ML_VERSION = '0.1.0';

export interface MLConfig {
  modelType: 'classification' | 'regression';
  features: string[];
  targetColumn: string;
  trainTestSplit: number;
}

export interface MLPrediction {
  symbol: string;
  timestamp: number;
  prediction: number;
  confidence: number;
  modelVersion: string;
}

export interface FeatureSet {
  technical: Record<string, number>;
  sentiment: Record<string, number>;
  temporal: Record<string, number>;
}

export const createDefaultMLConfig = (): MLConfig => ({
  modelType: 'classification',
  features: ['rsi', 'macd', 'bollingerBands', 'volume'],
  targetColumn: 'direction',
  trainTestSplit: 0.8,
});
