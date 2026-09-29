const axios = require('axios');

const OWM_KEY = process.env.OWM_KEY;
const CACHE_DURATION = 10 * 60 * 1000;

const GRID_POINTS = [
  { name: 'Pontianak', lat: -0.02, lon: 109.34 },
  { name: 'Singkawang', lat: 0.90, lon: 108.98 },
  { name: 'Ketapang', lat: -1.85, lon: 109.98 },
  { name: 'Palangkaraya', lat: -2.21, lon: 113.92 },
  { name: 'Sampit', lat: -2.53, lon: 112.95 },
  { name: 'Banjarmasin', lat: -3.32, lon: 114.59 },
  { name: 'Samarinda', lat: -0.50, lon: 117.15 },
  { name: 'Balikpapan', lat: -1.24, lon: 116.85 },
  { name: 'Tanjung Redeb', lat: 2.13, lon: 117.47 },
  { name: 'Tarakan', lat: 3.30, lon: 117.63 },
];

let cache = null;
let cacheTime = 0;

module.exports = async (req, res) => {
  if (cache && Date.now() - cacheTime < CACHE_DURATION) {
    return res.json(cache);
  }

  try {
    const results = await Promise.all(
      GRID_POINTS.map(async (p) => {
        const url = `https://api.openweathermap.org/data/2.5/weather?lat=${p.lat}&lon=${p.lon}&appid=${OWM_KEY}&units=metric`;
        const r = await axios.get(url);
        return {
          name: p.name,
          lat: p.lat,
          lon: p.lon,
          windSpeed: r.data.wind?.speed ?? 0,
          windDeg: r.data.wind?.deg ?? 0,
          temp: r.data.main?.temp ?? null,
          humidity: r.data.main?.humidity ?? null,
          description: r.data.weather?.[0]?.description ?? '-',
        };
      })
    );
    const result = { grid: results };
    cache = result;
    cacheTime = Date.now();
    res.json(result);
  } catch (err) {
    console.error(err.message);
    if (cache) return res.json(cache);
    res.status(500).json({ error: 'Gagal mengambil data angin' });
  }
};