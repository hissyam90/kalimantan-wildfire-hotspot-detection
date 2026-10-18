# Keputusan data dan hambatan terverifikasi

Dokumentasi resmi diperiksa 2026-10-18:

| Peran | Produk / sumber | Karakteristik |
|---|---|---|
| Input CNN yang direncanakan | [VNP02IMG](https://ladsweb.modaps.eosdis.nasa.gov/missions-and-measurements/products/VNP02IMG) | VIIRS SNPP L1B calibrated radiances; I1-I5, tiga reflective dan dua thermal emissive (I4/I5). 375 m di nadir, granule nominal 6 menit, 6464 x 6400 piksel. Ukuran granule bukan interval revisit. |
| Geolokasi | [VNP03IMG](https://ladsweb.modaps.eosdis.nasa.gov/missions-and-measurements/products/VNP03IMG) | Terrain-corrected latitude/longitude per piksel, sudut sensor/matahari, land/water dan quality flags; harus dipasangkan platform/waktu/granule/collection dengan L1B. |
| Referensi algoritme | [VIIRS Fire ESDR](https://viirsland.gsfc.nasa.gov/Products/NASA/FireESDR.html) | VNP14 750 m dan VNP14IMG 375 m L2 swath 6 menit, VNP14A1 L3 harian. Halaman menyebut HDF-EOS5, cakupan mulai 19 Januari 2012, observasi sekitar 01:30/13:30 lokal. Ini produk turunan, bukan radiansi input CNN. |
| Referensi titik | [FIRMS API](https://firms.modaps.eosdis.nasa.gov/api/) | CSV area/date/sensor; MAP_KEY diperlukan, terpisah dari Earthdata/LAADS. NRT tidak sama dengan pengamatan kontinu. |

I4/I5 termal merupakan kandidat awal yang relevan; kanal I1-I3 memerlukan perlakuan day/night dan reflektansi. NASA algoritme 375 m memakai I1-I5 ditambah M13; M13 memiliki grid berbeda, jangan langsung stack tanpa collocation/resampling yang diuji. Pemilihan dua kanal bukan klaim setara algoritme NASA.

## Akses sah dan cakupan pilot

Pilot yang direncanakan: bbox 116,-2,118,1 (sebagian Kalimantan Timur), satu pasangan granule L1B/geolokasi pada 2026-10-17 UTC, **tanggal/cakupan ketersediaan granule belum dikonfirmasi**. Gunakan Earthdata Search atau LAADS Find Data untuk memastikan footprint dan waktu; jangan mengunduh seluruh arsip.

1. Login lewat [Earthdata Search](https://search.earthdata.nasa.gov/) atau [LAADS](https://ladsweb.modaps.eosdis.nasa.gov/).
2. Cari pasangan VNP02IMG/VNP03IMG collection yang sama; periksa ukuran total sebelum mengunduh. Ambil satu granule masing-masing hanya setelah ukuran diterima pengguna. Catat URL, DOI, collection, nama file, waktu UTC, checksum, QA, fill, scale/offset/LUT dan unit.
3. LAADS menjelaskan token LAADS hanya berlaku di LAADS; EDL token dapat dipakai pada situs Earthdata. FIRMS_KEY bukan penggantinya. Simpan token lokal sesuai dokumentasi layanan, jangan kirim lewat chat/Git.
4. Tempatkan berkas di `E:\Coding\wildfire-app\data\raw`. Pembaca format asli, kalibrasi termal/LUT, QA dan ekstraksi patch masih belum diimplementasikan/diuji. Format L1B tidak boleh disimpulkan HDF-EOS5 hanya karena produk L2 memakai format tersebut; verifikasi file dan panduan L1B sebelum implementasi.
5. Gunakan referensi FIRMS platform/waktu cocok; tanpa observasi/QA memadai, sampel tidak cocok tetap uncertain. Label instrumen yang sama mengukur peniruan referensi NASA, bukan validasi kebakaran independen.

Dokumentasi LAADS saat diperiksa mengumumkan penghentian delivery SNPP pada 2 November 2026 dan menyarankan transisi NOAA-20/21; jangan menganggap feed SNPP tersedia tanpa batas. Dashboard belum dialihkan otomatis.

## Lisensi, batasan dan status

Gunakan sitasi/DOI dan ketentuan produk yang ditampilkan penyedia saat unduh. Halaman produk yang diperiksa tidak menetapkan lisensi spesifik untuk redistribusi bundle penelitian; tautan policy yang dicoba `https://www.earthdata.nasa.gov/data/use-policy` mengembalikan 404. Karena itu jangan mengarang lisensi atau mengunggah data ke Git sebelum memverifikasi ketentuan yang berlaku. GEE memerlukan akun/proyek/otorisasi; tidak digunakan pada implementasi ini.

Tidak ada citra asli diperoleh; token EARTHDATA_TOKEN/LAADS_TOKEN/NASA_TOKEN tidak ditemukan pada environment/config backend yang diperiksa. FIRMS_KEY lokal tersedia dan satu request kecil sah berhasil, tetapi tidak berisi deteksi. Tidak ada training ilmiah, metrik ilmiah, maupun klaim generalisasi. Cloud, saturasi, scan edge, waktu scan, revisi produk dan ketidakpastian posisi masih harus ditangani sebelum dataset dapat dianggap layak.