"""Train the CNN baseline on a prepared dataset directory."""

import argparse
import json
from pathlib import Path

import numpy as np
import tensorflow as tf

if __package__:
    from .data import binary_metrics, read_manifest, save_json, sha256
    from .models import build_baseline
else:
    from data import binary_metrics, read_manifest, save_json, sha256
    from models import build_baseline


def arrays(rows, patches):
    return patches[[row["array_index"] for row in rows]], np.array([row["label"] for row in rows], dtype="float32")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", required=True)
    parser.add_argument("--out", default="artifacts/satellite_baseline")
    parser.add_argument("--epochs", type=int, default=20)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument('--seed', type=int, default=42)
    args = parser.parse_args()
    dataset = Path(args.dataset); out = Path(args.out); out.mkdir(parents=True, exist_ok=True)
    rows = [r for r in read_manifest(dataset / "manifest.csv") if r['label'] >= 0]
    tf.keras.utils.set_random_seed(args.seed)
    patches = np.load(dataset / "patches.npy", mmap_mode="r").astype("float32")
    if patches.ndim != 4 or min(patches.shape[1:3]) < 4 or not np.isfinite(patches).all():
        raise ValueError("patches.npy harus berbentuk [N,H,W,C]")
    if any(row["array_index"] >= len(patches) for row in rows):
        raise ValueError("array_index berada di luar patches.npy")
    train_x, train_y = arrays([r for r in rows if r["split"] == "train"], patches)
    val_x, val_y = arrays([r for r in rows if r["split"] == "validation"], patches)
    if len(np.unique(train_y)) < 2 or len(val_x) == 0:
        raise ValueError("Train harus memiliki dua kelas dan validation tidak boleh kosong")
    model = build_baseline(train_x.shape[1:])
    model.summary()
    counts = np.bincount(train_y.astype("int32"), minlength=2)
    class_weight = {i: float(len(train_y) / (2 * count)) for i, count in enumerate(counts) if count}
    callbacks = [tf.keras.callbacks.ModelCheckpoint(out / "best.keras", monitor="val_loss", save_best_only=True),
                 tf.keras.callbacks.EarlyStopping(monitor="val_loss", patience=5, restore_best_weights=True)]
    history = model.fit(train_x, train_y, validation_data=(val_x, val_y), epochs=args.epochs,
                         batch_size=args.batch_size, callbacks=callbacks, class_weight=class_weight)
    model.save(out / "model.keras")
    save_json(out / "training_config.json", {"input_shape": list(train_x.shape[1:]), "epochs": args.epochs,
                                               "batch_size": args.batch_size, "architecture": "cnn_baseline",
                                                "normalization": "provided patch values; no ImageNet preprocessing",
                                                "class_counts": counts.tolist(), "class_weight": class_weight,
                                                "augmentation": "none; geometric transforms are not assumed valid for georeferenced patches"})
    save_json(out / "history.json", history.history)
    test_rows = [r for r in rows if r["split"] == "test"]
    evaluation_status = 'not_evaluated'
    if test_rows:
        test_x, test_y = arrays(test_rows, patches)
        scores = model.predict(test_x, verbose=0).reshape(-1)
        save_json(out / 'test_metrics.json', {**binary_metrics(test_y.astype('int32'), scores), 'samples': len(test_y),
                                              'split': 'test', 'model_sha256': sha256(out / 'best.keras')})
        evaluation_status = 'evaluated_once_after_training'
    save_json(out / 'model_metadata.json', {
        'schema_version': 1, 'architecture': 'cnn_baseline', 'seed': args.seed,
        'input_shape': list(train_x.shape[1:]), 'classes': ['reference_negative', 'FIRMS_match'],
        'preprocessing': 'provided values; channel calibration must be documented separately',
        'model_sha256': sha256(out / 'best.keras'),
        'manifest_sha256': sha256(dataset / 'manifest.csv'),
        'tensorflow_version': tf.__version__, 'evaluation_status': evaluation_status,
        'deployment_ready': False})


if __name__ == "__main__":
    main()