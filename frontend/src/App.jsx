import { useEffect, useRef, useState } from 'react';
import { Analytics } from '@vercel/analytics/react';
import HotspotMap from './HotspotMap';
import ImageVerification from './ImageVerification';
import CityConditions from './CityConditions';
import './App.css';

function App() {
  const [tab, setTab] = useState('map');
  const [theme, setTheme] = useState(() => localStorage.getItem('wildfire-theme') || 'dark');
  const [smokeEnabled, setSmokeEnabled] = useState(() => localStorage.getItem('wildfire-smoke') !== 'off');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef(null);
  useEffect(() => {
    if (!settingsOpen) return;
    const closeOutside = (event) => {
      if (!settingsRef.current?.contains(event.target)) setSettingsOpen(false);
    };
    const closeEscape = (event) => {
      if (event.key === 'Escape') {
        setSettingsOpen(false);
        settingsRef.current?.querySelector('button')?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOutside, true);
    document.addEventListener('keydown', closeEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside, true);
      document.removeEventListener('keydown', closeEscape);
    };
  }, [settingsOpen]);

  useEffect(() => { localStorage.setItem('wildfire-theme', theme); }, [theme]);
  useEffect(() => { localStorage.setItem('wildfire-smoke', smokeEnabled ? 'on' : 'off'); }, [smokeEnabled]);

  return (
    <div className="app-shell" data-theme={theme}>
      <header className="app-header">
        <div className="app-header-top">
          <div>
            <h1>Pantau karhutla Kalimantan</h1>
            <p>Lihat titik panas, kondisi udara kota, dan periksa citra dengan satu alur sederhana.</p>
          </div>
          <div className="settings-wrap" ref={settingsRef}>
            <button className="theme-toggle" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(!settingsOpen)}>Pengaturan</button>
            {settingsOpen && <div className="settings-menu" role="dialog" aria-label="Pengaturan tampilan">
              <strong>Pengaturan tampilan</strong>
              <label><span>Tema</span><select value={theme} onChange={(event) => setTheme(event.target.value)}><option value="dark">Gelap</option><option value="light">Terang</option></select></label>
              <label className="setting-check"><span>Animasi asap</span><input type="checkbox" checked={smokeEnabled} onChange={(event) => setSmokeEnabled(event.target.checked)} /></label>
            </div>}
          </div>
        </div>
      </header>

      <nav className="tabs">
        <button aria-pressed={tab === 'map'} className={tab === 'map' ? 'tab active' : 'tab'} onClick={() => setTab('map')}>Peta hotspot</button>
        <button aria-pressed={tab === 'cities'} className={tab === 'cities' ? 'tab active' : 'tab'} onClick={() => setTab('cities')}>Kondisi kota</button>
        <button aria-pressed={tab === 'verify'} className={tab === 'verify' ? 'tab active' : 'tab'} onClick={() => setTab('verify')}>Verifikasi citra</button>
      </nav>

      <main className={tab === 'map' ? 'content content-full' : 'content content-verify'}>
        {tab === 'map' ? <HotspotMap smokeEnabled={smokeEnabled} /> : tab === 'cities' ? <CityConditions /> : <ImageVerification />}
      </main>
      <Analytics />
    </div>
  );
}

export default App;