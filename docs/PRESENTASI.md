# Pantau Karhutla Kalimantan

## Panduan presentasi proyek

Dokumen ini menjadi acuan singkat untuk menjelaskan tujuan, cara kerja, sumber data, hasil yang ditampilkan, dan batasan aplikasi kepada dosen atau penguji.

---

## 1. Gagasan utama

**Pantau Karhutla Kalimantan** adalah aplikasi web untuk membantu pengguna melihat tiga jenis informasi yang saling melengkapi:

1. **Peta hotspot**: lokasi observasi panas dari satelit NASA FIRMS.
2. **Kondisi kota**: cuaca dan kualitas udara regional di beberapa kota Kalimantan.
3. **Verifikasi citra**: bantuan klasifikasi gambar menggunakan CNN dua kelas.

Aplikasi ini bukan sistem pemadam kebakaran dan bukan pengganti laporan resmi. Tujuannya adalah membuat informasi awal lebih mudah dibaca serta membantu pengguna menentukan informasi apa yang perlu diperiksa berikutnya.

## 2. Masalah yang ingin dibantu

Informasi karhutla sering tersebar di beberapa sumber dan memakai istilah teknis yang sulit dipahami pengguna umum. Selain itu, titik panas satelit, kualitas udara, dan klasifikasi gambar sering keliru dianggap sebagai satu data yang sama.

Proyek ini memisahkan ketiganya secara jelas:

- **NASA FIRMS** menjawab: “Di mana satelit mendeteksi titik panas?”
- **OpenWeatherMap** membantu menjawab: “Bagaimana konteks cuaca dan udara di sekitar kota?”
- **CNN** menjawab: “Apakah pola pada gambar lebih mirip contoh area terbakar atau tidak?”

## 3. Fitur aplikasi

### A. Peta hotspot

- Menampilkan observasi NASA FIRMS VIIRS untuk wilayah Kalimantan.
- Pengguna dapat memilih rentang 24 atau 48 jam.
- Sidebar menampilkan jumlah titik, observasi terbaru, rentang waktu, dan sumber data.
- Klik titik untuk melihat koordinat, waktu pengamatan, dan satelit yang digunakan.
- Animasi asap adalah **ilustrasi arah pergerakan berdasarkan data angin**, bukan peta konsentrasi asap yang terukur.

### B. Kondisi kota

Kartu kota menampilkan suhu, deskripsi cuaca, kelembapan, kecepatan angin, PM2.5, PM10, dan indeks udara OpenWeatherMap.

Indeks OpenWeatherMap memiliki skala **1–5**, bukan angka AQI 0–500 seperti yang dapat ditemukan pada layanan lain. Karena itu, aplikasi tidak boleh menyebut indeks ini sebagai data IQAir atau BMKG.

### C. Verifikasi citra

- Pengguna mengunggah gambar JPG/PNG.
- Backend mengubah ukuran dan memproses gambar dengan model CNN.
- Hasil ditampilkan sebagai dua kemungkinan: “terlihat seperti area terbakar” atau “tidak terlihat seperti area terbakar”.
- Skor adalah tingkat kecocokan terhadap data latihan dan belum tentu terkalibrasi sebagai probabilitas.
- Hasil tidak memberikan koordinat, luas api, tingkat bahaya, atau kepastian bahwa api benar-benar ada.

## 4. Sumber data dan alur sistem

```text
NASA FIRMS ───────┐
                  ├─ Backend Express ── Frontend React
OpenWeatherMap ───┘          │
                             └─ CNN Python untuk /api/predict
```

Endpoint utama:

| Endpoint | Kegunaan |
|---|---|
| `GET /api/hotspots` | Mengambil dan menyaring observasi NASA FIRMS |
| `GET /api/wind` | Mengambil cuaca dan Air Pollution API OpenWeatherMap |
| `POST /api/predict` | Memproses gambar melalui model CNN |
| `GET /api/model-status` | Memeriksa kesiapan model |

Backend menyimpan cache sementara agar aplikasi tidak meminta data eksternal berulang kali pada setiap pemuatan halaman.

## 5. Cara membaca hasil dengan benar

Urutan penggunaan yang disarankan:

1. Buka **Peta hotspot** untuk melihat lokasi dan waktu observasi.
2. Buka **Kondisi kota** untuk melihat konteks cuaca dan partikulat di kota-kota sekitar.
3. Jika memiliki gambar, gunakan **Verifikasi citra** sebagai pemeriksaan tambahan.
4. Bandingkan waktu, lokasi, cuaca, dan sumber resmi sebelum menyimpulkan adanya kebakaran.

Contoh kalimat yang aman saat presentasi:

> “Aplikasi ini tidak menyatakan bahwa setiap titik adalah kebakaran. Sistem menggabungkan observasi satelit, konteks cuaca dan udara, serta klasifikasi citra agar pengguna memiliki dasar pemeriksaan awal yang lebih jelas.”

## 6. Batasan penelitian

- NASA FIRMS adalah observasi satelit, bukan pengukuran langsung dari lapangan.
- Satu titik panas tidak menjelaskan ukuran api, penyebab, atau tingkat bahayanya.
- Data OpenWeatherMap bersifat regional pada koordinat kota dan tidak menggantikan stasiun pemantauan kualitas udara.
- API IQAir/BMKG belum terintegrasi; aplikasi tidak mengklaim data OWM sebagai data IQAir/BMKG.
- Model produksi masih memiliki dua kelas: `wildfire` dan `nowildfire`.
- Perubahan arsitektur CNN belum dapat disebut meningkatkan akurasi sebelum training ulang, test split independen, confusion matrix, dan metrik per kelas dilakukan.
- Animasi asap pada peta hanya visualisasi arah angin, bukan simulasi dispersi atmosfer.

## 7. Konfigurasi dan demo lokal

Backend membutuhkan environment variable:

```env
FIRMS_KEY=...
OWM_KEY=...
PYTHON_BIN=python
```

Jalankan backend:

```powershell
cd backend
npm install
node server.js
```

Jalankan frontend pada terminal lain:

```powershell
cd frontend
npm install
npm run dev
```

## 8. Alur demo untuk dosen

1. Tunjukkan tab **Peta hotspot** dan ubah periode 24/48 jam.
2. Klik satu titik dan jelaskan bahwa data berasal dari observasi NASA FIRMS.
3. Tunjukkan animasi asap, lalu tekankan bahwa itu ilustrasi arah angin.
4. Buka **Kondisi kota** dan tunjukkan perbedaan antara indeks OWM 1–5 dan AQI 0–500.
5. Buka **Verifikasi citra**, unggah satu gambar, lalu jelaskan hasil CNN sebagai bantuan awal.
6. Tutup dengan batasan sistem dan rencana validasi model.

## 9. Pengembangan berikutnya

- Integrasi sumber kualitas udara resmi dengan lisensi dan API key yang sah.
- Penambahan riwayat grafik PM2.5 dan PM10.
- Pengujian model pada dataset berlabel dengan pemisahan train/validation/test yang independen.
- Evaluasi precision, recall, F1-score, confusion matrix, dan kalibrasi skor.
- Validasi visual dengan petugas atau data lapangan sebelum digunakan untuk keputusan operasional.