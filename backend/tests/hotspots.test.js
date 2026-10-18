const test = require('node:test');
const assert = require('node:assert/strict');
const hotspots = require('../routes/hotspots');

test('parseCsv accepts header-only FIRMS responses', () => {
  assert.deepEqual(hotspots.parseCsv('latitude,longitude,acq_date,acq_time\n'), []);
});

test('parseCsv rejects non-FIRMS responses', () => {
  assert.throws(() => hotspots.parseCsv('<html>login</html>'), /bukan CSV/);
});

test('normalizeRows validates coordinates and keeps observation metadata', () => {
  const rows = hotspots.normalizeRows([
    { latitude: '-1.2', longitude: '116.8', acq_date: '2026-10-18', acq_time: '0518', bright_ti4: '330.5', frp: '12.4', confidence: 'h' },
    { latitude: '90', longitude: '116', acq_date: '2026-10-18', acq_time: '0518' },
  ], 'VIIRS_NOAA20_NRT');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].satellite, 'VIIRS_NOAA20');
  assert.equal(rows[0].ts, Date.UTC(2026, 9, 18, 5, 18));
});