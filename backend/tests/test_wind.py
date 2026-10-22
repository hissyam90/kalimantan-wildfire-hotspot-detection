import unittest
from unittest import mock

import routes.wind as wind
from routes.wind import GRID_POINTS, normalize_waqi


class WindNormalizationTest(unittest.TestCase):
    def test_normalize_waqi_maps_aqi_and_particulate_fields(self):
        result = normalize_waqi({
            "aqi": "72",
            "idx": 1234,
            "city": {"name": "Samarinda"},
            "time": {"iso": "2026-10-18T08:00:00+07:00"},
            "iaqi": {"pm25": {"v": 18.5}, "pm10": {"v": None}},
        })
        self.assertEqual(result, {
            "aqi": 72,
            "scale": "WAQI",
            "source": "WAQI",
            "pm2_5": 18.5,
            "pm10": None,
            "station": "Samarinda",
            "stationId": 1234,
            "city": "Samarinda",
            "country": None,
            "fetchedAt": "2026-10-18T08:00:00+07:00",
        })

    def test_normalize_waqi_rejects_responses_without_numeric_aqi(self):
        self.assertIsNone(normalize_waqi({"aqi": "-", "iaqi": {}}))

    def test_city_monitoring_grid_covers_the_five_kalimantan_provinces(self):
        self.assertGreaterEqual(len(GRID_POINTS), 17)
        names = {point["name"] for point in GRID_POINTS}
        for city in ("Pontianak", "Palangkaraya", "Banjarmasin", "Samarinda", "Tanjung Selor"):
            self.assertIn(city, names)


class WindCacheTest(unittest.TestCase):
    def setUp(self):
        wind.reset_cache()

    def tearDown(self):
        wind.reset_cache()

    @staticmethod
    def _payload(stamp="2026-10-22T10:00:00.000Z"):
        return {
            "grid": [{"name": "Pontianak", "lat": -0.02, "lon": 109.34, "windSpeed": 2.1}],
            "fetchedAt": stamp,
            "stale": False,
            "refreshPending": False,
        }

    def test_fresh_cache_skips_weather_requests(self):
        with mock.patch.object(wind, "now_seconds", return_value=1000.0), \
                mock.patch.object(wind, "build_payload", return_value=self._payload()) as build:
            wind.load_grid()
            payload = wind.load_grid()
            self.assertEqual(build.call_count, 1)
        self.assertFalse(payload["stale"])
        self.assertFalse(payload["refreshPending"])

    def test_expired_cache_is_served_while_refresh_runs_in_background(self):
        with mock.patch.object(wind, "now_seconds", return_value=1000.0), \
                mock.patch.object(wind, "build_payload", return_value=self._payload()):
            wind.load_grid()
        with mock.patch.object(wind, "now_seconds", return_value=1000.0 + wind.CACHE_SECONDS + 1), \
                mock.patch.object(wind, "refresh_in_background") as refresh, \
                mock.patch.object(wind, "build_payload") as build:
            payload = wind.load_grid()
        refresh.assert_called_once_with()
        build.assert_not_called()
        self.assertTrue(payload["stale"])
        self.assertTrue(payload["refreshPending"])
        self.assertEqual(payload["grid"][0]["name"], "Pontianak")

    def test_refresh_worker_keeps_old_grid_when_upstream_fails(self):
        with mock.patch.object(wind, "now_seconds", return_value=1000.0), \
                mock.patch.object(wind, "build_payload", return_value=self._payload()):
            wind.load_grid()
        wind.refreshing = True
        with mock.patch.object(wind, "build_payload", side_effect=RuntimeError("OWM down")):
            wind.refresh_worker()
        self.assertFalse(wind.refreshing)
        with mock.patch.object(wind, "now_seconds", return_value=2000.0), \
                mock.patch.object(wind, "refresh_in_background") as refresh:
            payload = wind.load_grid()
        refresh.assert_called_once_with()
        self.assertEqual(payload["grid"][0]["name"], "Pontianak")
        self.assertTrue(payload["stale"])

    def test_background_refresh_runs_only_once_at_a_time(self):
        with mock.patch.object(wind, "threading") as threading_mock:
            self.assertTrue(wind.refresh_in_background())
            self.assertFalse(wind.refresh_in_background())
        threading_mock.Thread.assert_called_once()


if __name__ == "__main__":
    unittest.main()
