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
    if (d < bestDist) { bestDist = d; best = g; }
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
  return 'Sedang';
}

function daynightLabel(d) {
  if (d === 'D') return 'Siang';
  if (d === 'N') return 'Malam';
  return '-';
}

function formatTime(t) {
  const p = String(t || '').padStart(4, '0');
  return `${p.slice(0, 2)}:${p.slice(2)} UTC`;
}

function formatWindow(startIso, endIso) {
  const opts = { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };
  const f = (iso) => new Date(iso).toLocaleString('id-ID', opts);
  return `${f(startIso)} - ${f(endIso)}`;
}

function TouchpadNavigation({ enabled }) {
  const map = useMap();

  useEffect(() => {
    if (!enabled) return;
    const container = map.getContainer();

    const onWheel = (e) => {
      if (e.ctrlKey) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const factor = e.deltaMode === 1 ? 16 : 1;
      map.panBy([e.deltaX * factor, e.deltaY * factor], { animate: false });
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
      <div className="popup-row"><span>Kecerahan</span><span>{h.brightness}</span></div>
      <div className="popup-row"><span>Daya radiatif api</span><span>{isNaN(h.frp) ? '-' : `${h.frp} MW`}</span></div>
      <div className="popup-row"><span>Keyakinan</span><span>{confidenceLabel(h.confidence)}</span></div>
      <div className="popup-row"><span>Waktu deteksi</span><span>{daynightLabel(h.daynight)}</span></div>
      <div className="popup-row"><span>Satelit</span><span>{h.satellite || '-'}</span></div>
      <div className="popup-row"><span>Tanggal</span><span>{h.date} {formatTime(h.time)}</span></div>

      {nearest && (
        <>
          <div className="popup-divider" />
          <div className="popup-row"><span>Wilayah acuan</span><span>{nearest.name} (±{Math.round(dist)} km)</span></div>
          <div className="popup-row"><span>Suhu</span><span>{nearest.temp != null ? `${nearest.temp}°C` : '-'}</span></div>
          <div className="popup-row"><span>Kelembapan</span><span>{nearest.humidity != null ? `${nearest.humidity}%` : '-'}</span></div>
          <div className="popup-row"><span>Cuaca</span><span>{nearest.description || '-'}</span></div>
          <div className="popup-row"><span>Arah angin</span><span>{degToCompass(nearest.windDeg)} ({nearest.windSpeed} m/s)</span></div>
        </>
      )}
    </div>
  );
}

export default function HotspotMap({ theme }) {
  const [days, setDays] = useState(1);
  const [hotspots, setHotspots] = useState([]);
  const [windGrid, setWindGrid] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [stale, setStale] = useState(false);
  const [fetchedAt, setFetchedAt] = useState(null);
  const [windowInfo, setWindowInfo] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [smokeEnabled, setSmokeEnabled] = useState(true);
  const [touchpadMode, setTouchpadMode] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    setWindowInfo(null);

    axios.get(`${API_URL}/api/hotspots`, { params: { days }, timeout: 30000 })
      .then((res) => {
        if (cancelled) return;
        setHotspots(res.data.hotspots);
        setFetchedAt(res.data.fetchedAt || null);
        setStale(Boolean(res.data.stale));
        setWindowInfo({ start: res.data.windowStart, end: res.data.windowEnd });
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Gagal ambil hotspot:', err.message);
        setHotspots([]);
        setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [days, reloadKey]);

  useEffect(() => {
    axios.get(`${API_URL}/api/wind`)
      .then((res) => setWindGrid(res.data.grid))
      .catch((err) => console.error('Gagal ambil data angin:', err.message));
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
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={1}>24 jam terakhir</option>
            <option value={2}>48 jam terakhir</option>
          </select>
        </div>
        {windowInfo && (
          <p className="period-range">
            {formatWindow(windowInfo.start, windowInfo.end)} (waktu setempat)
          </p>
        )}

        {loading ? (
          <p className="muted">Memuat data...</p>
        ) : error ? (
          <div>
            <p className="error-text">Gagal memuat data titik panas dari server.</p>
            <button className="retry-button" onClick={() => setReloadKey((k) => k + 1)}>
              Coba lagi
            </button>
          </div>
        ) : (
          <>
            {stale && (
              <p className="muted" style={{ marginBottom: 12 }}>
                NASA sedang tidak merespons, menampilkan data tersimpan terakhir.
              </p>
            )}
            {hotspots.length === 0 && (
              <p className="muted" style={{ marginBottom: 12 }}>
                Tidak ada titik panas terdeteksi pada periode ini. Bisa berarti wilayah sedang bersih, atau data satelit terbaru belum tersedia dari NASA.
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
                  {new Date(fetchedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )}

            <label className="toggle-row">
              <span>Animasi asap</span>
              <input
                type="checkbox"
                checked={smokeEnabled}
                onChange={(e) => setSmokeEnabled(e.target.checked)}
              />
            </label>
            <label className="toggle-row">
              <span>Geser peta dengan 2 jari</span>
              <input
                type="checkbox"
                checked={touchpadMode}
                onChange={(e) => setTouchpadMode(e.target.checked)}
              />
            </label>
            <p className="toggle-hint">
              {touchpadMode
                ? 'Geser 2 jari untuk memindahkan peta. Cubit atau tombol +/- untuk zoom.'
                : 'Scroll untuk zoom. Klik tahan lalu geser untuk memindahkan peta.'}
            </p>

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
              Sumber titik panas: NASA FIRMS (VIIRS NRT). Cuaca & arah angin: OpenWeatherMap,
              dari 10 titik referensi regional terdekat.
            </p>
          </>
        )}
      </aside>

      <div className="map-area">
        <MapContainer center={[-1, 116]} zoom={6} preferCanvas={true} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />
          <TouchpadNavigation enabled={touchpadMode} />
          {markers}
          {smokePoints.length > 0 && <SmokeOverlay points={smokePoints} windGrid={windGrid} />}
        </MapContainer>
      </div>
    </div>
  );
}