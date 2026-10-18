import { useMemo } from 'react';

function project(lat, lon) {
  const x = 50 + (lon - 116) * 0.72;
  const y = 50 - (lat + 1) * 0.9;
  return { x, y };
}

export default function GlobeView({ points }) {
  const visiblePoints = useMemo(() => points.filter((point) => Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lon))), [points]);
  return <section className="globe-view" aria-label="Globe 3D internal hotspot">
    <div className="globe-heading"><span className="eyebrow">MODE VISUAL 3D</span><h2>Globe hotspot Kalimantan</h2><p>Visualisasi internal ringan untuk melihat sebaran relatif titik panas. Ini bukan NASA Eyes dan bukan model elevasi.</p></div>
    <div className="globe-stage"><div className="globe-sphere"><div className="globe-grid globe-latitude" /><div className="globe-grid globe-longitude" />{visiblePoints.map((point, index) => { const position = project(Number(point.lat), Number(point.lon)); return <span className="globe-hotspot" key={`${point.lat}-${point.lon}-${index}`} style={{ left: `${position.x}%`, top: `${position.y}%` }} title={`${point.lat}, ${point.lon}`} />; })}<span className="globe-marker-label">Kalimantan</span></div><div className="globe-orbit orbit-one" /><div className="globe-orbit orbit-two" /></div>
    <div className="globe-stats"><strong>{visiblePoints.length.toLocaleString('id-ID')}</strong><span>observasi yang diproyeksikan</span><small>Proyeksi sederhana berdasarkan lintang dan bujur, bukan navigasi 3D presisi.</small></div>
  </section>;
}