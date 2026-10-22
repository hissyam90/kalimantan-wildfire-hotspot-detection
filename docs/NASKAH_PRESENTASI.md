# Naskah Presentasi UTS — Enam Poin Syarat

Naskah ini mengikuti urutan enam syarat UTS: EDA dan pra-pemrosesan, arsitektur sistem, flowchart, pseudocode, metrik evaluasi, dan model/prototype. Semua angka sudah dicocokkan dengan output notebook Colab `1NX43x-kH59Qu_nabDKVnKekNh4h-w9Se` dan pembacaan `backend/model/wildfire_model.h5`. Rincian teknisnya ada di [MODEL_TRAINING.md](MODEL_TRAINING.md).

**Total waktu:** sekitar 12 menit presentasi + 5 menit demo dan tanya jawab.

---

## A. Peta alt-tab: jendela mana, tab mana, tunjuk apa

Bagian ini menjawab pertanyaan "alt-tab ke mana". Prinsipnya: **hanya tiga jendela**, dan setiap poin sudah punya tujuan tetap. Jangan membuka berkas baru saat presentasi berlangsung.

### A.1 Tiga jendela yang disiapkan

| Jendela | Isi | Dipakai pada poin |
|---|---|---|
| **Jendela 1 — Browser** | Tab 1: aplikasi lokal `http://127.0.0.1:7860`, atau URL ngrok saat demo | 2, 5, 6 |
| **Jendela 2 — VS Code** | Tab editor: `PRD.md` (preview), `NASKAH_PRESENTASI.md` (preview), `assets/05-confusion-matrix.png`, `backend/python/infer.py` | 2, 3, 4 |
| **Jendela 3 — PowerShell** | Folder `E:\Coding\wildfire-app`, siap menjalankan `infer.py` | 4, 6 (opsional) |

### A.2 Tabel alt-tab per poin

Kolom **Alt+Tab ke** berisi jendela tujuan; tulisan **tetap** berarti Anda tidak perlu berpindah jendela, cukup scroll atau klik di tempat yang sama. Sebelum mulai, klik Jendela 1 → Jendela 2 → Jendela 3 secara berurutan supaya urutan Alt+Tab dapat diprediksi.

| Poin | Alt+Tab ke | Lalu buka | Yang Anda tunjuk | Kalimat pembuka |
|---|---|---|---|---|
| **1. EDA** | Jendela 1 | Tab 2 (Colab), `Ctrl+F` → `Number of pictures` | Output jumlah gambar train/test/valid | "Ini pembagian data yang kami pakai." |
| **1. EDA** | tetap | Colab, scroll ke `viz_img(df_train)` (cell 9) | Dua contoh citra: `wildfire` dan `nowildfire` | "Contoh kelasnya seperti ini." |
| **1. EDA** | tetap | Colab, scroll ke `def create_gen()` (cell 12) | Baris `target_size=(224, 224)` dan `preprocess_input` | "Di sini resize dan normalisasi terjadi." |
| **2. Arsitektur** | Jendela 2 | Tab `PRD.md`, scroll **§8 Arsitektur sistem** | Diagram mermaid: browser → Flask lokal → FIRMS/OWM/WAQI + Python, ngrok opsional | "Tiga bagian: frontend, backend, model." |
| **2. Arsitektur** | Jendela 1 | Tab 1 (aplikasi), klik tab **Peta hotspot** → **Kondisi kota** → **Verifikasi citra** | Tiga tab aplikasi | "Ketiganya terlihat di satu aplikasi." |
| **3. Flowchart** | Jendela 2 | Tab `PRD.md`, scroll **§9.1** lalu **§9.2** | Dua diagram alur: data peta dan verifikasi citra | "Alurnya dua jalur terpisah." |
| **4. Pseudocode** | Jendela 2 | Tab `PRD.md`, scroll **Lampiran A.1** dan **A.2** | Blok pseudocode training dan inferensi | "Ini pseudocode-nya." |
| **4. Pseudocode** | Jendela 2 | Tab `backend/python/infer.py` | Fungsi pra-pemrosesan dan `model.predict` | "Dan ini wujud nyatanya di kode." |
| **5. Metrik** | Jendela 1 | Tab 2 (Colab), scroll ke tabel `df_results` (cell 15) | Tabel 3 model + grafik batang | "Kami bandingkan tiga arsitektur." |
| **5. Metrik** | tetap | Colab, scroll ke log epoch (cell 18) dan grafik kurva (cell 19) | Empat baris `Epoch 1/5` … `Epoch 4/5`, lalu kurva | "Latihan berhenti sendiri di epoch 4." |
| **5. Metrik** | tetap | Colab, scroll ke sel prediksi (cell 20) | Tulisan **`MobileNetV2 with 97.00% accuracy on the test set`** dan confusion matrix | "Hasil akhir di test set: 97 persen." |
| **6. Model** | Jendela 1 | Tab 1 (aplikasi) → tab **Verifikasi citra** → unggah gambar → **Jalankan** | Kartu hasil: label + skor | "Ini model yang sama, dipakai langsung." |
| **6. Model** | tetap | Colab, scroll ke `!ls -la /content/*.h5` (cell 24) | `11745904 ... /content/wildfire_model.h5` | "Berkas inilah yang ada di repositori." |

### A.3 Aturan keselamatan saat layar diproyeksikan

1. **Jangan pernah scroll ke cell paling atas notebook.** Cell 0 berisi token API Kaggle yang tertulis terbuka. Sebelum presentasi, cabut token itu (Kaggle → Settings → API → *Revoke*), buat token baru, dan simpan di Colab Secrets, bukan di dalam cell.
2. **Jangan menjalankan ulang cell apa pun di Colab.** Runtime sudah terputus. Menekan *Run all* akan mengunduh dataset 1,45 GB dan menghabiskan waktu presentasi.
3. Tutup sidebar kiri Colab dan naikkan zoom browser ke 110% agar angka terbaca dari belakang.
4. Matikan notifikasi Windows (**Focus assist**) dan tutup tab surel atau chat.

### A.4 Rencana cadangan kalau Colab tidak bisa dibuka

Semua gambar hasil notebook sudah diekspor ke `docs/assets/`. Kalau internet atau akun bermasalah, buka Jendela 2 → VS Code → folder `docs/assets/` dan tampilkan:

| Poin | Berkas pengganti |
|---|---|
| 1. EDA | `assets/01-contoh-citra-dua-kelas.png` |
| 5. Metrik | `assets/02-perbandingan-3-model.png`, `assets/04-kurva-accuracy-loss.png`, `assets/05-confusion-matrix.png` |
| 6. Model | `assets/03-waktu-training.png` |

Angka-angka penting juga tersedia di lembar fakta (§H), sehingga presentasi tetap dapat berjalan tanpa membuka apa pun.

---

## B. Pembukaan (30 detik)

> "Selamat pagi. Aplikasi kami, Pantau Karhutla Kalimantan, membantu pengguna membaca tiga informasi yang berbeda tetapi saling melengkapi: titik panas satelit NASA FIRMS, kondisi cuaca dan kualitas udara kota, serta verifikasi citra memakai CNN. Kami ingin menekankan sejak awal bahwa ketiganya bukan data yang sama. Titik panas bukan kebakaran terkonfirmasi, animasi asap hanya ilustrasi arah angin, dan CNN hanya alat bantu screening gambar."

---

## Poin 1 — EDA dan pra-pemrosesan data (2 menit)

**Alt+Tab → Jendela 1 → Tab 2 (Colab).** Tekan `Ctrl+F`, cari `Number of pictures`, lalu `Esc`. Notebook akan melompat ke output jumlah gambar.

### Naskah

> "Dataset yang kami pakai adalah Wildfire Prediction Dataset dari Kaggle, 1,45 gigabyte. Isinya citra satelit berukuran 350 kali 350 piksel, dua kelas: wildfire dan nowildfire. Citra ini berasal dari area yang pernah terbakar di Kanada, Quebec, dan diekstrak memakai MapBox. Jadi sejak awal kami sadar dan kami sampaikan: domain datanya bukan Kalimantan."

> "Pembagian bawaannya train 30.250 gambar, test 6.300, dan valid 6.300. Yang menarik, di notebook folder train dipecah lagi dengan validation split 10 persen dan seed nol. Hasilnya 27.225 gambar untuk dilatih dan 3.025 untuk validasi. Folder valid bawaan justru tidak dipakai sama sekali. Jadi total yang terpakai 36.550 dari 42.850 gambar."

**Tunjuk contoh gambar** (scroll ke `viz_img(df_train)`): *"Ini contoh dua kelasnya. Perhatikan bahwa yang membedakan kelas bukan api yang menyala, melainkan tekstur lanskap yang pernah terbakar."*

**Tunjuk generator** (scroll ke `def create_gen()`): *"Semua gambar di-resize ke 224 kali 224, diubah ke RGB, lalu pikselnya dinormalisasi dengan preprocess_input MobileNetV2, dari nol sampai 255 menjadi minus satu sampai satu. Batch size 32. Fungsi yang sama dipanggil lagi di backend saat inferensi, karena file model tidak memiliki layer preprocessing di dalamnya."*

### Temuan yang harus disebut, bukan disembunyikan

> "Ada satu temuan penting saat kami audit ulang notebook. Parameter augmentasi seperti rotasi 30 derajat, zoom, shift, shear, dan horizontal flip ditulis di dalam pemanggilan flow_from_dataframe. Fungsi itu tidak membaca parameter tersebut; argumen tambahan hanya masuk ke kwargs dan diabaikan. Artinya augmentasi tidak pernah berjalan. Model kami dilatih hanya dengan resize dan normalisasi. Ini kami catat sebagai keterbatasan, dan perbaikannya adalah memindahkan parameter ke konstruktor ImageDataGenerator atau memakai layer augmentasi."

**Jangan bilang:** "Kami memakai augmentasi untuk mengurangi overfitting." Untuk run ini itu tidak benar.

---

## Poin 2 — Arsitektur sistem (1,5 menit)

**Alt+Tab → Jendela 2 → tab `PRD.md`, scroll ke §8 Arsitektur sistem** (di VS Code: `Ctrl+Shift+V` untuk preview Markdown). Tunjuk diagramnya, jangan bacakan isi kotak.

### Naskah

> "Arsitektur aplikasi terdiri dari tiga bagian. Frontend React menampilkan peta, kartu kota, dan panel verifikasi citra. Backend Flask berjalan di laptop dan menjadi satu-satunya pintu data: ia menyajikan halaman hasil build sekaligus mengambil titik panas dari NASA FIRMS, cuaca dan angin dari OpenWeatherMap, serta AQI dari WAQI. Ketiga sumber ini di-cache sementara supaya tidak meminta data berulang kali. Saat demo, tunnel ngrok hanya meneruskan alamat lokal itu supaya penguji bisa membukanya dari perangkat lain."

> "Untuk verifikasi citra, backend menyimpan file model dan memanggil proses Python terpisah. Jadi model tidak berjalan di browser pengguna, dan API key tidak pernah dikirim ke frontend."

**Transisi ke aplikasi:** **Alt+Tab → Jendela 1 → Tab 1**, klik berurutan tab **Peta hotspot**, **Kondisi kota**, **Verifikasi citra**.

> "Ini wujudnya. Tiga tab ini persis tiga sumber data tadi, dan sengaja kami pisahkan supaya pengguna tidak mencampurnya."

---

## Poin 3 — Flowchart (1,5 menit)

**Alt+Tab → Jendela 2 → tab `PRD.md`, scroll ke §9.1 lalu §9.2.**

### Naskah

> "Alurnya dua jalur terpisah. Jalur pertama, data peta: frontend meminta hotspot, backend memeriksa cache, kalau kosong ia memanggil FIRMS, menyaring koordinat ke wilayah Kalimantan, mengubah format, lalu mengirim GeoJSON ke peta. Ada juga jalur cuaca dan angin dari OpenWeatherMap dan AQI dari WAQI untuk kartu kota."

> "Jalur kedua, verifikasi citra: pengguna mengunggah gambar, Flask memvalidasi tipe dan ukuran, menyimpannya sementara, lalu menjalankan skrip Python. Skrip itu memuat model, melakukan resize dan normalisasi, memanggil predict, dan mengembalikan label beserta skor. Setelah itu berkas sementara dihapus."

> "Dua jalur ini tidak pernah bertemu. CNN tidak menerima koordinat, dan peta tidak menerima hasil klasifikasi. Itu keputusan desain, bukan kekurangan, supaya pengguna tidak salah membaca titik panas sebagai hasil CNN."

---

## Poin 4 — Pseudocode (1,5 menit)

**Alt+Tab → Jendela 2 → tab `PRD.md`, scroll ke Lampiran A.1 dan A.2.** Setelah itu klik tab `backend/python/infer.py`.

### Naskah

> "Pseudocode training-nya sederhana karena kami memakai transfer learning. Unduh dataset, buat DataFrame berisi path dan label, bangun generator dengan resize 224 dan normalisasi, muat MobileNetV2 tanpa top layer dengan bobot ImageNet, bekukan seluruh backbone, tambahkan dua layer Dense 128 dan satu output softmax dua kelas, latih, lalu simpan."

> "Untuk inferensi, pseudocode-nya hanya lima langkah: buka gambar, ubah ke RGB, resize ke 224, normalisasi dengan fungsi yang sama seperti saat training, lalu ambil argmax dari output softmax. Di file infer.py, lima langkah itu benar-benar ada, dan tidak ada langkah tambahan yang tersembunyi."

**Tunjuk `infer.py`:** *"Bagian ini penting: normalisasinya harus identik dengan saat training. Kalau fungsi ini diganti, model tidak akan error, tetapi akurasinya jatuh. Karena itu kami menaruh komentar eksplisit di sini."*

---

## Poin 5 — Metrik evaluasi (2,5 menit, bagian terpenting)

**Alt+Tab → Jendela 1 → Tab 2 (Colab).** `Ctrl+F`, cari `Training time (sec)`. Di bawahnya ada tabel hasil perbandingan.

### Naskah

> "Kami membandingkan tiga arsitektur transfer learning dengan resep yang sama: MobileNetV2, DenseNet121, dan EfficientNetB0. Semua backbone dibekukan, hanya head yang dilatih, satu epoch, dataset validasi 3.025 gambar."

**Tunjuk tabel (cell 15):**

> "Hasilnya MobileNetV2 0,9557, DenseNet121 0,9534, EfficientNetB0 0,8555. MobileNetV2 menang, tetapi saya ingin jujur: selisih dengan DenseNet121 hanya 0,0023, sekitar tujuh gambar dari 3.025. Jadi keunggulan yang benar-benar meyakinkan bukan akurasinya, melainkan efisiensi: 115 detik berbanding 151 detik, dan modelnya jauh lebih kecil. EfficientNetB0 tertinggal karena kami memakai fungsi normalisasi MobileNetV2 untuk semua model, padahal EfficientNet punya normalisasi sendiri. Itu bias pengujian kami, dan sudah kami catat."

**Scroll ke log epoch (cell 18) dan kurva (cell 19):**

> "Model terbaik lalu dilatih ulang dengan batas lima epoch dan EarlyStopping yang memantau validation loss. Latihan berhenti sendiri di epoch keempat: akurasi training naik terus dari 0,9474 sampai 0,9744, tetapi validation loss justru naik di epoch keempat. Jadi EarlyStopping mengembalikan bobot ke epoch ketiga, yang terbaik, dan di situlah gejala overfitting ringan mulai terlihat."

**Scroll ke sel prediksi (cell 20):**

> "Evaluasi akhir pada 6.300 gambar test menghasilkan **97,00 persen**. Artinya 6.111 benar dan 189 salah. Angka ini sah untuk model yang dipakai aplikasi, karena evaluasi memakai bobot epoch ketiga yang sama dengan yang kemudian disimpan. Confusion matrix ternormalisasi di bawahnya menunjukkan kedua jenis kesalahan masih ada, meskipun keduanya kecil."

### Kalimat jujur yang menaikkan nilai, bukan menurunkannya

> "Yang belum kami punya adalah precision, recall, dan F1 per kelas. Fungsinya sudah diimpor di notebook, tetapi tidak pernah dipanggil. Tanpa itu kami belum bisa menjawab pertanyaan yang paling penting untuk aplikasi ini: lebih berbahaya mana, kebakaran yang lolos, atau gambar bersih yang dituduh terbakar? Itu prioritas evaluasi kami berikutnya."

---

## Poin 6 — Model dan prototype (2 menit)

**Alt+Tab → Jendela 1 → Tab 1 (aplikasi) → tab Verifikasi citra → unggah gambar → Jalankan.**

Gambar uji harus disiapkan **sebelum** presentasi (satu citra satelit lanskap, JPG atau PNG).

### Naskah

> "Ini model yang sama yang tadi kita lihat metriknya, sekarang dipakai langsung. Saya unggah satu gambar. Hasilnya bukan 'ada api di sini', melainkan skor kemiripan pola: apakah gambar ini lebih mirip contoh area terbakar atau tidak. Skor 98 persen bukan berarti 98 persen kemungkinan kebakaran, karena softmax belum dikalibrasi."

> "Modelnya MobileNetV2 dengan 158 layer dan 2,4 juta parameter, tetapi karena backbone dibekukan, yang benar-benar dilatih hanya 180 ribu parameter di bagian head. Ukuran filenya 11,7 megabyte, dan inferensi di CPU masih di bawah satu detik."

**Alt+Tab tetap di Jendela 1, scroll Colab ke cell 24:**

> "Dan ini bukti rantainya: berkas yang disimpan notebook berukuran 11.745.904 byte, sama persis dengan yang ada di repositori. Jadi tidak ada model 'versi lain' yang diam-diam dipakai."

---

## C. Penutup (30 detik)

> "Kesimpulannya: aplikasi ini memisahkan tiga jenis informasi supaya tidak tertukar, dan model CNN-nya mencapai 97 persen pada test set dengan batasan yang kami sebutkan tadi. Batasan terbesarnya bukan angka akurasi, melainkan domain: data latihnya citra Kanada, bukan Kalimantan. Jadi model ini kami posisikan sebagai demonstrasi metode dan alat bantu awal, bukan alat operasional. Rencana kami: mengaktifkan augmentasi dengan benar, mengukur precision dan recall, memakai folder valid sebagai uji independen, dan menyediakan contoh citra Kalimantan."

---

## D. Persiapan 10 menit sebelum mulai

| No | Langkah | Alasan |
|---|---|---|
| 1 | Buka Tab 1 aplikasi live, muat sekali agar cache dan peta siap | Menghindari loading di depan dosen |
| 2 | Buka Tab 2 notebook Colab, **pastikan tidak di posisi paling atas** | Cell 0 memuat token |
| 3 | Di VS Code: buka preview `PRD.md`, tekan `Ctrl+F` cari `Arsitektur sistem` | Lompat cepat saat poin 2 |
| 4 | Buka `infer.py` di tab sebelahnya | Poin 4 |
| 5 | Siapkan satu gambar uji di Desktop | Poin 6 |
| 6 | Uji sekali alur unggah gambar | Mengetahui waktu tunggu sebenarnya |
| 7 | Klik berurutan Jendela 1 → 2 → 3 | Mengunci urutan Alt+Tab |
| 8 | Aktifkan Focus assist, tutup notifikasi | Layar bersih |

---

## E. Skenario demo (kalau dosen minta demo langsung)

1. **Peta hotspot** — ubah periode 1/2/3 hari, klik satu titik, sebut bahwa ini observasi NASA FIRMS, bukan jumlah kebakaran.
2. **Animasi asap** — nyalakan lewat menu Pengaturan, tegaskan ini ilustrasi arah angin.
3. **Kondisi kota** — tunjuk AQI dari WAQI dan cuaca dari OpenWeatherMap pada kartu yang sama.
4. **Verifikasi citra** — unggah gambar, baca label dan skornya, ulangi kalimat "skor kemiripan, bukan probabilitas kebakaran".

Demo cadangan tanpa internet: Jendela 3 (PowerShell), jalankan langsung

```powershell
cd E:\Coding\wildfire-app\backend
python python\infer.py "C:\path\ke\gambar.jpg"
```

Perintah ini mencetak hasil yang sama dengan endpoint `/api/predict` dan tidak membutuhkan jaringan.

---

## F. Persiapan tanya jawab

**1. "Kenapa hanya tiga model, bukan lebih banyak?"**

> "Notebook yang menghasilkan model ini membandingkan tiga arsitektur yang mewakili tiga keluarga berbeda: MobileNet untuk efisiensi, DenseNet untuk koneksi rapat, EfficientNet untuk penskalaan compound. Tiga model sudah cukup untuk menunjukkan proses seleksi, dan yang lebih penting bagi kami adalah waktu training di lingkungan gratis. Kami punya eksplorasi terpisah dengan 27 backbone, tetapi hasilnya tidak dipakai karena notebook itu memakai pra-pemrosesan yang sama untuk semua model dan tidak menghasilkan artefak yang kami deploy."

**2. "Selisih 0,0023 itu signifikan?"**

> "Tidak. Itu sekitar tujuh gambar dari 3.025, dan hanya dari satu epoch. Kami tidak mengklaim MobileNetV2 lebih akurat secara meyakinkan. Alasan kami memilihnya adalah efisiensi: 115 detik lawan 151 detik, ukuran jauh lebih kecil, dan cocok untuk backend gratis dengan CPU. Untuk klaim akurasi, perlu beberapa seed dan evaluasi pada test set."

**3. "Berapa akurasi model yang dipakai di aplikasi?"**

> "97,00 persen pada 6.300 gambar test, tercatat di notebook. Evaluasi itu memakai bobot epoch terbaik yang sama dengan yang disimpan, jadi angkanya berlaku untuk berkas yang dipakai aplikasi. Yang belum ada adalah precision dan recall per kelas."

**4. "Kenapa augmentasi tidak jalan?"**

> "Karena parameter rotasi, zoom, dan flip ditulis sebagai argumen flow_from_dataframe. Fungsi itu tidak memiliki parameter tersebut, jadi argumen tambahan diabaikan tanpa peringatan. Perbaikannya memindahkan parameter ke konstruktor ImageDataGenerator atau memakai layer augmentasi di dalam model, lalu melatih ulang."

**5. "Kenapa folder valid tidak dipakai?"**

> "Notebook memakai validation split internal 10 persen dari folder train dengan seed nol, sehingga validasinya konsisten dengan data train. Folder valid bawaan hanya dimuat dan divisualisasikan. Konsekuensinya 6.300 gambar berlabel tidak terpakai. Untuk evaluasi yang lebih jujur, folder itu seharusnya dipakai sebagai uji eksternal."

**6. "Apakah model bisa dipakai untuk kebakaran di Kalimantan?"**

> "Belum bisa diklaim. Data latihnya citra satelit Kanada pada resolusi 350 kali 350, dan tidak ada contoh negatif dari lahan gambut, kabut asap, atau tutupan awan tropis. Model bisa dipakai sebagai demonstrasi metode, bukan alat operasional."

**7. "Apa bedanya CNN dengan titik panas FIRMS?"**

> "FIRMS mendeteksi anomali panas termal dari satelit dan menghasilkan koordinat. CNN kami hanya mengklasifikasikan pola RGB pada satu gambar yang diunggah. CNN tidak menghasilkan koordinat, luas, atau tingkat bahaya."

**8. "Kenapa confidence bisa tinggi padahal prediksinya salah?"**

> "Softmax belum dikalibrasi dan model bisa sangat yakin pada gambar di luar distribusi latihan. Karena itu kami menyebutnya skor kemiripan, bukan probabilitas kejadian kebakaran."

**9. "Kenapa pakai HDF5 dan bukan format Keras yang baru?"**

> "Karena kode penyimpanan memakai model.save() dengan ekstensi .h5, yang di Keras 3 masih jalan tetapi berstatus legacy dan memunculkan peringatan. Format yang disarankan sekarang .keras. Ini sudah kami catat sebagai pekerjaan rumah teknis."

**10. "Apa rencana perbaikan model?"**

> "Pertama, mencabut dan mengganti token API yang sempat tertulis di notebook, lalu memindahkannya ke Colab Secrets. Kedua, mengaktifkan augmentasi dengan benar. Ketiga, mengukur precision, recall, F1, dan confusion matrix dalam bentuk angka. Keempat, memakai folder valid sebagai uji independen. Kelima, menguji citra Kalimantan dan membandingkannya dengan baseline VIIRS."

---

## G. Kalimat yang sebaiknya dihindari

| Jangan bilang | Sebab | Ganti dengan |
|---|---|---|
| "Akurasi kami 97,86 persen" | Itu milik MobileNet V1 di notebook lain | "97,00 persen pada test set untuk MobileNetV2" |
| "Modelnya 97 persen yakin ada kebakaran" | Softmax belum dikalibrasi | "Skor kemiripan terhadap contoh area terbakar" |
| "Kami memakai 27 arsitektur" | Notebook artefak memakai 3 | "Kami membandingkan tiga arsitektur" |
| "Kami memakai augmentasi" | Augmentasi tidak pernah berjalan | "Augmentasi belum aktif, ini keterbatasan kami" |
| "Ini bisa mendeteksi kebakaran di Kalimantan" | Domain data Kanada | "Ini demonstrasi metode, bukan alat operasional" |
| "Titik panas berarti kebakaran" | FIRMS hanya anomali termal | "Observasi titik panas, bukan kebakaran terkonfirmasi" |

---

## H. Lembar fakta cepat

| Item | Nilai |
|---|---|
| Dataset | Kaggle `abdelghaniaaba/wildfire-prediction-dataset`, 1,45 GB, citra Kanada 350×350 |
| Total citra | 42.850 (22.710 wildfire, 20.140 nowildfire) |
| Split dipakai | 27.225 train (851 batch), 3.025 validation, 6.300 test |
| Tidak dipakai | 6.300 gambar folder `valid` |
| Input model | 224×224×3 RGB, `float32`, rentang [-1, 1] |
| Pra-pemrosesan | `mobilenet_v2.preprocess_input`, di luar model |
| Augmentasi | Tidak aktif |
| Kandidat | 3 arsitektur: MobileNetV2, DenseNet121, EfficientNetB0 (1 epoch) |
| Hasil seleksi | MobileNetV2 0,9557 · DenseNet121 0,9534 · EfficientNetB0 0,8555 |
| Waktu training | 115,66 s · 150,70 s · 125,07 s |
| Training final | Maks 5 epoch, berhenti di epoch 4, bobot dipulihkan ke epoch 3 |
| Riwayat val accuracy | 0,9540 → 0,9574 → 0,9593 → 0,9547 |
| Metrik test | **97,00%** (6.111 benar, 189 salah dari 6.300) |
| Metrik belum ada | Precision, recall, F1, ROC/AUC, kalibrasi |
| Model deployment | MobileNetV2, 158 layer, 2.438.722 parameter, 11,7 MB |
| Backbone | Frozen seluruhnya (2.257.984 parameter); hanya head 180.738 parameter yang dilatih |
| Langkah optimizer | `iteration = 3404` (851 × 4) |
| Label | 0 = `nowildfire`, 1 = `wildfire` |
| Latensi | 0,46-0,49 detik inferensi + ±0,6 detik muat model (total ±1,1 detik) |
| Konversi ONNX | Gagal (konflik versi Protobuf); tidak ada `.onnx` di repositori |
