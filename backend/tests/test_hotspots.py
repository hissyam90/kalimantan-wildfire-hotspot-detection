import unittest
from datetime import datetime, timezone

from routes.hotspots import normalize_rows, parse_csv


class HotspotsParsingTest(unittest.TestCase):
    def test_parse_csv_accepts_header_only_response(self):
        self.assertEqual(parse_csv("latitude,longitude,acq_date,acq_time\n"), [])

    def test_parse_csv_rejects_non_firms_response(self):
        with self.assertRaisesRegex(ValueError, "bukan CSV"):
            parse_csv("<html>login</html>")

    def test_normalize_rows_validates_coordinates_and_keeps_metadata(self):
        rows = normalize_rows([
            {
                "latitude": "-1.2",
                "longitude": "116.8",
                "acq_date": "2026-10-18",
                "acq_time": "0518",
                "bright_ti4": "330.5",
                "frp": "12.4",
                "confidence": "h",
            },
            {"latitude": "90", "longitude": "116", "acq_date": "2026-10-18", "acq_time": "0518"},
        ], "VIIRS_NOAA20_NRT")
        expected = int(datetime(2026, 10, 18, 5, 18, tzinfo=timezone.utc).timestamp() * 1000)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["satellite"], "VIIRS_NOAA20")
        self.assertEqual(rows[0]["ts"], expected)
        self.assertEqual(rows[0]["frp"], 12.4)
        self.assertEqual(rows[0]["confidence"], "h")


if __name__ == "__main__":
    unittest.main()
