import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import {
  PieChart, Pie, Cell, Tooltip as RechartsTooltip,
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer
} from 'recharts';
import axios from 'axios';
import SmokeOverlay from './SmokeOverlay';
import { API_URL } from './config';

const MARKER_STYLE = { color: '#A8462F', fillColor: '#A8462F', fillOpacity: 0.6, weight: 1 };
const CONFIDENCE_COLORS = { Tinggi: '#A8462F', Sedang: '#C98A4B', Rendah: '#8C8672' };

function nearestWind(lat, lon, grid) {
  let best = grid[0];
  let bestDist = Infinity;
  for (const g of grid) {
    const d = Math.hypot(g.lat - lat, g.lon - lon);
    if (d < bestDist) { 
      bestDist = d; 
      best = g; 
    }
  }
  return best;
}

function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function degToCompass(deg) {
  const dirs = ['Utara', 'Timur Laut', 'Timur', 'Tenggara', 'Selatan', 'Barat Daya', 'Barat', 'Barat Laut'];
  return dirs[Math.round(deg / 45) % 8];
}

function confidenceLabel(c) {
  if (c === 'h' || c === 'high') return 'Tinggi';
  if (c === 'l' || c === 'low') return 'Rendah';
  if (c === 'n' || c === 'nominal') return 'Nominal';
  return 'Tidak diketahui';
}

function daynightLabel(d) {
  if (d === 'D') return 'Siang';
  if (d === 'N') return 'Malam';
  return '-';
}

function aqiLabel(aqi) {
  return ({ 1: 'Baik', 2: 'Sedang', 3: 'Kurang sehat', 4: 'Tidak sehat', 5: 'Sangat tidak sehat' })[aqi] || 'Tidak tersedia';
}

function formatTime(t) {
  const p = String(t || '').padStart(4, '0');
  return `${p.slice(0, 2)}:${p.slice(2)} UTC`;
}

function formatWindow(startIso, endIso) {
  const opts = { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short' };
  const f = (iso) => new Date(iso).toLocaleString('id-ID', opts);
  return `${f(startIso)} - ${f(endIso)}`;
}

function TouchpadNavigation({ enabled }) {
  const map = useMap();

  useEffect(() => {
    if (!enabled) return;
    const container = map.getContainer();

    const onWheel = (e) => {
      if (e.ctrlKey || e.metaKey) return;

      const isMouseWheel = Math.abs(e.deltaY) >= 100 || Math.abs(e.deltaX) >= 100 || e.deltaMode !== 0;
      if (isMouseWheel) return;

      e.preventDefault();
      e.stopImmediatePropagation();
      map.panBy([e.deltaX, e.deltaY], { animate: false });
    };

    container.addEventListener('wheel', onWheel, { capture: true, passive: false });
    return () => {
      container.removeEventListener('wheel', onWheel, { capture: true });
    };
  }, [map, enabled]);

  return null;
}

function HotspotPopup({ h, windGrid }) {
  const nearest = windGrid.length > 0 ? nearestWind(h.lat, h.lon, windGrid) : null;
  const dist = nearest ? distanceKm(h.lat, h.lon, nearest.lat, nearest.lon) : null;

  return (
    <div className="hotspot-popup">
      <div className="popup-row"><span>Brightness temperature I4 (K)</span><span>{h.brightness}</span></div>
      <div className="popup-row"><span>Daya radiatif api</span><span>{isNaN(h.frp) ? '-' : `${h.frp} MW`}</span></div>
      <div className="popup-row"><span>Confidence FIRMS (bukan CNN)</span><span>{confidenceLabel(h.confidence)}</span></div>
      <div className="popup-row"><span>Mode siang/malam</span><span>{daynightLabel(h.daynight)}</span></div>
      <div className="popup-row"><span>Satelit</span><span>{h.satellite || '-'}</span></div>
      {nearest?.airQuality && <div className="popup-row"><span>AQI regional terdekat</span><span>{aqiLabel(nearest.airQuality.aqi)}{nearest.airQuality.pm2_5 == null ? '' : ` · PM2.5 ${nearest.airQuality.pm2_5} µg/m³`}</span></div>}
      <div className="popup-row"><span>Observasi UTC</span><span>{h.date} {formatTime(h.time)}</span></div>
      <p>Confidence FIRMS adalah kategori deteksi, bukan probabilitas kebakaran.</p>

      {nearest && (
        <>
          <div className="popup-divider" />
          <p>Cuaca regional, bukan pengukuran pada titik hotspot.</p>
          <div className="popup-row"><span>Wilayah acuan</span><span>{nearest.name} (±{Math.round(dist)} km)</span></div>
          <div className="popup-row"><span>Suhu</span><span>{nearest.temp != null ? `${nearest.temp}°C` : '-'}</span></div>
          <div className="popup-row"><span>Kelembapan</span><span>{nearest.humidity != null ? `${nearest.humidity}%` : '-'}</span></div>
          <div className="popup-row"><span>Cuaca</span><span>{nearest.description || '-'}</span></div>
          <div className="popup-row"><span>Arah angin</span><span>{degToCompass(nearest.windDeg)} ({nearest.windSpeed} m/s)</span></div>
          <div className="popup-row"><span>AQI regional</span><span>{nearest.airQuality?.aqi ? `${nearest.airQuality.aqi}/5` : 'Tidak tersedia'}</span></div>
          <div className="popup-row"><span>PM2.5</span><span>{nearest.airQuality?.pm2_5 != null ? `${nearest.airQuality.pm2_5} µg/m³` : 'Tidak tersedia'}</span></div>
        </>
      )}
    </div>
  );
}

export default function HotspotMap() {
  const [days, setDays] = useState(1);
  const [hotspots, setHotspots] = useState([]);
  const [windGrid, setWindGrid] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [stale, setStale] = useState(false);
  const [fetchedAt, setFetchedAt] = useState(null);
  const [windowInfo, setWindowInfo] = useState(null);
  const [sources, setSources] = useState([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [smokeEnabled, setSmokeEnabled] = useState(false);
  const [windStatus, setWindStatus] = useState('Memuat konteks cuaca regional…');

  useEffect(() => {
    let cancelled = false;

    axios.get(`${API_URL}/api/hotspots`, { params: { days }, timeout: 30000 })
      .then((res) => {
        if (cancelled) return;
        setHotspots(res.data.hotspots);
        setFetchedAt(res.data.fetchedAt || null);
        setStale(Boolean(res.data.stale));
        setSources(res.data.sources || []);
        setWindowInfo({ start: res.data.windowStart, end: res.data.windowEnd });
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Gagal ambil hotspot:', err.message);
        setHotspots([]);
        setSources([]);
        setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [days, reloadKey]);

  useEffect(() => {
    let cancelled = false;
    axios.get(`${API_URL}/api/wind`, { timeout: 30000 })
      .then((res) => {
        if (cancelled) return;
        setWindGrid(res.data.grid);
        setWindStatus(res.data.stale ? 'Cuaca dan AQI regional usang dari cache.' : 'Cuaca dan AQI regional tersedia; bukan sensor tepat di hotspot.');
      })
      .catch(() => { if (!cancelled) setWindStatus('Cuaca/AQI regional tidak tersedia; animasi asap tidak ditampilkan.'); });
    return () => { cancelled = true; };
  }, []);

  const stats = useMemo(() => {
    const confidenceCounts = {};
    const hourCounts = Array.from({ length: 24 }, (_, h) => ({ jam: `${h}`, jumlah: 0 }));

    hotspots.forEach((h) => {
      const label = confidenceLabel(h.confidence);
      confidenceCounts[label] = (confidenceCounts[label] || 0) + 1;

      const t = parseInt(h.time, 10);
      if (!isNaN(t)) {
        const hour = Math.floor(t / 100);
        if (hourCounts[hour]) hourCounts[hour].jumlah += 1;
      }
    });

    return {
      confidenceCounts,
      hourCounts,
      pieData: Object.entries(confidenceCounts).map(([name, value]) => ({ name, value }))
    };
  }, [hotspots]);

  const markers = useMemo(
    () =>
      hotspots.map((h, i) => (
        <CircleMarker
          key={`dot-${i}`}
          center={[h.lat, h.lon]}
          radius={4}
          pathOptions={MARKER_STYLE}
        >
          <Popup>
            <HotspotPopup h={h} windGrid={windGrid} />
          </Popup>
        </CircleMarker>
      )),
    [hotspots, windGrid]
  );

  const smokePoints = useMemo(() => {
    if (!smokeEnabled || windGrid.length === 0) return [];
    return hotspots.map((h) => ({ lat: h.lat, lon: h.lon }));
  }, [smokeEnabled, windGrid, hotspots]);

  const highConfidence = stats.confidenceCounts['Tinggi'] || 0;

  return (
    <div className="map-layout">
      <aside className="stats-panel">
        <h2>Statistik</h2>

        <div className="stat-row">
          <span className="result-label">Periode data</span>
          <select
            className="period-select"
            value={days}
            onChange={(e) => { setLoading(true); setError(false); setWindowInfo(null); setHotspots([]); setDays(Number(e.target.value)); }}
          >
            <option value={1}>24 jam terakhir</option>
            <option value={2}>48 jam terakhir</option>
          </select>
        </div>
        
        {windowInfo && (
          <p className="period-range">
            {formatWindow(windowInfo.start, windowInfo.end)}
          </p>
        )}

        {loading ? (
          <p className="muted" role="status">Memuat observasi FIRMS...</p>
        ) : error ? (
          <div>
            <p className="error-text" role="alert">Gagal memuat data titik panas. Pastikan backend aktif dan FIRMS_KEY terkonfigurasi. Kegagalan ini bukan berarti tidak ada hotspot.</p>
            <button className="retry-button" onClick={() => { setLoading(true); setError(false); setWindowInfo(null); setHotspots([]); setReloadKey((k) => k + 1); }}>
              Coba lagi
            </button>
          </div>
        ) : (
          <>
            {stale && (
              <p className="muted" style={{ marginBottom: 12 }}>
                Data usang dari cache: pembaruan FIRMS gagal. Bukan data live.
              </p>
            )}
            {hotspots.length === 0 && (
              <p className="muted" style={{ marginBottom: 12 }}>
                Tidak ada observasi hotspot pada periode ini. Ini bukan bukti wilayah bebas kebakaran; data mungkin belum tersedia atau belum dilaporkan oleh satelit NASA.
              </p>
            )}

            <div className="stat-row">
              <span className="result-label">Total titik panas</span>
              <span className="result-value mono">{hotspots.length}</span>
            </div>
            
            <div className="stat-row">
              <span className="result-label">Keyakinan tinggi</span>
              <span className="result-value mono">{highConfidence}</span>
            </div>
            
            {fetchedAt && (
              <div className="stat-row">
                <span className="result-label">Data diambil</span>
                <span className="result-value mono">
                  {new Date(fetchedAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short' })}
                </span>
              </div>
            )}

            {sources.length > 0 && (
              <div className="stat-row">
                <span className="result-label">Sumber FIRMS</span>
                <span className="result-value mono">{sources.filter((source) => source.status === 'available').length}/{sources.length} aktif</span>
              </div>
            )}

            <label className="toggle-row">
              <span>Animasi asap indikatif</span>
              <input
                type="checkbox"
                checked={smokeEnabled}
                onChange={(e) => setSmokeEnabled(e.target.checked)}
              />
            </label>
            <p className="toggle-hint">Bukan simulasi dispersi asap atau prediksi kualitas udara. Animasi menggunakan angin regional.</p>
            <p className="stats-note" role="status">{windStatus}</p>
            <p className="stats-note">Cakupan dashboard: Kalimantan/Borneo dan sekitarnya, bukan hanya Kalimantan Timur. Cache FIRMS berlaku 10 menit; NRT bukan observasi kontinu.</p>
            <ul className="legend" aria-label="Status sumber FIRMS">
              {sources.map((source) => <li key={source.product}>{source.product}: {source.status === 'available' ? 'tersedia saat pengambilan' : 'gagal — cakupan data parsial'}</li>)}
            </ul>
            <p className="stats-note">Confidence FIRMS adalah kategori deteksi (tinggi, nominal, rendah), bukan probabilitas terkalibrasi dan bukan confidence CNN.</p>

            <h3 className="panel-subheading">Sebaran tingkat keyakinan</h3>
            <div className="chart-box">
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={stats.pieData} dataKey="value" nameKey="name" innerRadius={32} outerRadius={55} paddingAngle={2}>
                    {stats.pieData.map((entry) => (
                      <Cell key={entry.name} fill={CONFIDENCE_COLORS[entry.name] || '#8C8672'} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
              <ul className="legend">
                {stats.pieData.map((entry) => (
                  <li key={entry.name}>
                    <span className="legend-dot" style={{ background: CONFIDENCE_COLORS[entry.name] }} />
                    {entry.name} — {entry.value}
                  </li>
                ))}
              </ul>
            </div>

            <h3 className="panel-subheading">Distribusi per jam (UTC)</h3>
            <div className="chart-box">
              <ResponsiveContainer width="100%" height={110}>
                <BarChart data={stats.hourCounts}>
                  <XAxis dataKey="jam" tick={{ fontSize: 10 }} interval={3} />
                  <YAxis tick={{ fontSize: 10 }} width={22} />
                  <RechartsTooltip />
                  <Bar dataKey="jumlah" fill="#A8462F" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <p className="stats-note">
              Sumber titik panas: NASA FIRMS (VIIRS NRT), bukan prediksi CNN. Brightness temperature bukan suhu api langsung; FRP adalah daya radiatif (MW). Cuaca, AQI & arah angin: OpenWeatherMap,
              dari 10 titik referensi regional terdekat.
            </p>
          </>
        )}
      </aside>

      <div className="map-area">
        <MapContainer 
          center={[-1, 116]} 
          zoom={6} 
          preferCanvas={true} 
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true} 
          dragging={true}
          touchZoom={true}
          doubleClickZoom={true}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />
          <TouchpadNavigation enabled={true} />
          {markers}
          {smokePoints.length > 0 && <SmokeOverlay points={smokePoints} windGrid={windGrid} />}
        </MapContainer>
      </div>
    </div>
  );
}