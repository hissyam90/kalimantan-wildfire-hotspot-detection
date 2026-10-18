const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  const configured = process.env.SATELLITE_MODEL_PATH;
  const modelPath = configured ? path.resolve(configured) : null;
  let available = false;
  try { available = Boolean(modelPath && fs.statSync(modelPath).isFile()); } catch { /* absent */ }
  res.json({
    model: 'satellite_patch_cnn',
    ready: false,
    artifactAvailable: available,
    inferenceEnabled: false,
    status: available ? 'artifact_unverified' : 'not_trained',
    message: available
      ? 'Model CNN patch satelit tersedia; endpoint inferensi belum menggantikan inferensi RGB lama.'
      : 'Model penelitian belum tersedia. Tidak ada prediksi CNN satelit yang dibuat.',
  });
};