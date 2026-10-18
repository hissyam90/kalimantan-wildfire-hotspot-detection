# Deteksi Dini Titik Panas (Wildfire WebGIS)

Aplikasi ini adalah MVP WebGIS untuk **observasi active-fire NASA FIRMS** di wilayah Kalimantan/Borneo dan eksperimen klasifikasi citra RGB. Judul penelitian resmi tetap: **“Deteksi Dini Titik Panas (Hotspot) Potensi Karhutla di Kalimantan Timur Berbasis Citra Satelit Menggunakan Convolutional Neural Network (CNN)”**.

Ada dua cakupan yang harus dibedakan:

* **Cakupan penelitian resmi:** Kalimantan Timur.
* **Cakupan dashboard:** bbox `108,-4.5,119.5,7.5`, yaitu Kalimantan yang lebih luas dan area sekitarnya. Cakupan peta ini tidak membuktikan bahwa model CNN berlaku di seluruh wilayah tersebut.

## Cara kerja dan arsitektur

Frontend React/Vite menampilkan peta Leaflet, statistik, filter 24/48 jam, status cache/sumber, dan halaman klasifikasi RGB. Backend Node.js/Express menyediakan API, mengambil CSV FIRMS secara server-side, melakukan cache 10 menit, dan menjalankan inference RGB lama melalui Python. API cuaca mengambil titik referensi regional OpenWeatherMap.

## Peta source code untuk presentasi

| Bagian yang ditanyakan | Source code | Yang dilakukan |
|---|---|---|
| Server dan endpoint | [`backend/server.js`](./backend/server.js) | Membuat Express server, CORS, upload gambar, rate limit, dan mendaftarkan endpoint. |
| Pengambilan hotspot | [`backend/routes/hotspots.js`](./backend/routes/hotspots.js) | Mengambil CSV FIRMS, memvalidasi koordinat/waktu, menggabungkan sumber satelit, melakukan cache, dan memberi status partial/stale. |
| Cuaca dan AQI | [`backend/routes/wind.js`](./backend/routes/wind.js) | Mengambil cuaca dan Air Pollution API OpenWeatherMap pada 10 titik regional, lalu mengembalikan angin, suhu, kelembapan, AQI 1–5, PM2.5, dan PM10. |
| Peta dan statistik | [`frontend/src/HotspotMap.jsx`](./frontend/src/HotspotMap.jsx) | Memanggil API, menampilkan marker FIRMS, popup metadata, grafik, filter waktu, konteks AQI, dan toggle animasi asap indikatif. |
| Animasi asap | [`frontend/src/SmokeOverlay.jsx`](./frontend/src/SmokeOverlay.jsx) | Menggambar animasi visual berdasarkan titik hotspot dan angin regional; bukan model fisika dispersi. |
| Klasifikasi gambar | [`frontend/src/ImageVerification.jsx`](./frontend/src/ImageVerification.jsx), [`backend/python/infer.py`](./backend/python/infer.py) | Mengirim satu gambar RGB ke backend, resize/normalisasi, menjalankan model `.h5`, lalu menampilkan label eksperimental. |
| Model RGB hasil notebook | [`backend/model/wildfire_model.h5`](./backend/model/wildfire_model.h5) | Artefak model RGB yang dimodifikasi dari notebook Kaggle lalu diekspor ke `.h5`; tidak menghasilkan koordinat hotspot. |
| CNN patch penelitian | [`training/models.py`](./training/models.py), [`training/train.py`](./training/train.py) | Mendefinisikan dan melatih baseline CNN pada patch VIIRS termal dengan split berbasis group. Belum dipakai endpoint produksi. |
| Persiapan dataset | [`training/viirs.py`](./training/viirs.py), [`training/prepare_dataset.py`](./training/prepare_dataset.py) | Membaca patch VIIRS, memvalidasi QA/LUT, mengaitkan patch dengan FIRMS sebagai referensi label, dan membuat manifest. |
| Tes | [`backend/tests/`](./backend/tests/), [`training/tests/`](./training/tests/) | Memeriksa parser FIRMS, validasi data VIIRS, split, dan kontrak pipeline tanpa mengklaim metrik ilmiah. |

### Penjelasan singkat untuk dosen

**Model Kaggle/RGB:** notebook Kaggle adalah titik awal eksperimen. Notebook tersebut Anda modifikasi, lalu model diekspor menjadi `wildfire_model.h5`. Model menerima gambar RGB biasa dan mengeluarkan kelas `wildfire` atau `nowildfire`. Karena hanya menerima satu gambar, model ini tidak mengetahui koordinat dan tidak sama dengan titik FIRMS di peta.

**CNN patch VIIRS yang dikembangkan:** ini adalah pipeline terpisah yang kami susun di folder `training/`. Inputnya bukan foto RGB biasa, melainkan patch data termal VIIRS I04/I05 yang memiliki waktu dan lokasi. Patch dicocokkan dengan observasi FIRMS untuk membuat label referensi, lalu dibagi berdasarkan group agar patch yang berdekatan tidak bocor ke train dan test. CNN baseline-nya dibuat sendiri di `training/models.py`. Pipeline ini masih penelitian dan belum boleh disebut teruji atau siap produksi karena dataset berizin, training nyata, dan validasi lapangan belum lengkap.

Kalimat aman saat presentasi: **“Aplikasi memisahkan observasi dan klasifikasi. Titik pada peta berasal dari NASA FIRMS. Model RGB `.h5` adalah hasil modifikasi notebook Kaggle untuk eksperimen klasifikasi gambar. Selain itu saya menyiapkan pipeline CNN patch VIIRS yang lebih sesuai untuk penelitian geospasial, tetapi pipeline tersebut masih baseline dan belum saya klaim sebagai model produksi karena dataset, provenance, dan validasi ilmiahnya masih harus dilengkapi.”**

| Endpoint | Fungsi |
|---|---|
| `GET /api/health` | Pemeriksaan layanan backend |
| `GET /api/hotspots?days=1\|2` | Observasi FIRMS VIIRS NOAA-20/NOAA-21 NRT |
| `GET /api/wind` | Cuaca dan AQI OpenWeatherMap pada 10 titik regional |
| `GET /api/model-status` | Status artefak CNN patch penelitian; tidak mengaktifkan inference |
| `POST /api/predict` | Klasifikasi gambar RGB menggunakan model lama |

Peta hotspot dan CNN adalah alur berbeda. Titik peta berasal dari NASA FIRMS, bukan prediksi CNN. Klasifikasi satu gambar tidak menghasilkan koordinat hotspot dan tidak boleh dipakai sebagai validasi geospasial.

## Menjalankan lokal

```bash
cd backend
npm ci
# salin .env.example menjadi .env, lalu isi key lokal
node server.js
```

```bash
cd frontend
npm ci
# VITE_API_URL=http://localhost:5000 bila backend memakai port default
npm run dev
```

Backend menggunakan `PORT`, `FIRMS_KEY`, `OWM_KEY` (opsional), `FRONTEND_ORIGINS`, dan `PYTHON_BIN`. Frontend menggunakan `VITE_API_URL`. Key hanya boleh berada di backend; jangan commit `.env`.

Tes backend: `cd backend && npm test`. Tes training offline: `python -m unittest discover -s training/tests -p "test_*.py"`. Build/lint frontend: `cd frontend && npm run build && npm run lint`.

## NASA FIRMS dan keterbatasan

`/api/hotspots` memakai produk **VIIRS NOAA-20/NOAA-21 NRT**, area CSV NASA FIRMS, dan menyaring observasi pada 24 atau 48 jam terakhir. Respons menyertakan waktu observasi dalam UTC, `brightness`, FRP, kategori confidence, satelit, status setiap sumber, coverage, dan status stale. NRT dapat terlambat, tidak kontinu, dan bukan kepastian kebakaran lapangan. Kegagalan satu satelit dilaporkan sebagai data parsial; cache stale tidak dilabeli live.

`confidence` FIRMS adalah kategori deteksi dari produk FIRMS, **bukan probabilitas terkalibrasi dan bukan confidence CNN**. Brightness temperature bukan suhu api langsung; FRP adalah daya radiatif api dalam MW. Cuaca dan AQI adalah konteks regional dari titik referensi OpenWeatherMap, bukan pengukuran tepat pada setiap hotspot. AQI OpenWeatherMap memakai skala 1–5 (baik sampai sangat buruk), sedangkan PM2.5/PM10 ditampilkan sebagai indikator tambahan. Animasi asap tetap indikatif berdasarkan angin regional; bukan simulasi dispersi asap atau pengganti peringatan resmi kualitas udara.

Fixture `data/raw/firms_sample.csv` bukan dataset penelitian/live. Data mentah, token Earthdata/LAADS, dan artefak besar tetap di-ignore.

## CNN, model lama, dan pipeline penelitian

[`backend/model/wildfire_model.h5`](./backend/model/wildfire_model.h5) adalah model RGB yang dibuat dengan memodifikasi notebook Kaggle yang menjadi referensi awal, lalu diekspor ke format Keras `.h5` dan dimasukkan ke repository untuk inference. [`backend/python/infer.py`](./backend/python/infer.py) meresize input ke 224×224 RGB, memakai `tf.keras.applications.mobilenet_v2.preprocess_input`, memuat model, lalu mengembalikan label `nowildfire`/`wildfire`. Notebook/dataset Kaggle tetap harus dicantumkan sebagai sumber asli dan lisensi, tetapi detail yang belum tersedia tidak boleh diisi dengan tebakan. Model ini eksperimental dan bukan detektor hotspot FIRMS.

Pipeline CNN patch yang dikembangkan berada di [`training/README.md`](./training/README.md), dengan kontrak teknis di [`training/VIIRS.md`](./training/VIIRS.md) dan keputusan sumber di [`training/SOURCES.md`](./training/SOURCES.md). Pipeline memvalidasi pasangan VIIRS L1B/geolokasi, QA dan kalibrasi I4/I5, membuat patch bergeoreferensi, memberi label referensi FIRMS spatio-temporal, split berdasarkan group, melatih CNN Keras, dan mengevaluasi test holdout. Produk FIRMS digunakan sebagai referensi label, bukan citra input.

Referensi awal model RGB: [Wildfire Prediction Dataset (Satellite Images) di Kaggle](https://www.kaggle.com/code/vidhuran07/wildfire-prediction-dataset-satellite-images). Model `.h5` di repository adalah hasil modifikasi notebook tersebut, bukan file mentah yang otomatis identik dengan notebook. Simpan URL notebook, perubahan yang dilakukan, dataset yang benar-benar dipakai, lisensi, dan metrik asli di catatan eksperimen. Pada audit ini detail dataset, kelas, arsitektur notebook, metrik, pemilik lisensi, dan izin redistribusi belum dapat diverifikasi.

## Status eksperimen dan publikasi

Dataset VIIRS mentah yang sah, token akuisisi, dan model penelitian terlatih tidak tersedia di repository. Maka tidak ada metrik ilmiah atau klaim generalisasi yang boleh ditulis. Jalankan pipeline hanya setelah dataset dan provenance tersimpan secara sah di luar Git. Artefak training ditulis ke `training/artifacts/` dan di-ignore.

Sebelum publikasi, verifikasi lisensi/atribusi dataset Kaggle dan model `.h5` langsung pada halaman pemilik atau metadata yang dapat dibuktikan. Jangan mengunggah dataset mentah, credential, `.env`, atau model tanpa izin.

## Referensi

* [NASA FIRMS API](https://firms.modaps.eosdis.nasa.gov/api/)
* [FIRMS map key](https://firms.modaps.eosdis.nasa.gov/api/map_key)
* [VIIRS products NASA LAADS](https://ladsweb.modaps.eosdis.nasa.gov/missions-and-measurements/products/)
* [OpenWeatherMap](https://openweathermap.org)