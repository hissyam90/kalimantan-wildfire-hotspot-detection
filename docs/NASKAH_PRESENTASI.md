# Naskah Presentasi UTS — Enam Poin Syarat

Naskah ini disusun untuk presentasi **Pantau Karhutla Kalimantan** dengan urutan enam syarat UTS: EDA dan pra-pemrosesan, arsitektur sistem, flowchart, pseudocode, metrik evaluasi, dan model/prototype. Semua angka sudah dicocokkan dengan output notebook `wildfire-prediction-dataset-satellite-images (1).ipynb` dan pembacaan `backend/model/wildfire_model.h5`.

**Total waktu:** sekitar 12 menit presentasi + 5 menit demo dan tanya jawab.

> **Aturan utama:** jangan pernah menyebut angka akurasi test untuk MobileNetV2 yang dipakai aplikasi. Angka 97,86% adalah milik MobileNet V1 dari run notebook yang tersimpan. Metrik test artefak deployment belum diukur.

## Pembukaan (30 detik)

> "Selamat pagi. Aplikasi kami, Pantau Karhutla Kalimantan, membantu pengguna membaca tiga informasi yang berbeda tetapi saling melengkapi: titik panas satelit NASA FIRMS, kondisi cuaca dan kualitas udara kota, serta verifikasi citra memakai CNN. Kami ingin menekankan sejak awal bahwa ketiga hal ini bukan data yang sama. Titik panas bukan kebakaran terkonfirmasi, animasi asap hanya ilustrasi arah angin, dan CNN hanya alat bantu screening gambar."

## Poin 1 — EDA dan pra-pemrosesan data (2 menit)

**Yang ditampilkan:** tabel jumlah gambar per split, contoh gambar dua kelas, dan potongan kode generator.

**Naskah:**

> "Dataset yang kami pakai adalah Wildfire Prediction Dataset dari Kaggle. Isinya 42.850 citra satelit berukuran 350 kali 350 piksel, terdiri dari 22.710 gambar kelas wildfire dan 20.140 gambar kelas nowildfire. Citra ini berasal dari area yang pernah terbakar di Kanada, tepatnya Quebec, dan diekstrak memakai MapBox. Jadi sejak awal kami sadar dan kami sampaikan bahwa domain datanya bukan Kalimantan."

> "Folder asli dataset sudah terbagi menjadi train 30.250 gambar, test 6.300, dan valid 6.300. Di notebook, folder train dipecah lagi secara internal dengan validation split 10 persen dan seed nol, sehingga yang benar-benar dilatih 27.225 gambar dan yang dipakai validasi 3.025 gambar. Folder valid bawaan tidak dipakai sama sekali. Total yang terpakai 36.550 dari 42.850 gambar."

> "Semua gambar di-resize ke 224 kali 224 piksel, diubah ke RGB, dan pikselnya dinormalisasi dengan fungsi preprocess_input MobileNetV2, yaitu dari rentang nol sampai 255 menjadi minus satu sampai satu. Batch size 32. Fungsi yang sama dipakai lagi di backend saat inferensi, karena file model tidak memiliki layer preprocessing di dalamnya."

**Yang harus disebut sebagai temuan, bukan disembunyikan:**

> "Ada satu temuan penting saat kami audit ulang notebook. Parameter augmentasi seperti rotasi 30 derajat, zoom, shift, shear, dan horizontal flip ditulis di dalam pemanggilan flow_from_dataframe. Fungsi itu tidak membaca parameter tersebut; argumen tambahan hanya masuk ke kwargs dan diabaikan. Artinya augmentasi tidak pernah berjalan. Model kami dilatih hanya dengan resize dan normalisasi. Ini kami catat sebagai keterbatasan dan akan diperbaiki dengan memindahkan parameter ke konstruktor ImageDataGenerator atau memakai layer augmentasi."

**Jangan bilang:** "Kami memakai augmentasi untuk mengurangi overfitting." Itu tidak benar untuk run ini.

## Poin 2 — Arsitektur sistem (1,5 menit)

**Yang ditampilkan:** diagram React → Express → FIRMS/OpenWeatherMap/WAQI + Python.

**Naskah:**

> "Arsitektur aplikasi terdiri dari tiga bagian. Frontend React menampilkan peta, kartu kota, dan panel verifikasi citra. Backend Express menjadi satu-satunya pintu data: ia mengambil titik panas dari NASA FIRMS, cuaca dan angin dari OpenWeatherMap, serta AQI dari WAQI. Ketiga sumber ini di-cache sementara supaya tidak meminta data berulang kali."

> "Untuk fitur verifikasi citra, backend menyimpan file sementara lalu menjalankan script Python infer.py sebagai proses terpisah. Script itu memuat model, melakukan preprocessing, menjalankan prediksi, dan mengembalikan satu baris JSON. Frontend menampilkan status proses, confidence, ukuran gambar asli, jumlah parameter, dan waktu inferensi."

> "Empat endpoint utama: GET /api/hotspots untuk titik panas, GET /api/wind untuk cuaca dan angin, POST /api/predict untuk klasifikasi gambar, dan GET /api/model-status untuk memeriksa kesiapan model."

> "Poin pentingnya: CNN tidak terhubung ke peta. Titik di peta berasal dari FIRMS. CNN hanya memeriksa gambar yang diunggah pengguna. Menyambungkan CNN ke tile satelit di sekitar hotspot masih ada di backlog."

**Jangan bilang:** "CNN mendeteksi lokasi kebakaran." Model hanya mengklasifikasikan satu gambar.

## Poin 3 — Flowchart (1,5 menit)

**Yang ditampilkan:** flowchart alur verifikasi citra.

**Naskah:**

> "Alurnya seperti ini. Pengguna memilih gambar JPG atau PNG. Frontend mengirim multipart ke POST /api/predict. Backend memeriksa batas laju dan ukuran file, lalu menyimpan file sementara. Setelah itu backend menjalankan infer.py."

> "Di dalam infer.py, gambar dibaca, ukuran aslinya dicatat, lalu di-resize ke 224 kali 224 dan dikonversi ke RGB. Nilai piksel dinormalisasi dengan preprocess_input MobileNetV2 dan ditambah dimensi batch menjadi satu kali 224 kali 224 kali tiga. Model memuat wildfire_model.h5, menjalankan prediksi, dan menghasilkan dua skor softmax. Skor terbesar menentukan label. Hasil dikirim sebagai JSON, lalu file sementara dihapus."

> "Kalau model memprediksi wildfire, interpretasinya adalah pola gambar lebih dekat dengan contoh wildfire pada data latihan. Bukan berarti api pasti ada. Kalau nowildfire, tetap ada kemungkinan api kecil atau kondisi yang belum pernah dilihat model."

**Jangan bilang:** "Jika confidence 90 persen, berarti 90 persen pasti ada kebakaran." Softmax belum dikalibrasi.

## Poin 4 — Pseudocode atau algoritma (1,5 menit)

**Yang ditampilkan:** dua blok pseudocode: training dan inferensi.

**Naskah training:**

> "Algoritma training-nya: pertama baca daftar file dan label menjadi tabel. Kedua, bentuk generator train 90 persen dan validasi 10 persen dengan seed nol, serta generator test tanpa pengacakan. Ketiga, untuk setiap kandidat arsitektur, bangun backbone ImageNet yang dibekukan, tambahkan Dense 128, Dense 128, dan Dense 2 softmax, lalu latih satu epoch dan catat validation accuracy. Keempat, pilih kandidat dengan validation accuracy tertinggi. Kelima, bangun ulang model dan latih maksimal lima epoch dengan EarlyStopping pada val_loss, patience satu, dan restore best weights. Keenam, prediksi data test, hitung akurasi dan confusion matrix. Ketujuh, ekspor model dan labels.json."

**Naskah inferensi:**

> "Algoritma inferensi: baca gambar, resize 224, konversi RGB, preprocess_input, tambah dimensi batch, muat model dan labels.json, jalankan predict, ambil indeks skor terbesar, lalu kembalikan label, confidence, dan seluruh probabilitas."

> "Satu detail yang kami tekankan: urutan preprocessing saat training dan inferensi harus identik. Kalau tidak, distribusi input berubah dan hasil prediksi tidak bisa dibandingkan."

**Jangan bilang:** "Pseudocode memakai augmentasi." Tabel di poin 1 sudah menjelaskan bahwa augmentasi tidak aktif.

## Poin 5 — Metrik evaluasi (2 menit)

**Yang ditampilkan:** tabel perbandingan, kurva training, dan confusion matrix.

**Naskah:**

> "Notebook membandingkan 27 kandidat backbone, masing-masing satu epoch. Peringkat pertama adalah MobileNet V1 dengan validation accuracy 0,9640. DenseNet201 0,9636, DenseNet169 0,9600, DenseNet121 0,9590. MobileNetV2 yang kami pakai di aplikasi berada di peringkat kesembilan dengan 0,9544. Selisih dengan peringkat pertama hanya 0,0096, kurang dari satu poin persentase, jadi kami tidak mengklaim MobileNetV2 sebagai arsitektur terbaik."

> "Pada training final, model terbaik dari run yang tersimpan dilatih maksimal lima epoch dan berhenti di epoch keempat. Validation loss terbaik ada di epoch ketiga, yaitu 0,0809, dengan validation accuracy 0,9696. Bobot epoch ketiga dipulihkan oleh EarlyStopping."

> "Untuk test set, output notebook mencetak 97,86 persen. Tapi ada dua catatan kejujuran. Pertama, angka itu milik MobileNet V1, bukan MobileNetV2 yang diekspor ke aplikasi. Kedua, precision, recall, dan F1 per kelas belum dihitung karena classification_report hanya diimpor, tidak pernah dijalankan. Confusion matrix tersedia dalam bentuk gambar, bukan angka."

> "Kami juga menemukan judul grafik di notebook berbunyi Accuracy on the test set, padahal sumbu Y-nya val_accuracy. Itu label yang keliru dan tidak kami kutip sebagai akurasi test."

> "Untuk artefak MobileNetV2 yang dipakai aplikasi, kami sudah memverifikasi jumlah parameter 2.438.722 dan jumlah epoch training dari state optimizer, yaitu 3.404 iterasi atau 851 batch kali empat epoch. Tetapi metrik validasi dan test artefak itu belum tercatat. Langkah berikutnya adalah menjalankan evaluasi pada 6.300 gambar test dan melaporkan accuracy, precision, recall, F1, serta confusion matrix untuk model yang benar-benar dipakai."

**Angka yang boleh disebut:**

| Angka | Artinya |
|---|---|
| 0,9640 | Validation accuracy MobileNet V1, 1 epoch, peringkat 1 |
| 0,9544 | Validation accuracy MobileNetV2, 1 epoch, peringkat 9 |
| 0,9696 | Validation accuracy training final MobileNet V1, epoch 3 |
| 97,86% | Test accuracy MobileNet V1 dari output notebook |
| 2.438.722 | Jumlah parameter artefak MobileNetV2 yang dipakai aplikasi |
| 3.404 | Iterasi optimizer artefak = 851 batch × 4 epoch |

**Jangan bilang:** "Akurasi model kami 97 persen." Untuk model produksi, angka itu belum diukur.

## Poin 6 — Model atau prototype (2 menit + demo)

**Yang ditampilkan:** aplikasi live dan panel verifikasi citra.

**Naskah:**

> "Prototype yang kami bawa adalah aplikasi web yang sudah berjalan. Model yang terhubung ke endpoint adalah MobileNetV2 dengan bobot ImageNet yang dibekukan, ditambah head Dense 128, Dense 128, dan Dense 2 softmax. Total 158 layer dan 2.438.722 parameter. File model berisi konfigurasi, bobot, dan state optimizer, jadi bisa dimuat langsung tanpa mendefinisikan ulang arsitektur."

> "Saat pengguna mengunggah gambar, backend menjalankan inferensi sekitar 0,5 detik, ditambah muat model sekitar 0,6 detik, sehingga total sekitar 1,1 detik. Model dimuat ulang setiap permintaan. Ini masih bisa dioptimalkan dengan memuat model sekali di layanan terpisah."

> "Kami juga punya folder training berisi baseline CNN untuk patch termal VIIRS. Pipeline itu sudah memiliki split berbasis group dan metrik test, tetapi belum terhubung ke aplikasi. Jadi jangan kami campur dengan model produksi."

**Urutan demo (3 menit):**

1. Buka tab peta, tunjukkan titik FIRMS, ganti periode 24 ke 48 jam.
2. Klik satu titik, jelaskan bahwa itu observasi satelit, bukan kebakaran terkonfirmasi.
3. Tunjukkan animasi asap dan tegaskan itu ilustrasi arah angin.
4. Buka kartu kota, jelaskan AQI dari WAQI dan cuaca dari OpenWeatherMap.
5. Buka verifikasi citra, unggah satu gambar, tunjukkan log proses dan hasil.
6. Tutup dengan batasan: model hanya screening, domain data Kanada, metrik test model produksi belum diukur.

**Jangan bilang:** "Model ini sudah divalidasi untuk Kalimantan." Belum ada validasi lokal.

## Penutup (30 detik)

> "Kesimpulannya, aplikasi ini menggabungkan tiga sumber informasi yang berbeda: titik panas satelit, konteks cuaca dan udara, serta klasifikasi citra. Kami berusaha jujur soal batasannya. Augmentasi di notebook tidak aktif, dataset latih berasal dari Kanada, dan metrik test untuk model yang diekspor belum kami ukur. Pekerjaan berikutnya adalah memperbaiki pipeline training, mengevaluasi model deployment pada test set, dan menghitung precision, recall, serta F1 per kelas. Terima kasih."

## Persiapan tanya jawab

**1. "Kenapa di tabel MobileNet V1 lebih tinggi, tapi aplikasi memakai MobileNetV2?"**

> "Betul, output notebook yang tersimpan memilih MobileNet V1 dengan 0,9640, sedangkan MobileNetV2 0,9544. Namun artefak yang tersimpan dan dipakai endpoint adalah MobileNetV2, terlihat dari nama layer backbone dan state optimizer yang menunjukkan training empat epoch. Riwayat pemilihan ulang itu tidak tercatat di notebook. Selisih 0,0096 pada satu epoch juga terlalu kecil untuk menyimpulkan V1 lebih baik. Kami akan menjalankan ulang seleksi dengan seed tetap dan mencatat metrik test untuk model yang benar-benar diekspor."

**2. "Berapa akurasi model yang dipakai di aplikasi?"**

> "Belum kami ukur pada test set. Yang ada di notebook adalah 97,86 persen untuk MobileNet V1. Kami tidak memindahkan angka itu ke MobileNetV2 karena itu klaim yang tidak didukung data. Evaluasi model deployment menjadi prioritas berikutnya."

**3. "Kenapa augmentasi tidak jalan?"**

> "Karena parameter rotasi, zoom, dan flip ditulis sebagai argumen flow_from_dataframe. Fungsi itu tidak memiliki parameter tersebut; argumen tambahan diabaikan. Perbaikannya adalah memindahkan parameter ke konstruktor ImageDataGenerator atau memakai layer augmentasi di dalam model, lalu melatih ulang."

**4. "Apakah model bisa dipakai untuk kebakaran di Kalimantan?"**

> "Belum bisa diklaim. Data latih adalah citra satelit Kanada pada resolusi 350 kali 350. Tidak ada contoh negatif dari lanskap, kabut, atau lahan gambut Kalimantan. Model bisa dipakai sebagai demonstrasi metode, tetapi bukan alat operasional."

**5. "Apa bedanya CNN dengan titik panas FIRMS?"**

> "FIRMS mendeteksi anomali panas termal dari satelit dan menghasilkan koordinat. CNN kami hanya mengklasifikasikan pola RGB pada satu gambar yang diunggah. CNN tidak menghasilkan koordinat, luas, atau tingkat bahaya."

**6. "Kenapa confidence bisa tinggi padahal prediksinya salah?"**

> "Softmax belum dikalibrasi dan model bisa sangat yakin pada gambar di luar distribusi latihan. Karena itu kami menyebutnya skor kemiripan, bukan probabilitas kejadian kebakaran."

**7. "Kenapa folder valid tidak dipakai?"**

> "Notebook memakai validation split internal 10 persen dari folder train dengan seed nol, sehingga validasi konsisten dengan data train. Folder valid bawaan dataset hanya dimuat dan divisualisasikan. Konsekuensinya ada 6.300 gambar yang tidak terpakai; ini bisa diperbaiki dengan memakai folder valid sebagai validasi eksternal."

**8. "Apa rencana perbaikan model?"**

> "Pertama, mengaktifkan augmentasi dengan benar. Kedua, mengevaluasi artefak deployment pada test set dan melaporkan accuracy, precision, recall, F1, serta confusion matrix. Ketiga, memakai folder valid sebagai validasi independen. Keempat, menguji citra Kalimantan dan mempertimbangkan baseline VIIRS yang sudah ada di folder training."

## Lembar fakta cepat

| Item | Nilai |
|---|---|
| Dataset | Kaggle `abdelghaniaaba/wildfire-prediction-dataset`, citra satelit Kanada 350×350 |
| Total citra | 42.850 (22.710 wildfire, 20.140 nowildfire) |
| Split dipakai | 27.225 train, 3.025 validation, 6.300 test |
| Tidak dipakai | 6.300 folder valid |
| Input model | 224×224×3 RGB, float32, rentang [-1, 1] |
| Preprocessing | `mobilenet_v2.preprocess_input`, di luar model |
| Augmentasi | Tidak aktif |
| Kandidat dibandingkan | 27 backbone, 1 epoch |
| Model deployment | MobileNetV2, 158 layer, 2.438.722 parameter |
| Training artefak | 4 epoch (iteration 3404) |
| Test accuracy tercatat | 97,86% untuk MobileNet V1, bukan model deployment |
| Latensi inferensi | ±0,5 detik + muat model ±0,6 detik |
| Label | 0 = nowildfire, 1 = wildfire |