# Pipeline CNN patch VIIRS

Folder ini berisi implementasi CNN patch VIIRS yang dikembangkan untuk penelitian. Ini berbeda dari model RGB `.h5` di [`backend/model/wildfire_model.h5`](../backend/model/wildfire_model.h5), yang dibuat dengan memodifikasi notebook Kaggle dan dipakai oleh [`backend/python/infer.py`](../backend/python/infer.py). Dokumentasi lengkap model RGB, hasil training MobileNetV2, dan hasil test 97,00% tersedia di [`docs/MODEL_TRAINING.md`](../docs/MODEL_TRAINING.md).

## Kontrak data

Input awal adalah bundle NPZ dari `viirs.py` yang dibuat dari pasangan produk VIIRS L1B dan geolokasi yang cocok. Bundle memuat `x [N,H,W,C]`, `patch_id`, `group_id`, latitude, longitude, dan `observed_at` dengan timezone. Reader menggunakan kanal termal I04/I05 dalam Kelvin, menolak fill value, QA buruk, LUT/metadata tidak valid, pasangan granule tidak cocok, patch duplikat, dan patch di luar bbox.

`prepare_dataset.py` mencocokkan pusat patch dengan observasi FIRMS dalam toleransi jarak/waktu. Positif berarti ada kecocokan referensi. Tidak adanya kecocokan default-nya **uncertain**, bukan bukti tidak terbakar; `--allow-unconfirmed-negatives` hanya untuk eksperimen weak-label dan wajib dilaporkan. Split berdasarkan `group_id` mencegah group bocor antar train/validation/test.

## Arsitektur dan training

`models.py` mendefinisikan CNN Keras sendiri: tiga blok Conv2D ReLU (32, 64, 128 filter), BatchNormalization, MaxPooling pada dua blok pertama, BatchNormalization dan SpatialDropout 0,2 pada blok terakhir, GlobalAveragePooling, Dropout 0,35, lalu Dense sigmoid biner. Model menerima bentuk patch dari dataset; tidak memakai ImageNet preprocessing. Adam (learning rate 1e-3) dan binary cross-entropy adalah baseline eksplisit, bukan klaim model NASA. Perubahan regularisasi ini belum berarti akurasi meningkat sebelum diuji pada test split independen.

`train.py` memvalidasi manifest, seed, bentuk tensor, kelas train, menyimpan checkpoint terbaik `.keras`, early stopping, konfigurasi, checksum, dan history. `evaluate.py` membaca **test split yang tidak digunakan untuk memilih model** dan menulis accuracy, precision, recall, F1, serta confusion matrix. Fixture kecil hanya menguji kontrak, bukan bukti penelitian.

```bash
python -m training.prepare_dataset --patches data/prepared/pilot.npz --firms data/raw/firms.csv --out data/prepared/dataset
python -m training.train --dataset data/prepared/dataset --out training/artifacts/pilot --epochs 20
python -m training.evaluate --dataset data/prepared/dataset --model training/artifacts/pilot/best.keras --out training/artifacts/pilot/test_metrics.json
```

Jangan menjalankan contoh terhadap `firms_sample.csv` header-only. Jika eksperimen nyata dilakukan, catat sumber, jumlah setiap split, seed, konfigurasi, checksum, dan metrik test aktual.

## Provenance, lisensi, dan status

Model RGB lama merujuk pada [Wildfire Prediction Dataset (Satellite Images)](https://www.kaggle.com/code/vidhuran07/wildfire-prediction-dataset-satellite-images) dan telah dimodifikasi di notebook sebelum diekspor menjadi `.h5`. Endpoint menampilkan rincian inferensi per gambar—ukuran asli, input 224×224, jumlah parameter, waktu inferensi, dan margin skor—agar proses dapat dipresentasikan secara teknis. Rincian tersebut bukan pengganti accuracy, precision, recall, atau F1 dari evaluasi dataset. Pipeline pada folder ini adalah pengembangan terpisah: inputnya patch termal VIIRS I04/I05 dan label referensinya dicocokkan dengan FIRMS. Jadi, referensi Kaggle menjelaskan asal/eksperimen model RGB lama; kode `training/` menjelaskan baseline CNN patch penelitian baru.

Untuk pilot VIIRS, lihat [`SOURCES.md`](./SOURCES.md) dan [`VIIRS.md`](./VIIRS.md). Dataset asli memerlukan akses layanan dan pemeriksaan ketentuan produk. Token tidak boleh ditulis ke repository. `training/artifacts/`, `data/raw/`, dan `data/prepared/` di-ignore.

Kode pipeline dan tes fixture tersedia. Dataset VIIRS mentah berlisensi/provenance lengkap belum tersedia, sehingga training ilmiah, metrik penelitian, validasi lapangan, dan kesiapan deployment belum dapat diklaim. Model patch belum terhubung ke `/api/predict`; endpoint itu tetap khusus model RGB lama.