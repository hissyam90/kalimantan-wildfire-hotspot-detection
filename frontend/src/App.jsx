import { useState } from 'react';
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
            <p>Pemantauan potensi karhutla di Kalimantan Timur berbasis citra satelit</p>
          </div>
          <button className="theme-toggle" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? 'Mode terang' : 'Mode gelap'}
          </button>
        </div>
      </header>

      <nav className="tabs">
        <button className={tab === 'map' ? 'tab active' : 'tab'} onClick={() => setTab('map')}>Peta hotspot</button>
        <button className={tab === 'verify' ? 'tab active' : 'tab'} onClick={() => setTab('verify')}>Verifikasi citra</button>
      </nav>

      <main className={tab === 'map' ? 'content content-full' : 'content content-verify'}>
        {tab === 'map' ? <HotspotMap theme={theme} /> : <ImageVerification />}
      </main>
    </div>
  );
}

export default App;