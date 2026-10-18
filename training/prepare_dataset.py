"""Create a reproducible manifest by joining patch metadata with FIRMS observations.

Input patch NPZ contract:
  x: float/integer array [N,H,W,C]
  patch_id, group_id, latitude, longitude, observed_at: arrays of length N

The FIRMS CSV must contain latitude, longitude, acq_date and acq_time.
"""

import argparse
import csv
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

if __package__:
    from .data import save_json, split_by_group, validate_bundle, utc_time, sha256
else:
    from data import save_json, split_by_group, validate_bundle, utc_time, sha256


def parse_time(date, time):
    value = str(time).zfill(4)
    return datetime.strptime(f"{date} {value[:2]}:{value[2:]}", "%Y-%m-%d %H:%M").replace(tzinfo=timezone.utc)


def distance_km(lat1, lon1, lat2, lon2):
    lat1, lon1, lat2, lon2 = map(np.radians, [lat1, lon1, lat2, lon2])
    a = np.sin((lat2 - lat1) / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin((lon2 - lon1) / 2) ** 2
    return float(6371.0088 * 2 * np.arcsin(np.sqrt(a)))


def load_firms(path):
    with open(path, newline="", encoding="utf-8-sig") as handle:
        rows = list(csv.DictReader(handle))
    result = []
    for row in rows:
        try:
            result.append((float(row["latitude"]), float(row["longitude"]),
                           parse_time(row["acq_date"], row["acq_time"])))
        except (KeyError, TypeError, ValueError) as exc:
            raise ValueError('Baris FIRMS invalid; tidak boleh dilewati diam-diam') from exc
    if not result or any(not np.isfinite([lat, lon]).all() or abs(lat) > 90 or abs(lon) > 180 for lat, lon, _ in result):
        raise ValueError('FIRMS kosong atau koordinat invalid')
    return result


def reference_label(lat, lon, observed, firms, distance=1.5, hours=3.0):
    """Positive reference match or uncertain; absence is never confirmed negative."""
    if not np.isfinite([lat, lon, distance, hours]).all() or distance <= 0 or hours <= 0:
        raise ValueError('Koordinat/toleransi invalid')
    return 1 if any(distance_km(lat, lon, f_lat, f_lon) <= distance and
                    abs((observed - f_time).total_seconds()) <= hours * 3600
                    for f_lat, f_lon, f_time in firms) else -1


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--patches", required=True, help="NPZ patch bundle")
    parser.add_argument("--firms", required=True, help="FIRMS CSV yang diperoleh secara sah")
    parser.add_argument("--out", required=True, help="Direktori output dataset")
    parser.add_argument("--distance-km", type=float, default=1.5)
    parser.add_argument("--hours", type=float, default=3.0)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument('--allow-unconfirmed-negatives', action='store_true',
                        help='Eksperimen weak-label saja; default sampel tidak pasti diabaikan')
    args = parser.parse_args()

    bundle = np.load(args.patches, allow_pickle=False)
    checksums = validate_bundle(bundle)
    if not np.isfinite([args.distance_km, args.hours]).all() or min(args.distance_km, args.hours) <= 0:
        raise ValueError('Toleransi harus positif finite')
    required = {"x", "patch_id", "group_id", "latitude", "longitude", "observed_at"}
    missing = required.difference(bundle.files)
    if missing:
        raise ValueError(f"NPZ kehilangan array: {sorted(missing)}")
    x = bundle["x"]
    if x.ndim != 4 or x.shape[0] == 0:
        raise ValueError("x harus berbentuk [N,H,W,C] dan tidak kosong")
    firms = load_firms(args.firms)
    rows = []
    for index in range(len(x)):
        observed = utc_time(bundle["observed_at"][index])
        lat, lon = float(bundle["latitude"][index]), float(bundle["longitude"][index])
        match = reference_label(lat, lon, observed, firms, args.distance_km, args.hours) == 1
        rows.append({"patch_id": str(bundle["patch_id"][index]), "group_id": str(bundle["group_id"][index]),
                     "array_index": index, "latitude": lat, "longitude": lon,
                     "observed_at": observed.isoformat(),
                     "checksum": checksums[index],
                     "label": 1 if match else (0 if args.allow_unconfirmed_negatives else -1),
                     "label_source": "FIRMS_spatiotemporal_match" if match else
                     ("unconfirmed_negative" if args.allow_unconfirmed_negatives else "uncertain")})
    if not any(row["label"] == 1 for row in rows):
        raise ValueError("Tidak ada patch positif yang cocok dengan FIRMS")
    split_by_group(rows, seed=args.seed)
    provenance_path = Path(args.patches).with_suffix('.json')
    provenance = None
    if provenance_path.exists():
        provenance = json.loads(provenance_path.read_text(encoding='utf-8'))
        if provenance.get('bundle_sha256') != sha256(args.patches):
            raise ValueError('Checksum sidecar provenance tidak cocok dengan NPZ')
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    np.save(out / "patches.npy", x.astype("float32"))
    with open(out / "manifest.csv", "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=rows[0].keys())
        writer.writeheader(); writer.writerows(rows)
    save_json(out / "dataset_metadata.json", {
        "input": "user-supplied patch bundle; provenance not independently verified",
        "swath_provenance": provenance,
        "patch_bundle_sha256": sha256(args.patches),
        "firms_sha256": sha256(args.firms),
        "seed": args.seed,
        "allow_unconfirmed_negatives": args.allow_unconfirmed_negatives,
        "label_reference": "NASA FIRMS active-fire observations",
        "distance_tolerance_km": args.distance_km,
        "time_tolerance_hours": args.hours,
        "negative_label_warning": "unconfirmed_negative is absence of a matched FIRMS detection, not proof of no fire",
        "shape": list(x.shape), "dtype": "float32"
    })


if __name__ == "__main__":
    main()