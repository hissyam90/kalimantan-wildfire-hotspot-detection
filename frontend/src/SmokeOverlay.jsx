import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';

function windVectorAt(lat, lon, grid) {
  let sumWeight = 0, u = 0, v = 0;
  for (const g of grid) {
    const d = Math.max(Math.hypot(g.lat - lat, g.lon - lon), 0.05);
    const w = 1 / (d * d);
    const rad = (((g.windDeg + 180) % 360) * Math.PI) / 180;
    u += Math.sin(rad) * g.windSpeed * w;
    v += -Math.cos(rad) * g.windSpeed * w;
    sumWeight += w;
  }
  return { u: u / sumWeight, v: v / sumWeight };
}

export default function SmokeOverlay({ points, windGrid }) {
  const map = useMap();
  const particlesRef = useRef([]);

  useEffect(() => {
    if (windGrid.length === 0) return;

    const paneName = 'smokePane';
    if (!map.getPane(paneName)) {
      map.createPane(paneName);
      map.getPane(paneName).style.zIndex = 350;
      map.getPane(paneName).style.pointerEvents = 'none';
    }
    const pane = map.getPane(paneName);

    const canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    pane.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    let raf;
    let topLeft = map.containerPointToLayerPoint([0, 0]);

    const resizeCanvas = () => {
      const size = map.getSize();
      canvas.width = size.x;
      canvas.height = size.y;
      topLeft = map.containerPointToLayerPoint([0, 0]);
      canvas.style.left = `${topLeft.x}px`;
      canvas.style.top = `${topLeft.y}px`;
    };
    resizeCanvas();
    map.on('move', resizeCanvas);
    map.on('zoom', resizeCanvas);
    map.on('resize', resizeCanvas);

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

        const layerPoint = map.latLngToLayerPoint([particle.originLat, particle.originLon]);
        const x = layerPoint.x - topLeft.x + particle.offset.x;
        const y = layerPoint.y - topLeft.y + particle.offset.y;

        const lifeRatio = particle.age / particle.maxAge;
        const alpha = Math.sin(lifeRatio * Math.PI) * 0.14;
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
      map.off('move', resizeCanvas);
      map.off('zoom', resizeCanvas);
      map.off('resize', resizeCanvas);
      pane.removeChild(canvas);
    };
  }, [map, points, windGrid]);

  return null;
}