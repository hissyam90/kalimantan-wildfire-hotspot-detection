import sys
import json
import numpy as np
from PIL import Image
import tensorflow as tf

# Load model & label (cuma dijalankan sekali tiap script dipanggil)
model = tf.keras.models.load_model("model/wildfire_model.h5")
labels = json.load(open("model/labels.json"))

# Ambil path gambar dari argument yang dikirim Node.js
img_path = sys.argv[1]

img = Image.open(img_path).resize((224, 224)).convert("RGB")
arr = np.array(img, dtype=np.float32)
arr = tf.keras.applications.mobilenet_v2.preprocess_input(arr)  # normalisasi sama seperti saat training
arr = np.expand_dims(arr, axis=0)

pred = model.predict(arr, verbose=0)[0]
idx = int(np.argmax(pred))

result = {
    "label": labels[str(idx)],
    "confidence": float(pred[idx]),
    "probabilities": [{"label": labels[str(i)], "score": float(p)} for i, p in enumerate(pred)]
}

print(json.dumps(result))