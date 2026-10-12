const axios = require('axios');

const BBOX = '108,-4.5,119,4';
const FETCH_DAYS = 3;
const CACHE_DURATION = 10 * 60 * 1000;
const EMPTY_CACHE_DURATION = 60 * 1000;
const WINDOW_HOURS = { 1: 24, 2: 48 };

let cache = null;
let pending = null;

function parseCsv(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map((h) => h.trim());
  if (!headers.includes('latitude') || !headers.includes('longitude')) {
    throw new Error('Respons FIRMS tidak valid: ' + text.slice(0, 150));
  }
  return lines
    .slice(1)
    .filter((line) => line.trim())
    .map((line) => {
      const values = line.split(',').map((v) => v.trim());
      const obj = {};
      headers.forEach((h, i) => { obj[h] = values[i]; });
      return obj;
    });
}

function toTimestamp(date, time) {
  const padded = String(time || '').padStart(4, '0');
  const [y, m, d] = String(date).split('-').map(Number);
  const hh = parseInt(padded.slice(0, 2), 10);
  const mm = parseInt(padded.slice(2, 4), 10);
  return Date.UTC(y, m - 1, d, hh, mm);
}

async function fetchFromNasa() {
  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${process.env.FIRMS_KEY}/VIIRS_SNPP_NRT/${BBOX}/${FETCH_DAYS}`;
  const response = await axios.get(url, { timeout: 25000, responseType: 'text' });

  const rows = parseCsv(response.data)
    .map((h) => ({
      lat: parseFloat(h.latitude),
      lon: parseFloat(h.longitude),
      brightness: parseFloat(h.bright_ti4 || h.brightness),
      frp: parseFloat(h.frp),
      confidence: h.confidence,
      satellite: h.satellite,
      daynight: h.daynight,
      date: h.acq_date,
      time: h.acq_time,
      ts: toTimestamp(h.acq_date, h.acq_time)
    }))
    .filter((r) => !isNaN(r.lat) && !isNaN(r.lon) && !isNaN(r.ts));

  cache = { rows, time: Date.now(), fetchedAt: new Date().toISOString() };
  return cache;
}

async function loadRows() {
  if (cache) {
    const maxAge = cache.rows.length === 0 ? EMPTY_CACHE_DURATION : CACHE_DURATION;
    if (Date.now() - cache.time < maxAge) return { ...cache, stale: false };
  }

  if (!pending) {
    pending = fetchFromNasa().finally(() => { pending = null; });
  }

  try {
    const fresh = await pending;
    return { ...fresh, stale: false };
  } catch (err) {
    console.error('Gagal mengambil data FIRMS:', err.message);
    if (cache) return { ...cache, stale: true };
    throw err;
  }
}

module.exports = async (req, res) => {
  const requested = parseInt(req.query.days, 10);
  const days = WINDOW_HOURS[requested] ? requested : 1;
  const hours = WINDOW_HOURS[days];

  try {
    const { rows, fetchedAt, stale } = await loadRows();
    const now = Date.now();
    const windowStart = now - hours * 3600 * 1000;
    const recentLimit = now - 24 * 3600 * 1000;

    const hotspots = rows
      .filter((r) => r.ts >= windowStart)
      .map((r) => ({
        lat: r.lat,
        lon: r.lon,
        brightness: r.brightness,
        frp: r.frp,
        confidence: r.confidence,
        satellite: r.satellite,
        daynight: r.daynight,
        date: r.date,
        time: r.time,
        older: r.ts < recentLimit
      }));

    res.json({
      days,
      hours,
      total: hotspots.length,
      fetchedAt,
      windowStart: new Date(windowStart).toISOString(),
      windowEnd: new Date(now).toISOString(),
      stale,
      hotspots
    });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil data hotspot' });
  }
};