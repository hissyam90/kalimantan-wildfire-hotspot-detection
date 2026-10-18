import { useState } from 'react';
import { Analytics } from '@vercel/analytics/react';
import HotspotMap from './HotspotMap';
import ImageVerification from './ImageVerification';
import CityConditions from './CityConditions';
import './App.css';

function App() {
  const [tab, setTab] = useState('map');
  const [theme, setTheme] = useState('dark');

  return (
    <div className="app-shell" data-theme={theme}>
      <header className="app-header">
        <div className="app-header-top">
          <div>
            <h1>Pantau karhutla Kalimantan</h1>
            <p>Lihat titik panas, kondisi udara kota, dan periksa citra dengan satu alur sederhana.</p>
          </div>
          <button className="theme-toggle" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? 'Mode terang' : 'Mode gelap'}
          </button>
        </div>
      </header>

      <nav className="tabs">
        <button aria-pressed={tab === 'map'} className={tab === 'map' ? 'tab active' : 'tab'} onClick={() => setTab('map')}>Peta hotspot</button>
        <button aria-pressed={tab === 'cities'} className={tab === 'cities' ? 'tab active' : 'tab'} onClick={() => setTab('cities')}>Kondisi kota</button>
        <button aria-pressed={tab === 'verify'} className={tab === 'verify' ? 'tab active' : 'tab'} onClick={() => setTab('verify')}>Verifikasi citra</button>
      </nav>

      <main className={tab === 'map' ? 'content content-full' : 'content content-verify'}>
        {tab === 'map' ? <HotspotMap /> : tab === 'cities' ? <CityConditions /> : <ImageVerification />}
      </main>
      <Analytics />
    </div>
  );
}

export default App;