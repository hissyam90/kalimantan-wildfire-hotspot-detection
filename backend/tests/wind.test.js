const test = require('node:test');
const assert = require('node:assert/strict');
const wind = require('../routes/wind');

test('normalizeWaqi maps AQI and particulate fields without inventing null values', () => {
  const result = wind.normalizeWaqi({
    aqi: '72',
    idx: 1234,
    city: { name: 'Samarinda' },
    time: { iso: '2026-10-18T08:00:00+07:00' },
    iaqi: { pm25: { v: 18.5 }, pm10: { v: null } },
  });

  assert.deepEqual(result, {
    aqi: 72,
    scale: 'WAQI',
    source: 'WAQI',
    pm2_5: 18.5,
    pm10: null,
    station: 'Samarinda',
    stationId: 1234,
    city: 'Samarinda',
    country: null,
    fetchedAt: '2026-10-18T08:00:00+07:00',
  });
});

test('normalizeWaqi rejects responses without a numeric AQI', () => {
  assert.equal(wind.normalizeWaqi({ aqi: '-', iaqi: {} }), null);
});

test('city monitoring grid covers the five Kalimantan provinces', () => {
  assert.equal(wind.gridPoints.length, 17);
  for (const city of ['Pontianak', 'Palangkaraya', 'Banjarmasin', 'Samarinda', 'Tanjung Selor']) {
    assert.ok(wind.gridPoints.some((point) => point.name === city));
  }
});