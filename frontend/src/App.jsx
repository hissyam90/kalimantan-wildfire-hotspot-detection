import { useState } from 'react';
import { Analytics } from '@vercel/analytics/react';
import HotspotMap from './HotspotMap';
import ImageVerification from './ImageVerification';
import './App.css';

function App() {
  const [tab, setTab] = useState('map');
  const [theme, setTheme] = useState('dark');

  return (
    <div className="app-shell" data-theme={theme}>
      <header className="app-header">
        <div className="app-header-top">
          <div>
            <h1>Deteksi dini titik panas</h1>
            <p>Pemantauan potensi karhutla di Kalimantan berbasis citra satelit</p>
          </div>
          <button className="theme-toggle" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? 'Mode terang' : 'Mode gelap'}
          </button>
        </div>
      </header>

      <nav className="tabs">
        <button aria-pressed={tab === 'map'} className={tab === 'map' ? 'tab active' : 'tab'} onClick={() => setTab('map')}>Peta FIRMS · Kalimantan</button>
        <button aria-pressed={tab === 'verify'} className={tab === 'verify' ? 'tab active' : 'tab'} onClick={() => setTab('verify')}>Klasifikasi RGB · eksperimen</button>
      </nav>

      <main className={tab === 'map' ? 'content content-full' : 'content content-verify'}>
        {tab === 'map' ? <HotspotMap /> : <ImageVerification />}
      </main>
      <Analytics />
    </div>
  );
}

export default App;