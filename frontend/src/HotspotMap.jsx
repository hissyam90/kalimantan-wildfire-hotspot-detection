import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import axios from 'axios';
import { API_URL } from './config';

const MARKER_STYLE = { color: '#A8462F', fillColor: '#A8462F', fillOpacity: 0.7, weight: 1 };
function observationTime(value) { const time = String(value || '').padStart(4, '0'); return value ? `${time.slice(0, 2)}:${time.slice(2)} UTC` : 'waktu tidak tersedia'; }

function HotspotPopup({ hotspot }) {
  return <div className="hotspot-popup"><strong>Perkiraan titik panas</strong><p>Lokasi: {Number(hotspot.lat).toFixed(3)}, {Number(hotspot.lon).toFixed(3)}</p><p>Diamati satelit: {observationTime(hotspot.time)}</p><p className="popup-help">Gunakan informasi ini sebagai petunjuk awal dan bandingkan dengan kondisi di lapangan.</p></div>;
}

export default function HotspotMap() {
  const [days, setDays] = useState(1); const [hotspots, setHotspots] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(false); const [stale, setStale] = useState(false); const [fetchedAt, setFetchedAt] = useState(null);
  useEffect(() => { let cancelled = false; axios.get(`${API_URL}/api/hotspots`, { params: { days }, timeout: 30000 }).then(({ data }) => { if (!cancelled) { setHotspots(data.hotspots || []); setFetchedAt(data.fetchedAt); setStale(Boolean(data.stale)); } }).catch(() => { if (!cancelled) { setHotspots([]); setError(true); } }).finally(() => { if (!cancelled) setLoading(false); }); return () => { cancelled = true; }; }, [days]);
  return <div className="map-layout">
    <aside className="stats-panel map-summary"><p className="eyebrow">PANTAUAN KALIMANTAN</p><h2>Titik panas</h2><p className="panel-lead">Gunakan peta ini untuk melihat lokasi yang perlu diperhatikan. Satu titik belum otomatis berarti kebakaran besar.</p><label className="field-label" htmlFor="period">Tampilkan data</label><select id="period" className="period-select wide" value={days} onChange={(event) => { setLoading(true); setError(false); setDays(Number(event.target.value)); }}><option value={1}>24 jam terakhir</option><option value={2}>48 jam terakhir</option></select>
      {loading && <p className="muted" role="status">Memuat observasi…</p>}{error && <p className="error-text">Observasi belum dapat dimuat. Coba lagi nanti.</p>}{!loading && !error && <div className="main-count"><strong>{hotspots.length}</strong><span>titik panas dalam periode ini</span></div>}{fetchedAt && <p className="data-time">Data NASA FIRMS diperbarui: {new Date(fetchedAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}{stale ? ' (tersimpan sementara)' : ''}</p>}<p className="source-note">Sumber: NASA FIRMS VIIRS. Titik pada peta adalah hasil pengamatan satelit, bukan laporan kualitas udara dan bukan hasil CNN.</p></aside>
    <div className="map-area"><MapContainer center={[-1, 116]} zoom={6} preferCanvas style={{ height: '100%', width: '100%' }} scrollWheelZoom dragging touchZoom doubleClickZoom><TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />{hotspots.map((hotspot, index) => <CircleMarker key={`${hotspot.lat}-${hotspot.lon}-${index}`} center={[hotspot.lat, hotspot.lon]} radius={5} pathOptions={MARKER_STYLE}><Popup><HotspotPopup hotspot={hotspot} /></Popup></CircleMarker>)}</MapContainer></div>
  </div>;
}