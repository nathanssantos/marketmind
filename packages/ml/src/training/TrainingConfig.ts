export interface XGBoostConfig {
  n_estimators: number;
  max_depth: number;
  learning_rate: number;
  subsample: number;
  colsample_bytree: number;
  min_child_weight: number;
  reg_alpha: number;
  reg_lambda: number;
}

export interface LightGBMConfig {
  n_estimators: number;
  max_depth: number;
  learning_rate: number;
  subsample: number;
  colsample_bytree: number;
  min_child_samples: number;
  reg_alpha: number;
  reg_lambda: number;
}

export interface TrainingConfig {
  model_type: 'xgboost' | 'lightgbm';
  version: string;
  feature_names: string[];
  cv_splits: number;

  xgboost?: XGBoostConfig;
  lightgbm?: LightGBMConfig;
}

export const DEFAULT_XGBOOST_CONFIG: XGBoostConfig = {
  n_estimators: 500,
  max_depth: 6,
  learning_rate: 0.1,
  subsample: 0.8,
  colsample_bytree: 0.8,
  min_child_weight: 1,
  reg_alpha: 0,
  reg_lambda: 1,
};

export const DEFAULT_LIGHTGBM_CONFIG: LightGBMConfig = {
  n_estimators: 500,
  max_depth: 6,
  learning_rate: 0.1,
  subsample: 0.8,
  colsample_bytree: 0.8,
  min_child_samples: 20,
  reg_alpha: 0,
  reg_lambda: 0,
};

export const CONSERVATIVE_XGBOOST_CONFIG: XGBoostConfig = {
  n_estimators: 300,
  max_depth: 4,
  learning_rate: 0.05,
  subsample: 0.7,
  colsample_bytree: 0.7,
  min_child_weight: 3,
  reg_alpha: 0.1,
  reg_lambda: 1.5,
};

export const AGGRESSIVE_XGBOOST_CONFIG: XGBoostConfig = {
  n_estimators: 800,
  max_depth: 8,
  learning_rate: 0.15,
  subsample: 0.9,
  colsample_bytree: 0.9,
  min_child_weight: 1,
  reg_alpha: 0,
  reg_lambda: 0.5,
};

export class TrainingConfigBuilder {
  private config: Partial<TrainingConfig> = {};

  setModelType(type: 'xgboost' | 'lightgbm'): this {
    this.config.model_type = type;
    return this;
  }

  setVersion(version: string): this {
    this.config.version = version;
    return this;
  }

  setFeatureNames(names: string[]): this {
    this.config.feature_names = names;
    return this;
  }

  setCVSplits(splits: number): this {
    this.config.cv_splits = splits;
    return this;
  }

  useDefaultXGBoost(): this {
    this.config.model_type = 'xgboost';
    this.config.xgboost = { ...DEFAULT_XGBOOST_CONFIG };
    return this;
  }

  useConservativeXGBoost(): this {
    this.config.model_type = 'xgboost';
    this.config.xgboost = { ...CONSERVATIVE_XGBOOST_CONFIG };
    return this;
  }

  useAggressiveXGBoost(): this {
    this.config.model_type = 'xgboost';
    this.config.xgboost = { ...AGGRESSIVE_XGBOOST_CONFIG };
    return this;
  }

  useDefaultLightGBM(): this {
    this.config.model_type = 'lightgbm';
    this.config.lightgbm = { ...DEFAULT_LIGHTGBM_CONFIG };
    return this;
  }

  setXGBoostParam<K extends keyof XGBoostConfig>(key: K, value: XGBoostConfig[K]): this {
    if (!this.config.xgboost) {
      this.config.xgboost = { ...DEFAULT_XGBOOST_CONFIG };
    }
    this.config.xgboost[key] = value;
    return this;
  }

  setLightGBMParam<K extends keyof LightGBMConfig>(key: K, value: LightGBMConfig[K]): this {
    if (!this.config.lightgbm) {
      this.config.lightgbm = { ...DEFAULT_LIGHTGBM_CONFIG };
    }
    this.config.lightgbm[key] = value;
    return this;
  }

  build(): TrainingConfig {
    if (!this.config.model_type) {
      throw new Error('model_type is required');
    }
    if (!this.config.version) {
      throw new Error('version is required');
    }
    if (!this.config.feature_names || this.config.feature_names.length === 0) {
      throw new Error('feature_names is required');
    }

    return {
      model_type: this.config.model_type,
      version: this.config.version,
      feature_names: this.config.feature_names,
      cv_splits: this.config.cv_splits ?? 5,
      ...(this.config.model_type === 'xgboost'
        ? { ...DEFAULT_XGBOOST_CONFIG, ...this.config.xgboost }
        : { ...DEFAULT_LIGHTGBM_CONFIG, ...this.config.lightgbm }),
    } as TrainingConfig;
  }

  toJSON(): string {
    return JSON.stringify(this.build(), null, 2);
  }
}

export const createDefaultTrainingConfig = (
  featureNames: string[],
  version: string = '1.0.0'
): TrainingConfig => {
  return new TrainingConfigBuilder()
    .useDefaultXGBoost()
    .setVersion(version)
    .setFeatureNames(featureNames)
    .setCVSplits(5)
    .build();
};

export const createConservativeTrainingConfig = (
  featureNames: string[],
  version: string = '1.0.0'
): TrainingConfig => {
  return new TrainingConfigBuilder()
    .useConservativeXGBoost()
    .setVersion(version)
    .setFeatureNames(featureNames)
    .setCVSplits(5)
    .build();
};
