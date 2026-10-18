const axios = require('axios');

const BBOX = '108,-4.5,119.5,7.5';
const COVERAGE = { west: 108, south: -4.5, east: 119.5, north: 7.5 };
const PRODUCTS = ['VIIRS_NOAA20_NRT', 'VIIRS_NOAA21_NRT'];
const FETCH_DAYS = 3;
const CACHE_DURATION = 10 * 60 * 1000;
const WINDOW_HOURS = { 1: 24, 2: 48 };
let cache = null;
let pending = null;

function parseCsv(text) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('Respons FIRMS kosong');
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  const headers = lines[0].split(',').map((h) => h.trim());
  if (!headers.includes('latitude') || !headers.includes('longitude')
      || !headers.includes('acq_date') || !headers.includes('acq_time')) {
    throw new Error('Respons FIRMS bukan CSV hotspot yang valid');
  }
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim());
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  });
}

function toTimestamp(date, time) {
  const match = String(time || '').match(/^(\d{1,2})(\d{2})$/);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date)) || !match) return NaN;
  return Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10)), Number(match[1]), Number(match[2]));
}

function normalizeRows(rows, product) {
  return rows.map((row) => ({
    lat: Number(row.latitude), lon: Number(row.longitude),
    satellite: row.satellite || product.replace('_NRT', ''), date: row.acq_date, time: String(row.acq_time || '').padStart(4, '0'),
    ts: toTimestamp(row.acq_date, row.acq_time),
  })).filter((row) => Number.isFinite(row.lat) && Number.isFinite(row.lon)
    && row.lat >= COVERAGE.south && row.lat <= COVERAGE.north
    && row.lon >= COVERAGE.west && row.lon <= COVERAGE.east && Number.isFinite(row.ts));
}

async function fetchProduct(product) {
  if (!process.env.FIRMS_KEY) throw new Error('FIRMS_KEY belum dikonfigurasi');
  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${encodeURIComponent(process.env.FIRMS_KEY)}/${product}/${BBOX}/${FETCH_DAYS}`;
  const response = await axios.get(url, { timeout: 25000, responseType: 'text' });
  if (typeof response.data !== 'string' || response.data.trim().startsWith('<')) throw new Error(`${product}: respons bukan CSV`);
  return normalizeRows(parseCsv(response.data), product);
}

async function fetchFromNasa() {
  const results = await Promise.all(PRODUCTS.map(async (product) => {
    try { return { product, rows: await fetchProduct(product), status: 'available' }; }
    catch (error) { console.error(`Gagal mengambil FIRMS ${product}:`, error.message); return { product, rows: [], status: 'failed' }; }
  }));
  const successful = results.filter((result) => result.status === 'available');
  if (!successful.length) throw new Error('Semua sumber FIRMS gagal');
  return { rows: successful.flatMap((result) => result.rows),
    sources: results.map(({ product, status }) => ({ product, status })),
    time: Date.now(), fetchedAt: new Date().toISOString() };
}

async function loadRows() {
  if (cache && Date.now() - cache.time < CACHE_DURATION) return { ...cache, stale: false };
  if (!pending) pending = fetchFromNasa().finally(() => { pending = null; });
  try { const fresh = await pending; cache = fresh; return { ...fresh, stale: false }; }
  catch (error) { console.error('Gagal mengambil data FIRMS:', error.message); if (cache) return { ...cache, stale: true }; throw error; }
}

async function handler(req, res) {
  const requested = Number.parseInt(req.query.days, 10);
  const days = WINDOW_HOURS[requested] ? requested : 1;
  const hours = WINDOW_HOURS[days];
  if (!process.env.FIRMS_KEY && !cache) return res.status(503).json({ error: 'FIRMS_KEY belum dikonfigurasi', code: 'FIRMS_NOT_CONFIGURED' });
  try {
    const { rows, fetchedAt, stale, sources } = await loadRows();
    const now = Date.now();
    const windowStart = now - hours * 3600 * 1000;
    const hotspots = rows.filter((row) => row.ts >= windowStart).map((row) => ({
      lat: row.lat, lon: row.lon,
      date: row.date, time: row.time, observedAt: new Date(row.ts).toISOString(),
    }));
    return res.json({ days, hours, source: 'NASA FIRMS VIIRS NOAA-20/NOAA-21 NRT', dataType: 'active-fire point observations',
      coverage: COVERAGE, confidenceNote: 'Confidence adalah kategori deteksi FIRMS, bukan probabilitas pasti dan bukan confidence CNN.',
      total: hotspots.length, fetchedAt, windowStart: new Date(windowStart).toISOString(), windowEnd: new Date(now).toISOString(),
      stale: Boolean(stale), sources, hotspots });
  } catch (error) { return res.status(502).json({ error: 'Pengambilan data NASA FIRMS gagal', code: 'FIRMS_FETCH_FAILED', stale: Boolean(cache) }); }
}

handler.parseCsv = parseCsv;
handler.normalizeRows = normalizeRows;
handler.resetCache = () => { cache = null; pending = null; };
module.exports = handler;