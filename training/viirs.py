"""Strict NASA IMG adapter. BT is indexed from the product LUT, never Planck-guessed."""
import argparse
import hashlib
import re
from pathlib import Path

import h5py
import numpy as np

from .data import save_json, sha256, utc_time, validate_bundle

PRODUCTS = {
    'VNP': ('SNPP', '020', '5200'),
    'VJ1': ('NOAA-20', '021', '5201'),
    'VJ2': ('NOAA-21', '021', '5201'),
}
PLATFORM_NAMES = {'VNP': {'Suomi-NPP', 'SNPP'}, 'VJ1': {'JPSS-1', 'NOAA-20', 'JPSS1'},
                  'VJ2': {'JPSS-2', 'NOAA-21', 'JPSS2'}}


def identity(path):
    match = re.fullmatch(r'(VNP|VJ1|VJ2)(02|03)IMG\.A(\d{7})\.(\d{4})\.(\d{3})\.(\d{13})\.nc', Path(path).name)
    if not match:
        raise ValueError('Nama granule NASA IMG tidak kompatibel')
    prefix, level, day, minute, collection, _ = match.groups()
    if collection != PRODUCTS[prefix][1]:
        raise ValueError('Collection belum didukung oleh profil reader')
    return prefix, level, day, minute, collection


def text(value):
    return value.decode() if isinstance(value, bytes) else str(value)


def valid(ds, values):
    attrs = ds.attrs
    if not all(k in attrs for k in ('_FillValue', 'valid_min', 'valid_max')):
        raise ValueError(f'Metadata validitas tidak lengkap: {ds.name}')
    mask = np.isfinite(values) & (values != attrs['_FillValue'])
    mask &= (values >= attrs['valid_min']) & (values <= attrs['valid_max'])
    if 'flag_values' in attrs:
        mask &= ~np.isin(values, attrs['flag_values'])
    return mask


def read_pair(radiance, geolocation):
    rid, gid = identity(radiance), identity(geolocation)
    if rid[1] != '02' or gid[1] != '03' or rid[:1] + rid[2:] != gid[:1] + gid[2:]:
        raise ValueError('Pasangan platform/waktu/collection granule tidak cocok')
    try:
        with h5py.File(radiance, 'r') as rad, h5py.File(geolocation, 'r') as geo:
            start, end = [utc_time(text(rad.attrs[k])) for k in ('time_coverage_start', 'time_coverage_end')]
            for key, expected in [('time_coverage_start', start), ('time_coverage_end', end)]:
                if utc_time(text(geo.attrs[key])) != expected:
                    raise ValueError('Interval akuisisi pasangan tidak cocok')
            if not 0 < (end - start).total_seconds() <= 420:
                raise ValueError('Interval granule invalid')
            if start.strftime('%Y%j') != rid[2] or start.strftime('%H%M') != rid[3]:
                raise ValueError('Waktu metadata berbeda dari identitas file')
            if text(rad.attrs['platform']) != text(geo.attrs['platform']):
                raise ValueError('Metadata platform berbeda')
            if text(rad.attrs['platform']) not in PLATFORM_NAMES[rid[0]]:
                raise ValueError('Platform metadata tidak sesuai produk')
            coords = []
            mask = None
            for name, unit in [('latitude', 'degrees_north'), ('longitude', 'degrees_east')]:
                ds = geo[f'geolocation_data/{name}']
                if text(ds.attrs['units']) != unit:
                    raise ValueError('Unit geolokasi tidak kompatibel')
                raw = ds[:]
                good = valid(ds, raw)
                values = raw * ds.attrs.get('scale_factor', 1) + ds.attrs.get('add_offset', 0)
                good &= np.abs(values) <= (90 if name == 'latitude' else 180)
                mask = good if mask is None else mask & good
                coords.append(values)
            shape = coords[0].shape
            if len(shape) != 2 or coords[1].shape != shape:
                raise ValueError('Bentuk geolokasi invalid')
            qa = geo['geolocation_data/quality_flag'][:]
            if qa.shape != shape:
                raise ValueError('Bentuk QA geolokasi invalid')
            mask &= qa == 0
            channels, calibration = [], {}
            for band in ('I04', 'I05'):
                ds = rad[f'observation_data/{band}']
                raw = ds[:]
                qa = rad[f'observation_data/{band}_quality_flags'][:]
                if raw.shape != shape or qa.shape != shape or raw.dtype.kind != 'u':
                    raise ValueError('Bentuk/dtype kanal tidak kompatibel')
                lut = rad[f'observation_data/{band}_brightness_temperature_lut']
                if lut.shape != (65536,) or text(lut.attrs['units']) not in ('Kelvin', 'K'):
                    raise ValueError('LUT BT tidak kompatibel')
                if np.any(raw >= len(lut)):
                    raise ValueError('Indeks LUT di luar batas')
                bt = lut[:][raw]
                mask &= valid(ds, raw) & (qa == 0) & valid(lut, bt)
                channels.append(bt)
                calibration[band] = {k: np.asarray(v).tolist() if not isinstance(v, (str, bytes)) else text(v)
                                     for k, v in ds.attrs.items() if k in ('scale_factor', 'add_offset', 'radiance_scale_factor', 'radiance_add_offset', 'units', 'radiance_units')}
            return np.stack(channels, axis=-1).astype('float32'), coords, mask, {
                'platform': PRODUCTS[rid[0]][0], 'collection': rid[4],
                'products': [rid[0] + '02IMG', rid[0] + '03IMG'],
                'active_fire_reference_product': rid[0] + '14IMG',
                'start': start.isoformat(), 'end': end.isoformat(),
                'observed_at': (start + (end - start) / 2).isoformat(),
                'time_method': 'granule midpoint, not per-pixel scan time',
                'channels': ['I04', 'I05'], 'units': 'Kelvin',
                'transform': 'product brightness_temperature_lut[raw unsigned SI]; no normalization',
                'calibration_attributes': calibration, 'qa': 'all pixel quality flags must equal zero',
                'cloud_mask': 'not available from L1B; no clear-sky/negative assertion',
                'sources': [{'name': Path(p).name, 'sha256': sha256(p)} for p in (radiance, geolocation)],
            }
    except (OSError, KeyError) as exc:
        raise ValueError('File rusak atau struktur/metadata VIIRS wajib tidak tersedia') from exc


def extract(radiance, geolocation, bbox, size=32, max_patches=128):
    west, south, east, north = bbox
    if not np.isfinite(bbox).all() or not (-180 <= west < east <= 180 and -90 <= south < north <= 90):
        raise ValueError('BBox invalid')
    if size < 2 or max_patches < 1:
        raise ValueError('Ukuran/jumlah patch invalid')
    x, (lat, lon), mask, meta = read_pair(radiance, geolocation)
    mask &= (lat >= south) & (lat <= north) & (lon >= west) & (lon <= east)
    patches, rows, seen = [], [], set()
    for r in range(0, x.shape[0] - size + 1, size):
        for c in range(0, x.shape[1] - size + 1, size):
            if len(patches) >= max_patches or not mask[r:r+size, c:c+size].all():
                continue
            patch = x[r:r+size, c:c+size]
            digest = hashlib.sha256(patch.tobytes()).hexdigest()
            if digest in seen:
                continue
            seen.add(digest)
            patches.append(patch)
            rows.append({'patch_id': f'{Path(radiance).stem}:{r}:{c}',
                         'group_id': meta['start'][:10],
                         'latitude': float(lat[r+size//2, c+size//2]),
                         'longitude': float(lon[r+size//2, c+size//2]),
                         'observed_at': meta['observed_at'], 'row': r, 'column': c,
                         'sha256': digest, 'label_state': 'uncertain'})
    if not patches:
        raise ValueError('Tidak ada patch sepenuhnya valid di bbox')
    bundle = {'x': np.stack(patches)}
    for key in ('patch_id', 'group_id', 'latitude', 'longitude', 'observed_at'):
        bundle[key] = np.array([row[key] for row in rows])
    validate_bundle(bundle)
    meta.update(bbox=list(bbox), patch_size=size, patches=rows,
                grouping='UTC acquisition date; spatial holdout still required',
                overlap='non-overlapping pixel windows within this granule only')
    return bundle, meta


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--radiance', required=True)
    parser.add_argument('--geolocation', required=True)
    parser.add_argument('--bbox', nargs=4, type=float, default=[116, -2, 118, 1])
    parser.add_argument('--size', type=int, default=32)
    parser.add_argument('--max-patches', type=int, default=128)
    parser.add_argument('--out', required=True)
    args = parser.parse_args()
    out = Path(args.out)
    if out.suffix != '.npz' or out.exists() or out.with_suffix('.json').exists():
        raise ValueError('Output harus NPZ baru, tidak menimpa artefak')
    bundle, meta = extract(args.radiance, args.geolocation, args.bbox, args.size, args.max_patches)
    out.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(out, **bundle)
    meta['bundle_sha256'] = sha256(out)
    save_json(out.with_suffix('.json'), meta)


if __name__ == '__main__':
    main()