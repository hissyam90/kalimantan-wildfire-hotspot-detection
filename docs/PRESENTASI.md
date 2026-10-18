# Panduan penjelasan proyek

Dokumen ini membantu menjelaskan proyek tanpa mencampuradukkan data observasi NASA FIRMS dan hasil CNN.

## Inti sistem

1. **NASA FIRMS** menyediakan titik observasi active fire. Backend mengambil dan memfilter data tersebut di [`backend/routes/hotspots.js`](../backend/routes/hotspots.js).
2. **Peta** menampilkan titik FIRMS secara langsung sebagai observasi, bukan titik yang dibuat oleh CNN. UI dan statistik ada di [`frontend/src/HotspotMap.jsx`](../frontend/src/HotspotMap.jsx).
3. **Model RGB lama** menerima gambar yang di-upload. Proses resize, preprocessing, dan inference ada di [`backend/python/infer.py`](../backend/python/infer.py), sedangkan file model ada di [`backend/model/wildfire_model.h5`](../backend/model/wildfire_model.h5).
4. **AQI dan cuaca** diambil dari OpenWeatherMap pada titik regional. Implementasinya ada di [`backend/routes/wind.js`](../backend/routes/wind.js). AQI ini adalah konteks regional, bukan pengukuran tepat di setiap hotspot.
5. **CNN patch VIIRS** adalah pipeline penelitian terpisah. Arsitekturnya ada di [`training/models.py`](../training/models.py), training di [`training/train.py`](../training/train.py), dan persiapan datanya di [`training/prepare_dataset.py`](../training/prepare_dataset.py).

## Perbedaan model Kaggle dan pipeline CNN patch

| Hal | Model RGB dari notebook Kaggle | CNN patch VIIRS proyek |
|---|---|---|
| Asal | Notebook Kaggle yang dimodifikasi lalu diekspor menjadi `.h5` | Implementasi baseline baru di folder `training/` |
| Input | Satu gambar RGB biasa | Patch citra termal VIIRS I04/I05 |
| Output | Kelas `wildfire`/`nowildfire` | Kelas referensi `FIRMS_match`/`reference_negative` |
| Lokasi | Tidak menghasilkan koordinat | Patch memiliki metadata waktu dan lokasi |
| Peran di aplikasi | Dipakai endpoint `POST /api/predict` | Belum dihubungkan ke endpoint produksi |
| Status | Eksperimen kompatibilitas | Baseline penelitian, belum tervalidasi lapangan |

Penjelasan sederhana: **model Kaggle melihat gambar dan menebak kelas; pipeline VIIRS mencoba menghubungkan patch satelit yang memiliki lokasi/waktu dengan observasi FIRMS.** Keduanya sama-sama memakai CNN, tetapi datanya, tujuan, dan alur penggunaannya berbeda.

## Jika ditanya “mengapa CNN tidak membuat titik hotspot?”

Jawaban: “Karena endpoint peta mengambil koordinat dari NASA FIRMS. CNN RGB hanya memproses file gambar yang di-upload, sehingga outputnya label klasifikasi dan bukan koordinat. Pemisahan ini sengaja dibuat agar prediksi gambar tidak dianggap sebagai observasi satelit.”

## Jika ditanya “apa yang belum selesai?”

Jawaban: “Pipeline teknis dan pengujian kontraknya sudah dibuat, tetapi saya belum mengklaim hasil ilmiah karena dataset mentah berlisensi, provenance model, metrik test, dan validasi lapangan harus dibuktikan terlebih dahulu. Karena itu model RGB diberi label eksperimental dan CNN patch belum dipakai sebagai layanan produksi.”

## AQI

Endpoint [`backend/routes/wind.js`](../backend/routes/wind.js) meminta data cuaca dan Air Pollution API OpenWeatherMap dengan `OWM_KEY`. UI menampilkan AQI skala 1–5 dan PM2.5 pada popup hotspot berdasarkan titik regional terdekat. Jika API/key tidak tersedia, UI menampilkan status tidak tersedia; aplikasi tidak mengarang nilai AQI.

AQI tidak boleh dijelaskan sebagai pengukuran kualitas udara tepat di koordinat hotspot. Untuk peringatan resmi, gunakan sumber kualitas udara pemerintah/otoritas setempat.