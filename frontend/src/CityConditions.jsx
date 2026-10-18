import { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from './config';

const AQI_TEXT = { 1: 'Baik', 2: 'Cukup', 3: 'Sedang', 4: 'Buruk', 5: 'Sangat buruk' };
const AQI_CLASS = { 1: 'air-good', 2: 'air-fair', 3: 'air-moderate', 4: 'air-poor', 5: 'air-very-poor' };

function formatDate(value) {
  if (!value) return 'waktu tidak tersedia';
  return new Date(value).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function CityConditions() {
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    axios.get(`${API_URL}/api/wind`, { timeout: 30000 })
      .then(({ data }) => { if (!cancelled) setCities(data.grid || []); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <section className="cities-page">
      <div className="page-intro">
        <p className="eyebrow">KONDISI KOTA</p>
        <h2>Udara dan cuaca di Kalimantan</h2>
        <p>Bandingkan kondisi udara dan cuaca di seluruh kota pantauan Kalimantan. Indeks OWM memakai skala 1–5; PM2.5 dan PM10 adalah konsentrasi partikulat dalam µg/m³.</p>
      </div>
      {loading && <p className="muted" role="status">Memuat kondisi kota…</p>}
      {error && <p className="error-text">Data kota belum tersedia. Pastikan backend dan OWM_KEY aktif.</p>}
      <div className="city-grid">
        {cities.map((city) => {
          const air = city.airQuality;
          return (
            <article className="city-card" key={city.name}>
              <div className="city-card-top"><div><h3>{city.name}</h3><span>{city.description || '—'}</span></div><span className={`air-badge ${AQI_CLASS[air?.aqi] || ''}`}>{AQI_TEXT[air?.aqi] || 'Belum ada indeks'}</span></div>
              <div className="city-temperature">{city.temp == null ? '—' : `${Math.round(city.temp)}°`}<small> C</small><span className="weather-context">kelembapan {city.humidity == null ? '—' : `${city.humidity}%`}</span></div>
              <div className="city-metrics">
                <div><span>Indeks OWM</span><strong>{air?.aqi ?? '—'}</strong><small>skala 1–5</small></div>
                <div><span>PM2.5</span><strong>{air?.pm2_5 ?? '—'}</strong><small>µg/m³</small></div>
                <div><span>PM10</span><strong>{air?.pm10 ?? '—'}</strong><small>µg/m³</small></div>
              </div>
              <div className="city-extra"><span>Angin {city.windSpeed == null ? '—' : `${(city.windSpeed * 3.6).toFixed(1)} km/jam`}</span><span>Data udara {formatDate(air?.fetchedAt)}</span></div>
              <p className="city-updated">Sumber: OpenWeatherMap · titik koordinat kota, bukan sensor di setiap jalan</p>
            </article>
          );
        })}
      </div>
      {!loading && !error && cities.length === 0 && <p className="muted">Belum ada data kota.</p>}
    </section>
  );
}