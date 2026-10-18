import tempfile
import unittest
from pathlib import Path

import numpy as np

from training.data import binary_metrics, split_by_group, utc_time, validate_bundle, read_manifest
from training.prepare_dataset import load_firms


class PipelineTest(unittest.TestCase):
    def bundle(self):
        return dict(x=np.arange(64, dtype='float32').reshape(2, 4, 4, 2),
                    patch_id=np.array(['p1', 'p2']), group_id=np.array(['g1', 'g2']),
                    latitude=np.array([-1., -2.]), longitude=np.array([116., 117.]),
                    observed_at=np.array(['2026-01-01T12:00:00+08:00'] * 2))

    def test_timezone_conversion(self):
        self.assertEqual(utc_time('2026-01-01T12:00:00+08:00').hour, 4)
        with self.assertRaises(ValueError):
            utc_time('2026-01-01T12:00:00')

    def test_bundle_valid(self):
        self.assertEqual(len(validate_bundle(self.bundle())), 2)

    def test_bundle_invalid(self):
        for key, value in [('latitude', np.array([91., 0.])),
                           ('group_id', np.array(['g'])),
                           ('patch_id', np.array(['same', 'same']))]:
            bundle = self.bundle(); bundle[key] = value
            with self.assertRaises(ValueError):
                validate_bundle(bundle)
        bundle = self.bundle(); bundle['x'][0, 0, 0, 0] = np.nan
        with self.assertRaises(ValueError):
            validate_bundle(bundle)

    def test_exact_duplicates_rejected(self):
        bundle = self.bundle(); bundle['x'][1] = bundle['x'][0]
        with self.assertRaises(ValueError):
            validate_bundle(bundle)

    def test_metrics_invalid(self):
        for labels, scores in [([], []), ([0, 1], [0.5]), ([2], [0.5]), ([1], [np.nan])]:
            with self.assertRaises(ValueError):
                binary_metrics(labels, scores)

    def test_firms_invalid_not_silently_negative(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'firms.csv'
            path.write_text('latitude,longitude,acq_date,acq_time\ninvalid,116,2026-01-01,1200\n')
            with self.assertRaises(ValueError):
                load_firms(path)

    def test_manifest_leakage_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'manifest.csv'
            path.write_text('patch_id,group_id,label,array_index,split\na,g,0,0,train\nb,g,1,1,test\n')
            with self.assertRaises(ValueError):
                read_manifest(path)

    def test_invalid_split_fractions(self):
        with self.assertRaises(ValueError):
            split_by_group([], 0.6, 0.6)

    def test_group_split_has_no_overlap(self):
        rows = [{"patch_id": str(i), "group_id": f"g{i // 2}", "label": i % 2, "array_index": i}
                for i in range(12)]
        split_by_group(rows)
        groups = {name: {r["group_id"] for r in rows if r["split"] == name}
                  for name in ("train", "validation", "test")}
        self.assertEqual(len(groups["train"] & groups["test"]), 0)
        self.assertEqual(len(groups["train"] & groups["validation"]), 0)

    def test_metrics_are_real_counts(self):
        result = binary_metrics([0, 0, 1, 1], [0.1, 0.8, 0.7, 0.2])
        self.assertEqual(result["confusion_matrix"], [[1, 1], [1, 1]])
        self.assertAlmostEqual(result["f1"], 0.5)


if __name__ == "__main__":
    unittest.main()