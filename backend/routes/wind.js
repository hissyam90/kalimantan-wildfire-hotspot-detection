const axios = require('axios');

const OWM_KEY = process.env.OWM_KEY;
const WAQI_KEY = process.env.WAQI_KEY;
const CACHE_DURATION = 10 * 60 * 1000;

const GRID_POINTS = [
  { name: 'Pontianak', lat: -0.02, lon: 109.34 },
  { name: 'Singkawang', lat: 0.90, lon: 108.98 },
  { name: 'Ketapang', lat: -1.85, lon: 109.98 },
  { name: 'Palangkaraya', lat: -2.21, lon: 113.92 },
  { name: 'Sampit', lat: -2.53, lon: 112.95 },
  { name: 'Banjarmasin', lat: -3.32, lon: 114.59 },
  { name: 'Banjarbaru', lat: -3.44, lon: 114.83 },
  { name: 'Pangkalan Bun', lat: -2.69, lon: 111.63 },
  { name: 'Muara Teweh', lat: -0.95, lon: 114.89 },
  { name: 'Samarinda', lat: -0.50, lon: 117.15 },
  { name: 'Balikpapan', lat: -1.24, lon: 116.85 },
  { name: 'Bontang', lat: 0.13, lon: 117.50 },
  { name: 'Tenggarong', lat: -0.42, lon: 116.99 },
  { name: 'Tanjung Redeb', lat: 2.13, lon: 117.47 },
  { name: 'Tarakan', lat: 3.30, lon: 117.63 },
  { name: 'Tanjung Selor', lat: 2.84, lon: 117.37 },
  { name: 'Nunukan', lat: 4.14, lon: 117.65 },
];

let cache = null;
let cacheTime = 0;

function normalizeWaqi(data) {
  const numeric = (value) => {
    if (value === null || value === undefined || value === '' || (typeof value === 'string' && !value.trim())) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  };
  const aqi = numeric(data?.aqi);
  if (aqi === null) return null;
  const concentration = (value) => numeric(value?.v ?? value);
  return {
    aqi,
    scale: 'WAQI',
    source: 'WAQI',
    pm2_5: concentration(data?.iaqi?.pm25),
    pm10: concentration(data?.iaqi?.pm10),
    station: data?.city?.name || null,
    stationId: data?.idx ?? null,
    city: data?.city?.name || null,
    country: null,
    fetchedAt: data?.time?.iso || data?.time?.stime || null,
  };
}

async function fetchWaqi(point) {
  if (!WAQI_KEY) return null;
  try {
    const url = `https://api.waqi.info/feed/geo:${point.lat};${point.lon}/?token=${encodeURIComponent(WAQI_KEY)}`;
    const response = await axios.get(url, { timeout: 25000 });
    if (response.data?.status !== 'ok') {
      throw new Error(response.data?.data || 'WAQI tidak mengembalikan data');
    }
    return normalizeWaqi(response.data?.data);
  } catch (error) {
    console.error(`Gagal mengambil WAQI ${point.name}:`, error.response?.data?.data || error.message);
    return null;
  }
}

async function fetchWeather(point) {
  if (!OWM_KEY) return { windSpeed: null, windDeg: null, temp: null, humidity: null, description: null, owmAirQuality: null };
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${point.lat}&lon=${point.lon}&appid=${OWM_KEY}&units=metric`;
  const airUrl = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${point.lat}&lon=${point.lon}&appid=${OWM_KEY}`;
  const [weather, air] = await Promise.all([
    axios.get(url, { timeout: 25000 }),
    axios.get(airUrl, { timeout: 25000 }),
  ]);
  const airData = air.data.list?.[0];
  const components = airData?.components || {};
  return {
    windSpeed: weather.data.wind?.speed ?? null,
    windDeg: weather.data.wind?.deg ?? null,
    temp: weather.data.main?.temp ?? null,
    humidity: weather.data.main?.humidity ?? null,
    description: weather.data.weather?.[0]?.description ?? null,
    owmAirQuality: airData ? { aqi: airData.main?.aqi ?? null, pm2_5: components.pm2_5 ?? null, pm10: components.pm10 ?? null, fetchedAt: airData.dt ? new Date(airData.dt * 1000).toISOString() : null } : null,
  };
}

module.exports = async (req, res) => {
  if (!OWM_KEY && !WAQI_KEY) {
    return res.status(503).json({ error: 'OWM_KEY atau WAQI_KEY belum dikonfigurasi', code: 'AIR_DATA_NOT_CONFIGURED' });
  }
  if (cache && Date.now() - cacheTime < CACHE_DURATION) {
    return res.json({ ...cache, stale: false });
  }

  try {
    const results = await Promise.all(GRID_POINTS.map(async (p) => {
      const [weatherResult, waqi] = await Promise.allSettled([fetchWeather(p), fetchWaqi(p)]);
      const weather = weatherResult.status === 'fulfilled' ? weatherResult.value : { windSpeed: null, windDeg: null, temp: null, humidity: null, description: null, owmAirQuality: null };
      return { name: p.name, lat: p.lat, lon: p.lon, ...weather, airQuality: waqi.status === 'fulfilled' ? waqi.value : null };
    }));
    const result = {
      grid: results,
      fetchedAt: new Date().toISOString(),
      stale: false,
      context: 'regional',
      airQualitySource: WAQI_KEY ? 'WAQI' : 'unavailable',
      airQualityNote: WAQI_KEY ? 'AQI berasal dari World Air Quality Index (WAQI). Stasiun dan waktu pengukuran dapat berbeda dari titik pusat kota.' : 'WAQI_KEY belum dikonfigurasi; tidak ada status AQI yang dibuat-buat.',
    };
    cache = result;
    cacheTime = Date.now();
    res.json(result);
  } catch (err) {
    console.error(err.message);
    if (cache) return res.json({ ...cache, stale: true });
    res.status(500).json({ error: 'Gagal mengambil data angin' });
  }
};

module.exports.normalizeWaqi = normalizeWaqi;
module.exports.gridPoints = GRID_POINTS;