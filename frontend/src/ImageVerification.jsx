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
      if (buffer.trim()) {
        if (buffer.startsWith('RESULT:')) setResult(JSON.parse(buffer.slice('RESULT:'.length)));
        else setLogs(prev => [...prev, buffer]);
      }
    } catch (err) {
      setError('Image processing failed. Check that the backend is running.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const isWildfire = result?.label === 'wildfire';
  const resultTitle = isWildfire ? 'Wildfire-like pattern' : 'No wildfire-like pattern';
  const resultHelp = isWildfire
    ? 'The CNN found a visual pattern similar to wildfire examples. Cross-check the location and time on the hotspot map.'
    : 'The CNN did not find a strong wildfire-like pattern. This does not prove that there is no fire.';

  return (
    <section className="verify-panel">
      <div className="page-intro verify-heading">
        <p className="eyebrow">CNN IMAGE VERIFICATION</p>
        <h2>Analyze an image</h2>
        <p>The RGB CNN classifies visual patterns into two classes. Use the result as an initial screening signal, not as standalone fire evidence.</p>
      </div>
      <div className="verify-grid">
        <div>
          <label className="dropzone" htmlFor="file-input">
            {preview ? (
              <img src={preview} alt="Pratinjau citra" className="preview" />
            ) : (
              <span className="dropzone-text">Choose an image (.jpg or .png)</span>
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
            {loading ? 'Running CNN…' : 'Run CNN verification'}
          </button>

          {error && <p className="error-text">{error}</p>}

          {result && (
            <div className={`result ${isWildfire ? 'result-alert' : 'result-clear'}`}>
              <div className="result-row">
                <span className="result-label">Classification</span>
                <span className="result-value">{resultTitle}</span>
              </div>
              <div className="result-row">
                <span className="result-label">Pattern match</span>
                <span className="result-value mono">{(result.confidence * 100).toFixed(1)}%</span>
              </div>
              <p className="result-explanation">{resultHelp}</p>
              <p className="stats-note">CNN output is not a certainty, fire-size estimate, or location detector.</p>

              <div className="bars">
                {result.probabilities.map((p) => (
                  <div className="bar-row" key={p.label}>
                    <span className="bar-label">{p.label === 'wildfire' ? 'Wildfire' : 'No wildfire'}</span>
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
          <div className="terminal-header"><span>CNN inference log</span><span className="terminal-status">{loading ? 'running' : result ? 'complete' : 'waiting for image'}</span></div>
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