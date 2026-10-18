const axios = require('axios');

const OWM_KEY = process.env.OWM_KEY;
const IQAIR_KEY = process.env.IQAIR_KEY;
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
  { name: 'Nunukan', lat: 4.14, lon: 117.65 },
];

let cache = null;
let cacheTime = 0;

function normalizePollution(data) {
  const pollution = data?.current?.pollution;
  if (!pollution || !Number.isFinite(Number(pollution.aqius))) return null;
  const concentration = (value) => {
    if (Number.isFinite(Number(value))) return Number(value);
    return Number.isFinite(Number(value?.conc)) ? Number(value.conc) : null;
  };
  return {
    aqi: Number(pollution.aqius),
    scale: 'US AQI',
    source: 'IQAir AirVisual',
    pm2_5: concentration(pollution.p2),
    pm10: concentration(pollution.p10),
    station: data?.station?.name || null,
    city: data?.city || null,
    country: data?.country || null,
    fetchedAt: pollution.ts || null,
  };
}

async function fetchIqair(point) {
  if (!IQAIR_KEY) return null;
  try {
    const url = `https://api.airvisual.com/v2/nearest_city?lat=${point.lat}&lon=${point.lon}&key=${encodeURIComponent(IQAIR_KEY)}`;
    const response = await axios.get(url, { timeout: 25000 });
    return normalizePollution(response.data?.data);
  } catch (error) {
    console.error(`Gagal mengambil IQAir ${point.name}:`, error.response?.data?.data?.message || error.message);
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
  if (!OWM_KEY && !IQAIR_KEY) {
    return res.status(503).json({ error: 'OWM_KEY atau IQAIR_KEY belum dikonfigurasi', code: 'AIR_DATA_NOT_CONFIGURED' });
  }
  if (cache && Date.now() - cacheTime < CACHE_DURATION) {
    return res.json({ ...cache, stale: false });
  }

  try {
    const results = await Promise.all(GRID_POINTS.map(async (p) => {
      const [weatherResult, iqair] = await Promise.allSettled([fetchWeather(p), fetchIqair(p)]);
      const weather = weatherResult.status === 'fulfilled' ? weatherResult.value : { windSpeed: null, windDeg: null, temp: null, humidity: null, description: null, owmAirQuality: null };
      return { name: p.name, lat: p.lat, lon: p.lon, ...weather, airQuality: iqair.status === 'fulfilled' ? iqair.value : null };
    }));
    const result = {
      grid: results,
      fetchedAt: new Date().toISOString(),
      stale: false,
      context: 'regional',
      airQualitySource: IQAIR_KEY ? 'IQAir AirVisual' : 'unavailable',
      airQualityNote: IQAIR_KEY ? 'AQI utama berasal dari IQAir AirVisual dalam skala US AQI. PM2.5 dan PM10 mengikuti stasiun IQAir terdekat.' : 'IQAIR_KEY belum dikonfigurasi; tidak ada status AQI yang dibuat-buat.',
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