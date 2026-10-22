import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

import requests
from flask import Blueprint, jsonify

wind_bp = Blueprint("wind", __name__)

CACHE_SECONDS = 600
REQUEST_TIMEOUT = 25
EMPTY_WEATHER = {
    "windSpeed": None,
    "windDeg": None,
    "temp": None,
    "humidity": None,
    "description": None,
    "owmAirQuality": None,
}

GRID_POINTS = [
    {"name": "Pontianak", "lat": -0.02, "lon": 109.34},
    {"name": "Singkawang", "lat": 0.90, "lon": 108.98},
    {"name": "Ketapang", "lat": -1.85, "lon": 109.98},
    {"name": "Palangkaraya", "lat": -2.21, "lon": 113.92},
    {"name": "Sampit", "lat": -2.53, "lon": 112.95},
    {"name": "Banjarmasin", "lat": -3.32, "lon": 114.59},
    {"name": "Banjarbaru", "lat": -3.44, "lon": 114.83},
    {"name": "Pangkalan Bun", "lat": -2.69, "lon": 111.63},
    {"name": "Muara Teweh", "lat": -0.95, "lon": 114.89},
    {"name": "Samarinda", "lat": -0.50, "lon": 117.15},
    {"name": "Balikpapan", "lat": -1.24, "lon": 116.85},
    {"name": "Bontang", "lat": 0.13, "lon": 117.50},
    {"name": "Tenggarong", "lat": -0.42, "lon": 116.99},
    {"name": "Tanjung Redeb", "lat": 2.13, "lon": 117.47},
    {"name": "Tarakan", "lat": 3.30, "lon": 117.63},
    {"name": "Tanjung Selor", "lat": 2.84, "lon": 117.37},
    {"name": "Nunukan", "lat": 4.14, "lon": 117.65},
    {"name": "Sintang", "lat": 0.07, "lon": 111.49},
    {"name": "Putussibau", "lat": 0.84, "lon": 112.93},
    {"name": "Tamiang Layang", "lat": -2.10, "lon": 115.10},
    {"name": "Kuala Kapuas", "lat": -3.01, "lon": 114.39},
    {"name": "Tanah Grogot", "lat": -1.88, "lon": 116.20},
    {"name": "Sangatta", "lat": 0.52, "lon": 117.56},
]

cache = None
cache_lock = threading.Lock()
refresh_lock = threading.Lock()
warm_lock = threading.Lock()
refreshing = False


def now_seconds():
    return time.time()


def iso_now():
    moment = datetime.now(tz=timezone.utc)
    return moment.strftime("%Y-%m-%dT%H:%M:%S.") + f"{moment.microsecond // 1000:03d}Z"


def numeric(value):
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


def concentration(value):
    if isinstance(value, dict):
        value = value.get("v")
    return numeric(value)


def normalize_waqi(data):
    if not isinstance(data, dict):
        return None
    aqi = numeric(data.get("aqi"))
    if aqi is None:
        return None
    iaqi = data.get("iaqi") or {}
    city = data.get("city") or {}
    stamp = data.get("time") or {}
    return {
        "aqi": aqi,
        "scale": "WAQI",
        "source": "WAQI",
        "pm2_5": concentration(iaqi.get("pm25")),
        "pm10": concentration(iaqi.get("pm10")),
        "station": city.get("name") or None,
        "stationId": data.get("idx"),
        "city": city.get("name") or None,
        "country": None,
        "fetchedAt": stamp.get("iso") or stamp.get("stime") or None,
    }


def fetch_waqi(point):
    key = os.environ.get("WAQI_KEY")
    if not key:
        return None
    url = f"https://api.waqi.info/feed/geo:{point['lat']};{point['lon']}/?token={key}"
    try:
        response = requests.get(url, timeout=REQUEST_TIMEOUT)
        payload = response.json()
        if payload.get("status") != "ok":
            raise ValueError(payload.get("data") or "WAQI tidak mengembalikan data")
        return normalize_waqi(payload.get("data"))
    except Exception as error:
        print(f"Gagal mengambil WAQI {point['name']}: {error}")


def fetch_weather(point):
    key = os.environ.get("OWM_KEY")
    if not key:
        return dict(EMPTY_WEATHER)
    weather_url = (
        "https://api.openweathermap.org/data/2.5/weather"
        f"?lat={point['lat']}&lon={point['lon']}&appid={key}&units=metric"
    )
    air_url = (
        "https://api.openweathermap.org/data/2.5/air_pollution"
        f"?lat={point['lat']}&lon={point['lon']}&appid={key}"
    )
    weather = requests.get(weather_url, timeout=REQUEST_TIMEOUT).json()
    air = requests.get(air_url, timeout=REQUEST_TIMEOUT).json()
    entries = (air.get("list") or [{}])[0] or {}
    components = entries.get("components") or {}
    air_quality = None
    if entries:
        stamp = entries.get("dt")
        air_quality = {
            "aqi": (entries.get("main") or {}).get("aqi"),
            "pm2_5": components.get("pm2_5"),
            "pm10": components.get("pm10"),
            "fetchedAt": datetime.fromtimestamp(stamp, tz=timezone.utc).isoformat().replace("+00:00", "Z") if stamp else None,
        }
    wind = weather.get("wind") or {}
    main = weather.get("main") or {}
    description = (weather.get("weather") or [{}])[0].get("description")
    return {
        "windSpeed": wind.get("speed"),
        "windDeg": wind.get("deg"),
        "temp": main.get("temp"),
        "humidity": main.get("humidity"),
        "description": description,
        "owmAirQuality": air_quality,
    }


def fetch_grid():
    results = []
    with ThreadPoolExecutor(max_workers=12) as pool:
        weather_jobs = {point["name"]: pool.submit(fetch_weather, point) for point in GRID_POINTS}
        waqi_jobs = {point["name"]: pool.submit(fetch_waqi, point) for point in GRID_POINTS}
        for point in GRID_POINTS:
            try:
                weather = weather_jobs[point["name"]].result()
            except Exception as error:
                print(f"Gagal mengambil cuaca {point['name']}: {error}")
                weather = dict(EMPTY_WEATHER)
            try:
                air_quality = waqi_jobs[point["name"]].result()
            except Exception:
                air_quality = None
            results.append({**point, **weather, "airQuality": air_quality})
    return results


def build_payload():
    has_waqi = bool(os.environ.get("WAQI_KEY"))
    return {
        "grid": fetch_grid(),
        "fetchedAt": iso_now(),
        "stale": False,
        "refreshPending": False,
        "context": "regional",
        "airQualitySource": "WAQI" if has_waqi else "unavailable",
        "airQualityNote": (
            "AQI berasal dari World Air Quality Index (WAQI). Stasiun dan waktu pengukuran dapat berbeda dari titik pusat kota."
            if has_waqi
            else "WAQI_KEY belum dikonfigurasi; tidak ada status AQI yang dibuat-buat."
        ),
    }


def read_cache():
    with cache_lock:
        return cache


def store_cache(payload):
    global cache
    entry = {"payload": payload, "time": now_seconds()}
    with cache_lock:
        cache = entry
    return entry


def is_cache_fresh(snapshot, current):
    return bool(snapshot) and current - snapshot["time"] < CACHE_SECONDS


def refresh_cache():
    """Ambil cuaca dan AQI terbaru lalu simpan. Dipakai thread latar belakang dan pengujian."""
    payload = build_payload()
    return store_cache(payload)["payload"]


def refresh_worker():
    global refreshing
    try:
        refresh_cache()
    except Exception as error:
        print(f"Gagal mengambil data angin: {error}")
    finally:
        with refresh_lock:
            refreshing = False


def refresh_in_background():
    """Segarkan cache di thread lain. Hanya satu refresh berjalan dalam satu waktu."""
    global refreshing
    with refresh_lock:
        if refreshing:
            return False
        refreshing = True
    try:
        threading.Thread(target=refresh_worker, name="wind-refresh", daemon=True).start()
    except RuntimeError:
        with refresh_lock:
            refreshing = False
        return False
    return True


def load_grid():
    """Cache-first: data tersimpan langsung dipakai, pembaruan berjalan di latar belakang."""
    current = now_seconds()
    snapshot = read_cache()
    if is_cache_fresh(snapshot, current):
        return {**snapshot["payload"], "stale": False, "refreshPending": False}
    if snapshot is None:
        # Belum ada cache sama sekali: request pertama menunggu OpenWeatherMap/WAQI.
        with warm_lock:
            if read_cache() is None:
                store_cache(build_payload())
            snapshot = read_cache()
        expired = not is_cache_fresh(snapshot, current)
        return {**snapshot["payload"], "stale": expired, "refreshPending": expired}
    refresh_in_background()
    return {**snapshot["payload"], "stale": True, "refreshPending": True}


def reset_cache():
    global cache, refreshing
    with cache_lock:
        cache = None
    with refresh_lock:
        refreshing = False


@wind_bp.get("/api/wind")
def list_wind():
    if not os.environ.get("OWM_KEY") and not os.environ.get("WAQI_KEY"):
        return jsonify({
            "error": "OWM_KEY atau WAQI_KEY belum dikonfigurasi",
            "code": "AIR_DATA_NOT_CONFIGURED",
        }), 503
    try:
        payload = load_grid()
    except Exception as error:
        print(f"Gagal mengambil data angin: {error}")
        return jsonify({"error": "Gagal mengambil data angin"}), 500
    response = jsonify(payload)
    # Cache HTTP dimatikan supaya cache aplikasi (server + apiCache.js) tetap satu-satunya acuan.
    response.headers["Cache-Control"] = "no-store"
    return response

