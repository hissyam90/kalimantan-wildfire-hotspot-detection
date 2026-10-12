const axios = require('axios');

const BBOX = '108,-4.5,119,4';
const CACHE_DURATION = 10 * 60 * 1000;
const EMPTY_CACHE_DURATION = 60 * 1000;
const ALLOWED_DAYS = [1, 2];

const cache = {};

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

module.exports = async (req, res) => {
  const requested = parseInt(req.query.days, 10);
  const days = ALLOWED_DAYS.includes(requested) ? requested : 1;
  const entry = cache[days];

  if (entry) {
    const maxAge = entry.data.total === 0 ? EMPTY_CACHE_DURATION : CACHE_DURATION;
    if (Date.now() - entry.time < maxAge) {
      return res.json(entry.data);
    }
  }

  try {
    const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${process.env.FIRMS_KEY}/VIIRS_SNPP_NRT/${BBOX}/${days}`;
    const response = await axios.get(url, { timeout: 20000, responseType: 'text' });
    const rows = parseCsv(response.data);

    const data = {
      days,
      total: rows.length,
      fetchedAt: new Date().toISOString(),
      hotspots: rows.map((h) => ({
        lat: parseFloat(h.latitude),
        lon: parseFloat(h.longitude),
        brightness: parseFloat(h.bright_ti4 || h.brightness),
        frp: parseFloat(h.frp),
        confidence: h.confidence,
        satellite: h.satellite,
        daynight: h.daynight,
        date: h.acq_date,
        time: h.acq_time
      }))
    };

    cache[days] = { data, time: Date.now() };
    res.json(data);
  } catch (err) {
    console.error('Gagal mengambil data FIRMS:', err.message);
    if (entry) return res.json({ ...entry.data, stale: true });
    res.status(500).json({ error: 'Gagal mengambil data hotspot' });
  }
};