/**
 * Training Module
 *
 * Future implementations:
 * - Data loading and preprocessing
 * - Feature normalization
 * - Cross-validation
 * - Hyperparameter tuning
 */

export interface TrainingConfig {
  epochs: number;
  batchSize: number;
  learningRate: number;
  validationSplit: number;
  earlyStopping: boolean;
  patience: number;
}

export interface TrainingResult {
  modelPath: string;
  trainLoss: number;
  validationLoss: number;
  trainMetrics: Record<string, number>;
  validationMetrics: Record<string, number>;
  trainingTime: number;
}

export const DEFAULT_TRAINING_CONFIG: TrainingConfig = {
  epochs: 100,
  batchSize: 32,
  learningRate: 0.001,
  validationSplit: 0.2,
  earlyStopping: true,
  patience: 10,
};
