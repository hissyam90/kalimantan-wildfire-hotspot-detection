import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

const MAX_PARTICLES = 6000;

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

  useEffect(() => {
    if (windGrid.length === 0 || points.length === 0) return;

    const paneName = 'smokePane';
    if (!map.getPane(paneName)) {
      map.createPane(paneName);
      map.getPane(paneName).style.zIndex = 450;
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

    const perPoint = points.length * 2 <= MAX_PARTICLES ? 2 : 1;
    const stride = Math.max(1, Math.ceil(points.length / MAX_PARTICLES));
    const particles = [];

    for (let i = 0; i < points.length; i += stride) {
      const p = points[i];
      const vec = windVectorAt(p.lat, p.lon, windGrid);
      for (let k = 0; k < perPoint; k++) {
        particles.push({
          lat: p.lat,
          lon: p.lon,
          vx: vec.u * 0.4,
          vy: vec.v * 0.4,
          ox: (Math.random() - 0.5) * 20,
          oy: (Math.random() - 0.5) * 20,
          age: Math.random() * 120,
          maxAge: 90 + Math.random() * 60
        });
      }
    }

    const step = () => {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.globalCompositeOperation = 'source-over';

      for (const particle of particles) {
        particle.age += 1;
        if (particle.age > particle.maxAge) {
          particle.age = 0;
          particle.ox = (Math.random() - 0.5) * 20;
          particle.oy = (Math.random() - 0.5) * 20;
        }
        particle.ox += particle.vx;
        particle.oy += particle.vy;

        const layerPoint = map.latLngToLayerPoint([particle.lat, particle.lon]);
        const x = layerPoint.x - topLeft.x + particle.ox;
        const y = layerPoint.y - topLeft.y + particle.oy;

        const lifeRatio = particle.age / particle.maxAge;
        const alpha = Math.sin(lifeRatio * Math.PI) * 0.14;
        const radius = 3 + lifeRatio * 6;

        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, `rgba(225, 222, 214, ${alpha})`);
        gradient.addColorStop(1, 'rgba(180, 176, 165, 0)');

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      }

      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(raf);
      map.off('move', resizeCanvas);
      map.off('zoom', resizeCanvas);
      map.off('resize', resizeCanvas);
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    };
  }, [map, points, windGrid]);

  return null;
}