const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  const configured = process.env.RGB_MODEL_PATH || path.join(__dirname, '..', 'model', 'wildfire_model.h5');
  const modelPath = path.resolve(configured);
  let available = false;
  try { available = Boolean(modelPath && fs.statSync(modelPath).isFile()); } catch { /* absent */ }
  res.json({
    model: 'wildfire_rgb_cnn',
    ready: available,
    artifactAvailable: available,
    inferenceEnabled: available,
    input: 'RGB 224x224',
    status: available ? 'ready' : 'not_trained',
    message: available
      ? 'CNN RGB aktif pada endpoint /api/predict.'
      : 'File model CNN RGB belum tersedia; endpoint prediksi tidak dapat berjalan.',
  });
};