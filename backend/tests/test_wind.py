import unittest

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


if __name__ == "__main__":
    unittest.main()
