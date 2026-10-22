import unittest
from datetime import datetime, timezone
from unittest import mock

import routes.hotspots as hotspots
from routes.hotspots import normalize_rows, parse_csv, select_rows, utc_day_start_ms


def make_row(moment, confidence="n", frp=10.0):
    return {
        "lat": -2.5,
        "lon": 114.5,
        "date": moment.strftime("%Y-%m-%d"),
        "time": moment.strftime("%H%M"),
        "satellite": "N20",
        "confidence": confidence,
        "frp": frp,
        "ts": int(moment.timestamp() * 1000),
    }


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


class HotspotsWindowTest(unittest.TestCase):
    reference = datetime(2026, 10, 22, 22, 43, tzinfo=timezone.utc)
    reference_ms = int(reference.timestamp() * 1000)

    def test_day_range_starts_at_utc_midnight(self):
        self.assertEqual(
            utc_day_start_ms(reference_ms=self.reference_ms),
            int(datetime(2026, 10, 22, tzinfo=timezone.utc).timestamp() * 1000),
        )
        self.assertEqual(
            utc_day_start_ms(days_back=2, reference_ms=self.reference_ms),
            int(datetime(2026, 10, 20, tzinfo=timezone.utc).timestamp() * 1000),
        )

    def test_day_range_counts_whole_utc_calendar_days(self):
        rows = [
            make_row(datetime(2026, 10, 22, 0, 0, tzinfo=timezone.utc)),
            make_row(datetime(2026, 10, 21, 23, 59, tzinfo=timezone.utc)),
            make_row(datetime(2026, 10, 21, 0, 0, tzinfo=timezone.utc)),
            make_row(datetime(2026, 10, 20, 23, 59, tzinfo=timezone.utc)),
            make_row(datetime(2026, 10, 20, 0, 0, tzinfo=timezone.utc)),
            make_row(datetime(2026, 10, 19, 23, 59, tzinfo=timezone.utc)),
        ]
        window_start, one_day = select_rows(rows, 1, reference_ms=self.reference_ms)
        self.assertEqual(len(one_day), 1)
        self.assertEqual(window_start, utc_day_start_ms(reference_ms=self.reference_ms))
        self.assertEqual(len(select_rows(rows, 2, reference_ms=self.reference_ms)[1]), 3)
        self.assertEqual(len(select_rows(rows, 3, reference_ms=self.reference_ms)[1]), 5)

    def test_confidence_and_min_frp_filters_still_apply(self):
        rows = [
            make_row(self.reference, confidence="h", frp=30.0),
            make_row(self.reference, confidence="l", frp=5.0),
            make_row(self.reference, confidence="n", frp=None),
        ]
        self.assertEqual(len(select_rows(rows, 1, confidence="h", reference_ms=self.reference_ms)[1]), 1)
        self.assertEqual(len(select_rows(rows, 1, min_frp=10.0, reference_ms=self.reference_ms)[1]), 1)


class HotspotsCacheTest(unittest.TestCase):
    def setUp(self):
        hotspots.reset_cache()

    def tearDown(self):
        hotspots.reset_cache()

    @staticmethod
    def _payload(moment):
        moment_ms = int(moment.timestamp() * 1000)
        return {
            "rows": [],
            "sources": [],
            "time": moment_ms,
            "fetchedAt": hotspots.iso_from_ms(moment_ms),
            "day": utc_day_start_ms(reference_ms=moment_ms),
        }

    def test_cache_is_reused_then_replaced_when_utc_date_changes(self):
        late = datetime(2026, 10, 22, 23, 59, tzinfo=timezone.utc)
        with mock.patch.object(hotspots, "now_ms", return_value=int(late.timestamp() * 1000)), \
                mock.patch.object(hotspots, "fetch_from_nasa", return_value=self._payload(late)) as fetch:
            hotspots.load_rows()
            hotspots.load_rows()
            self.assertEqual(fetch.call_count, 1)

        early = datetime(2026, 10, 23, 0, 1, tzinfo=timezone.utc)
        with mock.patch.object(hotspots, "now_ms", return_value=int(early.timestamp() * 1000)), \
                mock.patch.object(hotspots, "fetch_from_nasa", return_value=self._payload(early)) as fetch:
            payload = hotspots.load_rows()
            self.assertEqual(fetch.call_count, 1)
            self.assertEqual(payload["day"], utc_day_start_ms(reference_ms=int(early.timestamp() * 1000)))


if __name__ == "__main__":
    unittest.main()
