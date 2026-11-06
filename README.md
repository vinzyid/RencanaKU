# RencanaKU

**Platform Prompt-to-PRD Generator dengan Deteksi Ambiguitas & Kontradiksi.**

RencanaKU mengubah ide/prompt kasar menjadi **PRD (Product Requirement Document)** yang terstruktur, jelas, dan bebas kontradiksi — sebelum requirement itu dipakai sebagai instruksi ke AI coding agent (Claude Code, Cursor, dsb).

Berbeda dari platform "prompt-to-code" yang langsung generate kode dari satu prompt, RencanaKU menyisipkan tahap **spec-first**: requirement dimatangkan dulu lewat proses klarifikasi dan validasi otomatis, baru dianggap "siap dieksekusi".

---

## Fitur Utama

- **Prompt-to-PRD Generator** — ide bebas → draft PRD terstruktur (latar belakang, tujuan, target user, requirement fungsional & non-fungsional, batasan).
- **Ambiguity Detector** — mendeteksi requirement yang masih ambigu dan meminta klarifikasi satu per satu (dengan dedup, sehingga pertanyaan yang sudah dijawab tidak muncul lagi).
- **Contradiction Checker** — mendeteksi requirement yang saling bertentangan (A vs B) dan meminta user memilih atau merevisi.
- **Versioning & Diff** — setiap perubahan membuat versi PRD baru; frontend menampilkan diff visual (hijau = ditambah, merah = dihapus, kuning = diubah).
- **AI Provider Fallback** — chain berlapis: **OpenRouter → Gemini → generator lokal deterministik**. Kolom `ai_provider` mencatat provider yang berhasil.
- **Finalisasi & Export** — export PRD final ke **Markdown**, **JSON**, dan **PDF**.
- **Model Hybrid Stepper + Chat** — stepper 5 tahap permanen di atas layar, sementara interaksi di dalamnya berupa chat thread berkelanjutan yang tidak reset antar tahap.
- **Lupa & Setel Kata Sandi** — reset kata sandi lewat tautan email (Gmail SMTP), plus setel kata sandi untuk akun OAuth Google/GitHub dari halaman Pengaturan.

---

## Alur Sistem

Stepper selalu terlihat di atas layar dan bergerak otomatis mengikuti progres percakapan:

```text
[1. Input Ide] -> [2. Klarifikasi] -> [3. Validasi] -> [4. Dokumentasi] -> [5. Export]
```

1. **Input Ide** — user menulis ide bebas → AI membuat draft PRD v1.
2. **Klarifikasi** — sistem menjalankan *ambiguity check*; AI mengajukan pertanyaan klarifikasi (dengan quick-reply chip).
3. **Validasi** — sistem menjalankan *contradiction check*; AI menjelaskan requirement yang bentrok.
4. **Dokumentasi** — PRD lengkap & konsisten ditampilkan; user masih bisa mengetik revisi bebas.
5. **Export** — user finalisasi, lalu mengekspor PRD ke Markdown / JSON / PDF.

State machine status PRD: `draft` → (ambiguitas/kontradiksi baru dari edit → kembali ke tahap terkait) → `finalized`.

---

## Tech Stack

| Bagian | Teknologi |
|--------|-----------|
| Backend | Laravel 12 (API-only) |
| Auth | Laravel Sanctum (token-based, stateless) |
| Frontend | React 19 + Vite (SPA) |
| Styling | Tailwind CSS v4 + custom CSS |
| Database | MySQL (produksi) / SQLite (development) |
| AI Gateway | OpenRouter (primary) → Gemini (fallback) → local deterministik |
| HTTP Client | Laravel HTTP Client (AI), native `fetch` (frontend) |
| Export PDF | Blade view siap-cetak (DomPDF opsional) |

> Frontend & backend terpisah penuh: SPA React (Vite) berkomunikasi ke backend Laravel murni lewat REST API (`/api/*`).

---

## Skema Database

- `users` — data pengguna.
- `projects` — proyek PRD (1 proyek = 1 thread chat).
- `messages` — histori chat thread (`sender`: `user`/`ai`, `content`, `quick_replies` JSON, `related_prd_version_id`).
- `prd_versions` — riwayat versi PRD (`version_number`, `content` JSON, `status` draft/finalized, `ai_provider`).
- `ambiguity_flags` — ambiguitas per versi (`code`, `question`, `is_resolved`, `resolution_answer`).
- `contradiction_flags` — kontradiksi per versi (`requirement_a`, `requirement_b`, `explanation`, `resolution`).
- `personal_access_tokens` — token Sanctum.
- `password_reset_tokens` — token sekali-pakai untuk reset kata sandi (berlaku 60 menit).
- Kolom `users.password_set_at` — menandai akun yang sudah punya kata sandi terpakai (akun OAuth bernilai `NULL` sampai user mengeset kata sandinya).

Relasi: `User` hasMany `Project` → hasMany `Message`, `PrdVersion` → hasMany `AmbiguityFlag`, `ContradictionFlag`.

---

## Endpoint API

Base URL: `/api`. Semua endpoint selain `register`, `login`, `forgot-password`, dan `reset-password` dilindungi `auth:sanctum` (Bearer token).

| Method | Endpoint | Fungsi |
|--------|----------|--------|
| POST | `/register` | Registrasi user |
| POST | `/login` | Login, dapat token Sanctum |
| POST | `/forgot-password` | Kirim tautan atur ulang kata sandi ke email (publik) |
| POST | `/reset-password` | Setel ulang kata sandi memakai token dari email (publik) |
| POST | `/logout` | Logout (hapus token aktif) |
| GET | `/me` | Data user yang sedang login |
| POST | `/password` | Ganti / setel kata sandi user yang sedang login |
| GET | `/projects` | List proyek milik user |
| POST | `/projects` | Buat proyek baru (prompt awal opsional) |
| GET | `/projects/{id}` | Detail proyek + thread chat + PRD terbaru + diff + stage |
| PATCH | `/projects/{id}` | Rename proyek |
| DELETE | `/projects/{id}` | Hapus proyek |
| GET | `/projects/{id}/messages` | Ambil histori chat lengkap |
| POST | `/projects/{id}/messages` | Kirim pesan chat (ide awal, jawaban klarifikasi, resolusi kontradiksi, atau revisi bebas — backend menentukan konteks via state machine) |
| GET | `/projects/{id}/versions` | List semua versi PRD + diff antar versi |
| POST | `/projects/{id}/finalize` | Finalisasi PRD |
| GET | `/projects/{id}/export/{format}` | Export PRD (`md` / `json` / `pdf`) |

Karena UI berbasis chat, satu endpoint `/messages` menangani semua jenis input user — bukan endpoint terpisah per aksi seperti model wizard.

---

## Setup & Menjalankan

### Prasyarat
- PHP 8.2+
- Composer
- Node.js & npm

### Langkah

```bash
# 1. Install dependency backend
cd backend
composer install

# 2. Siapkan environment
cp .env.example .env          # Windows: copy .env.example .env
php artisan key:generate

# 3. Konfigurasi database
#    - Untuk MySQL (sesuai PRD): isi DB_CONNECTION=mysql, DB_* di .env, lalu:
php artisan migrate --seed
#    - Untuk SQLite (cepat untuk development): set DB_CONNECTION=sqlite,
#      buat file database/database.sqlite, lalu:
# php artisan migrate --seed

# 4. (Opsional) Isi API key AI di .env agar memakai LLM sungguhan
#    OPENROUTER_API_KEY=...  (primary)
#    GEMINI_API_KEY=...      (fallback)
#    AI_MAX_TOKENS=4096      (batas keluaran token AI, naikkan bila PRD panjang terpotong)
#    Tanpa key, sistem otomatis memakai generator lokal deterministik.

# 5. Build frontend React (dari folder frontend)
cd ../frontend
npm install
npm run build
# Output build ditulis ke frontend/dist, dilayani server statis terpisah

# 6. Jalankan server API (dari folder backend)
cd ../backend
php artisan serve
```

- Backend API: `http://localhost:8000`
- Frontend (dev): `http://localhost:5173`
- Frontend (produksi): layani `frontend/dist` lewat web server statis (Nginx, `vite preview`, dll.)

> Frontend & backend terpisah. Saat dev, Vite mem-proxy `/api` & `/oauth` ke backend (`VITE_BACKEND_URL`, default `http://localhost:8000`). Di produksi, set `VITE_API_URL` di frontend dan `APP_FRONTEND_URL` + `CORS_ALLOWED_ORIGINS` di backend.

### Akun Demo

Setelah `migrate --seed`:

| Email | Password |
|-------|----------|
| `admin@rencanaku.test` | `admin12345` |

### Development (hot reload)

```bash
# Terminal 1 (dari folder backend) — server web
php artisan serve

# Terminal 2 (dari folder backend) — worker queue (WAJIB untuk menyusun PRD)
php artisan queue:work

# Terminal 3 (dari folder frontend) — Vite hot reload
npm run dev
```

> Pemrosesan PRD (panggilan AI) berjalan di background queue. **Tanpa worker
> `php artisan queue:work` yang hidup, draft PRD tidak akan pernah selesai
> disusun.** Request HTTP hanya menyimpan pesan lalu kembali cepat; UI
> memantau progres lewat status proyek.

> Jika baru mengubah config atau `.env`, jalankan `php artisan config:clear` lalu hard-refresh browser (`Ctrl + Shift + R`).

---

## Konfigurasi Email (Fitur Lupa Kata Sandi)

Fitur **Lupa Kata Sandi** mengirim tautan atur ulang ke email user. Pengiriman
memakai konfigurasi `MAIL_*` pada `backend/.env`.

### Gmail SMTP (untuk alamat `@gmail.com`)

1. Aktifkan **Verifikasi 2 Langkah** di akun Google Anda.
2. Buat **App Password** (16 karakter) di <https://myaccount.google.com/apppasswords>.
3. Isi `backend/.env`:

```env
MAIL_MAILER=failover
MAIL_SCHEME=null
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=alamat-anda@gmail.com
MAIL_PASSWORD=app-password-16-karakter
MAIL_FROM_ADDRESS="alamat-anda@gmail.com"
MAIL_FROM_NAME="${APP_NAME}"
```

> `MAIL_MAILER=failover` mencoba **SMTP Gmail** lebih dulu; bila kredensial belum
> diisi atau gagal, tautan reset otomatis ditulis ke
> `backend/storage/logs/laravel.log` sehingga alur tetap bisa diuji. Untuk
> produksi murni Gmail, set `MAIL_MAILER=smtp`.
>
> Setelah mengubah `.env`, jalankan `php artisan config:clear`.

### Alur Reset Kata Sandi

1. User klik **"Lupa password?"** di halaman masuk → halaman `/forgot-password`.
2. Backend membuat token di tabel `password_reset_tokens` lalu mengirim email
   berisi tautan `{APP_FRONTEND_URL}/reset-password?token=...&email=...`.
   Untuk alamat Gmail, email masuk ke inbox Gmail (cek juga folder Spam/Promotions).
3. User membuka tautan → halaman `/reset-password` → mengisi kata sandi baru.
4. Backend memvalidasi token, menyimpan kata sandi baru (`users.password_set_at`
   diisi), lalu **mencabut semua sesi/token lama**. User diarahkan masuk kembali.

Tautan berlaku **60 menit** dan hanya dapat dipakai **sekali**.

> Akun yang mendaftar lewat **Google/GitHub OAuth** tidak punya kata sandi
> terpakai. Mereka bisa memakai alur di atas untuk **membuat** kata sandi
> pertama, atau menyetelnya dari **Pengaturan → Keamanan & Sandi**.

---

## Konfigurasi AI Provider

Chain provider diatur di `config/rencanaku.php`:

1. **OpenRouter** (`OPENROUTER_API_KEY`, `OPENROUTER_MODEL`) — provider utama.
2. **Gemini** (`GEMINI_API_KEY`, `GEMINI_MODEL`) — fallback bila OpenRouter gagal.
3. **Local** — generator deterministik, dipakai bila seluruh provider LLM gagal atau key kosong.

Setiap kali membuat versi PRD baru, kolom `ai_provider` mencatat provider yang berhasil, untuk transparansi ke user.

---

## Struktur Singkat

Aplikasi dipisah penuh: **frontend React (Vite)** dan **backend Laravel (headless API)**. Backend tidak merender view apa pun kecuali template PDF export; komunikasi lewat REST `/api` + CORS.

```
backend/                                   # Aplikasi Laravel (headless REST API)
  app/
    Http/Controllers/ApiController.php     # Auth, proyek, chat, versi, finalize, export
    Http/Controllers/Controller/Auth/
      SocialAuthController.php             # OAuth Google/GitHub -> redirect balik ke frontend
    Models/                                # User, Project, Message, PrdVersion, ...
    Services/
      ProjectFlow.php                      # State machine & derivasi tahap (stepper)
      Ai/                                  # AiGateway, PrdGenerator, LocalPrdEngine, PrdDiff
  resources/views/exports/prd-pdf.blade.php# Template export PDF (dompdf)
  routes/api.php                           # Seluruh endpoint REST
  routes/web.php                           # Hanya route OAuth (redirect)
  public/                                  # Document root API + gambar

frontend/                                  # Aplikasi React (Vite + Tailwind), berdiri sendiri
  index.html                               # Shell HTML SPA
  src/
    main.jsx                               # Entry React
    app.css                                # Tailwind + tema
    react/
      app/                                 # App (routes) + AppProviders
      context/                             # Auth, Theme, Toast, Shell, Project
      utils/                               # api (fetch), format, icons
      components/landing|auth|workspace|modals
  public/images/                           # Asset gambar (hero, banner)
  dist/                                    # Hasil build (dilayani server statis)
  package.json
  vite.config.js                           # Build ke frontend/dist, proxy /api & /oauth ke backend
```

---

## Batasan (Constraints)

- Tidak mencakup eksekusi/generate kode sungguhan — scope berhenti di PRD final.
- Kualitas deteksi ambiguitas/kontradiksi bergantung pada LLM yang dipanggil (bukan validasi logis formal); tanpa API key, deteksi memakai heuristik lokal.
- Tidak ada kolaborasi real-time multi-user (satu proyek dimiliki satu akun).

---

## Anggota Kelompok

Praktik Aplikasi Web — Kelompok 5 orang:

| Nama | Peran |
|------|-------|
| Abyan Bergas Irmawan | Frontend |
| Maulana Yudo Yudistira | Frontend |
| Rafi Pandya Prabowo | Backend |
| Fahryan Amadis | Frontend |
| Agusta Rossi Lasangra | Backend |
