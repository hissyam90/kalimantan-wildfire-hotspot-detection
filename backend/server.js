const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { spawn } = require('child_process');
const fs = require('fs');

const app = express();

const defaultOrigins = ['https://kalimantan-wildfire.vercel.app', 'http://localhost:5173'];
const allowedOrigins = (process.env.FRONTEND_ORIGINS || defaultOrigins.join(','))
  .split(',').map((origin) => origin.trim()).filter(Boolean);
app.use(cors({ origin: (origin, callback) => {
  if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
  return callback(new Error('Origin tidak diizinkan oleh CORS'));
} }));
app.use(express.json({ limit: '100kb' }));

const upload = multer({
  dest: path.join(__dirname, 'uploads'),
  limits: { fileSize: 5 * 1024 * 1024 }
});

const predictLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Terlalu banyak permintaan, coba lagi sebentar lagi' }
});

app.post('/api/predict', predictLimiter, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Tidak ada gambar yang diupload' });
  }

  const imgPath = req.file.path;
  const scriptPath = path.join(__dirname, 'python', 'infer.py');
  const py = spawn(process.env.PYTHON_BIN || 'python', [scriptPath, imgPath], { cwd: __dirname });

  let buffer = '';
  let childFailed = false;

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');

  py.stdout.on('data', (data) => {
    buffer += data.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop();
    lines.forEach(line => {
      if (line.trim()) res.write(line + '\n');
    });
  });

  py.stderr.on('data', (data) => {
    console.error('Python error:', data.toString());
  });

  py.on('error', () => { childFailed = true; });

  py.on('close', (code) => {
    fs.unlink(imgPath, () => {});
    if (buffer.trim()) res.write(buffer + '\n');
    if (childFailed || code !== 0) res.write('ERROR: Inferensi gambar gagal\n');
    res.end();
  });
});

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: 'Upload gambar tidak valid', code: error.code });
  }
  if (error) return res.status(500).json({ error: 'Kesalahan server' });
  return next();
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'wildfire-backend' }));

app.get('/api/hotspots', require('./routes/hotspots'));
app.get('/api/wind', require('./routes/wind'));
app.get('/api/model-status', require('./routes/modelStatus'));

const PORT = Number(process.env.PORT) || 5000;
app.listen(PORT, () => console.log(`✅ Server jalan di port ${PORT}`));