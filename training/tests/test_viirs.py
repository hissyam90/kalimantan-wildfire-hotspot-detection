"""Synthetic HDF5 fixtures, NOT evidence of successful NASA granule ingestion."""
import tempfile
import unittest
from pathlib import Path

import h5py
import numpy as np

from training.viirs import extract, read_pair, identity
from training.acquire_viirs import discover, download
from training.data import validate_bundle
from training.data import utc_time
from training.prepare_dataset import reference_label


class SwathTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def pair(self, prefix='VNP'):
        collection = '020' if prefix == 'VNP' else '021'
        paths = [self.root / f'{prefix}{level}IMG.A2026290.0600.{collection}.2026290120000.nc' for level in ('02', '03')]
        for path in paths:
            with h5py.File(path, 'w') as f:
                f.attrs.update(platform={'VNP': 'Suomi-NPP', 'VJ1': 'JPSS-1', 'VJ2': 'JPSS-2'}[prefix], time_coverage_start='2026-10-17T06:00:00Z', time_coverage_end='2026-10-17T06:06:00Z')
        def dataset(f, name, data, low, high, unit='1', fill=65535):
            ds = f.create_dataset(name, data=data)
            ds.attrs.update(valid_min=low, valid_max=high, _FillValue=fill, units=unit)
        with h5py.File(paths[0], 'a') as f:
            for band in ('I04', 'I05'):
                dataset(f, 'observation_data/' + band, np.arange(64, dtype='uint16').reshape(8, 8), 0, 65527)
                f.create_dataset(f'observation_data/{band}_quality_flags', data=np.zeros((8, 8), dtype='uint16'))
                dataset(f, f'observation_data/{band}_brightness_temperature_lut', np.arange(65536, dtype='float32') * .001 + 250, 250, 320, 'Kelvin', -999.9)
        with h5py.File(paths[1], 'a') as f:
            dataset(f, 'geolocation_data/latitude', np.full((8, 8), -1.), -90, 90, 'degrees_north', -999.9)
            dataset(f, 'geolocation_data/longitude', np.full((8, 8), 117.), -180, 180, 'degrees_east', -999.9)
            f.create_dataset('geolocation_data/quality_flag', data=np.zeros((8, 8), dtype='uint8'))
        return paths

    def test_platforms_lut_and_contract(self):
        for prefix in ('VNP', 'VJ1', 'VJ2'):
            paths = self.pair(prefix)
            bundle, meta = extract(*paths, [116, -2, 118, 1], size=4)
            self.assertEqual(bundle['x'].shape, (4, 4, 4, 2))
            self.assertAlmostEqual(float(bundle['x'][0, 0, 1, 0]), 250.001, places=4)
            self.assertEqual(len(validate_bundle(bundle)), 4)
            self.assertEqual(len(set(bundle['group_id'])), 1)
            self.assertEqual(meta['units'], 'Kelvin')

    def test_fill_quality_and_bbox(self):
        paths = self.pair()
        with h5py.File(paths[0], 'a') as f:
            f['observation_data/I04'][0, 0] = 65535
            f['observation_data/I05_quality_flags'][4, 4] = 4
        bundle, _ = extract(*paths, [116, -2, 118, 1], size=4)
        self.assertEqual(len(bundle['x']), 2)
        with self.assertRaises(ValueError):
            extract(*paths, [110, -2, 111, 1], size=4)

    def test_mismatched_pair(self):
        a = self.pair('VNP'); b = self.pair('VJ1')
        with self.assertRaises(ValueError):
            read_pair(a[0], b[1])

    def test_metadata_and_corruption(self):
        paths = self.pair()
        with h5py.File(paths[1], 'a') as f:
            f['geolocation_data/latitude'].attrs['units'] = 'radians'
        with self.assertRaises(ValueError):
            read_pair(*paths)
        paths[0].write_bytes(b'not hdf5')
        with self.assertRaises(ValueError):
            read_pair(*paths)

    def test_missing_lut_rejected(self):
        paths = self.pair()
        with h5py.File(paths[0], 'a') as f:
            f.move('observation_data/I04_brightness_temperature_lut', 'other')
        with self.assertRaises(ValueError):
            read_pair(*paths)

    def test_limits_and_url_security(self):
        with self.assertRaises(ValueError):
            discover('VJ2', '2026-10-17T00:00:00Z', '2026-10-20T00:00:00Z', [116, -2, 118, 1])
        with self.assertRaises(ValueError):
            download({'url': 'https://example.com/a.nc'}, self.root, 'fixture-token', 100)
        with self.assertRaises(ValueError):
            identity('VJ202IMG.A2026290.0600.999.2026290120000.nc')

    def test_reference_uncertain_and_tolerance(self):
        time = utc_time('2026-10-17T06:03:00Z')
        firms = [(-1., 117., time)]
        self.assertEqual(reference_label(-1., 117., time, firms), 1)
        self.assertEqual(reference_label(-2., 117., time, firms), -1)
        self.assertEqual(reference_label(-1., 117., utc_time('2026-10-18T06:03:00Z'), firms), -1)
        self.assertEqual(reference_label(-1., 117., time, []), -1)


if __name__ == '__main__':
    unittest.main()