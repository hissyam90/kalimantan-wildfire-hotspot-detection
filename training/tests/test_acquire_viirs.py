"""Offline catalog/HTTP fixtures; no NASA payload download or live authentication."""
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch, MagicMock
import h5py
from urllib.parse import parse_qs, urlparse
from urllib.error import HTTPError
from urllib.request import Request

from training.acquire_viirs import (discover, archive_names, preflight, download,
                                    NoRedirect, SameHostRedirect, LAADS, AcquisitionError)


class DiscoveryTest(unittest.TestCase):
    def entry(self, level='02', prefix='VJ1', production='2026290112831'):
        name = f'{prefix}{level}IMG.A2026290.0518.021.{production}.nc'
        return {'id': 'fixture-' + level, 'producer_granule_id': name,
                'time_start': '2026-10-17T05:18:00Z', 'time_end': '2026-10-17T05:24:00Z',
                'granule_size': '240', 'links': [
                    {'rel': 'http://esipfed.org/ns/fedsearch/1.1/data#',
                     'href': f'https://data.laadsdaac.earthdatacloud.nasa.gov/prod-lads/{prefix}{level}IMG/{name}'}]}

    def run_discovery(self, batches, archive_missing=False):
        report, queries = {}, []

        def response(url, timeout):
            queries.append(parse_qs(urlparse(url).query))
            entries = batches[len(queries) - 1]
            result = io.BytesIO(json.dumps({'feed': {'entry': entries}}).encode())
            result.headers = {'CMR-Hits': str(len(entries))}
            return result

        def listing(directory):
            return set() if archive_missing else {
                directory + e['producer_granule_id'] for batch in batches for e in batch}

        with patch('training.acquire_viirs.urlopen', side_effect=response), \
                patch('training.acquire_viirs.archive_names', side_effect=listing):
            pairs = discover('VJ1', '2026-10-17T00:00:00Z', '2026-10-18T00:00:00Z',
                             [116, -2, 118, 1], diagnostics=report)
        return pairs, report, queries

    def test_cloud_catalog_version_and_different_production_timestamps(self):
        pairs, report, queries = self.run_discovery([
            [self.entry()], [self.entry('03', production='2026290103852')]])
        self.assertEqual(len(pairs), 1)
        self.assertEqual(queries[0]['version'], ['2.1'])
        self.assertEqual(queries[0]['bounding_box'], ['116,-2,118,1'])
        self.assertEqual(report['pairs_before_limit'], 1)
        self.assertTrue(pairs[0][0]['url'].startswith(LAADS + '/archive/allData/5201/'))

    def test_empty_catalog_is_visible(self):
        pairs, report, _ = self.run_discovery([[], []])
        self.assertEqual(pairs, [])
        self.assertEqual(report['products']['VJ102IMG']['candidates'], 0)

    def test_archive_membership_required(self):
        pairs, report, _ = self.run_discovery([[self.entry()], [self.entry('03')]], True)
        self.assertEqual(pairs, [])
        self.assertEqual(report['products']['VJ102IMG']['rejected'], {'not_in_laads_archive_listing': 1})

    def test_platform_collection_time_and_link_rejections(self):
        for kind in ('platform', 'collection', 'time', 'link', 'inherited'):
            with self.subTest(kind=kind):
                e = self.entry()
                if kind == 'platform':
                    e = self.entry(prefix='VJ2')
                elif kind == 'collection':
                    e['producer_granule_id'] = e['producer_granule_id'].replace('.021.', '.999.')
                elif kind == 'time':
                    e['time_start'] = '2026-10-17T05:19:00Z'
                elif kind == 'link':
                    e['links'][0]['href'] = e['links'][0]['href'].replace('data.laadsdaac.earthdatacloud.nasa.gov', 'example.com')
                else:
                    e['links'][0]['inherited'] = True
                pairs, report, _ = self.run_discovery([[e], [self.entry('03')]])
                self.assertEqual(pairs, [])
                self.assertEqual(sum(report['products']['VJ102IMG']['rejected'].values()), 1)

    def test_metadata_interval_mismatch(self):
        geo = self.entry('03')
        geo['time_end'] = '2026-10-17T05:23:59Z'
        pairs, report, _ = self.run_discovery([[self.entry()], [geo]])
        self.assertEqual(pairs, [])
        self.assertEqual(report['pairing_rejections'], {'metadata_interval_mismatch': 1})

    def test_pagination_and_duplicate_revision(self):
        pairs, report, queries = self.run_discovery([
            [self.entry()] * 100, [self.entry(production='2026290113000')], [self.entry('03')]])
        self.assertEqual(len(pairs), 1)
        self.assertEqual(queries[1]['page_num'], ['2'])
        self.assertEqual(report['products']['VJ102IMG']['candidates'], 101)
        self.assertIn('2026290113000', pairs[0][0]['name'])

    def test_archive_parser_resolves_actual_links_only(self):
        directory = LAADS + '/archive/allData/5201/VJ102IMG/2026/290/'
        with patch('training.acquire_viirs.urlopen', return_value=io.BytesIO(
                b'<a href="file.nc">file.nc</a> missing.nc <a href="https://evil.test/x.nc">x</a>')):
            names = archive_names(directory)
        self.assertIn(directory + 'file.nc', names)
        self.assertNotIn(directory + 'missing.nc', names)


class PreflightTest(unittest.TestCase):
    def response(self, payload, content_type='application/json', name='a.nc'):
        payload = dict(payload, name=name, resourceType='File',
                       downloadsLink=LAADS + '/api/v2/content/archives/allData/5201/' + name)
        response = io.BytesIO(json.dumps({'content': [payload]}).encode())
        response.status = 200
        response.headers = {'Content-Type': content_type}
        response.__enter__ = lambda: response
        response.__exit__ = lambda *args: None
        return response

    def items(self):
        return [{'url': LAADS + '/archive/allData/5201/' + name}
                for name in ('a.nc', 'b.nc')]

    def test_metadata_preflight_checks_all_files_without_head(self):
        responses = [self.response({'size': 100, 'status': 'Online'}, name=n) for n in ('a.nc', 'b.nc')]
        with patch('training.acquire_viirs.build_opener') as build:
            build.return_value.open.side_effect = responses
            self.assertEqual(preflight(self.items(), 'fixture-token', 200), [100, 100])
            self.assertTrue(all(c.args[0].get_method() == 'GET'
                                for c in build.return_value.open.call_args_list))
            self.assertTrue(all('/api/v2/content/details/' in c.args[0].full_url
                                for c in build.return_value.open.call_args_list))

    def test_token_missing(self):
        with self.assertRaisesRegex(AcquisitionError, 'authentication'):
            preflight(self.items(), '', 200)

    def test_invalid_token_is_rejected_before_request_and_not_echoed(self):
        with patch('training.acquire_viirs.build_opener') as build:
            with self.assertRaises(AcquisitionError) as caught:
                preflight(self.items(), 'secret\nAuthorization: secret', 200)
            self.assertNotIn('secret', str(caught.exception))
            build.return_value.open.assert_not_called()

    def test_authentication_rejected(self):
        error = HTTPError('https://ladsweb.modaps.eosdis.nasa.gov/x', 401, 'unauthorized', {}, None)
        with patch('training.acquire_viirs.build_opener') as build:
            build.return_value.open.side_effect = error
            with self.assertRaisesRegex(AcquisitionError, 'HTTP 401'):
                preflight(self.items(), 'fixture-token', 200)

    def test_head_not_supported_is_not_used(self):
        responses = [self.response({'size': 100, 'status': 'Online'}, name=n) for n in ('a.nc', 'b.nc')]
        with patch('training.acquire_viirs.build_opener') as build:
            build.return_value.open.side_effect = responses
            preflight(self.items(), 'fixture-token', 200)
            self.assertNotIn('HEAD', [c.args[0].get_method()
                                      for c in build.return_value.open.call_args_list])

    def test_redirect_rejected(self):
        with self.assertRaisesRegex(AcquisitionError, 'redirect'):
            NoRedirect().redirect_request(None, None, 302, '', {}, 'https://example.com')

    def test_edl_redirect_strips_bearer_and_return_restores_it(self):
        handler = SameHostRedirect('fixture-secret')
        request = Request(LAADS + '/api/v2/content/archives/file.nc',
                          headers={'Authorization': 'Bearer fixture-secret',
                                   'X-Requested-With': 'XMLHttpRequest'})
        request._laads_hops = 0
        edl = handler.redirect_request(request, None, 302, '', {},
                                       'https://urs.earthdata.nasa.gov/login')
        self.assertNotIn('Authorization', edl.headers)
        edl._laads_hops = 1
        returned = handler.redirect_request(edl, None, 302, '', {},
                                            LAADS + '/api/v2/content/archives/file.nc')
        self.assertEqual(returned.headers['Authorization'], 'Bearer fixture-secret')

    def test_edl_redirect_never_sends_token_to_untrusted_host(self):
        handler = SameHostRedirect('fixture-secret')
        request = Request(LAADS + '/api/v2/content/archives/file.nc')
        with self.assertRaisesRegex(AcquisitionError, 'di luar origin'):
            handler.redirect_request(request, None, 302, '', {}, 'https://example.com/file.nc')

    def test_html_response_rejected(self):
        response = self.response({}, 'text/html')
        with patch('training.acquire_viirs.build_opener') as build:
            build.return_value.open.return_value = response
            with self.assertRaisesRegex(AcquisitionError, 'metadata'):
                preflight(self.items()[:1], 'fixture-token', 200)

    def test_missing_size_rejected(self):
        response = self.response({'status': 'Online'})
        with patch('training.acquire_viirs.build_opener') as build:
            build.return_value.open.return_value = response
            with self.assertRaisesRegex(AcquisitionError, 'metadata file'):
                preflight(self.items()[:1], 'fixture-token', 200)

    def test_budget_rejected_before_download(self):
        responses = [self.response({'size': 101, 'status': 'Online'}, name=n) for n in ('a.nc', 'b.nc')]
        with patch('training.acquire_viirs.build_opener') as build:
            build.return_value.open.side_effect = responses
            with self.assertRaisesRegex(AcquisitionError, 'budget'):
                preflight(self.items(), 'fixture-token', 201)

    def test_download_failure_keeps_partial(self):
        with tempfile.TemporaryDirectory() as directory:
            item = {'url': LAADS + '/archive/allData/5201/a.nc', 'preflight_bytes': 8}
            response = io.BytesIO(b'1234')
            response.status = 200
            response.headers = {'Content-Type': 'application/octet-stream'}
            response.read = MagicMock(side_effect=[b'1234', OSError('fixture')])
            response.__enter__ = lambda: response
            response.__exit__ = lambda *args: None
            with patch('training.acquire_viirs.build_opener') as build:
                build.return_value.open.return_value = response
                with self.assertRaisesRegex(AcquisitionError, 'partial='):
                    download(item, Path(directory), 'fixture-token', 10)
            self.assertTrue((Path(directory) / 'a.nc.partial').exists())
            self.assertEqual((Path(directory) / 'a.nc.partial').read_bytes(), b'1234')
            with patch('training.acquire_viirs.build_opener') as build:
                with self.assertRaisesRegex(AcquisitionError, 'sudah ada'):
                    download(item, Path(directory), 'fixture-token', 10)
                build.assert_not_called()

    def test_html_download_and_truncated_payload_rejected(self):
        for content_type, payload in [('text/html', b'<html>'), ('application/octet-stream', b'123')]:
            with self.subTest(content_type=content_type), tempfile.TemporaryDirectory() as directory:
                response = io.BytesIO(payload)
                response.status = 200
                response.headers = {'Content-Type': content_type}
                item = dict(self.items()[0], preflight_bytes=10)
                with patch('training.acquire_viirs.build_opener') as build:
                    build.return_value.open.return_value = response
                    with self.assertRaises(AcquisitionError):
                        download(item, Path(directory), 'fixture-token', 10)
                self.assertFalse((Path(directory) / 'a.nc').exists())
                self.assertEqual((Path(directory) / 'a.nc.partial').exists(), content_type != 'text/html')

    def test_successful_download_uses_actual_size_and_hdf5(self):
        with tempfile.TemporaryDirectory() as directory:
            source = io.BytesIO()
            with h5py.File(source, 'w') as handle:
                handle.attrs['time_coverage_start'] = '2026-10-17T05:18:00Z'
            payload = source.getvalue()
            item = {'url': LAADS + '/archive/allData/5201/a.nc', 'preflight_bytes': len(payload)}
            response = io.BytesIO(payload)
            response.status = 200
            response.headers = {'Content-Type': 'application/octet-stream'}
            response.__enter__ = lambda: response
            response.__exit__ = lambda *args: None
            with patch('training.acquire_viirs.build_opener') as build:
                build.return_value.open.return_value = response
                result = download(item, Path(directory), 'fixture-token', len(payload))
            self.assertEqual(result['bytes'], len(payload))
            self.assertTrue((Path(directory) / 'a.nc').exists())
    def test_untrusted_host_and_redirect_rejected(self):
        with self.assertRaises(ValueError):
            preflight([{'url': 'https://example.com/a.nc'}], 'fixture-token', 200)
        with self.assertRaises(ValueError):
            NoRedirect().redirect_request(None, None, 302, '', {}, 'https://example.com')


if __name__ == '__main__':
    unittest.main()