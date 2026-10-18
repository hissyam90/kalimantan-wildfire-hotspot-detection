import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import axios from 'axios';
import { API_URL } from './config';
import SmokeOverlay from './SmokeOverlay';

const SATELLITES = { NOAA20: 'NOAA-20', NOAA21: 'NOAA-21' };
const MARKER_COLORS = { NOAA20: '#d97706', NOAA21: '#b91c1c' };
function satelliteKey(value) { return String(value || '').includes('21') ? 'NOAA21' : 'NOAA20'; }
function confidenceLabel(value) { return value === 'h' ? 'tinggi' : value === 'n' ? 'normal' : value === 'l' ? 'rendah' : 'tidak tersedia'; }
function markerRadius(hotspot) { return hotspot.confidence === 'h' ? 7 : hotspot.confidence === 'l' ? 4 : 5; }
function observationTime(value) { const time = String(value || '').padStart(4, '0'); return value ? `${time.slice(0, 2)}:${time.slice(2)} UTC` : 'waktu tidak tersedia'; }

function HotspotPopup({ hotspot }) {
  const satellite = String(hotspot.satellite || 'VIIRS').replace('VIIRS_', '').replace(/^N20$/, 'NOAA-20').replace(/^N21$/, 'NOAA-21');
  return <article className="hotspot-popup">
    <span className="eyebrow">NASA FIRMS · VIIRS</span>
    <h3>Lokasi teramati panas</h3>
    <dl>
      <div><dt>Koordinat</dt><dd>{Number(hotspot.lat).toFixed(3)}, {Number(hotspot.lon).toFixed(3)}</dd></div>
      <div><dt>Waktu pengamatan</dt><dd>{hotspot.date || '—'} · {observationTime(hotspot.time)}</dd></div>
      <div><dt>Satelit pengamat</dt><dd>{satellite}</dd></div>
      <div><dt>Confidence FIRMS</dt><dd>{confidenceLabel(hotspot.confidence)}</dd></div>
      {hotspot.frp != null && <div><dt>FRP</dt><dd>{hotspot.frp.toFixed(1)} MW</dd></div>}
    </dl>
    <p className="popup-help">Titik ini menunjukkan panas yang teramati satelit, bukan kepastian kebakaran. Cocokkan lokasi dan waktunya dengan laporan setempat.</p>
  </article>;
}

export default function HotspotMap({ smokeEnabled = true }) {
  const [days, setDays] = useState(1); const [satellite, setSatellite] = useState('all'); const [hotspots, setHotspots] = useState([]); const [windGrid, setWindGrid] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(false); const [stale, setStale] = useState(false); const [fetchedAt, setFetchedAt] = useState(null);
  useEffect(() => { let cancelled = false; Promise.allSettled([axios.get(`${API_URL}/api/hotspots`, { params: { days }, timeout: 30000 }), axios.get(`${API_URL}/api/wind`, { timeout: 30000 })]).then(([hotspotResult, windResult]) => { if (cancelled) return; if (hotspotResult.status === 'fulfilled') { const data = hotspotResult.value.data; setHotspots(data.hotspots || []); setFetchedAt(data.fetchedAt); setStale(Boolean(data.stale)); setError(false); } else { setHotspots([]); setFetchedAt(null); setError(true); } setWindGrid(windResult.status === 'fulfilled' ? (windResult.value.data.grid || []) : []); }).finally(() => { if (!cancelled) setLoading(false); }); return () => { cancelled = true; }; }, [days]);
  const timestamps = hotspots.map((point) => Date.parse(point.observedAt)).filter(Number.isFinite);
  const latest = timestamps.length ? new Date(Math.max(...timestamps)) : null;
  const oldest = timestamps.length ? new Date(Math.min(...timestamps)) : null;
  const validWindGrid = windGrid.filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lon) && Number.isFinite(point.windDeg) && Number.isFinite(point.windSpeed));
  const visibleHotspots = satellite === 'all' ? hotspots : hotspots.filter((point) => satelliteKey(point.satellite) === satellite);
  const satelliteCounts = Object.keys(SATELLITES).map((key) => ({ key, label: SATELLITES[key], count: hotspots.filter((point) => satelliteKey(point.satellite) === key).length }));
  return <div className="map-layout">
    <aside className="stats-panel map-summary"><p className="eyebrow">PANTAUAN KALIMANTAN</p><h2>Titik panas</h2><p className="panel-lead">Gunakan peta ini untuk melihat lokasi yang perlu diperhatikan. Satu titik belum otomatis berarti kebakaran besar.</p><div className="map-filters"><label className="field-label" htmlFor="period">Periode</label><select id="period" className="period-select wide" value={days} onChange={(event) => { setLoading(true); setError(false); setDays(Number(event.target.value)); }}><option value={1}>24 jam terakhir</option><option value={2}>48 jam terakhir</option></select><label className="field-label" htmlFor="satellite">Satelit</label><select id="satellite" className="period-select wide" value={satellite} onChange={(event) => setSatellite(event.target.value)}><option value="all">Semua satelit</option><option value="NOAA20">NOAA-20</option><option value="NOAA21">NOAA-21</option></select></div>
      {loading && <p className="muted" role="status">Memuat observasi dan arah angin…</p>}
      {error && <p className="error-text">Data belum dapat dimuat. Pastikan backend dan FIRMS_KEY aktif.</p>}
      {!loading && !error && <>
        <div className="main-count"><strong>{visibleHotspots.length.toLocaleString('id-ID')}</strong><span>observasi ditampilkan</span></div><div className="satellite-breakdown">{satelliteCounts.map((item) => <button type="button" className={`satellite-stat ${satellite === item.key ? 'selected' : ''}`} key={item.key} onClick={() => setSatellite(satellite === item.key ? 'all' : item.key)}><i style={{ backgroundColor: MARKER_COLORS[item.key] }} /> <span>{item.label}</span><b>{item.count.toLocaleString('id-ID')}</b></button>)}</div>
        <div className="map-facts">
          <div><span>Observasi terbaru (waktu perangkat)</span><b>{latest ? latest.toLocaleString('id-ID') : '—'}</b></div>
          <div><span>Rentang pengamatan (waktu perangkat)</span><b>{oldest && latest ? `${oldest.toLocaleString('id-ID')} – ${latest.toLocaleString('id-ID')}` : '—'}</b></div>
        </div>
      </>}
      {fetchedAt && <p className="data-time">Data NASA FIRMS diperbarui: {new Date(fetchedAt).toLocaleString('id-ID')}{stale ? ' (data tersimpan sementara)' : ''}</p>}
      <p className="source-note"><b>Bukan jumlah kebakaran:</b> satu lokasi dapat diamati beberapa kali oleh NOAA-20 dan NOAA-21. Waktu lintasan dan cakupan berbeda sehingga jumlah observasi kedua satelit tidak harus sama.</p>
      <p className="source-note">Animasi asap hanya ilustrasi arah angin OpenWeatherMap, bukan sebaran asap yang terukur.</p>
      <p className="source-note">Sumber: NASA FIRMS VIIRS NOAA-20/NOAA-21.</p>
    </aside>
    <div className="map-area"><MapContainer center={[-1, 116]} zoom={6} preferCanvas style={{ height: '100%', width: '100%' }} scrollWheelZoom dragging touchZoom doubleClickZoom><TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />{smokeEnabled && validWindGrid.length > 0 && visibleHotspots.length > 0 && <SmokeOverlay points={visibleHotspots} windGrid={validWindGrid} />}{visibleHotspots.map((hotspot, index) => { const key = satelliteKey(hotspot.satellite); return <CircleMarker key={`${hotspot.lat}-${hotspot.lon}-${index}`} center={[hotspot.lat, hotspot.lon]} radius={markerRadius(hotspot)} pathOptions={{ color: MARKER_COLORS[key], fillColor: MARKER_COLORS[key], fillOpacity: 0.72, weight: 1 }}><Popup><HotspotPopup hotspot={hotspot} /></Popup></CircleMarker>; })}<div className="map-legend"><strong>Legenda</strong><span><i style={{ backgroundColor: MARKER_COLORS.NOAA20 }} /> NOAA-20</span><span><i style={{ backgroundColor: MARKER_COLORS.NOAA21 }} /> NOAA-21</span><small>Ukuran lebih besar = confidence tinggi</small></div></MapContainer></div>
  </div>;
}