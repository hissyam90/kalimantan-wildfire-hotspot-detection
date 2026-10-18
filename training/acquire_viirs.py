"""Bounded CMR discovery and same-host LAADS download; dry-run by default."""
import argparse
import json
import os
import traceback
from http.client import HTTPException
from http.cookiejar import CookieJar
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlencode, urlparse, urljoin
from urllib.request import Request, build_opener, HTTPRedirectHandler, HTTPCookieProcessor, urlopen
from urllib.error import HTTPError, URLError

import h5py

from .data import save_json, sha256, utc_time
from .viirs import PRODUCTS, identity


class AcquisitionError(ValueError):
    """Safe, user-facing acquisition failure with a pipeline stage."""

    def __init__(self, stage, message, status=None, partial=None):
        self.stage, self.status, self.partial = stage, status, partial
        detail = f'{stage}: {message}'
        if status is not None:
            detail += f' (HTTP {status})'
        if partial:
            detail += f'; partial={partial}'
        super().__init__(detail)


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise AcquisitionError('redirect', 'redirect ditolak; token tidak diteruskan', code)


CMR_VERSIONS = {'VNP': '2', 'VJ1': '2.1', 'VJ2': '2.1'}
LAADS = 'https://ladsweb.modaps.eosdis.nasa.gov'
API_V2 = LAADS + '/api/v2'


EDL_HOST = 'urs.earthdata.nasa.gov'


class SameHostRedirect(HTTPRedirectHandler):
    """Follow the documented LAADS↔EDL GET flow without leaking Bearer."""

    def __init__(self, token):
        super().__init__()
        self.token = token

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        target = urlparse(newurl)
        source = urlparse(req.full_url)
        allowed = {urlparse(LAADS).netloc, EDL_HOST}
        if (target.scheme != 'https' or target.netloc not in allowed
                or source.scheme != 'https' or source.netloc not in allowed
                or target.fragment or req.get_method() != 'GET'):
            category = 'EDL session diperlukan' if target.hostname == EDL_HOST else 'target di luar origin LAADS/EDL'
            raise AcquisitionError('authentication redirect', category + '; redirect ditolak, token tidak diteruskan', code)
        hops = getattr(req, '_laads_hops', 0)
        if hops >= 5:
            raise AcquisitionError('authentication redirect', 'batas 5 redirect internal tercapai', code)
        redirected = super().redirect_request(req, fp, code, msg, headers, newurl)
        if redirected is None:
            raise AcquisitionError('authentication redirect', 'metode redirect tidak didukung', code)
        # urllib may copy request headers across a redirect. Never send the
        # LAADS bearer to EDL or any other origin; CookieJar carries only the
        # domain-scoped session state established by the documented flow.
        redirected.headers.pop('Authorization', None)
        redirected.unredirected_hdrs.pop('Authorization', None)
        if target.netloc == urlparse(LAADS).netloc:
            redirected.add_header('Authorization', 'Bearer ' + self.token)
            redirected.add_header('X-Requested-With', 'XMLHttpRequest')
        redirected._laads_hops = hops + 1
        return redirected


def data_opener(token):
    # CookieJar applies domain/path/secure scoping; no cookies are persisted or logged.
    return build_opener(SameHostRedirect(token), HTTPCookieProcessor(CookieJar()))


def authorize_data(items, token, opener):
    """Check GET response headers for EVERY file without reading payload bodies.

    Servers may send bytes into network buffers; this is not a zero-wire-byte probe.
    Downloads repeat the checks because authorization can expire after this gate.
    """
    for item in items:
        request = Request(api_url(item, 'archives'), headers=auth_headers(token))
        with _open(request, 'data authorization', opener, 120) as response:
            if response.status != 200 or 'text/html' in response.headers.get('Content-Type', '').lower():
                raise AcquisitionError('data authorization', 'respons bukan file data', response.status)
            length = response.headers.get('Content-Length')
            if length is not None and (not length.isdecimal() or int(length) != item['preflight_bytes']):
                raise AcquisitionError('data authorization', 'Content-Length berbeda dari metadata')


class ArchiveLinks(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = set()

    def handle_starttag(self, tag, attrs):
        if tag == 'a':
            href = dict(attrs).get('href')
            if href:
                self.links.add(href)


def archive_names(directory):
    with urlopen(directory, timeout=60) as response:
        parser = ArchiveLinks()
        parser.feed(response.read().decode('utf-8'))
    return {urljoin(directory, href) for href in parser.links}


def discover(prefix, start, end, bbox, max_pairs=1, diagnostics=None):
    if prefix not in PRODUCTS or not 1 <= max_pairs <= 2:
        raise ValueError('Platform/jumlah pasangan invalid (maksimal 2)')
    if not 0 < (utc_time(end) - utc_time(start)).total_seconds() <= 86400:
        raise ValueError('Pilot dibatasi maksimal 24 jam')
    west, south, east, north = bbox
    if not (108 <= west < east <= 119.5 and -4.5 <= south < north <= 7.5):
        raise ValueError('Pilot dibatasi bbox Borneo')
    report = diagnostics if diagnostics is not None else {}
    report.update(platform=prefix, start=start, end=end, bbox=list(bbox),
                  cmr_version=CMR_VERSIONS[prefix], filename_collection=PRODUCTS[prefix][1],
                  products={}, pairing_rejections={})
    found, archives = [], {}
    for level in ('02', '03'):
        product = prefix + level + 'IMG'
        params = {'short_name': product, 'version': CMR_VERSIONS[prefix], 'provider': 'LAADS',
                  'temporal': start + ',' + end, 'bounding_box': ','.join(map(str, bbox)),
                  'page_size': 100, 'sort_key': 'start_date'}
        entries = []
        detail = report['products'][product] = {'query': dict(params), 'pages': 0}
        # Bounded pagination; incomplete searches must not silently select a pair.
        for page in range(1, 11):
            query = urlencode(dict(params, page_num=page))
            with urlopen('https://cmr.earthdata.nasa.gov/search/granules.json?' + query, timeout=60) as response:
                batch = json.load(response)['feed']['entry']
                detail['cmr_hits'] = int(response.headers.get('CMR-Hits', len(batch)))
            entries.extend(batch)
            detail['pages'] = page
            if len(batch) < 100:
                break
        else:
            raise ValueError('Batas pagination CMR tercapai; pencarian tidak lengkap')
        rejected, ignored_links = Counter(), Counter()
        files = {}
        for entry in entries:
            try:
                name = entry['producer_granule_id']
                ident = identity(name)
                if name != Path(name).name or ident[:2] != (prefix, level):
                    raise ValueError('product')
            except (KeyError, ValueError):
                rejected['invalid_product_filename_or_collection'] += 1
                continue
            try:
                t0, t1 = utc_time(entry['time_start']), utc_time(entry['time_end'])
                if (t0.strftime('%Y%j'), t0.strftime('%H%M')) != ident[2:4]:
                    raise ValueError('time')
                if not 0 < (t1 - t0).total_seconds() <= 420:
                    raise ValueError('duration')
                if not (t0 < utc_time(end) and t1 > utc_time(start)):
                    raise ValueError('outside requested interval')
            except (KeyError, ValueError):
                rejected['invalid_or_outside_acquisition_interval'] += 1
                continue
            data_link = False
            for link in entry.get('links', []):
                url = link.get('href', '')
                parsed = urlparse(url)
                if link.get('inherited') or not link.get('rel', '').endswith('/data#'):
                    ignored_links['inherited_or_not_data'] += 1
                    continue
                if (parsed.scheme != 'https' or parsed.netloc not in (
                        'ladsweb.modaps.eosdis.nasa.gov', 'data.laadsdaac.earthdatacloud.nasa.gov')
                        or parsed.query or parsed.fragment or Path(parsed.path).name != name):
                    ignored_links['untrusted_or_nonmatching_data_url'] += 1
                    continue
                data_link = True
            if not data_link:
                rejected['no_matching_official_data_link'] += 1
                continue
            directory = f'{LAADS}/archive/allData/{PRODUCTS[prefix][2]}/{product}/{ident[2][:4]}/{ident[2][4:]}/'
            if directory not in archives:
                archives[directory] = archive_names(directory)
            url = directory + name
            if url not in archives[directory]:
                rejected['not_in_laads_archive_listing'] += 1
                continue
            key = ident[:1] + ident[2:]
            item = {'url': url, 'name': name, 'cmr_id': entry['id'],
                    'collection_concept_id': entry.get('collection_concept_id'),
                    'cmr_size_mb': entry.get('granule_size'),
                    'time_start': t0.isoformat(), 'time_end': t1.isoformat(),
                    'verification': 'CMR spatial query + identity/time + exact LAADS archive listing'}
            if key in files:
                rejected['duplicate_acquisition_revision'] += 1
                # Production timestamp is a revision, NOT part of acquisition pairing.
                if name < files[key]['name']:
                    continue
            files[key] = item
        detail.update(candidates=len(entries), accepted=len(files), rejected=dict(rejected),
                      ignored_links=dict(ignored_links), accepted_names=[v['name'] for v in files.values()])
        found.append(files)
    pairs = []
    reasons = Counter()
    for k in sorted(found[0].keys() | found[1].keys()):
        if k not in found[0] or k not in found[1]:
            reasons['missing_counterpart'] += 1
            continue
        a, b = found[0][k], found[1][k]
        if (a['time_start'], a['time_end']) != (b['time_start'], b['time_end']):
            reasons['metadata_interval_mismatch'] += 1
            continue
        pairs.append([a, b])
    report.update(pairs_before_limit=len(pairs), pairs_selected=min(len(pairs), max_pairs),
                  pairing_rejections=dict(reasons), selection='earliest acquisition, not label-based')
    return pairs[:max_pairs]


def api_path(item):
    parsed = urlparse(item['url'])
    if (parsed.scheme != 'https' or parsed.netloc != urlparse(LAADS).netloc
            or parsed.query or parsed.fragment or not parsed.path.startswith('/archive/allData/')
            or any(part in ('.', '..') for part in parsed.path.split('/'))):
        raise AcquisitionError('preflight', 'URL bukan arsip LAADS resmi')
    return parsed.path[len('/archive/'):]


def api_url(item, kind):
    path = api_path(item)
    if kind not in ('details', 'archives'):
        raise ValueError('API v2 kind invalid')
    return f'{API_V2}/content/{kind}/{path}'


def auth_headers(token):
    if not token:
        raise AcquisitionError('authentication', 'EARTHDATA_TOKEN belum tersedia')
    if not token.isascii() or any(c.isspace() or ord(c) < 33 or ord(c) == 127 for c in token):
        raise AcquisitionError('token validation', 'token mengandung whitespace/karakter header invalid; request belum dikirim')
    return {'Authorization': 'Bearer ' + token, 'X-Requested-With': 'XMLHttpRequest'}


def _open(request, stage, opener, timeout=60):
    try:
        return opener.open(request, timeout=timeout)
    except HTTPError as exc:
        raise AcquisitionError(stage, 'respons HTTP tidak berhasil', exc.code) from None
    except URLError:
        raise AcquisitionError(stage, 'koneksi layanan gagal') from None


def preflight(items, token, budget):
    """Inspect ALL files via API-v2 metadata; not proof of data authorization."""
    if not token:
        raise AcquisitionError('authentication', 'EARTHDATA_TOKEN belum tersedia')
    opener = build_opener(NoRedirect())
    sizes = []
    for item in items:
        # Directory details is a JSON listing (verified live); a file-level
        # details URL can redirect to EDL instead. Match the exact revision.
        request = Request(api_url(item, 'details').rsplit('/', 1)[0] + '/', headers=auth_headers(token))
        with _open(request, 'metadata preflight', opener) as response:
            if response.status != 200 or 'application/json' not in response.headers.get('Content-Type', '').lower():
                raise AcquisitionError('metadata preflight', 'respons metadata invalid', response.status)
            try:
                payload = response.read(1024 * 1024 + 1)
                if len(payload) > 1024 * 1024:
                    raise ValueError()
                listing = json.loads(payload)['content']
                matches = [entry for entry in listing
                           if entry['name'] == Path(urlparse(item['url']).path).name]
                if len(matches) != 1:
                    raise ValueError()
                metadata = matches[0]
                size = metadata['size']
                status = metadata['status']
                if (type(size) is not int or metadata['resourceType'] != 'File'
                        or metadata['name'] != Path(urlparse(item['url']).path).name
                        or metadata['downloadsLink'] != api_url(item, 'archives')):
                    raise ValueError()
            except (ValueError, TypeError, KeyError, json.JSONDecodeError):
                raise AcquisitionError('metadata preflight', 'metadata file tidak valid') from None
            if size <= 0 or status != 'Online':
                raise AcquisitionError('metadata preflight', 'ukuran/status file invalid')
            item['preflight_bytes'] = size
            sizes.append(size)
    if sum(sizes) > budget:
        raise AcquisitionError('budget preflight', 'total ukuran pasangan melebihi budget')
    return sizes


def download(item, directory, token, remaining, opener=None):
    parsed = urlparse(item['url'])
    api_path(item)
    target = directory / Path(parsed.path).name
    partial = target.with_suffix('.nc.partial')
    if target.exists() or partial.exists():
        raise AcquisitionError('download setup', 'file target atau partial sudah ada', partial=str(partial) if partial.exists() else None)
    opener = opener if opener is not None else data_opener(token)
    request = Request(api_url(item, 'archives'), headers=auth_headers(token))
    count = 0
    try:
        with _open(request, 'download', opener, 120) as response:
            if response.status != 200 or 'text/html' in response.headers.get('Content-Type', '').lower():
                raise AcquisitionError('download', 'respons bukan file data', response.status, str(partial))
            expected = item.get('preflight_bytes')
            if type(expected) is not int or not 0 < expected <= remaining:
                raise AcquisitionError('download budget', 'ukuran metadata tidak diketahui atau melebihi budget', partial=str(partial))
            length = response.headers.get('Content-Length')
            if length is not None and (not length.isdecimal() or int(length) != expected):
                raise AcquisitionError('download headers', 'Content-Length berbeda dari metadata')
            with partial.open('xb') as output:
                while True:
                    chunk = response.read(min(1024 * 1024, expected - count + 1))
                    if not chunk:
                        break
                    count += len(chunk)
                    if count > expected:
                        raise AcquisitionError('download', 'unduhan melebihi ukuran metadata', partial=str(partial))
                    output.write(chunk)
    except AcquisitionError:
        raise
    except (OSError, ValueError, HTTPException):
        raise AcquisitionError('download', 'penulisan atau pembacaan file gagal', partial=str(partial)) from None
    if count != item['preflight_bytes']:
        raise AcquisitionError('download integrity', 'ukuran aktual berbeda dari metadata', partial=str(partial))
    if not h5py.is_hdf5(partial):
        raise AcquisitionError('download integrity', 'payload bukan HDF5/NetCDF4', partial=str(partial))
    try:
        with h5py.File(partial, 'r') as handle:
            if 'time_coverage_start' not in handle.attrs:
                raise AcquisitionError('download integrity', 'metadata granule hilang', partial=str(partial))
        partial.rename(target)
    except OSError:
        raise AcquisitionError('download integrity', 'HDF5 open atau finalisasi file gagal', partial=str(partial)) from None
    return dict(item, bytes=count, sha256=sha256(target))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--platform', choices=PRODUCTS, default='VJ2')
    parser.add_argument('--start', required=True)
    parser.add_argument('--end', required=True)
    parser.add_argument('--bbox', nargs=4, type=float, default=[116, -2, 118, 1])
    parser.add_argument('--max-pairs', type=int, default=1)
    parser.add_argument('--max-mib', type=int, default=512)
    parser.add_argument('--download', action='store_true', help='Default hanya discovery/dry-run')
    parser.add_argument('--preflight-only', action='store_true', help='Metadata kedua file tanpa download payload')
    parser.add_argument('--debug', action='store_true', help='Lokasi frame saja, tanpa source/locals/exception mentah')
    parser.add_argument('--expect-name', action='append', help='Nama granule wajib; ulangi untuk mengunci pasangan')
    parser.add_argument('--known-noaa20-pair', action='store_true', help='Gunakan pasangan NOAA-20 2026290/0518 yang sudah ditemukan, tanpa discovery')
    args = parser.parse_args()
    if not 1 <= args.max_mib <= 1024:
        raise ValueError('Budget pilot harus 1..1024 MiB')
    diagnostics = {}
    if args.known_noaa20_pair:
        if (args.platform != 'VJ1' or args.start != '2026-10-17T05:18:00Z'
                or args.end != '2026-10-17T05:24:00Z' or args.bbox != [116, -2, 118, 1]
                or args.max_pairs != 1 or args.max_mib > 512):
            raise AcquisitionError('selection', 'parameter pasangan NOAA-20 terkunci tidak cocok')
        names = ('VJ102IMG.A2026290.0518.021.2026290112831.nc',
                 'VJ103IMG.A2026290.0518.021.2026290103852.nc')
        pairs = [[{'name': name, 'url': f'{LAADS}/archive/allData/5201/{name.split(".")[0]}/2026/290/{name}'}
                  for name in names]]
        diagnostics['selection'] = 'previously discovered fixed NOAA-20 pair; metadata revalidated'
    else:
        pairs = discover(args.platform, args.start, args.end, args.bbox, args.max_pairs, diagnostics)
    if args.expect_name and sorted(args.expect_name) != sorted(item['name'] for pair in pairs for item in pair):
        raise AcquisitionError('selection', 'pasangan discovery tidak sama dengan nama yang dikunci')
    print(json.dumps({'dry_run': not args.download, 'diagnostics': diagnostics, 'pairs': pairs,
                      'download_gate': {'token_available': bool(os.environ.get('EARTHDATA_TOKEN')),
                                        'budget_bytes': args.max_mib * 1024**2,
                                        'metadata_preflight': 'not yet performed',
                                        'data_authorization': 'not yet performed'}}, indent=2))
    if not (args.download or args.preflight_only) or not pairs:
        return
    token = os.environ.get('EARTHDATA_TOKEN')
    if not token:
        raise AcquisitionError('authentication setup', 'EARTHDATA_TOKEN belum tersedia; request autentikasi belum dikirim')
    items = [item for pair in pairs for item in pair]
    directory = Path(__file__).resolve().parents[1] / 'data' / 'raw'
    for item in items:
        target = directory / item['name']
        partial = target.with_suffix('.nc.partial')
        if target.exists() or partial.exists():
            raise AcquisitionError('local file check', 'target/partial sudah ada; tidak dihapus atau ditimpa',
                                   partial=str(partial) if partial.exists() else None)
    sizes = preflight(items, token, args.max_mib * 1024**2)
    for item, size in zip(items, sizes):
        item['preflight_bytes'] = size
    print(json.dumps({'metadata_preflight': 'passed', 'sizes_bytes': sizes,
                      'total_bytes': sum(sizes), 'data_authorization': 'not yet performed'}))
    opener = data_opener(token)
    authorize_data(items, token, opener)
    print(json.dumps({'data_authorization': 'GET headers accepted for both files; bodies not read'}))
    if args.preflight_only:
        return
    directory.mkdir(parents=True, exist_ok=True)
    remaining, results = args.max_mib * 1024**2, []
    for pair in pairs:
        for item in pair:
            result = download(item, directory, token, remaining, opener)
            remaining -= result['bytes']
            results.append(result)
    save_json(directory / 'acquisition_manifest.json', {
        'files': results, 'bbox': args.bbox, 'start': args.start, 'end': args.end,
        'integrity': 'API-v2 metadata size, downloaded byte count, HDF5 signature/open, local SHA256; not provider checksum verification'})


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        import sys
        if '--debug' in sys.argv:
            # Only numeric line locations; never render source, locals, URLs or remote messages.
            for frame in traceback.extract_tb(exc.__traceback__):
                if Path(frame.filename).resolve() == Path(__file__).resolve():
                    print(f'acquire_viirs.py:{frame.lineno}', file=sys.stderr)
        # Never print a traceback: urllib exceptions can contain URLs/headers.
        if isinstance(exc, AcquisitionError):
            raise SystemExit('Akuisisi gagal: ' + str(exc)) from None
        frames = [f for f in traceback.extract_tb(exc.__traceback__)
                  if Path(f.filename).resolve() == Path(__file__).resolve()]
        location = f'acquire_viirs.py:{frames[-1].lineno}' if frames else 'entrypoint'
        raise SystemExit('Akuisisi gagal di ' + location + ': ' + type(exc).__name__
                         + '; detail eksternal disembunyikan demi keamanan') from None