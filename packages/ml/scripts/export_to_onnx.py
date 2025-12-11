#!/usr/bin/env python3
"""
ONNX Export Utility

Standalone utility to convert pre-trained sklearn/XGBoost/LightGBM models to ONNX format.
Also includes verification and benchmarking functionality.

Usage:
    python export_to_onnx.py --model model.pkl --config config.json --output model.onnx
    python export_to_onnx.py --verify model.onnx --data sample_data.json
"""

import numpy as np
import onnx
import onnxruntime as ort
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import FloatTensorType
import json
import argparse
import pickle
import time
from pathlib import Path
from typing import Any


def load_model(model_path: str) -> Any:
    """Load a pickled sklearn/XGBoost/LightGBM model"""
    with open(model_path, 'rb') as f:
        return pickle.load(f)


def convert_to_onnx(
    model: Any,
    feature_names: list[str],
    output_path: str,
    version: str = "1.0.0",
    model_type: str = "xgboost"
) -> str:
    """Convert a trained model to ONNX format"""
    initial_type = [('input', FloatTensorType([None, len(feature_names)]))]
    options = {id(model): {'zipmap': False}}

    onnx_model = convert_sklearn(
        model,
        initial_types=initial_type,
        target_opset=15,
        options=options,
    )

    meta = onnx_model.metadata_props.add()
    meta.key = 'model_version'
    meta.value = version

    meta = onnx_model.metadata_props.add()
    meta.key = 'model_type'
    meta.value = model_type

    meta = onnx_model.metadata_props.add()
    meta.key = 'feature_names'
    meta.value = json.dumps(feature_names)

    meta = onnx_model.metadata_props.add()
    meta.key = 'feature_count'
    meta.value = str(len(feature_names))

    onnx.save(onnx_model, output_path)
    print(f"Model exported to {output_path}")

    return output_path


def verify_onnx_model(
    onnx_path: str,
    sample_data: np.ndarray | None = None,
    original_model: Any | None = None
) -> dict:
    """Verify ONNX model loads correctly and produces valid outputs"""
    print(f"\nVerifying ONNX model: {onnx_path}")

    onnx_model = onnx.load(onnx_path)
    onnx.checker.check_model(onnx_model)
    print("  ONNX model structure: OK")

    metadata = {}
    for prop in onnx_model.metadata_props:
        metadata[prop.key] = prop.value
    print(f"  Metadata: {json.dumps(metadata, indent=4)}")

    session = ort.InferenceSession(
        onnx_path,
        providers=['CPUExecutionProvider']
    )
    print("  ONNX Runtime session: OK")

    input_name = session.get_inputs()[0].name
    input_shape = session.get_inputs()[0].shape
    print(f"  Input: {input_name}, shape: {input_shape}")

    output_names = [o.name for o in session.get_outputs()]
    print(f"  Outputs: {output_names}")

    if sample_data is not None:
        print("\nRunning inference test...")
        outputs = session.run(None, {input_name: sample_data.astype(np.float32)})

        print(f"  Output shapes: {[o.shape for o in outputs]}")
        print(f"  Sample predictions: {outputs[0][:5] if len(outputs[0]) > 5 else outputs[0]}")

        if len(outputs) > 1 and outputs[1] is not None:
            print(f"  Sample probabilities: {outputs[1][:5] if len(outputs[1]) > 5 else outputs[1]}")

        if original_model is not None:
            original_preds = original_model.predict(sample_data)
            onnx_preds = outputs[0].flatten()
            match_rate = np.mean(original_preds == onnx_preds)
            print(f"  Prediction match rate vs original: {match_rate:.2%}")

    return {
        'status': 'valid',
        'metadata': metadata,
        'input_shape': input_shape,
        'output_names': output_names,
    }


def benchmark_inference(onnx_path: str, feature_count: int, n_samples: int = 1000) -> dict:
    """Benchmark ONNX model inference performance"""
    print(f"\nBenchmarking inference performance...")

    session = ort.InferenceSession(
        onnx_path,
        providers=['CPUExecutionProvider']
    )
    input_name = session.get_inputs()[0].name

    dummy_data = np.random.randn(1, feature_count).astype(np.float32)
    for _ in range(10):
        session.run(None, {input_name: dummy_data})
    print("  Warmup complete")

    single_times = []
    for _ in range(100):
        start = time.perf_counter()
        session.run(None, {input_name: dummy_data})
        single_times.append((time.perf_counter() - start) * 1000)

    batch_data = np.random.randn(n_samples, feature_count).astype(np.float32)
    start = time.perf_counter()
    session.run(None, {input_name: batch_data})
    batch_time = (time.perf_counter() - start) * 1000

    results = {
        'single_inference_ms': {
            'mean': np.mean(single_times),
            'std': np.std(single_times),
            'min': np.min(single_times),
            'max': np.max(single_times),
            'p50': np.percentile(single_times, 50),
            'p95': np.percentile(single_times, 95),
            'p99': np.percentile(single_times, 99),
        },
        'batch_inference': {
            'samples': n_samples,
            'total_ms': batch_time,
            'per_sample_ms': batch_time / n_samples,
        }
    }

    print(f"  Single inference: {results['single_inference_ms']['mean']:.3f}ms (p99: {results['single_inference_ms']['p99']:.3f}ms)")
    print(f"  Batch ({n_samples} samples): {batch_time:.3f}ms ({batch_time/n_samples:.4f}ms/sample)")

    return results


def main():
    parser = argparse.ArgumentParser(description='ONNX export and verification utility')
    subparsers = parser.add_subparsers(dest='command', help='Command to run')

    convert_parser = subparsers.add_parser('convert', help='Convert model to ONNX')
    convert_parser.add_argument('--model', required=True, help='Pickled model path')
    convert_parser.add_argument('--config', required=True, help='Config JSON with feature names')
    convert_parser.add_argument('--output', required=True, help='ONNX output path')
    convert_parser.add_argument('--version', default='1.0.0', help='Model version')

    verify_parser = subparsers.add_parser('verify', help='Verify ONNX model')
    verify_parser.add_argument('--model', required=True, help='ONNX model path')
    verify_parser.add_argument('--data', help='Sample data JSON for inference test')

    bench_parser = subparsers.add_parser('benchmark', help='Benchmark ONNX model')
    bench_parser.add_argument('--model', required=True, help='ONNX model path')
    bench_parser.add_argument('--features', type=int, required=True, help='Number of features')
    bench_parser.add_argument('--samples', type=int, default=1000, help='Batch size for benchmark')

    args = parser.parse_args()

    if args.command == 'convert':
        with open(args.config, 'r') as f:
            config = json.load(f)
        model = load_model(args.model)
        convert_to_onnx(
            model,
            config['feature_names'],
            args.output,
            args.version,
            config.get('model_type', 'xgboost')
        )
    elif args.command == 'verify':
        sample_data = None
        if args.data:
            with open(args.data, 'r') as f:
                data = json.load(f)
            sample_data = np.array(data['features'], dtype=np.float32)
        verify_onnx_model(args.model, sample_data)
    elif args.command == 'benchmark':
        benchmark_inference(args.model, args.features, args.samples)
    else:
        parser.print_help()


if __name__ == '__main__':
    main()
