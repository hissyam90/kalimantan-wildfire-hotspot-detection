import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import {
  PieChart, Pie, Cell, Tooltip as RechartsTooltip,
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer
} from 'recharts';
import axios from 'axios';
import SmokeOverlay from './SmokeOverlay';
import { API_URL } from './config';

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

const CONFIDENCE_COLORS = { Tinggi: '#A8462F', Sedang: '#C98A4B', Rendah: '#8C8672' };

export default function HotspotMap({ theme }) {
  const [hotspots, setHotspots] = useState([]);
  const [windGrid, setWindGrid] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API_URL}/api/hotspots`)
      .then(res => setHotspots(res.data.hotspots))
      .catch(err => console.error('Gagal ambil hotspot:', err.message))
      .finally(() => setLoading(false));

    axios.get(`${API_URL}/api/wind`)
      .then(res => setWindGrid(res.data.grid))
      .catch(err => console.error('Gagal ambil data angin:', err.message));
  }, []);

  const confidenceCounts = hotspots.reduce((acc, h) => {
    const label = confidenceLabel(h.confidence);
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});
  const pieData = Object.entries(confidenceCounts).map(([name, value]) => ({ name, value }));

  const hourCounts = Array.from({ length: 24 }, (_, h) => ({ jam: `${h}`, jumlah: 0 }));
  hotspots.forEach(h => {
    const t = parseInt(h.time, 10);
    if (!isNaN(t)) {
      const hour = Math.floor(t / 100);
      if (hourCounts[hour]) hourCounts[hour].jumlah += 1;
    }
  });

  const highConfidence = confidenceCounts['Tinggi'] || 0;

  const smokePoints = windGrid.length > 0
    ? hotspots.map(h => {
        const w = nearestWind(h.lat, h.lon, windGrid);
        return { lat: h.lat, lon: h.lon, windDeg: w.windDeg, windSpeed: w.windSpeed };
      })
    : [];

  return (
    <div className="map-layout">
      <aside className="stats-panel">
        <h2>Statistik</h2>
        {loading ? (
          <p className="muted">Memuat data...</p>
        ) : (
          <>
            <div className="stat-row">
              <span className="result-label">Total titik panas</span>
              <span className="result-value mono">{hotspots.length}</span>
            </div>
            <div className="stat-row">
              <span className="result-label">Keyakinan tinggi</span>
              <span className="result-value mono">{highConfidence}</span>
            </div>
            <div className="stat-row">
              <span className="result-label">Periode data</span>
              <span className="result-value">24 jam terakhir</span>
            </div>

            <h3 className="panel-subheading">Sebaran tingkat keyakinan</h3>
            <div className="chart-box">
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={32} outerRadius={55} paddingAngle={2}>
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={CONFIDENCE_COLORS[entry.name] || '#8C8672'} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
              <ul className="legend">
                {pieData.map((entry) => (
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
                <BarChart data={hourCounts}>
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
        <MapContainer center={[-1, 116]} zoom={6} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />
          {hotspots.map((h, i) => {
            const nearest = windGrid.length > 0 ? nearestWind(h.lat, h.lon, windGrid) : null;
            const dist = nearest ? distanceKm(h.lat, h.lon, nearest.lat, nearest.lon) : null;

            return (
              <CircleMarker
                key={`dot-${i}`}
                center={[h.lat, h.lon]}
                radius={4}
                pathOptions={{ color: '#A8462F', fillColor: '#A8462F', fillOpacity: 0.6, weight: 1 }}
              >
                <Popup>
                  <div className="hotspot-popup">
                    <div className="popup-row"><span>Kecerahan</span><span>{h.brightness}</span></div>
                    <div className="popup-row"><span>Daya radiatif api</span><span>{isNaN(h.frp) ? '-' : `${h.frp} MW`}</span></div>
                    <div className="popup-row"><span>Keyakinan</span><span>{confidenceLabel(h.confidence)}</span></div>
                    <div className="popup-row"><span>Waktu deteksi</span><span>{daynightLabel(h.daynight)}</span></div>
                    <div className="popup-row"><span>Satelit</span><span>{h.satellite || '-'}</span></div>
                    <div className="popup-row"><span>Tanggal</span><span>{h.date} {h.time}</span></div>

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
                </Popup>
              </CircleMarker>
            );
          })}
          {smokePoints.length > 0 && <SmokeOverlay points={smokePoints} windGrid={windGrid} />}
        </MapContainer>
      </div>
    </div>
  );
}