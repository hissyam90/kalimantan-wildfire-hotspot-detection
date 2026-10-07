const axios = require('axios');

const FIRMS_KEY = process.env.FIRMS_KEY;
const BBOX = '108,-4.5,119,4';
const CACHE_DURATION = 10 * 60 * 1000;

let cache = null;
let cacheTime = 0;

module.exports = async (req, res) => {
  if (cache && Date.now() - cacheTime < CACHE_DURATION) {
    return res.json(cache);
  }

  try {
    const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${FIRMS_KEY}/VIIRS_SNPP_NRT/${BBOX}/2`;
    const response = await axios.get(url);

    const lines = response.data.trim().split('\n');
    const headers = lines[0].split(',');

    const hotspots = lines.slice(1).map(line => {
      const values = line.split(',');
      const obj = {};
      headers.forEach((h, i) => { obj[h] = values[i]; });
      return obj;
    });

    const result = {
      total: hotspots.length,
      hotspots: hotspots.map(h => ({
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

    cache = result;
    cacheTime = Date.now();
    res.json(result);
  } catch (err) {
    console.error(err.message);
    if (cache) return res.json(cache);
    res.status(500).json({ error: 'Gagal mengambil data hotspot' });
  }
};