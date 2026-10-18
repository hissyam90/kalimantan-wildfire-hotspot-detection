import { useState } from 'react';
import { API_URL } from './config';

export default function ImageVerification() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (!selected) return;
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    setResult(null);
    setLogs([]);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setLogs([]);

    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch(`${API_URL}/api/predict`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Request gagal');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.trim()) continue;
          if (line.startsWith('RESULT:')) {
            setResult(JSON.parse(line.slice('RESULT:'.length)));
          } else {
            setLogs(prev => [...prev, line]);
          }
        }
      }
    } catch (err) {
      setError('Gagal memproses gambar. Periksa apakah server backend sedang berjalan.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const isWildfire = result?.label === 'wildfire';
  const resultTitle = isWildfire ? 'Terlihat seperti area terbakar' : 'Tidak terlihat seperti area terbakar';
  const resultHelp = isWildfire
    ? 'Model melihat pola gambar yang mirip contoh area terbakar. Cek kembali lokasi dan waktunya di Peta hotspot.'
    : 'Model tidak melihat pola yang kuat seperti contoh area terbakar. Hasil ini bukan jaminan bahwa tidak ada api.';

  return (
    <section className="verify-panel">
      <div className="page-intro verify-heading">
        <p className="eyebrow">PEMERIKSAAN CITRA</p>
        <h2>Periksa sebuah gambar</h2>
        <p>Model membaca pola visual gambar dan memberi dua kemungkinan. Gunakan hasil ini sebagai bantuan awal, bukan bukti tunggal kebakaran.</p>
      </div>
      <div className="verify-grid">
        <div>
          <label className="dropzone" htmlFor="file-input">
            {preview ? (
              <img src={preview} alt="Pratinjau citra" className="preview" />
            ) : (
              <span className="dropzone-text">Klik untuk memilih gambar (.jpg atau .png)</span>
            )}
          </label>
          <input
            id="file-input"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="file-input"
          />

          <button onClick={handleSubmit} disabled={!file || loading} className="run-button">
            {loading ? 'Sedang memeriksa…' : 'Periksa gambar'}
          </button>

          {error && <p className="error-text">{error}</p>}

          {result && (
            <div className={`result ${isWildfire ? 'result-alert' : 'result-clear'}`}>
              <div className="result-row">
                <span className="result-label">Status</span>
                <span className="result-value">{resultTitle}</span>
              </div>
              <div className="result-row">
                <span className="result-label">Tingkat kecocokan pola</span>
                <span className="result-value mono">{(result.confidence * 100).toFixed(1)}%</span>
              </div>
              <p className="result-explanation">{resultHelp}</p>
              <p className="stats-note">Ini bantuan awal dari model gambar, bukan kepastian kebakaran dan bukan penentu lokasi.</p>

              <div className="bars">
                {result.probabilities.map((p) => (
                  <div className="bar-row" key={p.label}>
                    <span className="bar-label">{p.label === 'wildfire' ? 'Terbakar' : 'Tidak terbakar'}</span>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${p.score * 100}%` }} data-kind={p.label} />
                    </div>
                    <span className="bar-value mono">{(p.score * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="terminal">
          <div className="terminal-header">proses pemeriksaan</div>
          <div className="terminal-body">
            {logs.length === 0 && !loading && (
              <span className="terminal-placeholder">Log proses akan muncul di sini</span>
            )}
            {logs.map((line, i) => (
              <div key={i} className="terminal-line">{line}</div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}