import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { API_URL } from './config';
import { CLIENT_CACHE_MS, cachedGet, readCache } from './apiCache';
import SmokeOverlay from './SmokeOverlay';
import GlobeView from './GlobeView';

const SATELLITES = { NOAA20: 'NOAA-20', NOAA21: 'NOAA-21' };
const MARKER_COLORS = { NOAA20: '#d97706', NOAA21: '#b91c1c' };
const CONFIDENCE_LABELS = { h: 'tinggi', n: 'normal', l: 'rendah' };
const EMPTY = [];
function satelliteKey(value) { return String(value || '').includes('21') ? 'NOAA21' : 'NOAA20'; }
function markerRadius(hotspot) { return hotspot.confidence === 'h' ? 7 : hotspot.confidence === 'l' ? 4 : 5; }
function clusterPoints(points) {
  const buckets = new Map();
  points.forEach((point) => {
    const key = `${Math.round(point.lat * 2) / 2}:${Math.round(point.lon * 2) / 2}`;
    const bucket = buckets.get(key) || { ...point, count: 0, latTotal: 0, lonTotal: 0 };
    bucket.count += 1; bucket.latTotal += Number(point.lat); bucket.lonTotal += Number(point.lon); buckets.set(key, bucket);
  });
  return [...buckets.values()].map((bucket) => ({ ...bucket, lat: bucket.latTotal / bucket.count, lon: bucket.lonTotal / bucket.count }));
}
function observationTime(value) { const time = String(value || '').padStart(4, '0'); return value ? `${time.slice(0, 2)}:${time.slice(2)} UTC` : 'waktu tidak tersedia'; }
function formatUtc(value) { return `${new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })} UTC`; }
function windowLabel(windowStart, days) {
  if (!windowStart) return `${days} hari kalender UTC`;
  const start = new Date(windowStart); const end = new Date(windowStart); end.setUTCDate(end.getUTCDate() + days - 1);
  const format = (date) => date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  return days === 1 ? `hari kalender UTC ${format(start)}` : `hari kalender UTC ${format(start)} – ${format(end)}`;
}

function HotspotPopup({ hotspot }) {
  const satellite = String(hotspot.satellite || 'VIIRS').replace('VIIRS_', '').replace(/^N20$/, 'NOAA-20').replace(/^N21$/, 'NOAA-21');
  return <article className="hotspot-popup"><span className="eyebrow">NASA FIRMS · VIIRS</span><h3>Lokasi teramati panas</h3><dl>
    <div><dt>Koordinat</dt><dd>{Number(hotspot.lat).toFixed(3)}, {Number(hotspot.lon).toFixed(3)}</dd></div><div><dt>Waktu pengamatan</dt><dd>{hotspot.date || '—'} · {observationTime(hotspot.time)}</dd></div><div><dt>Satelit pengamat</dt><dd>{satellite}</dd></div><div><dt>Confidence FIRMS</dt><dd>{CONFIDENCE_LABELS[hotspot.confidence] || 'tidak tersedia'}</dd></div>{hotspot.frp != null && <div><dt>FRP</dt><dd>{Number(hotspot.frp).toFixed(1)} MW</dd></div>}
  </dl><p className="popup-help">Titik ini menunjukkan panas yang teramati satelit, bukan kepastian kebakaran. Cocokkan dengan laporan setempat.</p></article>;
}

function downloadCsv(points) {
  const rows = [['latitude', 'longitude', 'observedAt', 'satellite', 'confidence', 'frp_mw'], ...points.map((p) => [p.lat, p.lon, p.observedAt, p.satellite, p.confidence || '', p.frp ?? ''])];
  const blob = new Blob([rows.map((row) => row.join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'hotspot-firms.csv'; link.click(); URL.revokeObjectURL(url);
}

export default function HotspotMap({ smokeEnabled = true }) {
  const [days, setDays] = useState(1); const [satellite, setSatellite] = useState('all'); const [confidence, setConfidence] = useState('all'); const [minFrp, setMinFrp] = useState('');
  const [viewMode, setViewMode] = useState('markers'); const [history, setHistory] = useState(() => Number(localStorage.getItem('wildfire-hotspot-views') || 0));
  const [remote, setRemote] = useState(null); const [failure, setFailure] = useState(null); const [windRemote, setWindRemote] = useState(null);
  const cacheKey = `hotspots:days=${days}`;
  // Baca cache saat render agar peta langsung terisi.
  const cached = useMemo(() => readCache(cacheKey), [cacheKey]);
  const windCache = useMemo(() => readCache('wind', 'local'), []);
  const payload = remote && remote.key === cacheKey ? remote.data : (cached ? cached.data : null);
  const hotspots = payload?.hotspots || EMPTY;
  const windGrid = windRemote || windCache?.data.grid || EMPTY;
  const failed = failure === cacheKey;
  const loading = !payload && !failed; const error = failed && !payload;
  const showingCache = Boolean(payload) && remote?.key !== cacheKey;
  const fetchedAt = payload?.fetchedAt || null; const windowStart = payload?.windowStart || null;
  const stale = Boolean(payload?.stale); const refreshPending = Boolean(payload?.refreshPending);

  useEffect(() => {
    let cancelled = false; let timer = 0; let retries = 0;
    const load = (force) => {
      cachedGet(cacheKey, `${API_URL}/api/hotspots`, { params: { days }, timeout: 120000, maxAgeMs: force ? 0 : CLIENT_CACHE_MS })
        .fresh.then(({ data, fromCache }) => {
          if (cancelled) return;
          setRemote({ key: cacheKey, data }); setFailure(null);
          if (fromCache) return;
          const nextHistory = Number(localStorage.getItem('wildfire-hotspot-views') || 0) + 1;
          localStorage.setItem('wildfire-hotspot-views', String(nextHistory)); setHistory(nextHistory);
          // Cache server masih disegarkan; periksa ulang sebentar lagi.
          if (data.refreshPending && retries < 5) { retries += 1; timer = setTimeout(() => load(true), 20000); }
        })
        .catch(() => { if (!cancelled) setFailure(cacheKey); });
    };
    load(false);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [cacheKey, days]);

  useEffect(() => {
    let cancelled = false;
    cachedGet('wind', `${API_URL}/api/wind`, { timeout: 60000, maxAgeMs: CLIENT_CACHE_MS, persist: 'local' })
      .fresh.then(({ data }) => { if (!cancelled) setWindRemote(data.grid || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Filter confidence dan FRP di klien agar mengganti filter tidak mengunduh payload besar.
  const filteredHotspots = useMemo(() => {
    const minFrpValue = Number.parseFloat(minFrp);
    return hotspots.filter((p) => (confidence === 'all' || p.confidence === confidence)
      && (!Number.isFinite(minFrpValue) || (p.frp != null && p.frp >= minFrpValue)));
  }, [hotspots, confidence, minFrp]);
  const visibleHotspots = useMemo(() => filteredHotspots.filter((p) => satellite === 'all' || satelliteKey(p.satellite) === satellite), [filteredHotspots, satellite]);
  const validWindGrid = useMemo(() => windGrid.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon) && Number.isFinite(p.windDeg) && Number.isFinite(p.windSpeed)), [windGrid]);
  const satelliteCounts = Object.keys(SATELLITES).map((key) => ({ key, label: SATELLITES[key], count: filteredHotspots.filter((p) => satelliteKey(p.satellite) === key).length }));
  const plottedPoints = viewMode === 'cluster' ? clusterPoints(visibleHotspots) : visibleHotspots;
  return <div className="map-layout"><aside className="stats-panel map-summary"><p className="eyebrow">PANTAUAN KALIMANTAN</p><h2>Titik panas</h2><p className="panel-lead">Gunakan peta ini untuk melihat lokasi yang perlu diperhatikan. Satu titik belum otomatis berarti kebakaran besar.</p><div className="view-switcher" role="group" aria-label="Mode visualisasi"><button type="button" className={viewMode === 'markers' ? 'selected' : ''} onClick={() => setViewMode('markers')}>Titik</button><button type="button" className={viewMode === 'cluster' ? 'selected' : ''} onClick={() => setViewMode('cluster')}>Cluster</button><button type="button" className={viewMode === 'heatmap' ? 'selected' : ''} onClick={() => setViewMode('heatmap')}>Heatmap</button><button type="button" className={viewMode === 'globe' ? 'selected' : ''} onClick={() => setViewMode('globe')}>3D Globe</button></div><p className="history-note">Riwayat sesi: {history} kali data dimuat</p><div className="map-filters"><label className="field-label" htmlFor="period">Periode</label><select id="period" className="period-select wide" value={days} onChange={(e) => setDays(Number(e.target.value))}><option value={1}>1 hari (24 jam)</option><option value={2}>2 hari (48 jam)</option><option value={3}>3 hari (72 jam)</option></select><label className="field-label" htmlFor="satellite">Satelit</label><select id="satellite" className="period-select wide" value={satellite} onChange={(e) => setSatellite(e.target.value)}><option value="all">Semua satelit</option><option value="NOAA20">NOAA-20</option><option value="NOAA21">NOAA-21</option></select><label className="field-label" htmlFor="confidence">Confidence FIRMS</label><select id="confidence" className="period-select wide" value={confidence} onChange={(e) => setConfidence(e.target.value)}><option value="all">Semua kategori</option><option value="h">Tinggi</option><option value="n">Normal</option><option value="l">Rendah</option></select><label className="field-label" htmlFor="min-frp">FRP minimum (MW)</label><input id="min-frp" className="period-select wide" type="number" min="0" step="0.1" placeholder="Semua" value={minFrp} onChange={(e) => setMinFrp(e.target.value)} /></div>{loading && <p className="muted" role="status">Memuat observasi dan arah angin…</p>}{showingCache && <p className="muted" role="status">Menampilkan data tersimpan, mengambil pembaruan…</p>}{error && <p className="error-text">Data belum dapat dimuat. Pastikan backend dan FIRMS_KEY aktif.</p>}{!loading && !error && <><div className="main-count"><strong>{visibleHotspots.length.toLocaleString('id-ID')}</strong><span>observasi ditampilkan</span></div><div className="satellite-breakdown">{satelliteCounts.map((item) => <button type="button" className={`satellite-stat ${satellite === item.key ? 'selected' : ''}`} key={item.key} onClick={() => setSatellite(satellite === item.key ? 'all' : item.key)}><i style={{ backgroundColor: MARKER_COLORS[item.key] }} /> <span>{item.label}</span><b>{item.count.toLocaleString('id-ID')}</b></button>)}</div><button type="button" className="secondary-button export-button" onClick={() => downloadCsv(visibleHotspots)}>Unduh CSV hasil filter</button></>}{fetchedAt && <p className="data-time">Data NASA FIRMS diperbarui: {formatUtc(fetchedAt)}{(stale || refreshPending) ? ' (data tersimpan, sedang diperbarui)' : ''} · rentang {windowLabel(windowStart, days)}</p>}<p className="source-note"><b>Bukan jumlah kebakaran:</b> satu lokasi dapat diamati beberapa kali oleh NOAA-20 dan NOAA-21.</p><p className="source-note">FRP adalah estimasi energi radiasi panas dari piksel aktif, bukan luas api.</p><p className="source-note">Animasi asap hanya ilustrasi arah angin OpenWeatherMap.</p></aside><div className="map-area">{viewMode === 'globe' ? <GlobeView points={visibleHotspots} /> : <MapContainer center={[-1, 116]} zoom={6} preferCanvas style={{ height: '100%', width: '100%' }} scrollWheelZoom dragging touchZoom doubleClickZoom><TileLayer updateWhenIdle updateWhenZooming={false} keepBuffer={1} url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />{smokeEnabled && validWindGrid.length > 0 && visibleHotspots.length > 0 && <SmokeOverlay points={visibleHotspots} windGrid={validWindGrid} />}{plottedPoints.map((hotspot, index) => { const key = satelliteKey(hotspot.satellite); return <CircleMarker key={`${hotspot.lat}-${hotspot.lon}-${index}`} center={[hotspot.lat, hotspot.lon]} radius={viewMode === 'cluster' ? Math.min(18, 5 + hotspot.count) : viewMode === 'heatmap' ? 12 : markerRadius(hotspot)} pathOptions={{ color: MARKER_COLORS[key], fillColor: MARKER_COLORS[key], fillOpacity: 0.72, weight: 1 }}><Popup><HotspotPopup hotspot={hotspot} /></Popup></CircleMarker>; })}<div className="map-legend"><strong>Legenda</strong><span><i style={{ backgroundColor: MARKER_COLORS.NOAA20 }} /> NOAA-20</span><span><i style={{ backgroundColor: MARKER_COLORS.NOAA21 }} /> NOAA-21</span><small>Ukuran lebih besar = confidence tinggi</small></div></MapContainer>}</div></div>;
}