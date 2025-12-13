#!/usr/bin/env python3
"""
Setup Classifier Training Script

Trains an XGBoost or LightGBM model to predict trading setup success.
Uses walk-forward cross-validation to prevent data leakage.
Exports trained model to JSON format for Node.js inference.

Usage:
    python train_setup_classifier.py --config config.json --data training_unified.csv --output models/model.onnx
"""

import numpy as np
import pandas as pd
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score
from xgboost import XGBClassifier
from lightgbm import LGBMClassifier
import json
import argparse
from datetime import datetime
from pathlib import Path
from typing import Optional
import warnings

warnings.filterwarnings('ignore')

INTERVAL_MAP = {
    '1m': 0, '5m': 1, '15m': 2, '30m': 3,
    '1h': 4, '4h': 5, '1d': 6, '1w': 7
}


class SetupClassifierTrainer:
    def __init__(self, config_path: str):
        with open(config_path, 'r') as f:
            self.config = json.load(f)

        self.model_type = self.config.get('model_type', 'xgboost')
        self.feature_names = self.config['feature_names']
        self.version = self.config.get('version', '1.0.0')
        self.model: Optional[XGBClassifier | LGBMClassifier] = None
        self.cv_scores: list[dict] = []

    def load_training_data(self, data_path: str) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
        """Load pre-extracted features from TypeScript pipeline"""
        file_path = Path(data_path)

        if file_path.suffix == '.parquet':
            df = pd.read_parquet(data_path)
        elif file_path.suffix == '.json':
            df = pd.read_json(data_path)
        elif file_path.suffix == '.csv':
            df = pd.read_csv(data_path)
        else:
            raise ValueError(f"Unsupported file format: {file_path.suffix}")

        if 'interval' in df.columns:
            print(f"\nInterval distribution:")
            print(df['interval'].value_counts().to_string())
            df['interval_encoded'] = df['interval'].map(INTERVAL_MAP).fillna(-1).astype(np.float32)
            if 'interval_encoded' not in self.feature_names:
                self.feature_names = self.feature_names + ['interval_encoded']
            print(f"\nAdded interval_encoded feature (0-7 scale)")

        available_features = [f for f in self.feature_names if f in df.columns]
        missing_features = [f for f in self.feature_names if f not in df.columns]

        if missing_features:
            print(f"\nWarning: {len(missing_features)} features not found in data:")
            for f in missing_features[:10]:
                print(f"  - {f}")
            if len(missing_features) > 10:
                print(f"  ... and {len(missing_features) - 10} more")
            self.feature_names = available_features

        X = df[self.feature_names].values.astype(np.float32)
        y = df['label'].values.astype(np.int32)
        timestamps = df['timestamp'].values

        nan_counts = np.isnan(X).sum(axis=0)
        if nan_counts.sum() > 0:
            print(f"\nWarning: Found NaN values in {(nan_counts > 0).sum()} features")
            X = np.nan_to_num(X, nan=0.0)

        print(f"\nLoaded {len(X)} samples with {len(self.feature_names)} features")
        print(f"Label distribution: {np.bincount(y)}")
        print(f"Positive rate: {y.sum() / len(y):.2%}")

        return X, y, timestamps

    def _create_model(self) -> XGBClassifier | LGBMClassifier:
        """Create model instance based on configuration"""
        if self.model_type == 'xgboost':
            return XGBClassifier(
                n_estimators=self.config.get('n_estimators', 500),
                max_depth=self.config.get('max_depth', 6),
                learning_rate=self.config.get('learning_rate', 0.1),
                subsample=self.config.get('subsample', 0.8),
                colsample_bytree=self.config.get('colsample_bytree', 0.8),
                min_child_weight=self.config.get('min_child_weight', 1),
                reg_alpha=self.config.get('reg_alpha', 0),
                reg_lambda=self.config.get('reg_lambda', 1),
                early_stopping_rounds=50,
                eval_metric='logloss',
                random_state=42,
                n_jobs=-1,
            )
        elif self.model_type == 'lightgbm':
            return LGBMClassifier(
                n_estimators=self.config.get('n_estimators', 500),
                max_depth=self.config.get('max_depth', 6),
                learning_rate=self.config.get('learning_rate', 0.1),
                subsample=self.config.get('subsample', 0.8),
                colsample_bytree=self.config.get('colsample_bytree', 0.8),
                min_child_samples=self.config.get('min_child_samples', 20),
                reg_alpha=self.config.get('reg_alpha', 0),
                reg_lambda=self.config.get('reg_lambda', 0),
                verbose=-1,
                random_state=42,
                n_jobs=-1,
            )
        else:
            raise ValueError(f"Unknown model type: {self.model_type}")

    def train(self, X: np.ndarray, y: np.ndarray, timestamps: np.ndarray) -> XGBClassifier | LGBMClassifier:
        """Train with time-series cross-validation"""
        n_splits = self.config.get('cv_splits', 5)
        tscv = TimeSeriesSplit(n_splits=n_splits)

        print(f"\nRunning {n_splits}-fold walk-forward cross-validation...")

        for fold, (train_idx, val_idx) in enumerate(tscv.split(X)):
            X_train, X_val = X[train_idx], X[val_idx]
            y_train, y_val = y[train_idx], y[val_idx]

            print(f"\nFold {fold + 1}/{n_splits}:")
            print(f"  Train: {len(train_idx)} samples")
            print(f"  Val: {len(val_idx)} samples")

            model = self._create_model()

            if self.model_type == 'xgboost':
                model.fit(
                    X_train, y_train,
                    eval_set=[(X_val, y_val)],
                    verbose=False,
                )
            else:
                model.fit(X_train, y_train)

            y_pred = model.predict(X_val)
            y_proba = model.predict_proba(X_val)[:, 1]

            fold_metrics = {
                'fold': fold + 1,
                'accuracy': accuracy_score(y_val, y_pred),
                'precision': precision_score(y_val, y_pred, zero_division=0),
                'recall': recall_score(y_val, y_pred, zero_division=0),
                'f1': f1_score(y_val, y_pred, zero_division=0),
                'auc': roc_auc_score(y_val, y_proba) if len(np.unique(y_val)) > 1 else 0.5,
            }
            self.cv_scores.append(fold_metrics)

            print(f"  Accuracy: {fold_metrics['accuracy']:.4f}")
            print(f"  Precision: {fold_metrics['precision']:.4f}")
            print(f"  Recall: {fold_metrics['recall']:.4f}")
            print(f"  F1: {fold_metrics['f1']:.4f}")
            print(f"  AUC: {fold_metrics['auc']:.4f}")

        mean_metrics = {
            'accuracy': np.mean([s['accuracy'] for s in self.cv_scores]),
            'precision': np.mean([s['precision'] for s in self.cv_scores]),
            'recall': np.mean([s['recall'] for s in self.cv_scores]),
            'f1': np.mean([s['f1'] for s in self.cv_scores]),
            'auc': np.mean([s['auc'] for s in self.cv_scores]),
        }
        std_metrics = {
            'accuracy': np.std([s['accuracy'] for s in self.cv_scores]),
            'f1': np.std([s['f1'] for s in self.cv_scores]),
            'auc': np.std([s['auc'] for s in self.cv_scores]),
        }

        print(f"\n{'='*50}")
        print("Cross-Validation Summary:")
        print(f"  Mean Accuracy: {mean_metrics['accuracy']:.4f} (+/- {std_metrics['accuracy']:.4f})")
        print(f"  Mean Precision: {mean_metrics['precision']:.4f}")
        print(f"  Mean Recall: {mean_metrics['recall']:.4f}")
        print(f"  Mean F1: {mean_metrics['f1']:.4f} (+/- {std_metrics['f1']:.4f})")
        print(f"  Mean AUC: {mean_metrics['auc']:.4f} (+/- {std_metrics['auc']:.4f})")
        print(f"{'='*50}")

        print("\nTraining final model on full dataset...")
        self.model = self._create_model()

        if self.model_type == 'xgboost':
            self.model.set_params(early_stopping_rounds=None)

        self.model.fit(X, y)
        print("Training complete!")

        return self.model

    def export_to_onnx(self, output_path: str) -> str:
        """Export trained model to JSON format (compatible with xgboost-node inference)"""
        if self.model is None:
            raise ValueError("Model not trained. Call train() first.")

        mean_metrics = {
            'accuracy': float(np.mean([s['accuracy'] for s in self.cv_scores])),
            'precision': float(np.mean([s['precision'] for s in self.cv_scores])),
            'recall': float(np.mean([s['recall'] for s in self.cv_scores])),
            'f1': float(np.mean([s['f1'] for s in self.cv_scores])),
            'auc': float(np.mean([s['auc'] for s in self.cv_scores])),
        }

        booster = self.model.get_booster()

        json_output = str(output_path).replace('.onnx', '.json')
        booster.save_model(json_output)
        print(f"\nModel exported to {json_output}")

        ubj_output = str(output_path).replace('.onnx', '.ubj')
        booster.save_model(ubj_output)
        print(f"Binary model exported to {ubj_output}")

        manifest_path = Path(output_path).parent / 'manifest.json'
        manifest = {
            'models': [{
                'id': f'setup-classifier-v{self.version}',
                'name': 'Setup Classifier',
                'version': self.version,
                'type': 'setup-classifier',
                'file': Path(output_path).name,
                'model_type': self.model_type,
                'feature_count': len(self.feature_names),
                'trained_at': datetime.now().isoformat(),
                'metrics': mean_metrics,
            }]
        }

        with open(manifest_path, 'w') as f:
            json.dump(manifest, f, indent=2)
        print(f"Manifest saved to {manifest_path}")

        return output_path

    def get_feature_importance(self) -> dict[str, float]:
        """Get feature importance scores"""
        if self.model is None:
            raise ValueError("Model not trained")

        importance = self.model.feature_importances_
        return dict(sorted(
            [(name, float(score)) for name, score in zip(self.feature_names, importance)],
            key=lambda x: x[1],
            reverse=True
        ))

    def save_feature_importance(self, output_path: str) -> None:
        """Save feature importance to JSON file"""
        importance = self.get_feature_importance()
        with open(output_path, 'w') as f:
            json.dump(importance, f, indent=2)
        print(f"Feature importance saved to {output_path}")


def main():
    parser = argparse.ArgumentParser(description='Train setup classifier model')
    parser.add_argument('--config', required=True, help='Training config JSON path')
    parser.add_argument('--data', required=True, help='Training data path (parquet/json/csv)')
    parser.add_argument('--output', required=True, help='ONNX output path')
    parser.add_argument('--importance', help='Feature importance output path (optional)')
    args = parser.parse_args()

    trainer = SetupClassifierTrainer(args.config)
    X, y, timestamps = trainer.load_training_data(args.data)
    trainer.train(X, y, timestamps)
    trainer.export_to_onnx(args.output)

    print("\nTop 20 Important Features:")
    importance = trainer.get_feature_importance()
    for i, (name, score) in enumerate(list(importance.items())[:20]):
        print(f"  {i+1:2d}. {name}: {score:.4f}")

    if args.importance:
        trainer.save_feature_importance(args.importance)


if __name__ == '__main__':
    main()
