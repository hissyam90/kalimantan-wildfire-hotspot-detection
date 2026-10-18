import sys
import json
import time
import os
from pathlib import Path
import numpy as np
from PIL import Image
import tensorflow as tf


def log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


t0 = time.time()
log("Memulai proses deteksi")
img_path = sys.argv[1]
log(f"Membaca file: {img_path}")
img = Image.open(img_path)
img_original_width, img_original_height = img.size
log(f"Ukuran asli citra: {img_original_width}x{img_original_height} piksel")
img = img.resize((224, 224)).convert("RGB")
log("Resize ke 224x224 dan konversi ke RGB")
arr = np.array(img, dtype=np.float32)
arr = tf.keras.applications.mobilenet_v2.preprocess_input(arr)
arr = np.expand_dims(arr, axis=0)
log("Normalisasi piksel selesai (preprocess_input MobileNetV2)")

model_path = Path(os.environ.get("RGB_MODEL_PATH", Path(__file__).resolve().parent.parent / "model" / "wildfire_model.h5"))
labels_path = model_path.parent / "labels.json"
log(f"Memuat model {model_path.name}")
model_start = time.time()
model = tf.keras.models.load_model(model_path)
log(f"Model berhasil dimuat ({time.time() - model_start:.2f} detik)")
with labels_path.open(encoding="utf-8") as labels_file:
    labels = json.load(labels_file)

log("Menjalankan inferensi CNN")
infer_start = time.time()
pred = np.asarray(model.predict(arr, verbose=0)[0]).reshape(-1)
inference_seconds = time.time() - infer_start
log(f"Inferensi selesai ({inference_seconds:.2f} detik)")
idx = int(np.argmax(pred))
predicted_label = labels[str(idx)]
is_wildfire = predicted_label == "wildfire"
result = {
    "label": predicted_label,
    "confidence": float(pred[idx]),
    "probabilities": [{"label": labels[str(i)], "score": float(p)} for i, p in enumerate(pred)],
    "model": "wildfire_rgb_cnn",
    "modelDescription": "CNN klasifikasi gambar RGB; bukan pendeteksi koordinat hotspot.",
    "modelInput": "RGB 224x224",
    "interpretation": "Pola gambar lebih dekat dengan contoh wildfire pada data latihan." if is_wildfire else "Pola gambar lebih dekat dengan contoh nowildfire pada data latihan.",
    "nextStep": "Bandingkan dengan peta hotspot dan waktu observasi sebelum mengambil tindakan." if is_wildfire else "Tetap periksa peta dan sumber lain; hasil ini bukan jaminan tidak ada api.",
    "diagnostics": {
        "originalSize": [img_original_width, img_original_height],
        "parameters": int(model.count_params()),
        "inferenceMs": inference_seconds * 1000,
        "margin": float(abs(pred[0] - pred[1])) if len(pred) >= 2 else 0,
    },
}
log(f"Total waktu proses: {time.time() - t0:.2f} detik")
print("RESULT:" + json.dumps(result), flush=True)