import { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from './config';

function aqiLabel(value) {
  if (value == null) return 'AQI unavailable';
  if (value <= 50) return 'Good';
  if (value <= 100) return 'Moderate';
  if (value <= 150) return 'Unhealthy for sensitive groups';
  if (value <= 200) return 'Unhealthy';
  if (value <= 300) return 'Very unhealthy';
  return 'Hazardous';
}
function aqiClass(value) { return value == null ? '' : value <= 50 ? 'air-good' : value <= 100 ? 'air-moderate' : 'air-poor'; }

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
        <p>Bandingkan AQI resmi IQAir dan kondisi cuaca di kota-kota pantauan Kalimantan. AQI memakai skala US AQI; PM2.5 dan PM10 adalah konsentrasi partikulat dalam µg/m³.</p>
      </div>
      {loading && <p className="muted" role="status">Memuat kondisi kota…</p>}
      {error && <p className="error-text">Data kota belum tersedia. Pastikan backend dan IQAIR_KEY atau OWM_KEY aktif.</p>}
      <div className="city-grid">
        {cities.map((city) => {
          const air = city.airQuality;
          return (
            <article className="city-card" key={city.name}>
              <div className="city-card-top"><div><h3>{city.name}</h3><span>{city.description || 'Weather unavailable'}</span></div><span className={`air-badge ${aqiClass(air?.aqi)}`}>{aqiLabel(air?.aqi)}</span></div>
              <div className="city-temperature">{city.temp == null ? '—' : `${Math.round(city.temp)}°`}<small> C</small><span className="weather-context">kelembapan {city.humidity == null ? '—' : `${city.humidity}%`}</span></div>
              <div className="city-metrics">
                <div><span>IQAir AQI</span><strong>{air?.aqi ?? '—'}</strong><small>{air ? 'US AQI' : 'not available'}</small></div>
                <div><span>PM2.5</span><strong>{air?.pm2_5 ?? '—'}</strong><small>µg/m³</small></div>
                <div><span>PM10</span><strong>{air?.pm10 ?? '—'}</strong><small>µg/m³</small></div>
              </div>
              <div className="city-extra"><span>Angin {city.windSpeed == null ? '—' : `${(city.windSpeed * 3.6).toFixed(1)} km/jam`}</span><span>Station {air?.station || 'unavailable'}</span></div>
              <p className="city-updated">Air source: {air?.source || 'IQAir unavailable'} · {formatDate(air?.fetchedAt)} · weather: OpenWeatherMap</p>
            </article>
          );
        })}
      </div>
      {!loading && !error && cities.length === 0 && <p className="muted">Belum ada data kota.</p>}
    </section>
  );
}