# Dokumentasi Training Model Klasifikasi Citra Wildfire

Dokumen ini adalah dokumentasi mandiri untuk model RGB yang dipakai endpoint `POST /api/predict`. Isinya direkonstruksi dari notebook Colab yang dibagikan melalui Google Drive publik dan dibandingkan dengan artefak yang ada di repository:

- Model deployment: [`backend/model/wildfire_model.h5`](../backend/model/wildfire_model.h5)
- Label deployment: [`backend/model/labels.json`](../backend/model/labels.json)
- Script inference: [`backend/python/infer.py`](../backend/python/infer.py)
- Endpoint backend: [`backend/server.js`](../backend/server.js)

Notebook sumber: [Colab training notebook](https://colab.research.google.com/drive/1NX43x-kH59Qu_nabDKVnKekNh4h-w9Se?usp=sharing). Notebook tidak disalin mentah ke repository karena salah satu cell-nya berisi credential Kaggle. Dokumentasi ini hanya memuat konfigurasi, hasil, dan penjelasan teknis yang relevan.

> **Status hasil:** angka di bawah adalah output notebook yang berhasil diekstrak, bukan hasil training ulang di mesin repository ini. Dataset sekitar 1,45 GB dan credential/dataset asli tidak disimpan di repository.

## 1. Tujuan model

Model melakukan klasifikasi dua kelas pada gambar RGB:

| Label | Arti |
|---|---|
| `wildfire` | Pola gambar lebih dekat dengan contoh kelas wildfire pada dataset |
| `nowildfire` | Pola gambar lebih dekat dengan contoh kelas nowildfire pada dataset |

Model **bukan** pendeteksi koordinat hotspot, bukan segmentasi api, dan bukan pengukur luas atau tingkat bahaya kebakaran. Hasilnya hanya bantuan screening visual dan harus dibandingkan dengan peta hotspot NASA FIRMS, waktu observasi, sumber lapangan, dan konteks cuaca.

## 2. Sumber dan pembagian data

Notebook mengunduh dataset Kaggle:

> `abdelghaniaaba/wildfire-prediction-dataset`

Struktur folder yang dibaca notebook:

```text
/content/dataset/
├── train/
│   ├── nowildfire/
│   └── wildfire/
├── valid/
│   ├── nowildfire/
│   └── wildfire/
└── test/
    ├── nowildfire/
    └── wildfire/
```

Jumlah file yang tercatat dalam output notebook:

| Folder | Jumlah gambar | Keterangan |
|---|---:|---|
| `train` | 30.250 | Sumber dataframe training |
| `test` | 6.300 | Dipakai untuk evaluasi akhir |
| `valid` | 6.300 | Terbaca dan divisualisasikan, tetapi tidak dipakai oleh generator final |

Pada generator final, notebook membuat validation split internal 10% dari dataframe `train`:

| Split generator | Jumlah gambar |
|---|---:|
| Training aktual | 27.225 |
| Validation aktual | 3.025 |
| Test | 6.300 |

Dengan demikian, angka validation pada training final bukan berasal dari folder `/valid`, melainkan dari `train` yang dipecah oleh `ImageDataGenerator(validation_split=0.1)`. Ini penting ketika hasil hendak direproduksi.

## 3. Preprocessing dan augmentasi

Semua gambar diproses sebagai RGB dengan target ukuran `224 x 224` dan batch size `32`.

Preprocessing piksel menggunakan fungsi yang sama dengan MobileNetV2:

```python
tf.keras.applications.mobilenet_v2.preprocess_input
```

Untuk training dan validation internal, notebook menggunakan augmentasi:

```text
rotation_range=30
zoom_range=0.15
width_shift_range=0.2
height_shift_range=0.2
shear_range=0.15
horizontal_flip=True
fill_mode="nearest"
```

Generator test tidak melakukan augmentasi dan menggunakan `shuffle=False`, sehingga urutan prediksi dapat dibandingkan dengan `df_test.Label`.

## 4. Arsitektur model

Notebook membandingkan tiga backbone ImageNet dengan `include_top=False`, input `(224, 224, 3)`, `pooling='avg'`, dan backbone dibekukan (`trainable=False`):

1. MobileNetV2
2. DenseNet121
3. EfficientNetB0

Head klasifikasi yang sama ditambahkan pada setiap backbone:

```text
backbone ImageNet, frozen, global average pooling
        ↓
Dense(128, activation="relu")
        ↓
Dense(128, activation="relu")
        ↓
Dense(2, activation="softmax")
```

Konfigurasi compile:

```text
optimizer = Adam (default learning rate Keras)
loss = categorical_crossentropy
metric = accuracy
```

Model di repository sesuai dengan kontrak ini: `infer.py` memuat gambar sebagai RGB, resize ke `224 x 224`, menjalankan `mobilenet_v2.preprocess_input`, lalu memuat `wildfire_model.h5` dan `labels.json`.

## 5. Preview alur training

```text
Dataset Kaggle
      │
      ├── train/ 30.250 ──┬── 90% generator train: 27.225
      │                    └── 10% generator validation: 3.025
      ├── test/ 6.300 ─────────────── evaluasi akhir
      └── valid/ 6.300 ────────────── tidak dipakai generator final
      │
      ▼
ImageDataGenerator: RGB 224×224 + MobileNetV2 preprocessing + augmentasi
      │
      ▼
Bandingkan MobileNetV2, DenseNet121, EfficientNetB0 selama 1 epoch
      │
      ▼
Pilih validation accuracy tertinggi: MobileNetV2
      │
      ▼
Latih ulang MobileNetV2 terpilih maksimal 5 epoch
EarlyStopping(monitor="val_loss", patience=1, restore_best_weights=True)
      │
      ▼
Evaluasi pada test 6.300 gambar
      │
      ▼
Simpan wildfire_model.h5 + labels.json
```

## 6. Hasil perbandingan backbone

Setiap kandidat terlebih dahulu dilatih selama satu epoch. Output notebook:

| Model | Validation accuracy setelah 1 epoch | Waktu training |
|---|---:|---:|
| **MobileNetV2** | **0,9557** | 115,66 detik |
| DenseNet121 | 0,9534 | 150,70 detik |
| EfficientNetB0 | 0,8555 | 125,07 detik |

MobileNetV2 dipilih karena memiliki validation accuracy tertinggi dan waktu training paling singkat di antara tiga kandidat pada percobaan satu epoch tersebut.

## 7. Hasil training final

Model MobileNetV2 terpilih dilatih maksimal lima epoch dengan early stopping. Notebook berhenti setelah epoch keempat karena `val_loss` memburuk setelah epoch ketiga dan `patience=1`.

| Epoch | Train accuracy | Train loss | Validation accuracy | Validation loss |
|---:|---:|---:|---:|---:|
| 1 | 0,9474 | 0,1397 | 0,9540 | 0,1288 |
| 2 | 0,9626 | 0,1002 | 0,9574 | 0,1120 |
| 3 | 0,9698 | 0,0799 | **0,9593** | **0,1071** |
| 4 | 0,9744 | 0,0667 | 0,9547 | 0,1212 |

Bobot terbaik dipulihkan berdasarkan `val_loss`, bukan berdasarkan train accuracy. Ini mencegah pemilihan model hanya karena performa pada data yang dipakai untuk update bobot terus meningkat.

## 8. Hasil evaluasi test

Notebook mengevaluasi model pada 6.300 gambar test dan menampilkan hasil:

```text
Best Model: MobileNetV2 with 97.00% accuracy on the test set
```

Notebook juga membuat **normalized confusion matrix** dan grid contoh gambar dengan label sebenarnya serta prediksi. Namun output yang tersedia tidak memberikan nilai numerik confusion matrix atau classification report precision/recall/F1. Karena itu repository tidak boleh mengklaim angka per kelas yang tidak tercatat.

Interpretasi yang aman:

- `97,00%` adalah accuracy pada test split dataset tersebut.
- Angka ini bukan jaminan accuracy pada citra Kalimantan, citra satelit operasional, kamera lapangan, atau kondisi cuaca lain.
- Belum ada validasi independen berbasis data lapangan dalam artefak repository.
- Nama file dan koordinat pada dataset tidak membuktikan bahwa model memahami lokasi atau kausalitas kebakaran.

## 9. Artefak model

Notebook menyimpan:

```text
/content/wildfire_model.h5
/content/labels.json
```

Mapping label yang tercatat:

```json
{"0": "nowildfire", "1": "wildfire"}
```

Artefak tersebut kemudian tersedia di repository sebagai:

```text
backend/model/wildfire_model.h5
backend/model/labels.json
```

Notebook juga mencoba mengonversi model ke ONNX, tetapi file ONNX tidak menjadi artefak yang digunakan oleh aplikasi. Backend saat ini menggunakan TensorFlow/Keras melalui `backend/python/infer.py`.

## 10. Hubungan dengan aplikasi

Saat pengguna mengunggah gambar:

1. `POST /api/predict` menerima file gambar maksimal 5 MB.
2. Express menjalankan `backend/python/infer.py`.
3. Gambar dibaca, dikonversi RGB, dan di-resize ke `224 x 224`.
4. Preprocessing MobileNetV2 diterapkan.
5. Model menghasilkan skor dua kelas.
6. Label dengan skor terbesar dikembalikan bersama confidence, probabilitas kedua kelas, margin, ukuran gambar asli, jumlah parameter, dan waktu inferensi.

Confidence pada response adalah skor output softmax yang paling besar. Skor tersebut belum dikalibrasi dan tidak boleh dibaca sebagai probabilitas pasti kebakaran.

## 11. Cara menjalankan ulang secara konseptual

Notebook asli memerlukan akun/credential Kaggle, dataset sekitar 1,45 GB, TensorFlow, GPU yang sesuai, dan lingkungan Colab. Jangan memasukkan token ke source code atau commit.

Urutan reproduksi:

```text
1. Sediakan dataset Kaggle secara sah.
2. Pastikan struktur train/test/valid dan dua kelas sama.
3. Bentuk dataframe filepath-label.
4. Gunakan preprocessing dan augmentasi pada bagian 3.
5. Bandingkan tiga backbone selama 1 epoch.
6. Pilih model berdasarkan validation accuracy.
7. Latih model terpilih maksimal 5 epoch dengan early stopping.
8. Evaluasi pada test split yang sama sekali tidak digunakan untuk memilih model.
9. Simpan model dan mapping label.
10. Catat versi TensorFlow, seed, checksum dataset, dan seluruh metrik.
```

Pipeline `training/` di repository adalah eksperimen terpisah untuk patch termal VIIRS dan **bukan** pipeline yang menghasilkan `wildfire_model.h5`. Pipeline tersebut memakai arsitektur CNN baseline sendiri, input patch VIIRS, dan label referensi FIRMS. Jangan mencampur metriknya dengan model RGB pada dokumen ini.

## 12. Keamanan dan provenance

Cell pertama notebook yang diekstrak memuat credential Kaggle secara langsung. Credential tersebut tidak disalin ke repository atau dokumentasi. Pemilik notebook harus segera mencabut dan membuat ulang token tersebut di Kaggle, kemudian menghapus token dari notebook history/output sebelum membagikan notebook lagi.

Selain itu:

- Dataset asli tidak disimpan di repository.
- Hasil test hanya berlaku untuk split dan dataset yang digunakan notebook.
- Versi dependency, seed eksplisit, checksum dataset, dan nilai numerik confusion matrix tidak semuanya tercatat pada output yang tersedia.
- Model ini adalah alat screening awal, bukan sistem keputusan operasional.

## 13. Ringkasan untuk presentasi

> “Kami membandingkan MobileNetV2, DenseNet121, dan EfficientNetB0 dengan transfer learning pada dua kelas citra wildfire dan nowildfire. MobileNetV2 memberikan validation accuracy tertinggi pada percobaan awal, yaitu 95,57%, sehingga dipilih untuk training lanjutan. Setelah early stopping, validation accuracy terbaik mencapai 95,93% dan accuracy pada test split tercatat 97,00%. Hasil ini hanya menunjukkan performa pada dataset tersebut; model tidak mendeteksi koordinat hotspot dan belum divalidasi sebagai pengganti observasi satelit atau laporan lapangan.”