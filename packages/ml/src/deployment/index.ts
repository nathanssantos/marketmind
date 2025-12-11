/**
 * Deployment Module
 *
 * Future implementations:
 * - Model serving API
 * - Model versioning
 * - A/B testing deployment
 * - Model monitoring
 */

export interface DeploymentConfig {
  modelPath: string;
  version: string;
  endpoint: string;
  batchSize: number;
  maxLatencyMs: number;
}

export interface ModelRegistry {
  models: RegisteredModel[];
  activeModel: string | null;
}

export interface RegisteredModel {
  name: string;
  version: string;
  path: string;
  createdAt: Date;
  metrics: Record<string, number>;
  isActive: boolean;
}

export const DEFAULT_DEPLOYMENT_CONFIG: DeploymentConfig = {
  modelPath: './models',
  version: '1.0.0',
  endpoint: '/api/ml/predict',
  batchSize: 100,
  maxLatencyMs: 100,
};
