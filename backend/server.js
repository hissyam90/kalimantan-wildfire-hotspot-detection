require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { spawn } = require('child_process');
const fs = require('fs');

const app = express();
app.use(cors({
  origin: ['https://wildfire-app-private.vercel.app/', 'http://localhost:5173']
}));

const upload = multer({ dest: 'uploads/' });

app.post('/api/predict', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Tidak ada gambar yang diupload' });
  }

  const imgPath = req.file.path;
  const py = spawn('python', ['python/infer.py', imgPath]);

  let result = '';
  let errorOutput = '';

  py.stdout.on('data', (data) => { result += data.toString(); });
  py.stderr.on('data', (data) => { errorOutput += data.toString(); });

  py.on('close', (code) => {
    fs.unlink(imgPath, () => {});
    if (code !== 0) {
      console.error('Python error:', errorOutput);
      return res.status(500).json({ error: 'Gagal memproses gambar', detail: errorOutput });
    }
    try {
      res.json(JSON.parse(result));
    } catch (e) {
      res.status(500).json({ error: 'Response Python tidak valid', raw: result });
    }
  });
});

app.get('/api/hotspots', require('./routes/hotspots'));
app.get('/api/wind', require('./routes/wind'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server jalan di port ${PORT}`));