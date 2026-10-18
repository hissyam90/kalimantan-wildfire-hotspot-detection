import { useMemo, useRef, useState } from 'react';

const EARTH_TEXTURE = 'https://eoimages.gsfc.nasa.gov/images/imagerecords/74000/74218/world.topo.bathy.200412.3x5400x2700.jpg';

function project(lat, lon, rotation) {
  const x = 50 + (lon - 116 + rotation) * 0.72;
  const y = 50 - (lat + 1) * 0.9;
  return { x: ((x % 100) + 100) % 100, y };
}

export default function GlobeView({ points }) {
  const [rotation, setRotation] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef(null);
  const visiblePoints = useMemo(() => points.filter((point) => Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lon))), [points]);

  function startDrag(event) {
    setDragging(true); dragStart.current = { x: event.clientX, rotation };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }
  function moveDrag(event) {
    if (dragStart.current) setRotation(dragStart.current.rotation + (event.clientX - dragStart.current.x) * 0.35);
  }
  function endDrag() { setDragging(false); dragStart.current = null; }

  return <section className="globe-view" aria-label="Globe interaktif hotspot bumi">
    <div className="globe-heading"><span className="eyebrow">MODE GLOBE INTERAKTIF</span><h2>Hotspot di permukaan bumi</h2><p>Geser globe dengan mouse atau jari untuk memutarnya. Citra permukaan berasal dari NASA Blue Marble; titik panas berasal dari FIRMS.</p></div>
    <div className="globe-stage"><div className={`globe-sphere ${dragging ? 'is-dragging' : ''}`} role="application" aria-label="Globe yang dapat diputar" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onPointerLeave={endDrag}>
      <div className="globe-earth" style={{ backgroundImage: `url(${EARTH_TEXTURE})`, backgroundPosition: `${50 + rotation}% 50%` }} /><div className="globe-shade" />
      {visiblePoints.map((point, index) => { const position = project(Number(point.lat), Number(point.lon), rotation); return <span className="globe-hotspot" key={`${point.lat}-${point.lon}-${index}`} style={{ left: `${position.x}%`, top: `${position.y}%` }} title={`${point.lat}, ${point.lon}`} />; })}
    </div></div>
    <div className="globe-controls"><button type="button" onClick={() => setRotation(0)}>Kembali ke Kalimantan</button><span>← geser untuk rotasi →</span></div>
    <div className="globe-stats"><strong>{visiblePoints.length.toLocaleString('id-ID')}</strong><span>observasi yang diproyeksikan</span><small>Globe ini untuk eksplorasi visual. Untuk koordinat presisi, gunakan peta hotspot utama.</small></div>
  </section>;
}