import { useEffect, useMemo, useRef, useState } from 'react';

const EARTH_TEXTURE = 'https://eoimages.gsfc.nasa.gov/images/imagerecords/74000/74218/world.topo.bathy.200412.3x5400x2700.jpg';

function project(lat, lon, rotation) {
  const x = 50 + (lon - 116 + rotation) * 0.72;
  const y = 50 - (lat + 1) * 0.9;
  return { x: ((x % 100) + 100) % 100, y };
}

export default function GlobeView({ points }) {
  const [rotation, setRotation] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [tleStatus, setTleStatus] = useState('mengambil TLE terbaru…');
  const dragStart = useRef(null);
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

  function startDrag(event) {
    setDragging(true); dragStart.current = { x: event.clientX, rotation };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }
  function moveDrag(event) {
    if (dragStart.current) setRotation(dragStart.current.rotation + (event.clientX - dragStart.current.x) * 0.35);
  }
  function endDrag() { setDragging(false); dragStart.current = null; }

  return <section className="globe-view" aria-label="Globe interaktif hotspot bumi">
    <div className="globe-heading"><span className="eyebrow">MODE ORBIT NOAA</span><h2>Bumi dan lintasan satelit</h2><p>Skin Blue Marble menyorot Kalimantan, dengan lintasan atom NOAA-20 dan NOAA-21. Geser bola dengan mouse atau jari untuk melihat permukaannya.</p></div>
    <div className="globe-stage"><div className={`globe-sphere ${dragging ? 'is-dragging' : ''}`} role="application" aria-label="Globe yang dapat diputar" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onPointerLeave={endDrag}>
      <div className="globe-earth" style={{ backgroundImage: `url(${EARTH_TEXTURE})`, backgroundPosition: `${50 + rotation}% 50%` }} /><span className="kalimantan-focus" aria-label="Kalimantan" title="Kalimantan" /><div className="globe-shade" />
      {visiblePoints.map((point, index) => { const position = project(Number(point.lat), Number(point.lon), rotation); return <span className="globe-hotspot" key={`${point.lat}-${point.lon}-${index}`} style={{ left: `${position.x}%`, top: `${position.y}%` }} title={`${point.lat}, ${point.lon}`} />; })}
    </div>
      <div className="globe-orbit orbit-one"><span className="orbit-satellite"><b>NOAA-20</b></span></div>
      <div className="globe-orbit orbit-two"><span className="orbit-satellite"><b>NOAA-21</b></span></div>
    </div>
    <div className="globe-controls"><button type="button" onClick={() => setRotation(0)}>Kembali ke Kalimantan</button><span>← geser untuk rotasi →</span></div>
    <div className="globe-stats"><strong>{visiblePoints.length.toLocaleString('id-ID')}</strong><span>observasi yang diproyeksikan</span><small>{tleStatus}. Lintasan ditampilkan statis sebagai referensi visual; posisi presisi memerlukan propagasi SGP4.</small></div>
  </section>;
}