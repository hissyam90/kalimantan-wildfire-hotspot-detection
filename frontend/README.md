# Frontend Pantau Karhutla Kalimantan

Frontend React/Vite ini menampilkan peta observasi NASA FIRMS, kondisi cuaca dan AQI WAQI untuk 23 kota, serta verifikasi citra dengan CNN RGB.

## Menjalankan

```powershell
npm install
npm run dev
```

Mode dev memanggil backend Flask di `http://127.0.0.1:7860`. Isi `VITE_API_URL` pada `.env` hanya bila backend berada di alamat lain. Untuk demo normal, jalankan `npm run build` lalu buka aplikasi dari Flask di `http://127.0.0.1:7860`, sehingga frontend dan API berada pada satu origin.

Nilai `VITE_API_URL` harus berupa URL biasa tanpa tanda kurung atau teks tambahan, misalnya `VITE_API_URL=http://127.0.0.1:7860`, lalu jalankan `npm run build` lagi. Nilai yang tidak valid diabaikan dan frontend memakai alamat halaman itu sendiri.

Bila `VITE_API_URL` menunjuk alamat ngrok, frontend otomatis mengirim header `ngrok-skip-browser-warning`.

## Pemeriksaan

```powershell
npm run lint
npm run build
```

Hasil CNN adalah screening pola visual. Aplikasi tidak menggunakannya sebagai penentu koordinat, ukuran api, atau bukti tunggal kebakaran.

