# VIIRS swath pilot — 18 Oktober 2026

Penelitian: **“Deteksi Dini Titik Panas (Hotspot) Potensi Karhutla di Kalimantan Timur Berbasis Citra Satelit Menggunakan Convolutional Neural Network (CNN)”**.

## Profil produk

| Platform | L1B + geolokasi | Collection reader / archive | Referensi api |
|---|---|---|---|
| SNPP | VNP02IMG + VNP03IMG | 020 / 5200 | VNP14IMG |
| NOAA-20 | VJ102IMG + VJ103IMG | 021 / 5201 | VJ114IMG |
| NOAA-21 | VJ202IMG + VJ203IMG | 021 / 5201 | VJ214IMG |

Landing page resmi kesembilan produk diperiksa:
`https://ladsweb.modaps.eosdis.nasa.gov/missions-and-measurements/products/<SHORTNAME>/`.
L1B menggunakan netCDF4/HDF5 dan geolokasi .nc. Landing page active-fire
menampilkan archive 5200 tetapi tidak mendokumentasikan struktur secara cukup
(VJ214IMG: "No description available"). **Reader L2 belum diimplementasikan**;
referensi label menggunakan CSV FIRMS. Jangan menyamakan collection L2 dan L1B.

Spesifikasi struktur yang digunakan:
- https://ladsweb.modaps.eosdis.nasa.gov/filespec/VIIRS/1/VNP02IMG
  versi dokumen 3.0.0 (2019-01-22), eksplisit SNPP/JPSS1, perluasan JPSS berikutnya.
- https://ladsweb.modaps.eosdis.nasa.gov/filespec/VIIRS/1/VNP03IMG
- https://ladsweb.modaps.eosdis.nasa.gov/missions-and-measurements/products/VJ202IMG/
  collection 2.1 sejak 10 Februari 2023; nominal 6464 × 6400 piksel.
- https://ladsweb.modaps.eosdis.nasa.gov/alerts-and-issues/199516
  delivery baru SNPP direncanakan berhenti 2 November 2026 13:00 UTC (dapat berubah),
  arsip historis tetap tersedia.

NOAA-21 merupakan adapter dengan pemeriksaan struktur ketat, **bukan bukti
kesetaraan penuh atau keberhasilan membaca granule asli**. Ketiga platform diuji
dengan fixture HDF5 kecil, bukan file netCDF lengkap dengan dimension scales.

## Transformasi dan kontrak

`observation_data/I04` dan `I05` dibaca sebagai unsigned scaled integer (SI).
BT = `observation_data/<band>_brightness_temperature_lut[SI]`, LUT 65536 elemen,
unit Kelvin. Tidak mengubah indeks dengan scale/offset radiance, tidak menggunakan
Planck/rentang tebakan. Metadata kalibrasi disimpan. Mode radiance belum tersedia.
Fill, valid_min/max, flag_values, LUT invalid dan pixel quality flags nonzero
ditolak. Koordinat `geolocation_data/latitude`, `longitude` memakai scale/offset
metadata jika ada; `quality_flag` geolokasi harus nol.

QA konservatif dapat membuang hotspot tersaturasi dan membiasakan dataset;
**bukan cloud mask**. Waktu memakai interval UTC dan midpoint granule, bukan
waktu scan per piksel (ketidakpastian nominal ±3 menit). Pasangan harus cocok
platform, identitas acquisition, collection, waktu metadata dan ukuran raster.

Patch harus sepenuhnya valid dan berada di bbox, stride = ukuran patch,
tanpa padding/imputasi. Duplikat tensor identik dibuang dalam satu ekstraksi.
Group = tanggal UTC lintas platform (minimal tiga tanggal untuk split).
Overlap antar-granule, near-duplicate dan holdout spasial belum diimplementasikan.
Reader memuat raster ke RAM; file asli dapat membutuhkan RAM beberapa GB.

NPZ berbentuk `[N,H,W,2]`. JSON sidecar menyimpan checksum sumber/bundle/patch,
produk, kanal, transformasi, waktu, bbox dan posisi pixel. Preprocessing memeriksa
checksum sidecar jika ada dan meneruskan provenance. BT belum dinormalisasi;
normalisasi ilmiah harus ditetapkan tanpa fit menggunakan validation/test.

Algoritme NASA active-fire memakai kombinasi I1–I5 dan M13. CNN I4/I5 adalah
pendekatan penelitian tersendiri, bukan implementasi algoritme NASA.
Matching FIRMS terhadap pusat patch memakai default 1,5 km / 3 jam (eksplorasi,
belum dikalibrasi). Match positif, non-match uncertain -1. CSV kosong ditolak.
Belum ada negatif terkonfirmasi: jangan mengaktifkan weak-negative untuk memaksa
training. Label NASA terkait instrumen input berisiko mengajarkan ulang detektor,
bukan membuktikan deteksi kebakaran lapangan tanpa validasi independen.

## Akuisisi dan perintah

Dari `E:\Coding\wildfire-app`:

```powershell
python -m training.acquire_viirs --platform VJ2 --start 2026-10-17T00:00:00Z --end 2026-10-18T00:00:00Z
python -m training.viirs --help
python -m training.prepare_dataset --help
python -m unittest discover -s training/tests -v
```

Discovery CMR memakai versi katalog `2` (SNPP) atau `2.1` (NOAA-20/21),
**bukan** kode nama file `020`/`021` atau archive set `5200`/`5201`.
Default dry-run; pagination 100 hasil/halaman, maksimal 10 halaman/produk;
jika batas tercapai pencarian ditolak, bukan dipotong diam-diam.
Filter provider LAADS, waktu dan bbox diteruskan ke CMR. Link data granule
LAADS Earthdata Cloud dikenali, tetapi token/download tetap hanya ke host LAADS
klasik. URL arsip dibentuk dari identitas lalu **harus ditemukan sebagai tautan
persis dalam listing direktori resmi**. Bukan asumsi bahwa URL bentukan tersedia.
Pairing memakai platform, acquisition day/minute, collection serta interval
metadata CMR yang sama; timestamp produksi kedua file tidak harus sama.
Revisi duplikat dipilih deterministik berdasarkan timestamp produksi terbaru.
Output JSON menyertakan query, hits, kandidat, penolakan, link diabaikan,
jumlah pasangan sebelum batas dan jumlah terpilih. Interval diperlakukan
half-open; granule harus beririsan dengan interval yang diminta.

Tambahkan `--download` hanya setelah hasil discovery sesuai. Autentikasi melalui
`EARTHDATA_TOKEN` environment lokal, tidak source/chat. Token belum tersedia saat
pengujian. Default 1 pasangan/512 MiB; batas 2 pasangan/1024 MiB, <=24 jam, Borneo.
Raw tersimpan di `E:\Coding\wildfire-app\data\raw` (Git ignored).
Sebelum body unduhan apa pun, GET metadata API v2 direktori `content/details`
untuk **semua** file terpilih harus sukses, JSON valid, identitas/revisi dan link
download persis cocok, status Online, ukuran positif dan total di bawah budget.
HEAD tidak digunakan: tidak ada jaminan dukungan HEAD dalam dokumentasi yang diperiksa.
GET file memakai `content/archives`, Bearer dan `X-Requested-With: XMLHttpRequest`.
Content-Length boleh tidak ada; bila ada harus sama dengan metadata. Jumlah byte
aktual wajib sama dengan metadata, dan pembacaan dibatasi ukuran + satu byte deteksi overflow.
Metadata publik **bukan bukti autentikasi data**. Gunakan `--preflight-only` untuk
metadata tanpa payload, `--debug` untuk nomor baris tanpa source/locals/traceback mentah,
dan dua `--expect-name` untuk mengunci tepat revisi pasangan.
Pemeriksaan: metadata size, jumlah byte, HDF5 signature/open, metadata, SHA256
lokal. **Belum pembandingan checksum provider**. Redirect ditolak untuk melindungi
token. File gagal `.partial` dibiarkan untuk pemeriksaan manual, tidak menimpa raw.
Lisensi/ketentuan redistribusi produk belum diverifikasi penuh; jangan menyertakan
raw granule di repository/publikasi sebelum verifikasi.

Sesudah file asli tersedia, jalankan `python -m training.viirs` dengan opsi
`--radiance` dan `--geolocation` berisi path absolut pasangan hasil discovery,
`--bbox 116 -2 118 1 --size 32 --out E:\Coding\wildfire-app\data\prepared\pilot.npz`.
Preprocessing menggunakan `python -m training.prepare_dataset --patches
E:\Coding\wildfire-app\data\prepared\pilot.npz --firms` diikuti path absolut CSV
nonempty dan `--out E:\Coding\wildfire-app\data\prepared\pilot-labeled`.
Satu granule/hari tidak memenuhi syarat split atau training; jangan melewati guard.

## Status validasi

26 unit test lulus: 10 pipeline + 7 reader/matching/security fixture + 9 discovery/preflight.
Mencakup tiga prefix, LUT, fill/QA, unit salah, struktur hilang, file rusak,
pasangan berbeda, ekstraksi, NPZ, batas discovery, URL nonresmi, positif/uncertain,
split dan duplikasi. Unduhan autentikasi dan ingestion NASA asli belum diuji.
Tidak ada dataset/training/evaluasi ilmiah baru. Model produksi tidak diubah;
endpoint CNN satelit tetap non-ready. Frontend/backend tidak diubah oleh pekerjaan ini.

### Validasi katalog live — 18 Oktober 2026 (bukan ingestion granule)

Tanggal tetap `2026-10-17T00:00:00Z` sampai `2026-10-18T00:00:00Z`,
bbox tetap `116,-2,118,1`. Query lama `version=021` mengembalikan CMR-Hits 0
untuk keempat produk. Endpoint collections resmi mengonfirmasi versi `2.1`:
VJ102IMG `C2105083900-LAADS`, VJ103IMG `C2105086226-LAADS`,
VJ202IMG `C3478413786-LAADS`, VJ203IMG `C3478476050-LAADS`.
Query versi benar menunjukkan link data langsung di host
`data.laadsdaac.earthdatacloud.nasa.gov`, yang juga ditolak filter lama.

| Platform | Kandidat 02 / 03 | Pasangan sebelum batas | Terpilih | Waktu acquisition UTC |
|---|---:|---:|---:|---|
| NOAA-20 | 2 / 2 | 2 | 1 | 05:18, 18:00 |
| NOAA-21 | 3 / 3 | 3 | 1 | 06:00, 06:06, 17:06 |

Semua kandidat lolos identitas, interval metadata dan listing arsip;
tidak ada penolakan kandidat/pairing. Link inherited/non-data diabaikan:
20 per produk NOAA-20, 27 per produk NOAA-21. CMR spatial intersection
belum menjamin ada patch sepenuhnya valid di bbox (perlu raster asli).

Pasangan NOAA-20 yang disiapkan (satu saja, acquisition paling awal):
- `VJ102IMG.A2026290.0518.021.2026290112831.nc`, `G4372853380-LAADS`,
  CMR granule_size 242.330147743225 MB (sekitar 242.33 MiB pada konvensi katalog).
- `VJ103IMG.A2026290.0518.021.2026290103852.nc`, `G4372835250-LAADS`,
  CMR granule_size 147.121405601501 MB (sekitar 147.12 MiB).
- Kedua interval metadata: 05:18–05:24 UTC. Estimasi total sekitar 389.45 MiB;
  **bukan hasil Content-Length terautentikasi**.
- Listing sumber:
  https://ladsweb.modaps.eosdis.nasa.gov/archive/allData/5201/VJ102IMG/2026/290/
  https://ladsweb.modaps.eosdis.nasa.gov/archive/allData/5201/VJ103IMG/2026/290/

Pasangan pertama NOAA-21: `VJ202IMG.A2026290.0600.021.2026290123101.nc`
dan `VJ203IMG.A2026290.0600.021.2026290121729.nc`, 06:00–06:06 UTC;
CMR ukuran masing-masing 235.349282264709 dan 137.698321342468 MB.
Keduanya juga diverifikasi di listing arsip 5201/produk/2026/290.

Ulangi dry-run NOAA-20:
```powershell
python -m training.acquire_viirs --platform VJ1 --start 2026-10-17T00:00:00Z --end 2026-10-18T00:00:00Z --bbox 116 -2 118 1 --max-pairs 1 --max-mib 512
```
Hanya setelah token tersedia secara lokal, tambahkan `--download` pada perintah
NOAA-20 ini, bukan menjalankan download kedua platform sekaligus.
Tidak ada payload NASA diunduh, pembacaan raster nyata, ekstraksi patch nyata,
atau matching FIRMS nyata pada validasi katalog ini. Tes baru memock respons
CMR, listing dan HEAD; tidak dianggap sebagai keberhasilan autentikasi live.

### Perbaikan akuisisi — 18 Oktober 2026

Dokumentasi resmi diperiksa ulang:
- https://ladsweb.modaps.eosdis.nasa.gov/tools-and-services/api-v2/quick-start-guide/
- https://ladsweb.modaps.eosdis.nasa.gov/tools-and-services/data-download-scripts/
- https://ladsweb.modaps.eosdis.nasa.gov/learn/download-files-using-edl-tokens/
- https://ladsweb.modaps.eosdis.nasa.gov/tools-and-services/

LWS Classic ditandai retired, tetapi halaman HTTP Interface dan contoh EDL masih
mendokumentasikan `/archive/allData/...`; pensiun Classic tidak membuktikan URL
arsip langsung mati. API v2 direkomendasikan untuk program dan kini digunakan
untuk metadata preflight serta download; discovery mempertahankan verifikasi listing.
Detail file tanpa token mengarah ke login, sedangkan detail direktori mengembalikan
JSON `content` dengan name/resourceType/size/status/downloadsLink. Preflight memilih
tepat nama file dari listing tersebut, bukan mengasumsikan respons detail file.

EDL mendokumentasikan `curl -L -b session -H 'Authorization: Bearer ...'`: redirect
dan cookie sesi diperlukan. Implementasi Python kini memakai `CookieJar` in-memory,
membatasi hop hanya pada LAADS dan `urs.earthdata.nasa.gov`, serta menolak host lain;
Bearer tetap dibatasi pada LAADS dan tidak pernah dikirim ke EDL atau host lain; respons HTML/login
atau HTTP error tetap ditolak oleh authorization gate.
Pada validasi live terakhir, metadata API v2 lulus untuk pasangan (254101577 +
154267975 = 408369552 byte), tetapi gate data berakhir HTTP 401 dari alur EDL.
Belum ada payload yang disimpan dan belum boleh memulai training.

Penyebab pesan lama tidak informatif terbukti: blok exception hanya mencetak nama
tipe, sehingga pesan/lokasi ValueError hilang. Penyebab ValueError percobaan lama
sendiri belum diketahui tanpa reproduksi; tidak diasumsikan sebagai penolakan token.
Error terkontrol kini menyebut tahap/pesan aman/HTTP bila tersedia/partial bila relevan.
Pesan jaringan dan traceback mentah tidak dicetak. Token invalid untuk header ditolak
sebelum request; tidak diperbaiki atau dicetak secara otomatis.

Validasi lokal terbaru: 37 tes offline lulus (termasuk kegagalan transfer dan partial,
HTML, missing size, missing Content-Length, budget, token, redirect, dan HDF5 sukses).
Mock bukan bukti autentikasi NASA. Dry-run live 05:18–05:24 menemukan tepat satu
pasangan NOAA-20 di atas. Token tidak tersedia pada proses agent; preflight token,
download granule, pembacaan raster/patch nyata belum dilakukan. Tidak ditemukan
partial dalam direktori data, dan `firms_sample.csv` tidak diubah.

Jalankan dari PowerShell yang benar-benar mewarisi token (jangan cetak nilainya):
```powershell
Set-Location E:\Coding\wildfire-app
if (-not $env:EARTHDATA_TOKEN) { throw 'EARTHDATA_TOKEN tidak tersedia dalam terminal ini' }
$viirsArgs = @('--platform','VJ1','--start','2026-10-17T05:18:00Z','--end','2026-10-17T05:24:00Z',
  '--bbox','116','-2','118','1','--max-pairs','1','--max-mib','512',
  '--expect-name','VJ102IMG.A2026290.0518.021.2026290112831.nc',
  '--expect-name','VJ103IMG.A2026290.0518.021.2026290103852.nc')
python -m training.acquire_viirs @viirsArgs --preflight-only --debug
```
Hanya sesudah kedua metadata valid, jalankan dengan `--download --debug` sebagai
pengganti `--preflight-only --debug`; download mengulangi gate kedua file.
Jika redirect muncul, berhenti: metadata sukses belum berarti akses data sukses.
Tidak ada training ilmiah sebelum reader asli dan ekstraksi patch valid berhasil.