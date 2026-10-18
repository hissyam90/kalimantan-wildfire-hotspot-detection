import { useEffect, useState } from 'react';
import { API_URL } from './config';

export default function ImageVerification() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

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
      let receivedResult = false;
      const consume = (line) => {
        if (!line.trim()) return;
        if (line.startsWith('ERROR:')) throw new Error('Inference failed');
        if (line.startsWith('RESULT:')) {
          setResult(JSON.parse(line.slice('RESULT:'.length)));
          receivedResult = true;
        } else setLogs(prev => [...prev, line]);
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          consume(line);
        }
      }
      consume(buffer + decoder.decode());
      if (!receivedResult) throw new Error('No inference result');
    } catch (err) {
      setResult(null);
      setError('Gambar gagal dianalisis. Pastikan backend, model, dan dependensi Python tersedia.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const isWildfire = result?.label === 'wildfire';
  const resultTitle = isWildfire ? 'Pola menyerupai kebakaran' : 'Pola tidak menyerupai kebakaran';
  const resultHelp = isWildfire
    ? 'CNN menemukan pola visual yang menyerupai contoh kebakaran. Cocokkan lokasi dan waktu gambar dengan peta hotspot serta laporan setempat.'
    : 'CNN memilih kelas bukan kebakaran. Hasil ini tidak menjamin bahwa lokasi pada gambar bebas dari api.';

  return (
    <section className="verify-panel">
      <div className="page-intro verify-heading">
        <p className="eyebrow">VERIFIKASI CITRA CNN</p>
        <h2>Periksa pola pada gambar</h2>
        <p>Unggah gambar untuk pemeriksaan awal pola kebakaran. Hasil CNN perlu dibandingkan dengan waktu, lokasi, dan sumber lain; bukan bukti kebakaran yang berdiri sendiri.</p>
      </div>
      <div className="verify-grid">
        <div>
          <label className="dropzone" htmlFor="file-input">
            {preview ? (
              <img src={preview} alt="Pratinjau citra" className="preview" />
            ) : (
              <span className="dropzone-text">Pilih gambar JPG atau PNG (maks. 5 MB)</span>
            )}
          </label>
          <input
            id="file-input"
            type="file"
            accept="image/jpeg,image/png"
            disabled={loading}
            onChange={handleFileChange}
            className="file-input"
          />

          <button onClick={handleSubmit} disabled={!file || loading} className="run-button">
            {loading ? 'Menganalisis gambar…' : 'Analisis dengan CNN'}
          </button>

          {error && <p className="error-text">{error}</p>}

          {result && (
            <div className={`result ${isWildfire ? 'result-alert' : 'result-clear'}`}>
              <div className="result-row">
                <span className="result-label">Hasil klasifikasi</span>
                <span className="result-value">{resultTitle}</span>
              </div>
              <div className="result-row">
                <span className="result-label">Skor kelas terpilih</span>
                <span className="result-value mono">{(result.confidence * 100).toFixed(1)}%</span>
              </div>
              <p className="result-explanation">{resultHelp}</p>
              <p className="stats-note">Persentase adalah skor model, bukan akurasi atau kepastian kebakaran. CNN tidak mengukur luas api dan tidak menentukan lokasi.</p>

              <div className="bars">
                {result.probabilities.map((p) => (
                  <div className="bar-row" key={p.label}>
                    <span className="bar-label">{p.label === 'wildfire' ? 'Kebakaran' : 'Bukan kebakaran'}</span>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${p.score * 100}%` }} data-kind={p.label} />
                    </div>
                    <span className="bar-value mono">{(p.score * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
              {result.diagnostics && <div className="model-details">
                <h3>Rincian analisis</h3>
                <dl>
                  <div><dt>Ukuran gambar asli</dt><dd>{result.diagnostics.originalSize.join(' × ')} piksel</dd></div>
                  <div><dt>Input model</dt><dd>{result.modelInput}</dd></div>
                  <div><dt>Jumlah parameter</dt><dd>{result.diagnostics.parameters.toLocaleString('id-ID')}</dd></div>
                  <div><dt>Waktu inferensi</dt><dd>{result.diagnostics.inferenceMs.toFixed(1)} ms</dd></div>
                  <div><dt>Selisih skor dua kelas</dt><dd>{(result.diagnostics.margin * 100).toFixed(1)} poin persentase</dd></div>
                </dl>
                <p className="stats-note">Selisih kecil berarti skor dua kelas berdekatan, bukan ukuran bahaya. Rincian ini berasal dari proses gambar ini, bukan hasil evaluasi dataset.</p>
              </div>}
            </div>
          )}
        </div>

        <div className="terminal">
          <div className="terminal-header"><span>CNN inference log</span><span className="terminal-status">{loading ? 'running' : error ? 'failed' : result ? 'complete' : 'waiting for image'}</span></div>
          <div className="terminal-body">
            {logs.length === 0 && !loading && (
              <span className="terminal-placeholder">Preprocessing and inference logs will appear here</span>
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