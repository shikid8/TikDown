# 🎵 TikTok Downloader

Aplikasi web untuk mengunduh video TikTok dalam kualitas HD tanpa watermark. Dibangun dengan Next.js dan Puppeteer Stealth untuk melewati proteksi WAF TikTok.

🌍 **Live Demo:** [https://tikdown-j2y5.onrender.com/](https://tikdown-j2y5.onrender.com/)

## Fitur

- **Single Download** — Unduh satu video langsung dari URL
- **Batch Download** — Proses banyak URL sekaligus dengan progress real-time
- **Ekstraktor Koleksi** — Tempel satu link koleksi/playlist/profil, sistem otomatis mengambil semua URL videonya
- **Pilihan Kualitas** — 1080p tanpa watermark, 720p, atau Audio MP3
- **Drag & Drop** — Seret file `.txt` berisi daftar URL ke area input
- **Cookies Support** — Gunakan session cookies TikTok untuk akses konten privat

## Tech Stack

- [Next.js 16](https://nextjs.org/) — Framework React fullstack
- [Puppeteer](https://pptr.dev/) + [Stealth Plugin](https://github.com/berstend/puppeteer-extra) — Browser headless untuk bypass WAF
- [Tailwind CSS](https://tailwindcss.com/) — Styling dengan desain glassmorphism
- [Framer Motion](https://www.framer-motion.com/) — Animasi UI
- [fluent-ffmpeg](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg) — Ekstraksi audio MP3
- [Zustand](https://zustand-demo.pmnd.rs/) — State management

## Penggunaan Lokal

```bash
# Install dependensi
npm install --legacy-peer-deps

# Salin template environment
copy .env.example .env.local

# Jalankan server development
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000).

> **Catatan:** Letakkan file `cookies.json` (cookies TikTok Anda) di folder root proyek untuk mengakses video tanpa watermark dan konten privat.

---

> Gunakan hanya untuk keperluan pribadi. Hormati hak cipta kreator konten.
