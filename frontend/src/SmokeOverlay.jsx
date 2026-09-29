import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';

// Interpolasi arah & kecepatan angin dari beberapa titik grid sekaligus
// (inverse-distance weighting), bukan cuma titik terdekat.
function windVectorAt(lat, lon, grid) {
  let sumWeight = 0, u = 0, v = 0;
  for (const g of grid) {
    const d = Math.max(Math.hypot(g.lat - lat, g.lon - lon), 0.05);
    const w = 1 / (d * d);
    const rad = (((g.windDeg + 180) % 360) * Math.PI) / 180; // arah tujuan angin bertiup
    u += Math.sin(rad) * g.windSpeed * w;
    v += -Math.cos(rad) * g.windSpeed * w;
    sumWeight += w;
  }
  return { u: u / sumWeight, v: v / sumWeight };
}

export default function SmokeOverlay({ points, windGrid }) {
  const map = useMap();
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);

  useEffect(() => {
    if (windGrid.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let raf;

    const resizeCanvas = () => {
      const size = map.getSize();
      canvas.width = size.x;
      canvas.height = size.y;
    };
    resizeCanvas();
    map.on('resize', resizeCanvas);
    map.on('move', resizeCanvas);

    particlesRef.current = points.flatMap((p) =>
      Array.from({ length: 2 }).map(() => ({
        originLat: p.lat,
        originLon: p.lon,
        offset: { x: (Math.random() - 0.5) * 20, y: (Math.random() - 0.5) * 20 },
        age: Math.random() * 120,
        maxAge: 90 + Math.random() * 60,
      }))
    );

    const step = () => {
            ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.globalCompositeOperation = 'source-over';

      particlesRef.current.forEach((particle) => {
        const vec = windVectorAt(particle.originLat, particle.originLon, windGrid);

        particle.age += 1;
        if (particle.age > particle.maxAge) {
          particle.age = 0;
          particle.offset = { x: (Math.random() - 0.5) * 20, y: (Math.random() - 0.5) * 20 };
        }
        particle.offset.x += vec.u * 0.4;
        particle.offset.y += vec.v * 0.4;

        const origin = map.latLngToContainerPoint([particle.originLat, particle.originLon]);
        const x = origin.x + particle.offset.x;
        const y = origin.y + particle.offset.y;

        const lifeRatio = particle.age / particle.maxAge;
        const alpha = Math.sin(lifeRatio * Math.PI) * 0.22;
        const radius = 3 + lifeRatio * 6;

        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, `rgba(225, 222, 214, ${alpha})`);
        gradient.addColorStop(1, `rgba(180, 176, 165, 0)`);

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      });

      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(raf);
      map.off('resize', resizeCanvas);
      map.off('move', resizeCanvas);
    };
  }, [map, points, windGrid]);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 400 }}
    />
  );
}