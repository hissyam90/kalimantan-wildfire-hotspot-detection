# Frontend Pantau Karhutla Kalimantan

Frontend React/Vite ini menampilkan peta observasi NASA FIRMS, kondisi cuaca dan AQI WAQI untuk 17 kota, serta verifikasi citra dengan CNN RGB.

## Menjalankan

```powershell
npm install
npm run dev
```

Atur `VITE_API_URL` pada `.env` jika backend tidak berjalan di `http://localhost:5000`.

## Pemeriksaan

```powershell
npm run lint
npm run build
```

Hasil CNN adalah screening pola visual. Aplikasi tidak menggunakannya sebagai penentu koordinat, ukuran api, atau bukti tunggal kebakaran.
