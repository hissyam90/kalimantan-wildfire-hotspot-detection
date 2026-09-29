import { useState } from 'react';
import axios from 'axios';

export default function ImageVerification() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (!selected) return;
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    setResult(null);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await axios.post('http://localhost:5000/api/predict', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setResult(res.data);
    } catch (err) {
      setError('Gagal memproses gambar. Periksa apakah server backend sedang berjalan.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const isWildfire = result?.label === 'wildfire';

  return (
    <section className="verify-panel">
      <label className="dropzone" htmlFor="file-input">
        {preview ? (
          <img src={preview} alt="Pratinjau citra" className="preview" />
        ) : (
          <span className="dropzone-text">Pilih citra satelit (.jpg, .png)</span>
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
        {loading ? 'Memproses' : 'Jalankan deteksi'}
      </button>

      {error && <p className="error-text">{error}</p>}

      {result && (
        <div className={`result ${isWildfire ? 'result-alert' : 'result-clear'}`}>
          <div className="result-row">
            <span className="result-label">Status</span>
            <span className="result-value">
              {isWildfire ? 'Titik panas terdeteksi' : 'Tidak ada indikasi titik panas'}
            </span>
          </div>
          <div className="result-row">
            <span className="result-label">Keyakinan model</span>
            <span className="result-value mono">{(result.confidence * 100).toFixed(1)}%</span>
          </div>

          <div className="bars">
            {result.probabilities.map((p) => (
              <div className="bar-row" key={p.label}>
                <span className="bar-label">{p.label}</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${p.score * 100}%` }} data-kind={p.label} />
                </div>
                <span className="bar-value mono">{(p.score * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}