"""Evaluate a saved CNN on the untouched test split."""

import argparse
from pathlib import Path

import numpy as np
import tensorflow as tf

if __package__:
    from .data import binary_metrics, read_manifest, save_json, sha256
else:
    from data import binary_metrics, read_manifest, save_json, sha256


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", required=True)
    parser.add_argument("--model", required=True)
    parser.add_argument("--out", default="artifacts/satellite_baseline/test_metrics.json")
    parser.add_argument("--threshold", type=float, default=0.5)
    args = parser.parse_args()
    rows = read_manifest(Path(args.dataset) / "manifest.csv")
    rows = [row for row in rows if row["split"] == "test" and row['label'] >= 0]
    if not rows:
        raise ValueError("Manifest tidak memiliki test split")
    patches = np.load(Path(args.dataset) / "patches.npy", mmap_mode="r").astype("float32")
    x = patches[[row["array_index"] for row in rows]]
    y = np.array([row["label"] for row in rows], dtype="int32")
    scores = tf.keras.models.load_model(args.model).predict(x, verbose=0).reshape(-1)
    metrics = binary_metrics(y, scores, args.threshold)
    metrics["samples"] = len(y)
    metrics["model"] = str(args.model)
    metrics['model_sha256'] = sha256(args.model)
    metrics['manifest_sha256'] = sha256(Path(args.dataset) / 'manifest.csv')
    metrics['reference'] = 'FIRMS-derived labels; not independent field validation'
    save_json(args.out, metrics)
    print(metrics)


if __name__ == "__main__":
    main()