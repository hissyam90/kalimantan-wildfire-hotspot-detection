# Pantau Karhutla Kalimantan

## Panduan presentasi proyek

Dokumen ini menjadi acuan singkat untuk menjelaskan tujuan, cara kerja, sumber data, hasil yang ditampilkan, dan batasan aplikasi kepada dosen atau penguji.

---

## 1. Gagasan utama

**Pantau Karhutla Kalimantan** adalah aplikasi web untuk membantu pengguna melihat tiga jenis informasi yang saling melengkapi:

1. **Peta hotspot**: lokasi observasi panas dari satelit NASA FIRMS.
2. **Kondisi kota**: cuaca dan AQI dari WAQI di 17 kota pantauan Kalimantan.
3. **Verifikasi citra**: bantuan klasifikasi gambar menggunakan CNN dua kelas.

Aplikasi ini bukan sistem pemadam kebakaran dan bukan pengganti laporan resmi. Tujuannya adalah membuat informasi awal lebih mudah dibaca serta membantu pengguna menentukan informasi apa yang perlu diperiksa berikutnya.

## 2. Masalah yang ingin dibantu

Informasi karhutla sering tersebar di beberapa sumber dan memakai istilah teknis yang sulit dipahami pengguna umum. Selain itu, titik panas satelit, kualitas udara, dan klasifikasi gambar sering keliru dianggap sebagai satu data yang sama.

Proyek ini memisahkan ketiganya secara jelas:

- **NASA FIRMS** menjawab: “Di mana satelit mendeteksi titik panas?”
- **OpenWeatherMap** membantu menjawab: “Bagaimana konteks cuaca dan angin di sekitar kota?”
- **WAQI** menyediakan AQI dan data partikulat dari stasiun terdekat; stasiun tidak selalu berada tepat di pusat kota.
- **CNN** menjawab: “Apakah pola pada gambar lebih mirip contoh area terbakar atau tidak?”

## 3. Fitur aplikasi

### A. Peta hotspot

- Menampilkan observasi NASA FIRMS VIIRS untuk wilayah Kalimantan.
- Pengguna dapat memilih rentang 24 atau 48 jam.
- Sidebar menampilkan jumlah titik, observasi terbaru, rentang waktu, dan sumber data.
- Klik titik untuk melihat koordinat, waktu pengamatan, dan satelit yang digunakan.
- NOAA-20 dan NOAA-21 adalah satelit berbeda. Waktu lintasan dan cakupannya berbeda, jadi jumlah observasi N20 dan N21 tidak harus sama; angka tersebut bukan jumlah kebakaran unik.
- Animasi asap adalah **ilustrasi arah pergerakan berdasarkan data angin**, bukan peta konsentrasi asap yang terukur.

### B. Kondisi kota

Kartu kota menampilkan suhu, deskripsi cuaca, kelembapan, kecepatan angin, AQI WAQI, PM2.5, dan PM10.

AQI pada kartu berasal dari **WAQI**. Cuaca dan angin tetap berasal dari OpenWeatherMap.

Titik pantauan yang digunakan adalah Pontianak, Singkawang, Ketapang, Palangkaraya, Sampit, Banjarmasin, Banjarbaru, Pangkalan Bun, Muara Teweh, Samarinda, Balikpapan, Bontang, Tenggarong, Tanjung Redeb, Tarakan, Tanjung Selor, dan Nunukan. Daftar ini mencakup ibu kota lima provinsi Kalimantan serta beberapa kota/kawasan penting lainnya; bukan daftar seluruh kota di pulau Kalimantan.

### C. Verifikasi citra

- Pengguna mengunggah gambar JPG/PNG.
- Backend mengubah ukuran dan memproses gambar dengan model CNN.
- Hasil ditampilkan sebagai dua kemungkinan: “terlihat seperti area terbakar” atau “tidak terlihat seperti area terbakar”.
- Skor adalah tingkat kecocokan terhadap data latihan dan belum tentu terkalibrasi sebagai probabilitas.
- Hasil tidak memberikan koordinat, luas api, tingkat bahaya, atau kepastian bahwa api benar-benar ada.

## 4. Sumber data dan alur sistem

```mermaid
classDiagram
    class FrontendReact {
        +url_backend : str
        +tampilkan_peta_firms()
        +tampilkan_cuaca()
        +request_prediksi(data)
    }

    class BackendExpress {
        -api_key_nasa : str
        -api_key_owm : str
        +get_nasa_firms_data()
        +get_weather_data()
        +forward_to_cnn(data)
    }

    class NASAFIRMS {
        +endpoint_url : str
        +fetch_hotspots()
    }

    class OpenWeatherMap {
        +endpoint_url : str
        +fetch_weather()
    }

    class CNNPython {
        +model_path : str
        +predict_endpoint : str
        +load_model()
        +preprocess_data()
        +predict_hotspot()
    }

    FrontendReact <--> BackendExpress : HTTP Requests / API REST
    BackendExpress ..> NASAFIRMS : Fetch Data
    BackendExpress ..> OpenWeatherMap : Fetch Data
    BackendExpress --> CNNPython : /api/predict
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
- WAQI diintegrasikan untuk 17 titik pantauan, tetapi ketersediaan stasiun dan kuota API dapat membuat sebagian AQI tidak tersedia.
- Model produksi masih memiliki dua kelas: `wildfire` dan `nowildfire`.
- Perubahan arsitektur CNN belum dapat disebut meningkatkan akurasi sebelum training ulang, test split independen, confusion matrix, dan metrik per kelas dilakukan.
- Animasi asap pada peta hanya visualisasi arah angin, bukan simulasi dispersi atmosfer.

## 7. Konfigurasi dan demo lokal

Backend membutuhkan environment variable:

```env
FIRMS_KEY=...
OWM_KEY=...
WAQI_KEY=...
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

## 8. Alur demo 

1. Tunjukkan tab **Peta hotspot** dan ubah periode 24/48 jam.
2. Klik satu titik dan jelaskan bahwa data berasal dari observasi NASA FIRMS.
3. Tunjukkan animasi asap, lalu tekankan bahwa itu ilustrasi arah angin.
4. Buka **Kondisi kota** dan jelaskan bahwa AQI berasal dari WAQI, sedangkan cuaca dan angin berasal dari OpenWeatherMap.
5. Buka **Verifikasi citra**, unggah satu gambar, lalu jelaskan hasil CNN sebagai bantuan awal.
6. Tutup dengan batasan sistem dan rencana validasi model.

## 9. Pengembangan berikutnya

- Integrasi sumber kualitas udara resmi dengan lisensi dan API key yang sah.
- Penambahan riwayat grafik PM2.5 dan PM10.
- Pengujian model pada dataset berlabel dengan pemisahan train/validation/test yang independen.
- Evaluasi precision, recall, F1-score, confusion matrix, dan kalibrasi skor.
- Validasi visual dengan petugas atau data lapangan sebelum digunakan untuk keputusan operasional.
