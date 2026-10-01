require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { spawn } = require('child_process');
const fs = require('fs');

const app = express();

app.use(cors({
  origin: ['https://kalimantan-wildfire.vercel.app', 'http://localhost:5173']
}));

const upload = multer({
  dest: 'uploads/',
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

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');

  const imgPath = req.file.path;
  const py = spawn('python', ['python/infer.py', imgPath]);

  let buffer = '';

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

  py.on('close', () => {
    fs.unlink(imgPath, () => {});
    if (buffer.trim()) res.write(buffer + '\n');
    res.end();
  });
});

app.get('/api/hotspots', require('./routes/hotspots'));
app.get('/api/wind', require('./routes/wind'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server jalan di port ${PORT}`));