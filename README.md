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

---

## Alur Sistem

Stepper selalu terlihat di atas layar dan bergerak otomatis mengikuti progres percakapan:

```
[● Input Ide] —— [○ Klarifikasi] —— [○ Validasi] —— [○ Dokumentasi] —— [○ Export]
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
| Frontend | SPA (vanilla JS + Vite) |
| Styling | Tailwind CSS v4 + custom CSS |
| Database | MySQL (produksi) / SQLite (development) |
| AI Gateway | OpenRouter (primary) → Gemini (fallback) → local deterministik |
| HTTP Client | Laravel HTTP Client (AI), native `fetch` (frontend) |
| Export PDF | Blade view siap-cetak (DomPDF opsional) |

> Catatan: PRD menyebut React.js untuk frontend. Implementasi saat ini menggunakan **SPA vanilla JS** yang dibundel dengan Vite namun tetap berkomunikasi ke backend **murni lewat REST API (`/api/*`)** — sehingga frontend bisa diganti ke React tanpa mengubah backend.

---

## Skema Database

- `users` — data pengguna.
- `projects` — proyek PRD (1 proyek = 1 thread chat).
- `messages` — histori chat thread (`sender`: `user`/`ai`, `content`, `quick_replies` JSON, `related_prd_version_id`).
- `prd_versions` — riwayat versi PRD (`version_number`, `content` JSON, `status` draft/finalized, `ai_provider`).
- `ambiguity_flags` — ambiguitas per versi (`code`, `question`, `is_resolved`, `resolution_answer`).
- `contradiction_flags` — kontradiksi per versi (`requirement_a`, `requirement_b`, `explanation`, `resolution`).
- `personal_access_tokens` — token Sanctum.

Relasi: `User` hasMany `Project` → hasMany `Message`, `PrdVersion` → hasMany `AmbiguityFlag`, `ContradictionFlag`.

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
# 1. Install dependency
composer install
npm install

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

# 5. Build asset frontend
npm run build

# 6. Jalankan server
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
# Terminal 1
php artisan serve

# Terminal 2
npm run dev
```

> Jika baru mengubah config atau `.env`, jalankan `php artisan config:clear` lalu hard-refresh browser (`Ctrl + Shift + R`).

---

## Konfigurasi AI Provider

Chain provider diatur di `config/rencanaku.php`:

1. **OpenRouter** (`OPENROUTER_API_KEY`, `OPENROUTER_MODEL`) — provider utama.
2. **Gemini** (`GEMINI_API_KEY`, `GEMINI_MODEL`) — fallback bila OpenRouter gagal.
3. **Local** — generator deterministik, dipakai bila seluruh provider LLM gagal atau key kosong.

Setiap kali membuat versi PRD baru, kolom `ai_provider` mencatat provider yang berhasil, untuk transparansi ke user.

---

## Struktur Singkat

```
app/
├── Http/Controllers/ApiController.php   # Auth, proyek, chat, versi, finalize, export
├── Models/                              # User, Project, Message, PrdVersion, AmbiguityFlag, ContradictionFlag
└── Services/
    ├── ProjectFlow.php                  # State machine & derivasi tahap (stepper)
    └── Ai/
        ├── AiGateway.php                # Fallback chain OpenRouter → Gemini → local
        ├── PrdGenerator.php             # Generate / ambiguity / contradiction / revisi
        ├── LocalPrdEngine.php           # Generator deterministik (tanpa API key)
        └── PrdDiff.php                  # Diff antar versi PRD
resources/
├── css/app.css                          # Styling stepper, chat, split-panel, diff
├── js/app.js                            # Entry Vite
├── js/spa/app.js                        # Seluruh logika SPA (stepper + chat)
└── views/
    ├── welcome.blade.php                # Shell SPA
    └── exports/prd-pdf.blade.php        # Template export PDF
routes/api.php                           # Seluruh endpoint REST
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
