import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import axios from 'axios';
import { API_URL } from './config';
import SmokeOverlay from './SmokeOverlay';

const MARKER_STYLE = { color: '#A8462F', fillColor: '#A8462F', fillOpacity: 0.7, weight: 1 };
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
    </dl>
    <p className="popup-help">Titik ini menunjukkan panas yang teramati satelit, bukan kepastian kebakaran. Cocokkan lokasi dan waktunya dengan laporan setempat.</p>
  </article>;
}

export default function HotspotMap({ smokeEnabled = true }) {
  const [days, setDays] = useState(1); const [hotspots, setHotspots] = useState([]); const [windGrid, setWindGrid] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(false); const [stale, setStale] = useState(false); const [fetchedAt, setFetchedAt] = useState(null);
  useEffect(() => { let cancelled = false; Promise.allSettled([axios.get(`${API_URL}/api/hotspots`, { params: { days }, timeout: 30000 }), axios.get(`${API_URL}/api/wind`, { timeout: 30000 })]).then(([hotspotResult, windResult]) => { if (cancelled) return; if (hotspotResult.status === 'fulfilled') { const data = hotspotResult.value.data; setHotspots(data.hotspots || []); setFetchedAt(data.fetchedAt); setStale(Boolean(data.stale)); setError(false); } else { setHotspots([]); setFetchedAt(null); setError(true); } setWindGrid(windResult.status === 'fulfilled' ? (windResult.value.data.grid || []) : []); }).finally(() => { if (!cancelled) setLoading(false); }); return () => { cancelled = true; }; }, [days]);
  const timestamps = hotspots.map((point) => Date.parse(point.observedAt)).filter(Number.isFinite);
  const latest = timestamps.length ? new Date(Math.max(...timestamps)) : null;
  const oldest = timestamps.length ? new Date(Math.min(...timestamps)) : null;
  const validWindGrid = windGrid.filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lon) && Number.isFinite(point.windDeg) && Number.isFinite(point.windSpeed));
  return <div className="map-layout">
    <aside className="stats-panel map-summary"><p className="eyebrow">PANTAUAN KALIMANTAN</p><h2>Titik panas</h2><p className="panel-lead">Gunakan peta ini untuk melihat lokasi yang perlu diperhatikan. Satu titik belum otomatis berarti kebakaran besar.</p><label className="field-label" htmlFor="period">Tampilkan data</label><select id="period" className="period-select wide" value={days} onChange={(event) => { setLoading(true); setError(false); setDays(Number(event.target.value)); }}><option value={1}>24 jam terakhir</option><option value={2}>48 jam terakhir</option></select>
      {loading && <p className="muted" role="status">Memuat observasi dan arah angin…</p>}
      {error && <p className="error-text">Data belum dapat dimuat. Pastikan backend dan FIRMS_KEY aktif.</p>}
      {!loading && !error && <>
        <div className="main-count"><strong>{hotspots.length.toLocaleString('id-ID')}</strong><span>observasi titik panas</span></div>
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
    <div className="map-area"><MapContainer center={[-1, 116]} zoom={6} preferCanvas style={{ height: '100%', width: '100%' }} scrollWheelZoom dragging touchZoom doubleClickZoom><TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />{smokeEnabled && validWindGrid.length > 0 && hotspots.length > 0 && <SmokeOverlay points={hotspots} windGrid={validWindGrid} />}{hotspots.map((hotspot, index) => <CircleMarker key={`${hotspot.lat}-${hotspot.lon}-${index}`} center={[hotspot.lat, hotspot.lon]} radius={5} pathOptions={MARKER_STYLE}><Popup><HotspotPopup hotspot={hotspot} /></Popup></CircleMarker>)}</MapContainer></div>
  </div>;
}