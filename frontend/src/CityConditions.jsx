import { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from './config';

const AQI_TEXT = { 1: 'Rendah', 2: 'Sedang', 3: 'Meningkat', 4: 'Tinggi', 5: 'Sangat tinggi' };

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
        <p>Pilih kota untuk memahami konteks wilayahnya. AQI OpenWeatherMap berskala 1–5 dan merupakan gambaran regional, bukan sensor asap di setiap titik.</p>
      </div>
      {loading && <p className="muted" role="status">Memuat kondisi kota…</p>}
      {error && <p className="error-text">Data kota belum tersedia. Pastikan backend dan OWM_KEY aktif.</p>}
      <div className="city-grid">
        {cities.map((city) => {
          const air = city.airQuality;
          return (
            <article className="city-card" key={city.name}>
              <div className="city-card-top"><h3>{city.name}</h3><span>{city.description || '—'}</span></div>
              <div className="city-temperature">{city.temp == null ? '—' : `${Math.round(city.temp)}°`}<small> C</small></div>
              <div className="city-metrics">
                <div><span>AQI regional</span><strong>{AQI_TEXT[air?.aqi] || '—'}</strong><small>{air?.aqi ? `skala ${air.aqi}/5` : 'tidak tersedia'}</small></div>
                <div><span>PM2.5</span><strong>{air?.pm2_5 ?? '—'}</strong><small>µg/m³</small></div>
                <div><span>PM10</span><strong>{air?.pm10 ?? '—'}</strong><small>µg/m³</small></div>
              </div>
              <p className="city-updated">Data udara: {formatDate(air?.fetchedAt)}</p>
            </article>
          );
        })}
      </div>
      {!loading && !error && cities.length === 0 && <p className="muted">Belum ada data kota.</p>}
    </section>
  );
}