import sys
import json
import time
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
log(f"Ukuran asli citra: {img.size[0]}x{img.size[1]} piksel")

img = img.resize((224, 224)).convert("RGB")
log("Resize ke 224x224 dan konversi ke RGB")

arr = np.array(img, dtype=np.float32)
arr = tf.keras.applications.mobilenet_v2.preprocess_input(arr)
arr = np.expand_dims(arr, axis=0)
log("Normalisasi piksel selesai (preprocess_input MobileNetV2)")

log("Memuat model wildfire_model.h5")
model_start = time.time()
model = tf.keras.models.load_model("model/wildfire_model.h5")
log(f"Model berhasil dimuat ({time.time() - model_start:.2f} detik)")

labels = json.load(open("model/labels.json"))

log("Menjalankan inferensi CNN")
infer_start = time.time()
pred = model.predict(arr, verbose=0)[0]
log(f"Inferensi selesai ({time.time() - infer_start:.2f} detik)")

idx = int(np.argmax(pred))
result = {
    "label": labels[str(idx)],
    "confidence": float(pred[idx]),
    "probabilities": [{"label": labels[str(i)], "score": float(p)} for i, p in enumerate(pred)]
}

log(f"Total waktu proses: {time.time() - t0:.2f} detik")
print("RESULT:" + json.dumps(result), flush=True)