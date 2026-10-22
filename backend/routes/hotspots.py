import os
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

import requests
from flask import Blueprint, jsonify, request

hotspots_bp = Blueprint("hotspots", __name__)

BBOX = "108,-4.5,119.5,7.5"
COVERAGE = {"west": 108, "south": -4.5, "east": 119.5, "north": 7.5}
PRODUCTS = ["VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT"]
FETCH_DAYS = 3
CACHE_SECONDS = 600
REQUEST_TIMEOUT = int(os.environ.get("HOTSPOT_FETCH_TIMEOUT") or 90)
# `days` dipetakan langsung ke rentang hari kalender UTC yang dilayani NASA FIRMS.
DAY_RANGES = (1, 2, 3)
DAY_RANGE_HOURS = {1: 24, 2: 48, 3: 72}

cache = None
cache_lock = threading.Lock()
refresh_lock = threading.Lock()
warm_lock = threading.Lock()
refreshing = False


def now_ms():
    return int(time.time() * 1000)


def iso_from_ms(value):
    moment = datetime.fromtimestamp(value / 1000, tz=timezone.utc)
    return moment.strftime("%Y-%m-%dT%H:%M:%S.") + f"{moment.microsecond // 1000:03d}Z"


def utc_day_start_ms(*, days_back=0, reference_ms=None):
    """Awal hari kalender UTC, digeser `days_back` hari ke belakang."""
    moment = datetime.fromtimestamp(
        (now_ms() if reference_ms is None else reference_ms) / 1000, tz=timezone.utc
    )
    midnight = datetime(moment.year, moment.month, moment.day, tzinfo=timezone.utc) - timedelta(days=days_back)
    return int(midnight.timestamp() * 1000)


def parse_csv(text):
    if not isinstance(text, str) or not text.strip():
        raise ValueError("Respons FIRMS kosong")
    lines = [line for line in text.strip().splitlines() if line.strip()]
    headers = [header.strip() for header in lines[0].split(",")]
    required = ("latitude", "longitude", "acq_date", "acq_time")
    if not all(field in headers for field in required):
        raise ValueError("Respons FIRMS bukan CSV hotspot yang valid")
    rows = []
    for line in lines[1:]:
        values = [value.strip() for value in line.split(",")]
        rows.append({header: (values[index] if index < len(values) else "") for index, header in enumerate(headers)})
    return rows


def to_timestamp(date, acq_time):
    match = re.fullmatch(r"(\d{1,2})(\d{2})", str(acq_time or "").strip())
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(date or "").strip()) or not match:
        return None
    try:
        moment = datetime(
            int(date[0:4]), int(date[5:7]), int(date[8:10]),
            int(match.group(1)), int(match.group(2)), tzinfo=timezone.utc,
        )
    except ValueError:
        return None
    return int(moment.timestamp() * 1000)


def to_number(value):
    if value is None:
        return None
    if isinstance(value, str):
        value = value.strip()
        if not value:
            return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None

def normalize_rows(rows, product):
    normalized = []
    for row in rows:
        lat = to_number(row.get("latitude"))
        lon = to_number(row.get("longitude"))
        stamp = to_timestamp(row.get("acq_date"), row.get("acq_time"))
        if lat is None or lon is None or stamp is None:
            continue
        if not COVERAGE["south"] <= lat <= COVERAGE["north"]:
            continue
        if not COVERAGE["west"] <= lon <= COVERAGE["east"]:
            continue
        normalized.append({
            "lat": lat,
            "lon": lon,
            "satellite": row.get("satellite") or product.replace("_NRT", ""),
            "date": row.get("acq_date"),
            "time": str(row.get("acq_time") or "").zfill(4),
            "confidence": row.get("confidence") or None,
            "frp": to_number(row.get("frp")),
            "ts": stamp,
        })
    return normalized


def fetch_product(product):
    key = os.environ.get("FIRMS_KEY")
    if not key:
        raise RuntimeError("FIRMS_KEY belum dikonfigurasi")
    url = (
        "https://firms.modaps.eosdis.nasa.gov/api/area/csv/"
        f"{quote(key, safe='')}/{product}/{BBOX}/{FETCH_DAYS}"
    )
    response = requests.get(url, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    text = response.text
    if text.lstrip().startswith("<"):
        raise ValueError(f"{product}: respons bukan CSV")
    return normalize_rows(parse_csv(text), product)


def fetch_from_nasa():
    rows = []
    sources = []
    with ThreadPoolExecutor(max_workers=len(PRODUCTS)) as pool:
        futures = [(product, pool.submit(fetch_product, product)) for product in PRODUCTS]
        for product, future in futures:
            try:
                rows.extend(future.result())
                sources.append({"product": product, "status": "available"})
            except Exception as error:
                print(f"Gagal mengambil FIRMS {product}: {error}")
                sources.append({"product": product, "status": "failed"})
    if all(source["status"] == "failed" for source in sources):
        raise RuntimeError("Semua sumber FIRMS gagal")
    fetched_at = now_ms()
    return {
        "rows": rows,
        "sources": sources,
        "time": fetched_at,
        "fetchedAt": iso_from_ms(fetched_at),
        "day": utc_day_start_ms(reference_ms=fetched_at),
    }


def read_cache():
    with cache_lock:
        return cache


def store_cache(payload):
    global cache
    with cache_lock:
        cache = payload
    return payload


def is_cache_fresh(snapshot, current):
    """Cache masih sah bila belum lewat CACHE_SECONDS dan tanggal UTC-nya sama."""
    return bool(
        snapshot
        and snapshot.get("day") == utc_day_start_ms(reference_ms=current)
        and current - snapshot["time"] < CACHE_SECONDS * 1000
    )


def refresh_cache():
    """Ambil data baru dari FIRMS lalu simpan. Dipakai thread latar belakang dan pengujian."""
    global cache
    payload = fetch_from_nasa()
    with cache_lock:
        latest = cache
        if latest is not None and payload["time"] < latest["time"]:
            return latest
        cache = payload
    return payload


def refresh_worker():
    global refreshing
    try:
        refresh_cache()
    except Exception as error:
        print(f"Gagal mengambil data FIRMS: {error}")
    finally:
        with refresh_lock:
            refreshing = False


def refresh_in_background():
    """Segarkan cache di thread lain supaya request tidak menunggu unduhan FIRMS.

    Hanya satu refresh berjalan pada satu waktu, jadi berapa pun request yang
    datang bersamaan NASA tetap dipanggil sekali.
    """
    global refreshing
    with refresh_lock:
        if refreshing:
            return False
        refreshing = True
    try:
        threading.Thread(target=refresh_worker, name="firms-refresh", daemon=True).start()
    except RuntimeError:
        with refresh_lock:
            refreshing = False
        return False
    return True


def load_rows():
    """Cache-first: data tersimpan langsung dipakai, pembaruan jalan di latar belakang."""
    current = now_ms()
    snapshot = read_cache()
    if is_cache_fresh(snapshot, current):
        return {**snapshot, "stale": False, "refreshPending": False}
    if snapshot is None:
        # Cache kosong: request pertama memang menunggu FIRMS.
        with warm_lock:
            if read_cache() is None:
                store_cache(fetch_from_nasa())
            snapshot = read_cache()
        expired = not is_cache_fresh(snapshot, current)
        return {**snapshot, "stale": expired, "refreshPending": expired}
    refresh_in_background()
    return {**snapshot, "stale": True, "refreshPending": True}


def reset_cache():
    global cache, refreshing
    with cache_lock:
        cache = None
    with refresh_lock:
        refreshing = False


def select_rows(rows, days, confidence="all", min_frp=None, reference_ms=None):
    """Saring baris cache mengikuti rentang hari kalender UTC, sama seperti DAY_RANGE NASA FIRMS."""
    window_start = utc_day_start_ms(days_back=days - 1, reference_ms=reference_ms)
    selected = []
    for row in rows:
        if row["ts"] < window_start:
            continue
        if confidence != "all" and row["confidence"] != confidence:
            continue
        if min_frp is not None and (row["frp"] is None or row["frp"] < min_frp):
            continue
        selected.append(row)
    return window_start, selected


@hotspots_bp.get("/api/hotspots")
def list_hotspots():
    requested = request.args.get("days", type=int) or 1
    days = requested if requested in DAY_RANGES else 1
    hours = DAY_RANGE_HOURS[days]
    confidence = (request.args.get("confidence") or "all").strip().lower()
    min_frp = to_number(request.args.get("minFrp"))
    if not os.environ.get("FIRMS_KEY") and read_cache() is None:
        return jsonify({"error": "FIRMS_KEY belum dikonfigurasi", "code": "FIRMS_NOT_CONFIGURED"}), 503
    try:
        payload = load_rows()
    except Exception:
        return jsonify({
            "error": "Pengambilan data NASA FIRMS gagal",
            "code": "FIRMS_FETCH_FAILED",
            "stale": read_cache() is not None,
        }), 502

    current = now_ms()
    window_start, rows = select_rows(payload["rows"], days, confidence, min_frp, current)
    hotspots = [
        {
            "lat": row["lat"],
            "lon": row["lon"],
            "date": row["date"],
            "time": row["time"],
            "satellite": row["satellite"],
            "confidence": row["confidence"],
            "frp": row["frp"],
            "observedAt": iso_from_ms(row["ts"]),
        }
        for row in rows
    ]

    response = jsonify({
        "days": days,
        "dayRange": days,
        "hours": hours,
        "windowMode": "calendar-day-utc",
        "source": "NASA FIRMS VIIRS NOAA-20/NOAA-21 NRT",
        "dataType": "active-fire point observations",
        "coverage": COVERAGE,
        "confidenceNote": "Confidence adalah kategori deteksi FIRMS, bukan probabilitas pasti dan bukan confidence CNN.",
        "total": len(hotspots),
        "filters": {"confidence": confidence, "minFrp": min_frp},
        "fetchedAt": payload["fetchedAt"],
        "windowStart": iso_from_ms(window_start),
        "windowEnd": iso_from_ms(current),
        "stale": bool(payload["stale"]),
        "refreshPending": bool(payload.get("refreshPending")),
        "sources": payload["sources"],
        "hotspots": hotspots,
    })
    # Matikan cache HTTP agar cache aplikasi (server + apiCache.js) jadi satu-satunya acuan.
    response.headers["Cache-Control"] = "no-store"
    return response

