/**
 * ML Models Module
 *
 * Future implementations:
 * - XGBoost wrapper for setup selection
 * - LightGBM for price direction
 * - Neural network models
 */

export interface ModelInterface {
  name: string;
  version: string;
  train(features: number[][], labels: number[]): Promise<void>;
  predict(features: number[]): Promise<number>;
  evaluate(features: number[][], labels: number[]): Promise<ModelMetrics>;
  save(path: string): Promise<void>;
  load(path: string): Promise<void>;
}

export interface ModelMetrics {
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1Score?: number;
  rmse?: number;
  mae?: number;
  r2?: number;
}

export const SUPPORTED_MODELS = [
  'xgboost',
  'lightgbm',
  'random-forest',
  'logistic-regression',
] as const;

export type SupportedModel = (typeof SUPPORTED_MODELS)[number];
