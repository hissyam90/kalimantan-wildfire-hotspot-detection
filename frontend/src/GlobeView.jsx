import { useEffect, useMemo, useState } from 'react';

// Natural-colour NASA Blue Marble; the gradient underneath remains as a visual fallback if the CDN is unavailable.
const EARTH_TEXTURE = 'https://eoimages.gsfc.nasa.gov/images/imagerecords/74000/74218/world.200412.3x5400x2700.jpg';

function project(lat, lon) {
  // The globe shows a 180° window centered at 116°E (Kalimantan), not the
  // default Greenwich-centered half of an equirectangular world texture.
  const x = 50 + (lon - 116) * (100 / 180);
  const y = 50 - (lat + 1) * 0.9;
  return { x: ((x % 100) + 100) % 100, y };
}

export default function GlobeView({ points }) {
  const [tleStatus, setTleStatus] = useState('mengambil TLE terbaru…');
  const visiblePoints = useMemo(() => points.filter((point) => Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lon))), [points]);

  useEffect(() => {
    const controller = new AbortController();
    fetch('https://celestrak.org/NORAD/elements/gp.php?GROUP=weather&FORMAT=tle', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('TLE request failed');
        return response.text();
      })
      .then((tle) => {
        const hasNoaa20 = /NOAA\s*20|JPSS-1/i.test(tle);
        const hasNoaa21 = /NOAA\s*21|JPSS-2/i.test(tle);
        if (!hasNoaa20 || !hasNoaa21) throw new Error('NOAA TLE tidak lengkap');
        setTleStatus(`TLE NOAA-20/21 diperbarui ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`);
      })
      .catch(() => setTleStatus('TLE live tidak tersedia — lintasan visual digunakan'));
    return () => controller.abort();
  }, []);

  return <section className="globe-view" aria-label="Globe satelit hotspot bumi">
    <div className="globe-heading"><span className="eyebrow">MODE SATELIT NOAA</span><h2>Bumi dan lintasan satelit</h2><p>Citra true-color menyorot Kalimantan, dengan lintasan referensi NOAA-20 dan NOAA-21. Tampilan dikunci agar posisi peta dan hotspot tetap konsisten saat presentasi.</p></div>
    <div className="globe-stage"><div className="globe-sphere" role="img" aria-label="Globe citra satelit statis">
      <div className="globe-earth"><img className="globe-earth-image" src={EARTH_TEXTURE} alt="" loading="lazy" decoding="async" onError={(event) => { event.currentTarget.hidden = true; }} /></div><span className="kalimantan-focus" aria-label="Kalimantan" title="Kalimantan" /><div className="globe-shade" />
      {visiblePoints.map((point, index) => { const position = project(Number(point.lat), Number(point.lon)); return <span className="globe-hotspot" key={`${point.lat}-${point.lon}-${index}`} style={{ left: `${position.x}%`, top: `${position.y}%` }} title={`${point.lat}, ${point.lon}`} />; })}
    </div>
      <div className="globe-orbit orbit-one"><span className="orbit-satellite"><b>NOAA-20</b></span></div>
      <div className="globe-orbit orbit-two"><span className="orbit-satellite"><b>NOAA-21</b></span></div>
    </div>
    <div className="globe-controls"><span>Visualisasi satelit statis · rotasi dinonaktifkan</span></div>
    <div className="globe-stats"><strong>{visiblePoints.length.toLocaleString('id-ID')}</strong><span>observasi yang diproyeksikan</span><small>{tleStatus}. Lintasan ditampilkan statis sebagai referensi visual; posisi presisi memerlukan propagasi SGP4.</small></div>
  </section>;
}