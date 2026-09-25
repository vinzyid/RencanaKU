# RencanaKU

**Platform Prompt-to-PRD Generator dengan Deteksi Ambiguitas & Kontradiksi.**

RencanaKU mengubah ide/prompt kasar menjadi **PRD (Product Requirement Document)** yang terstruktur, jelas, dan bebas kontradiksi â€” sebelum requirement itu dipakai sebagai instruksi ke AI coding agent (Claude Code, Cursor, dsb).

Berbeda dari platform "prompt-to-code" yang langsung generate kode dari satu prompt, RencanaKU menyisipkan tahap **spec-first**: requirement dimatangkan dulu lewat proses klarifikasi dan validasi otomatis, baru dianggap "siap dieksekusi".

---

## Fitur Utama

- **Prompt-to-PRD Generator** â€” ide bebas â†’ draft PRD terstruktur (latar belakang, tujuan, target user, requirement fungsional & non-fungsional, batasan).
- **Ambiguity Detector** â€” mendeteksi requirement yang masih ambigu dan meminta klarifikasi satu per satu (dengan dedup, sehingga pertanyaan yang sudah dijawab tidak muncul lagi).
- **Contradiction Checker** â€” mendeteksi requirement yang saling bertentangan (A vs B) dan meminta user memilih atau merevisi.
- **Versioning & Diff** â€” setiap perubahan membuat versi PRD baru; frontend menampilkan diff visual (hijau = ditambah, merah = dihapus, kuning = diubah).
- **AI Provider Fallback** â€” chain berlapis: **OpenRouter â†’ Gemini â†’ generator lokal deterministik**. Kolom `ai_provider` mencatat provider yang berhasil.
- **Finalisasi & Export** â€” export PRD final ke **Markdown**, **JSON**, dan **PDF**.
- **Model Hybrid Stepper + Chat** â€” stepper 5 tahap permanen di atas layar, sementara interaksi di dalamnya berupa chat thread berkelanjutan yang tidak reset antar tahap.

---

## Alur Sistem

Stepper selalu terlihat di atas layar dan bergerak otomatis mengikuti progres percakapan:

```
[â— Input Ide] â€”â€” [â—‹ Klarifikasi] â€”â€” [â—‹ Validasi] â€”â€” [â—‹ Dokumentasi] â€”â€” [â—‹ Export]
```

1. **Input Ide** â€” user menulis ide bebas â†’ AI membuat draft PRD v1.
2. **Klarifikasi** â€” sistem menjalankan *ambiguity check*; AI mengajukan pertanyaan klarifikasi (dengan quick-reply chip).
3. **Validasi** â€” sistem menjalankan *contradiction check*; AI menjelaskan requirement yang bentrok.
4. **Dokumentasi** â€” PRD lengkap & konsisten ditampilkan; user masih bisa mengetik revisi bebas.
5. **Export** â€” user finalisasi, lalu mengekspor PRD ke Markdown / JSON / PDF.

State machine status PRD: `draft` â†’ (ambiguitas/kontradiksi baru dari edit â†’ kembali ke tahap terkait) â†’ `finalized`.

---

## Tech Stack

| Bagian | Teknologi |
|--------|-----------|
| Backend | Laravel 12 (API-only) |
| Auth | Laravel Sanctum (token-based, stateless) |
| Frontend | SPA (vanilla JS + Vite) |
| Styling | Tailwind CSS v4 + custom CSS |
| Database | MySQL (produksi) / SQLite (development) |
| AI Gateway | OpenRouter (primary) â†’ Gemini (fallback) â†’ local deterministik |
| HTTP Client | Laravel HTTP Client (AI), native `fetch` (frontend) |
| Export PDF | Blade view siap-cetak (DomPDF opsional) |

> Catatan: PRD menyebut React.js untuk frontend. Implementasi saat ini menggunakan **SPA vanilla JS** yang dibundel dengan Vite namun tetap berkomunikasi ke backend **murni lewat REST API (`/api/*`)** â€” sehingga frontend bisa diganti ke React tanpa mengubah backend.

---

## Skema Database

- `users` â€” data pengguna.
- `projects` â€” proyek PRD (1 proyek = 1 thread chat).
- `messages` â€” histori chat thread (`sender`: `user`/`ai`, `content`, `quick_replies` JSON, `related_prd_version_id`).
- `prd_versions` â€” riwayat versi PRD (`version_number`, `content` JSON, `status` draft/finalized, `ai_provider`).
- `ambiguity_flags` â€” ambiguitas per versi (`code`, `question`, `is_resolved`, `resolution_answer`).
- `contradiction_flags` â€” kontradiksi per versi (`requirement_a`, `requirement_b`, `explanation`, `resolution`).
- `personal_access_tokens` â€” token Sanctum.

Relasi: `User` hasMany `Project` â†’ hasMany `Message`, `PrdVersion` â†’ hasMany `AmbiguityFlag`, `ContradictionFlag`.

---

## Endpoint API

Base URL: `/api`. Semua endpoint selain register/login dilindungi `auth:sanctum` (Bearer token).

| Method | Endpoint | Fungsi |
|--------|----------|--------|
| POST | `/register` | Registrasi user |
| POST | `/login` | Login, dapat token Sanctum |
| POST | `/logout` | Logout (hapus token aktif) |
| GET | `/me` | Data user yang sedang login |
| GET | `/projects` | List proyek milik user |
| POST | `/projects` | Buat proyek baru (prompt awal opsional) |
| GET | `/projects/{id}` | Detail proyek + thread chat + PRD terbaru + diff + stage |
| PATCH | `/projects/{id}` | Rename proyek |
| DELETE | `/projects/{id}` | Hapus proyek |
| GET | `/projects/{id}/messages` | Ambil histori chat lengkap |
| POST | `/projects/{id}/messages` | Kirim pesan chat (ide awal, jawaban klarifikasi, resolusi kontradiksi, atau revisi bebas â€” backend menentukan konteks via state machine) |
| GET | `/projects/{id}/versions` | List semua versi PRD + diff antar versi |
| POST | `/projects/{id}/finalize` | Finalisasi PRD |
| GET | `/projects/{id}/export/{format}` | Export PRD (`md` / `json` / `pdf`) |

Karena UI berbasis chat, satu endpoint `/messages` menangani semua jenis input user â€” bukan endpoint terpisah per aksi seperti model wizard.

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
#    Tanpa key, sistem otomatis memakai generator lokal deterministik.

# 5. Build asset frontend (dari folder frontend)
cd ../frontend
npm install
npm run build
# Output build otomatis ditulis ke backend/public/build

# 6. Jalankan server (dari folder backend)
cd ../backend
php artisan serve
```

Buka `http://localhost:8000`.

### Akun Demo

Setelah `migrate --seed`:

| Email | Password |
|-------|----------|
| `admin@rencanaku.test` | `admin12345` |

### Development (hot reload)

```bash
# Terminal 1 (dari folder backend)
php artisan serve

# Terminal 2 (dari folder frontend)
npm run dev
```

> Jika baru mengubah config atau `.env`, jalankan `php artisan config:clear` lalu hard-refresh browser (`Ctrl + Shift + R`).

---

## Konfigurasi AI Provider

Chain provider diatur di `config/rencanaku.php`:

1. **OpenRouter** (`OPENROUTER_API_KEY`, `OPENROUTER_MODEL`) â€” provider utama.
2. **Gemini** (`GEMINI_API_KEY`, `GEMINI_MODEL`) â€” fallback bila OpenRouter gagal.
3. **Local** â€” generator deterministik, dipakai bila seluruh provider LLM gagal atau key kosong.

Setiap kali membuat versi PRD baru, kolom `ai_provider` mencatat provider yang berhasil, untuk transparansi ke user.

---

## Struktur Singkat

```
backend/                                   # Aplikasi Laravel (API + shell blade)
  app/
    Http/Controllers/ApiController.php     # Auth, proyek, chat, versi, finalize, export
    Models/                                # User, Project, Message, PrdVersion, ...
    Services/
      ProjectFlow.php                      # State machine & derivasi tahap (stepper)
      Ai/
        AiGateway.php                      # Fallback chain OpenRouter -> Gemini -> local
        PrdGenerator.php                   # Generate / ambiguity / contradiction / revisi
        LocalPrdEngine.php                 # Generator deterministik (tanpa API key)
        PrdDiff.php                        # Diff antar versi PRD
  resources/views/
    welcome.blade.php                      # Shell SPA
    exports/prd-pdf.blade.php              # Template export PDF
  routes/api.php                           # Seluruh endpoint REST
  public/                                  # Document root + hasil build asset

frontend/                                  # Sumber asset (Vite + Tailwind)
  resources/css/app.css                    # Styling stepper, chat, split-panel, diff
  resources/js/app.js                      # Entry Vite
  resources/js/spa/app.js                  # Seluruh logika SPA (stepper + chat)
  package.json
  vite.config.js                           # Build diarahkan ke backend/public/build
```
# RencanaKU

**Platform Prompt-to-PRD Generator dengan Deteksi Ambiguitas & Kontradiksi.**

RencanaKU mengubah ide/prompt kasar menjadi **PRD (Product Requirement Document)** yang terstruktur, jelas, dan bebas kontradiksi â€” sebelum requirement itu dipakai sebagai instruksi ke AI coding agent (Claude Code, Cursor, dsb).

Berbeda dari platform "prompt-to-code" yang langsung generate kode dari satu prompt, RencanaKU menyisipkan tahap **spec-first**: requirement dimatangkan dulu lewat proses klarifikasi dan validasi otomatis, baru dianggap "siap dieksekusi".

---

## Fitur Utama

- **Prompt-to-PRD Generator** â€” ide bebas â†’ draft PRD terstruktur (latar belakang, tujuan, target user, requirement fungsional & non-fungsional, batasan).
- **Ambiguity Detector** â€” mendeteksi requirement yang masih ambigu dan meminta klarifikasi satu per satu (dengan dedup, sehingga pertanyaan yang sudah dijawab tidak muncul lagi).
- **Contradiction Checker** â€” mendeteksi requirement yang saling bertentangan (A vs B) dan meminta user memilih atau merevisi.
- **Versioning & Diff** â€” setiap perubahan membuat versi PRD baru; frontend menampilkan diff visual (hijau = ditambah, merah = dihapus, kuning = diubah).
- **AI Provider Fallback** â€” chain berlapis: **OpenRouter â†’ Gemini â†’ generator lokal deterministik**. Kolom `ai_provider` mencatat provider yang berhasil.
- **Finalisasi & Export** â€” export PRD final ke **Markdown**, **JSON**, dan **PDF**.
- **Model Hybrid Stepper + Chat** â€” stepper 5 tahap permanen di atas layar, sementara interaksi di dalamnya berupa chat thread berkelanjutan yang tidak reset antar tahap.

---

## Alur Sistem

Stepper selalu terlihat di atas layar dan bergerak otomatis mengikuti progres percakapan:

```
[â— Input Ide] â€”â€” [â—‹ Klarifikasi] â€”â€” [â—‹ Validasi] â€”â€” [â—‹ Dokumentasi] â€”â€” [â—‹ Export]
```

1. **Input Ide** â€” user menulis ide bebas â†’ AI membuat draft PRD v1.
2. **Klarifikasi** â€” sistem menjalankan *ambiguity check*; AI mengajukan pertanyaan klarifikasi (dengan quick-reply chip).
3. **Validasi** â€” sistem menjalankan *contradiction check*; AI menjelaskan requirement yang bentrok.
4. **Dokumentasi** â€” PRD lengkap & konsisten ditampilkan; user masih bisa mengetik revisi bebas.
5. **Export** â€” user finalisasi, lalu mengekspor PRD ke Markdown / JSON / PDF.

State machine status PRD: `draft` â†’ (ambiguitas/kontradiksi baru dari edit â†’ kembali ke tahap terkait) â†’ `finalized`.

---

## Tech Stack

| Bagian | Teknologi |
|--------|-----------|
| Backend | Laravel 12 (API-only) |
| Auth | Laravel Sanctum (token-based, stateless) |
| Frontend | SPA (vanilla JS + Vite) |
| Styling | Tailwind CSS v4 + custom CSS |
| Database | MySQL (produksi) / SQLite (development) |
| AI Gateway | OpenRouter (primary) â†’ Gemini (fallback) â†’ local deterministik |
| HTTP Client | Laravel HTTP Client (AI), native `fetch` (frontend) |
| Export PDF | Blade view siap-cetak (DomPDF opsional) |

> Catatan: PRD menyebut React.js untuk frontend. Implementasi saat ini menggunakan **SPA vanilla JS** yang dibundel dengan Vite namun tetap berkomunikasi ke backend **murni lewat REST API (`/api/*`)** â€” sehingga frontend bisa diganti ke React tanpa mengubah backend.

---

## Skema Database

- `users` â€” data pengguna.
- `projects` â€” proyek PRD (1 proyek = 1 thread chat).
- `messages` â€” histori chat thread (`sender`: `user`/`ai`, `content`, `quick_replies` JSON, `related_prd_version_id`).
- `prd_versions` â€” riwayat versi PRD (`version_number`, `content` JSON, `status` draft/finalized, `ai_provider`).
- `ambiguity_flags` â€” ambiguitas per versi (`code`, `question`, `is_resolved`, `resolution_answer`).
- `contradiction_flags` â€” kontradiksi per versi (`requirement_a`, `requirement_b`, `explanation`, `resolution`).
- `personal_access_tokens` â€” token Sanctum.

Relasi: `User` hasMany `Project` â†’ hasMany `Message`, `PrdVersion` â†’ hasMany `AmbiguityFlag`, `ContradictionFlag`.

---

## Endpoint API

Base URL: `/api`. Semua endpoint selain register/login dilindungi `auth:sanctum` (Bearer token).

| Method | Endpoint | Fungsi |
|--------|----------|--------|
| POST | `/register` | Registrasi user |
| POST | `/login` | Login, dapat token Sanctum |
| POST | `/logout` | Logout (hapus token aktif) |
| GET | `/me` | Data user yang sedang login |
| GET | `/projects` | List proyek milik user |
| POST | `/projects` | Buat proyek baru (prompt awal opsional) |
| GET | `/projects/{id}` | Detail proyek + thread chat + PRD terbaru + diff + stage |
| PATCH | `/projects/{id}` | Rename proyek |
| DELETE | `/projects/{id}` | Hapus proyek |
| GET | `/projects/{id}/messages` | Ambil histori chat lengkap |
| POST | `/projects/{id}/messages` | Kirim pesan chat (ide awal, jawaban klarifikasi, resolusi kontradiksi, atau revisi bebas â€” backend menentukan konteks via state machine) |
| GET | `/projects/{id}/versions` | List semua versi PRD + diff antar versi |
| POST | `/projects/{id}/finalize` | Finalisasi PRD |
| GET | `/projects/{id}/export/{format}` | Export PRD (`md` / `json` / `pdf`) |

Karena UI berbasis chat, satu endpoint `/messages` menangani semua jenis input user â€” bukan endpoint terpisah per aksi seperti model wizard.

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
#    Tanpa key, sistem otomatis memakai generator lokal deterministik.

# 5. Build asset frontend (dari folder frontend)
cd ../frontend
npm install
npm run build
# Output build otomatis ditulis ke backend/public/build

# 6. Jalankan server (dari folder backend)
cd ../backend
php artisan serve
```

Buka `http://localhost:8000`.

### Akun Demo

Setelah `migrate --seed`:

| Email | Password |
|-------|----------|
| `admin@rencanaku.test` | `admin12345` |

### Development (hot reload)

```bash
# Terminal 1 (dari folder backend)
php artisan serve

# Terminal 2 (dari folder frontend)
npm run dev
```

> Jika baru mengubah config atau `.env`, jalankan `php artisan config:clear` lalu hard-refresh browser (`Ctrl + Shift + R`).

---

## Konfigurasi AI Provider

Chain provider diatur di `config/rencanaku.php`:

1. **OpenRouter** (`OPENROUTER_API_KEY`, `OPENROUTER_MODEL`) â€” provider utama.
2. **Gemini** (`GEMINI_API_KEY`, `GEMINI_MODEL`) â€” fallback bila OpenRouter gagal.
3. **Local** â€” generator deterministik, dipakai bila seluruh provider LLM gagal atau key kosong.

Setiap kali membuat versi PRD baru, kolom `ai_provider` mencatat provider yang berhasil, untuk transparansi ke user.

---

## Batasan (Constraints)

- Tidak mencakup eksekusi/generate kode sungguhan â€” scope berhenti di PRD final.
- Kualitas deteksi ambiguitas/kontradiksi bergantung pada LLM yang dipanggil (bukan validasi logis formal); tanpa API key, deteksi memakai heuristik lokal.
- Tidak ada kolaborasi real-time multi-user (satu proyek dimiliki satu akun).

---

## Anggota Kelompok

Praktik Aplikasi Web â€” Kelompok 5 orang:

| Nama | Peran |
|------|-------|
| Abyan Bergas Irmawan | Frontend |
| Maulana Yudo Yudistira | Frontend |
| Rafi Pandya Prabowo | Backend |
| Fahryan Amadis | Frontend |
| Agusta Rossi Lasangra | Backend |
