# PRD: Deteksi Dini Titik Panas (Hotspot) Potensi Karhutla di Kalimantan Berbasis Citra Satelit Menggunakan CNN

| Atribut | Nilai |
|---|---|
| Versi dokumen | 1.0 |
| Tanggal | 12 Oktober 2026 |
| Status produk | Prototype berjalan di hosting gratis |
| Pemilik | hissyam90 |
| Konteks | Project UTS mata kuliah Dasar Kecerdasan Artifisial (DKA), Universitas Mulawarman |
| Repositori | https://github.com/hissyam90/kalimantan-wildfire-hotspot-detection |
| Demo | https://kalimantan-wildfire.vercel.app |
| Backend | https://wildfire-app-private-production.up.railway.app |

Dokumen ini untuk pemilik proyek dan untuk AI atau developer lain yang melanjutkan pekerjaan. Panduan teknis operasional ada di `AGENTS.md`.

---

## 1. Ringkasan

Aplikasi WebGIS yang menampilkan titik panas satelit NASA FIRMS di Pulau Kalimantan secara hampir real-time, lengkap dengan animasi arah angin sebagai ilustrasi sebaran asap, statistik, serta cuaca dan arah angin dari 10 kota acuan. Aplikasi juga menyediakan fitur verifikasi citra: pengguna mengunggah citra, lalu model CNN (transfer learning MobileNetV2) mengklasifikasikannya sebagai `wildfire` atau `nowildfire`, disertai log proses backend yang asli.

## 2. Latar belakang dan masalah

- Karhutla di Kalimantan berulang setiap musim kemarau dan asapnya melintasi batas wilayah.
- Data titik panas satelit tersedia gratis, tetapi sulit dibaca orang awam tanpa visualisasi dan konteks (angin, kualitas udara).
- Tugas mata kuliah meminta penerapan CNN pada citra satelit dan prototype yang bisa didemonstrasikan.

## 3. Tujuan dan non-tujuan

### Tujuan

| ID | Tujuan |
|---|---|
| G1 | Menampilkan hotspot FIRMS untuk jendela 24 jam dan 48 jam terakhir di seluruh Kalimantan |
| G2 | Memberi konteks cuaca dan arah angin di sekitar titik panas (kualitas udara per kota direncanakan, lihat F5) |
| G3 | Menyediakan verifikasi citra berbasis CNN dengan proses yang transparan |
| G4 | Memenuhi enam syarat dokumen UTS (lihat bagian 13) |

### Non-tujuan

- Memprediksi kebakaran di masa depan.
- Memodelkan dispersi asap secara fisik (animasi asap hanya ilustrasi berbasis vektor angin).
- Menjadi sistem peringatan resmi atau pengganti data BMKG, KLHK, atau BRIN.
- Autentikasi pengguna, basis data historis, dan dukungan perangkat mobile pada versi ini.

## 4. Pengguna dan skenario

| Pengguna | Skenario |
|---|---|
| Dosen penguji | Membuka demo, melihat peta, mengganti periode 24/48 jam, mengunggah citra ke verifikasi, membaca log proses |
| Mahasiswa atau peneliti | Memahami pipeline data, model, dan batasan sistem lewat repositori dan dokumen ini |
| Publik | Melihat sebaran titik panas dan kondisi cuaca di sekitarnya |

## 5. Ruang lingkup fitur dan status

| ID | Fitur | Status | Catatan |
|---|---|---|---|
| F1 | Peta hotspot interaktif (Leaflet, tile OSM) | Selesai | Marker digambar dengan canvas (`preferCanvas`) |
| F2 | Periode data 24 jam dan 48 jam | Selesai | Jendela waktu bergeser, bukan hari kalender UTC |
| F3 | Animasi asap berbasis arah angin | Selesai | Ilustratif, maksimum 6000 partikel |
| F4 | Statistik: total, keyakinan tinggi, pie keyakinan, distribusi per jam | Selesai | |
| F5 | Cuaca dan kualitas udara (AQI) per kota | Rencana | Belum ada di repositori; rancangan: AQI AS (EPA) dari PM2.5 dan PM10 |
| F6 | Verifikasi citra CNN dengan log proses nyata | Selesai | Log di-stream dari `infer.py` |
| F7 | Mode terang dan gelap | Selesai | |
| F8 | Navigasi touchpad (geser 2 jari) | Selesai | Mouse wheel tetap untuk zoom |
| F9 | Popup detail hotspot | Selesai | Data hotspot, wilayah acuan terdekat, suhu, kelembapan, cuaca, arah angin |
| F10 | Filter batas administrasi Indonesia | Backlog | Saat ini bounding box persegi |
| F11 | Riwayat dan tren hotspot | Backlog | Butuh penyimpanan (mis. Supabase) |
| F12 | CNN pada tile citra satelit di sekitar hotspot | Backlog | Menyambungkan CNN dengan titik di peta |
| F13 | Tampilan mobile | Backlog | README menyatakan belum didukung |

## 6. Persyaratan fungsional

| ID | Persyaratan |
|---|---|
| FR-01 | Sistem mengambil hotspot VIIRS SNPP NRT dari NASA FIRMS untuk bounding box Kalimantan dan menyimpannya di cache memori (10 menit; 1 menit bila hasil kosong). |
| FR-02 | Endpoint `/api/hotspots?days=1` mengembalikan titik dalam 24 jam terakhir, `days=2` dalam 48 jam terakhir, dihitung dari `acq_date` dan `acq_time` (UTC). |
| FR-03 | Frontend menampilkan hanya titik pada periode terpilih, semuanya berwarna sama; jumlah titik 48 jam harus lebih besar atau sama dengan 24 jam. |
| FR-04 | Sistem mengambil cuaca (suhu, kelembapan, deskripsi, angin) untuk 10 kota acuan dari OpenWeatherMap dengan cache 10 menit. |
| FR-05 | [Rencana] AQI dihitung dengan skala AQI AS (EPA) revisi 2024 dari PM2.5 dan PM10, nilai tertinggi menjadi AQI akhir, disertai kategori dan polutan dominan. |
| FR-06 | [Rencana] Peta menampilkan lencana AQI di tiap kota; klik membuka kartu kota (AQI, kategori, PM2.5, PM10, saran kesehatan, cuaca). |
| FR-07 | [Rencana] Tab "Kualitas udara" menampilkan daftar kota terurut dari AQI terburuk; klik baris memindahkan peta ke kota tersebut dan membuka kartunya. |
| FR-08 | Animasi asap memakai vektor angin hasil interpolasi inverse-distance dari seluruh titik acuan; arah gerak asap berlawanan dengan arah asal angin. |
| FR-09 | Pengguna dapat mematikan animasi asap. |
| FR-10 | `POST /api/predict` menerima satu gambar (field `image`, maksimum 5 MB), menjalankan CNN, dan men-stream log proses diikuti satu baris `RESULT:<json>`. |
| FR-11 | Frontend menampilkan status, confidence, probabilitas per kelas, dan log proses secara real-time. |
| FR-12 | Kegagalan pengambilan data ditampilkan sebagai pesan dengan tombol coba lagi, bukan tampilan kosong. |

## 7. Persyaratan non-fungsional

| ID | Persyaratan |
|---|---|
| NFR-01 | Kunci API tidak boleh ada di kode atau riwayat git; disimpan sebagai environment variable. |
| NFR-02 | CORS hanya mengizinkan domain frontend produksi dan `http://localhost:5173`. |
| NFR-03 | `/api/predict` dibatasi 10 permintaan per menit per IP dan 5 MB per file. |
| NFR-04 | Jumlah panggilan OpenWeatherMap tidak melebihi 60 per menit (batas gratis); saat ini 10 panggilan per 10 menit. |
| NFR-05 | Peta tetap responsif pada sampai sekitar 11.000 titik (periode 48 jam) di laptop standar. |
| NFR-06 | Antarmuka berbahasa Indonesia, desain datar tanpa emoji dan tanpa gradient. |
| NFR-07 | Aplikasi harus berjalan di hosting gratis (Vercel untuk frontend, Railway untuk backend). |

## 8. Arsitektur sistem

```mermaid
flowchart LR
  subgraph Browser
    UI["React + Vite + react-leaflet"]
  end
  subgraph Vercel
    STATIC["Hosting frontend statis"]
  end
  subgraph Railway["Railway (Docker, Node 20 + Python 3)"]
    API["Express API"]
    PY["Python infer.py + TensorFlow"]
    MODEL[("wildfire_model.h5")]
    CACHE[("Cache memori")]
  end
  FIRMS["NASA FIRMS API"]
  OWM["OpenWeatherMap API"]

  STATIC --> UI
  UI -->|"GET /api/hotspots"| API
  UI -->|"GET /api/wind"| API
  UI -->|"POST /api/predict"| API
  API --> CACHE
  API -->|"CSV hotspot 3 hari"| FIRMS
  API -->|"cuaca dan angin"| OWM
  API -->|"spawn python"| PY
  PY --> MODEL
```

Ringkasan komponen:

| Lapisan | Teknologi |
|---|---|
| Frontend | React 19, Vite 8, react-leaflet 5, Leaflet 1.9, Recharts 3, axios |
| Backend | Node.js 20, Express 5, multer, express-rate-limit, dotenv, axios |
| Inferensi | Python 3, TensorFlow/Keras, Pillow, NumPy (dipanggil lewat `child_process.spawn`) |
| Data eksternal | NASA FIRMS (VIIRS SNPP NRT), OpenWeatherMap (weather) |
| Hosting | Vercel (frontend), Railway via Docker (backend) |

## 9. Alur proses

### 9.1 Alur data peta

```mermaid
flowchart TD
  A["Pengguna membuka tab Peta"] --> B["GET /api/hotspots?days=1 atau 2"]
  A --> H["GET /api/wind"]
  B --> C{"Cache hotspot masih valid?"}
  C -->|ya| F["Saring titik sesuai jendela 24 atau 48 jam"]
  C -->|tidak| D["Ambil CSV FIRMS DAY_RANGE=3"]
  D --> E["Parse CSV, hitung timestamp UTC, saring area Borneo, simpan cache"]
  E --> F
  F --> G["Kirim JSON ke frontend"]
  H --> I{"Cache angin valid?"}
  I -->|ya| L["Kirim JSON angin"]
  I -->|tidak| J["Ambil cuaca 10 kota dari OpenWeatherMap"]
  J --> K["Simpan cache"]
  K --> L
  G --> M["Render titik dan statistik"]
  L --> M
  M --> N["Animasi asap mengikuti vektor angin"]
```

### 9.2 Alur verifikasi citra CNN

```mermaid
flowchart TD
  A["Pengguna memilih citra"] --> B["POST /api/predict multipart"]
  B --> C{"Batas laju dan ukuran file lolos?"}
  C -->|tidak| X["Kembalikan error"]
  C -->|ya| D["Simpan sementara di uploads"]
  D --> E["spawn python infer.py path"]
  E --> F["Baca citra, resize 224x224, konversi RGB"]
  F --> G["preprocess_input MobileNetV2"]
  G --> H["Muat wildfire_model.h5"]
  H --> I["model.predict, softmax 2 kelas"]
  I --> J["Stream baris log lalu baris RESULT json"]
  J --> K["Frontend menampilkan status, confidence, log"]
  K --> L["Hapus file sementara"]
```

## 10. Sumber data dan API

| Sumber | Endpoint yang dipakai | Catatan |
|---|---|---|
| NASA FIRMS | `/api/area/csv/{MAP_KEY}/VIIRS_SNPP_NRT/{bbox}/{DAY_RANGE}` | Batas 5000 transaksi per 10 menit. `DAY_RANGE` berarti hari kalender UTC dari hari ini ke belakang, bukan 24 jam bergeser. Kolom penting: `latitude`, `longitude`, `bright_ti4`, `frp`, `confidence` (`l`, `n`, `h`), `acq_date`, `acq_time` (HHMM UTC), `daynight`, `satellite`. |
| OpenWeatherMap | `/data/2.5/weather` | Suhu, kelembapan, deskripsi cuaca, angin (`wind.deg` adalah arah asal angin). Deskripsi masih berbahasa Inggris (belum memakai `lang=id`). |
| OpenWeatherMap | `/data/2.5/air_pollution` | Belum dipakai. Rencana F5: konsentrasi PM2.5 dan PM10 dihitung menjadi AQI AS. |

Bounding box hotspot saat ini: barat 108, selatan -4.5, timur 119, utara 4. Batas utara 4.0 memotong sebagian Kalimantan Utara (Nunukan, Sebatik, Krayan). Area persegi ini juga memuat ujung timur Belitung, pesisir barat Sulawesi, Sarawak, Sabah, dan Brunei (lihat bagian 14).

Titik acuan cuaca: 10 kota (Pontianak, Singkawang, Ketapang, Palangka Raya, Sampit, Banjarmasin, Samarinda, Balikpapan, Tanjung Redeb, Tarakan) yang seluruhnya di pesisir atau dekat pesisir, sehingga medan angin di pedalaman hanya hasil interpolasi.

## 11. Metodologi AI

### 11.1 Data dan pra-pemrosesan (EDA)

- Dataset: Wildfire Prediction Dataset (Satellite Images) di Kaggle, dua kelas: `wildfire` dan `nowildfire`.
- Jumlah citra menurut log notebook: training 27.225, validasi 3.025, test 6.300.
- Daftar berkas dan label dimuat ke DataFrame (`Filepath`, `Label`), diacak, lalu dialirkan dengan `flow_from_dataframe`.
- Validasi diambil 10% dari data train (`validation_split=0.1`, `seed=0`); data test terpisah dan tidak diacak.
- Ukuran masukan 224x224 RGB, batch 32, normalisasi `mobilenet_v2.preprocess_input` (piksel ke rentang -1 sampai 1).
- Catatan terverifikasi: parameter augmentasi (`rotation_range`, `zoom_range`, dan lainnya) pada notebook ditulis di `flow_from_dataframe`. Fungsi itu hanya membaca `has_ext`, `sort`, dan `drop_duplicates` dari argumen tambahan, sehingga augmentasi tidak pernah berjalan pada pelatihan. Jangan mengklaim augmentasi di makalah.
- Folder `valid` (6.300 citra) hanya dimuat dan divisualisasikan, tidak dipakai untuk pelatihan maupun evaluasi. Total dataset 42.850 citra, yang terpakai 36.550.

### 11.2 Model

- Transfer learning: basis pretrained ImageNet (dibekukan, `include_top=False`, `pooling='avg'`), lalu `Dense(128, relu)` dua kali dan `Dense(2, softmax)`.
- Optimizer Adam, loss `categorical_crossentropy`, metrik `accuracy`.
- Seleksi arsitektur: setiap kandidat dilatih 1 epoch lalu dibandingkan dengan `val_accuracy`; arsitektur terbaik dilatih ulang maksimal 5 epoch dengan `EarlyStopping(monitor='val_loss', patience=1, restore_best_weights=True)`.
- Artefak deployment: MobileNetV2 dengan 2.438.722 parameter. Catatan provenance: output notebook yang tersimpan justru memilih MobileNet (V1) 0,9640; MobileNetV2 0,9544 di peringkat 9 dari 27 kandidat. State optimizer artefak MobileNetV2 konsisten dengan 4 epoch training, tetapi metrik test-nya belum diukur. Diekspor ke `wildfire_model.h5` dan `labels.json` (`{"0": "nowildfire", "1": "wildfire"}`).

### 11.3 Inferensi di produksi

`backend/python/infer.py` membaca citra, melakukan resize dan normalisasi yang identik dengan pelatihan, memuat model, memprediksi, lalu mencetak log dan satu baris `RESULT:` berisi JSON. Model dimuat ulang pada setiap permintaan.

### 11.4 Hubungan CNN dengan peta

Titik di peta berasal dari FIRMS, bukan dari CNN. CNN dipakai sebagai alat verifikasi citra yang diunggah pengguna. Menyambungkan keduanya (CNN pada tile citra di sekitar hotspot) adalah F12 di backlog.

## 12. Evaluasi dan metrik

### 12.1 Perbandingan arsitektur (1 epoch, `val_accuracy`)

| Model | val_accuracy | Waktu latih (detik) |
|---|---|---|
| MobileNet (V1), peringkat 1 | 0,9640 | 114,04 |
| DenseNet121, peringkat 4 | 0,9590 | 276,70 |
| MobileNetV2, peringkat 9 | 0,9544 | 118,69 |
| EfficientNetB0, peringkat 26 | 0,6443 | 124,30 |

Catatan: notebook membandingkan 27 kandidat, bukan tiga. Angka di atas adalah `val_accuracy` setelah 1 epoch. Judul grafik pada notebook ("Accuracy on the test set") tidak sesuai dengan kolom yang digambar. Selisih MobileNet V1 dan MobileNetV2 hanya 0,0096 sehingga belum cukup untuk klaim keunggulan arsitektur.

### 12.2 Metrik yang masih harus dicatat untuk makalah

Output notebook sudah mencetak test accuracy 97,86% dan confusion matrix ternormalisasi, tetapi angka itu milik MobileNet (V1), bukan MobileNetV2 yang diekspor. `classification_report` hanya diimpor, tidak pernah dijalankan, sehingga precision, recall, dan F1 per kelas belum ada. Metrik test untuk artefak deployment harus diukur ulang.

### 12.3 Metrik operasional (dari log backend)

| Metrik | Nilai teramati |
|---|---|
| Waktu muat model | sekitar 0,6 detik |
| Waktu inferensi | sekitar 0,46 sampai 0,49 detik |
| Total waktu proses | sekitar 1,07 sampai 1,13 detik |

## 13. Pemetaan ke syarat UTS

Presentasi UTS: 12 Oktober 2026. Makalah dikumpulkan paling lambat 16 Oktober 2026 (subjek: DKA).

| No | Syarat dosen | Bahan di proyek | Status |
|---|---|---|---|
| 1 | EDA dan pra-pemrosesan data | Notebook Kaggle dan bagian 11.1 | Bahan ada, tulisan makalah belum |
| 2 | Arsitektur sistem | Bagian 8 | Draft siap |
| 3 | Flowchart | Bagian 9 | Draft siap |
| 4 | Pseudocode atau algoritma | Lampiran A | Draft siap |
| 5 | Metrik evaluasi | Bagian 12 | Akurasi test MobileNet V1 ada (97,86%); metrik model deployment belum diukur |
| 6 | Model atau prototype | Website live dan repositori | Selesai |

## 14. Keterbatasan dan risiko

1. Hotspot adalah anomali panas satelit, bukan kebakaran terkonfirmasi. Titik di laut biasanya suar gas anjungan migas atau pantulan matahari (sun glint).
2. Pengambilan area memakai persegi panjang, sehingga titik di Sarawak, Sabah, dan Brunei ikut terhitung pada "Total titik panas".
3. Data NRT diproses sekitar 3 jam setelah satelit lewat dan satelit hanya lewat sekitar dua kali sehari (sekitar 05-06 UTC dan 17-18 UTC di Kalimantan), jadi data bersifat hampir real-time, bukan instan.
4. Animasi asap adalah ilustrasi dari vektor angin permukaan yang diinterpolasi dari sedikit titik acuan, bukan model dispersi atmosfer.
5. AQI adalah estimasi dari konsentrasi saat ini, sedangkan skala EPA aslinya memakai rata-rata 24 jam. Nilainya dapat berbeda dari ISPU resmi.
6. Dataset pelatihan adalah citra satelit Kanada (Quebec) berukuran 350x350 piksel, bukan citra Kalimantan; tidak ada validasi pada citra lokal.
7. Model dimuat ulang pada setiap permintaan prediksi; ini menambah latensi dan memori.
8. Cache berada di memori satu instance; restart server mengosongkannya.
9. Hosting gratis memiliki sumber daya terbatas; aplikasi belum dirancang untuk mobile.

## 15. Backlog prioritas

| Prioritas | Item |
|---|---|
| P0 | Rotasi kunci API (FIRMS dan OpenWeatherMap) dan token Kaggle yang pernah muncul di tangkapan layar atau percakapan |
| P0 | Isi metrik test (akurasi, confusion matrix, precision, recall, F1) ke makalah |
| P1 | Fitur kualitas udara per kota (F5): endpoint stasiun, AQI dari PM2.5 dan PM10, lencana di peta, tab daftar kota |
| P1 | Perbaiki bounding box (utara 4.5, barat 108.5) dan tambah titik acuan angin di pedalaman |
| P1 | Tambahkan `app.set('trust proxy', 1)` di server.js agar batas laju dihitung per IP pengguna, bukan per proxy Railway |
| P1 | Rapikan README (Tailwind tidak dipakai, port lokal 5000, backend Node.js + Express) dan hapus `frontend/.vade-report` |
| P1 | Filter hotspot ke batas administrasi Indonesia memakai GeoJSON provinsi |
| P1 | Pisahkan inferensi menjadi layanan yang memuat model sekali (FastAPI atau ONNX Runtime) |
| P1 | Tambahkan `fileFilter` multer (hanya jpg/png) dan respons error JSON yang jelas |
| P2 | Hitung ISPU (skala Indonesia) selain AQI AS |
| P2 | Riwayat harian jumlah hotspot dan AQI (Supabase atau sejenis) |
| P2 | CNN pada tile citra satelit (mis. NASA GIBS) di sekitar hotspot |
| P3 | Tampilan mobile, uji otomatis, dan CI |

## 16. Definisi selesai (versi UTS)

- Demo live dapat dibuka tanpa server lokal menyala.
- Periode 24 jam dan 48 jam sama-sama menampilkan data dan 48 jam memuat lebih banyak titik.
- Verifikasi citra menampilkan log proses lalu hasil klasifikasi.
- Repositori publik tidak berisi kunci API.
- Dokumen syarat 1-5 tersusun di makalah.

---

## Lampiran A. Pseudocode

### A.1 Pipeline data dan pelatihan

```
ALGORITMA LatihKlasifikasiKarhutla
MASUKAN : folder dataset (train, test), kelas {nowildfire, wildfire}
KELUARAN: wildfire_model.h5, labels.json

1. UNTUK setiap folder, baca daftar berkas gambar dan labelnya menjadi tabel (Filepath, Label)
2. Acak urutan baris tabel train
3. Bentuk generator:
     train      = 90% tabel train, ukuran 224x224 RGB, batch 32, preprocess_input
     validasi   = 10% tabel train, perlakuan sama
     test       = tabel test, tanpa diacak
4. UNTUK setiap arsitektur kandidat A:
     bangun model = A (bobot ImageNet, dibekukan) + Dense(128) + Dense(128) + Dense(2, softmax)
     latih 1 epoch, catat val_accuracy dan waktu latih
5. Pilih A dengan val_accuracy tertinggi
6. Bangun ulang model dari A, latih maksimal 5 epoch dengan EarlyStopping(val_loss)
7. Prediksi data test, hitung akurasi dan confusion matrix
8. Simpan model ke wildfire_model.h5 dan peta indeks-kelas ke labels.json
```

### A.2 Inferensi satu citra

```
ALGORITMA PrediksiCitra
MASUKAN : path gambar
KELUARAN: label, confidence, probabilitas tiap kelas

1. gambar <- baca(path); catat ukuran asli
2. gambar <- resize(gambar, 224x224) lalu konversi ke RGB
3. x <- preprocess_input(array float32 dari gambar)
4. x <- tambah dimensi batch
5. model <- muat(wildfire_model.h5); labels <- muat(labels.json)
6. p <- model.predict(x)
7. i <- indeks nilai terbesar pada p
8. KEMBALIKAN label = labels[i], confidence = p[i], probabilitas = semua p
```

### A.3 Jendela waktu hotspot

```
ALGORITMA HotspotJendelaWaktu
MASUKAN : days (1 atau 2)
KELUARAN: daftar titik pada 24 atau 48 jam terakhir

1. JIKA cache valid MAKA baris <- cache
   SELAIN ITU baris <- ambil FIRMS(DAY_RANGE = 3); hitung ts = UTC(acq_date, acq_time) tiap baris; simpan cache
2. jam <- 24 * days
3. awal <- sekarang - jam
4. KEMBALIKAN semua baris dengan ts >= awal
```

### A.4 AQI per kota (rencana, F5)

```
ALGORITMA HitungAQI
MASUKAN : pm25, pm10 (konsentrasi saat ini)
KELUARAN: aqi, kategori, polutan dominan

1. pm25 <- potong ke 1 desimal; pm10 <- potong ke bilangan bulat
2. UNTUK setiap polutan, cari baris breakpoint [Clo, Chi, Ilo, Ihi] yang memuat nilainya
     indeks <- (Ihi - Ilo) / (Chi - Clo) * (nilai - Clo) + Ilo, dibulatkan
3. aqi <- maksimum(indeks PM2.5, indeks PM10); dominan <- polutan pemilik nilai maksimum
4. kategori <- Baik (0-50), Sedang (51-100), Tidak sehat bagi kelompok sensitif (101-150),
               Tidak sehat (151-200), Sangat tidak sehat (201-300), Berbahaya (301+)
```

## Lampiran B. Istilah

| Istilah | Arti |
|---|---|
| Hotspot | Piksel satelit dengan anomali panas yang terdeteksi sebagai potensi api |
| FRP | Fire Radiative Power, daya radiatif api dalam megawatt |
| NRT | Near Real-Time, data yang diproses beberapa jam setelah satelit lewat |
| VIIRS | Sensor satelit Suomi NPP untuk deteksi api |
| AQI | Air Quality Index; di sini skala AS (EPA) revisi 2024 |
| PM2.5 / PM10 | Partikel udara berdiameter di bawah 2,5 / 10 mikrometer |
| ISPU | Indeks Standar Pencemar Udara, skala resmi Indonesia |
