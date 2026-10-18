"""Data validation, group splitting, and metrics without a scikit-learn dependency."""

import csv
import json
import hashlib
from datetime import datetime, timezone
from pathlib import Path

import numpy as np


def sha256(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def utc_time(value):
    result = datetime.fromisoformat(str(value))
    if result.tzinfo is None:
        raise ValueError('observed_at harus menyertakan timezone')
    return result.astimezone(timezone.utc)


def validate_bundle(bundle):
    required = {'x', 'patch_id', 'group_id', 'latitude', 'longitude', 'observed_at'}
    if required.difference(bundle.keys()):
        raise ValueError('NPZ kehilangan metadata wajib')
    x = bundle['x']
    if x.ndim != 4 or min(x.shape) < 1 or x.dtype.kind not in 'fiu' or not np.isfinite(x).all():
        raise ValueError('Tensor harus numerik finite [N,H,W,C], tidak kosong')
    for key in required - {'x'}:
        if bundle[key].shape != (len(x),):
            raise ValueError(f'Panjang metadata tidak sesuai: {key}')
    for key, limit in [('latitude', 90), ('longitude', 180)]:
        values = bundle[key].astype(float)
        if not np.isfinite(values).all() or np.any(np.abs(values) > limit):
            raise ValueError(f'Koordinat invalid: {key}')
    for key in ['patch_id', 'group_id']:
        if any(not str(v).strip() for v in bundle[key]):
            raise ValueError(f'{key} kosong')
    if len(set(bundle['patch_id'])) != len(x):
        raise ValueError('patch_id duplikat')
    for value in bundle['observed_at']:
        utc_time(value)
    hashes = [hashlib.sha256(np.asarray(p, dtype='float32').tobytes()).hexdigest() for p in x]
    if len(set(hashes)) != len(hashes):
        raise ValueError('Patch identik: deduplikasi sebelum split')
    return hashes


def read_manifest(path):
    with open(path, newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    required = {"patch_id", "group_id", "label", "array_index"}
    missing = required.difference(rows[0] if rows else {})
    if missing:
        raise ValueError(f"Manifest kehilangan kolom: {sorted(missing)}")
    for row in rows:
        row["label"] = int(row["label"])
        row["array_index"] = int(row["array_index"])
        if row['label'] not in (-1, 0, 1) or row['array_index'] < 0:
            raise ValueError('Label/index invalid')
    groups = {}
    for row in rows:
        split = row.get('split')
        if split not in ('train', 'validation', 'test'):
            raise ValueError('Split invalid')
        if row['group_id'] in groups and groups[row['group_id']] != split:
            raise ValueError('Group bocor antar split')
        groups[row['group_id']] = split
    if len({r['array_index'] for r in rows}) != len(rows) or len({r['patch_id'] for r in rows}) != len(rows):
        raise ValueError('Manifest duplikat')
    return rows


def split_by_group(rows, validation_fraction=0.15, test_fraction=0.15, seed=42):
    """Split rows deterministically; a group cannot cross a split."""
    if not 0 < validation_fraction < 1 or not 0 < test_fraction < 1 or validation_fraction + test_fraction >= 1:
        raise ValueError("Fraction validation/test harus di antara 0 dan 1")
    groups = sorted({row["group_id"] for row in rows})
    if len(groups) < 3:
        raise ValueError("Minimal tiga group diperlukan untuk train/validation/test")
    rng = np.random.default_rng(seed)
    rng.shuffle(groups)
    n_test = max(1, round(len(groups) * test_fraction))
    n_val = max(1, round(len(groups) * validation_fraction))
    if n_test + n_val >= len(groups):
        n_test, n_val = 1, 1
    test_groups = set(groups[:n_test])
    val_groups = set(groups[n_test:n_test + n_val])
    for row in rows:
        group = row["group_id"]
        row["split"] = "test" if group in test_groups else "validation" if group in val_groups else "train"
    return rows


def save_json(path, payload):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")


def binary_metrics(y_true, y_score, threshold=0.5):
    truth, scores = np.asarray(y_true), np.asarray(y_score)
    if truth.ndim != 1 or truth.size == 0 or truth.shape != scores.shape or not np.isin(truth, [0, 1]).all():
        raise ValueError('Label/skor harus vektor biner berukuran sama dan tidak kosong')
    if not np.isfinite(scores).all() or np.any((scores < 0) | (scores > 1)) or not 0 <= threshold <= 1:
        raise ValueError('Skor/threshold invalid')
    y_true = np.asarray(y_true, dtype=np.int32)
    y_pred = (np.asarray(y_score) >= threshold).astype(np.int32)
    tp = int(np.sum((y_true == 1) & (y_pred == 1)))
    tn = int(np.sum((y_true == 0) & (y_pred == 0)))
    fp = int(np.sum((y_true == 0) & (y_pred == 1)))
    fn = int(np.sum((y_true == 1) & (y_pred == 0)))
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    accuracy = (tp + tn) / len(y_true) if len(y_true) else 0.0
    return {"threshold": threshold, "accuracy": accuracy, "precision": precision,
            "recall": recall, "f1": f1, "confusion_matrix": [[tn, fp], [fn, tp]]}