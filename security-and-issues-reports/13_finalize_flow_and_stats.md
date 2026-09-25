# Perbaikan Masalah #13: Alur Finalisasi & Akurasi Statistik Dokumen PRD

> **Status**: 🟠 Medium Priority
> **Kategori**: Bug Fungsional UI + Data
> **Ditulis**: 2025-09-25
> **Ditemukan saat**: verifikasi manual alur PRD (setelah perbaikan #7-#12 & bagian A/B)

---

## 📋 Ringkasan

Ditemukan **4 masalah** pada halaman dokumen PRD (`workspace → dokumentasi`)
yang belum diperbaiki pada commit-commit sebelumnya. Semua dapat dibuktikan
manual melalui UI. Masalah #13.1 bersifat fungsional (tombol finalisasi tidak
ada), #13.2–#13.4 bersifat akurasi/tampilan data.

Daftar:

| # | Masalah | Tingkat |
|---|---------|---------|
| 13.1 | Tombol **Finalisasi tidak ada** di UI → endpoint `POST /finalize` tidak pernah dipanggil | 🟠 Medium |
| 13.2 | Statistik dokumen **hardcoded** ("User Stories = 8", fallback 12/5) | 🟡 Low-Medium |
| 13.3 | Export **tidak memblokir** PRD yang belum difinalisasi | 🟡 Low |
| 13.4 | `AI_MAX_TOKENS` dipakai kode tapi **tidak ada di `.env.example`** | 🟡 Low |

---

## 13.1 — Tombol Finalisasi Tidak Ada di UI

### Fakta kode

- **Backend menyediakan** endpoint: `POST /api/projects/{project}/finalize`
  (`backend/routes/api.php`), dengan logika validasi di
  `ApiController::finalize()` (`backend/app/Http/Controllers/ApiController.php:189-213`).
- **Frontend tidak pernah memanggilnya.** Hasil pencarian di
  `frontend/resources/js/spa/app.js` untuk `finalize` hanya menemukan:
  - `state.validation.can_finalize` (didefinisikan, tidak dipakai untuk aksi),
  - `isFinalized` (dihitung, tidak dipakai menampilkan tombol).
- Halaman dokumen hanya punya dua tombol: **Bagikan** (`#btn-share-prd`) dan
  **Export** (`#btn-open-export`) — lihat `app.js:1421-1426`.

### Akibat

- Status PRD **tidak pernah menjadi `finalized`** dari alur UI normal.
- Karena `ProjectFlow::stage()` mengembalikan `export` HANYA bila
  `status === 'finalized'` (`ProjectFlow.php:23-25`), stepper tidak pernah
  mencapai tahap **Export**.
- Pesan AI "siap difinalisasi" tidak bisa ditindaklanjuti user (tidak ada
  tombolnya).

### Cara Membuktikan Manual (besok)

1. Jalankan: `php artisan serve` (folder `backend`) + `php artisan queue:work`.
2. Login, buat proyek baru, isi ide, jawab sampai PRD bersih
   (tidak ada ambiguitas/kontradiksi).
3. Buka halaman dokumen (tab Preview). Amati area tombol kanan atas.
4. **Hasil yang diharapkan (bug):** hanya ada tombol **"Bagikan"** dan
   **"Export"**. **Tidak ada tombol "Finalisasi"**.
5. Verifikasi status di database masih `draft`:
   ```powershell
   php artisan tinker --execute="echo App\Models\Project::latest('id')->first()->prdVersions()->latest('version_number')->first()->status;"
   ```
   **Hasil (bug):** `draft` (bukan `finalized`), padahal seharusnya bisa difinalkan.

### Perbaikan yang Diharapkan

- Tambah tombol **"Finalisasi"** di halaman dokumen, aktif hanya bila
  `state.validation.can_finalize === true` (dan/atau ambiguities = 0 &
  contradictions = 0).
- Saat diklik → `POST /api/projects/{id}/finalize` → terapkan ulang payload →
  tampilkan badge "Final" & aktifkan stepper tahap Export.

---

## 13.2 — Statistik Dokumen Hardcoded

### Fakta kode

`frontend/resources/js/spa/app.js` (sekitar baris 1398-1400):

```js
const funcReqs = prd.content?.functional_requirements?.length || 12;
const nonFuncReqs = prd.content?.non_functional_requirements?.length || 5;
const userStories = 8;   // <-- hardcoded, bukan dari data
```

Widget **"Statistik"** di sisi kanan (`app.js:1470-1496`) menampilkan:
- Functional Requirements = jumlah asli (jika ada; jika kosong → 12).
- Non-Functional = jumlah asli (jika kosong → 5).
- **User Stories = selalu 8** (nilai tetap), berapa pun isi sebenarnya.

### Akibat

- Angka "User Stories = 8" **menyesatkan** — dokumen bisa punya 0 atau 5 user
  story, tapi UI selalu menampilkan 8.
- Bila `functional_requirements` kosong, tampil "12" palsu.

### Cara Membuktikan Manual

1. Buat PRD baru.
2. Buka halaman dokumen → panel kanan → **Statistik**.
3. Bandingkan **"User Stories"** di statistik dengan jumlah user story sebenarnya
   di tab Preview (bagian "User Story").
4. **Hasil (bug):** statistik selalu **8**, meski daftar User Story di dokumen
   jumlahnya berbeda (mis. 5).

### Perbedaan yang Diharapkan

- `userStories = prd.content?.user_stories?.length || 0;`
- Untuk semua field gunakan `?? 0`, bukan angka fallback palsu (12/5/8).

---

## 13.3 — Export Tidak Memblokir PRD yang Belum Difinalisasi

### Fakta kode

- Backend `export()` (`ApiController.php:215-240`) hanya memeriksa
  format & keberadaan versi; **tidak** memeriksa `status === 'finalized'`.
- UI Export selalu bisa diklik dari halaman dokumen (`app.js:1507-1510`).

### Akibat

- User bisa mengunduh PRD berstatus `draft` (masih bisa berubah). Untuk
  orang awam, ini membingungkan: file terlihat "final" padahal belum.

### Cara Membuktikan Manual

1. Buat PRD baru (biarkan berstatus `draft`, belum difinalkan — lihat 13.1).
2. Klik **Export** → pilih format MD/JSON/PDF → unduh.
3. **Hasil (bug):** file terunduh tanpa peringatan apa pun.

### Perbaikan yang Diharapkan (pilih salah satu)

- **Opsi A:** Blokir di backend — `abort_unless($version->status === 'finalized', 422, 'Finalisasi PRD sebelum mengunduh.')`.
- **Opsi B:** Izinkan, tapi beri label jelas di UI ("Draft — belum difinalisasi")
  dan/atau konfirmasi sebelum unduh.

---

## 13.4 — `AI_MAX_TOKENS` Tidak Terdokumentasi di `.env.example`

### Fakta kode

- Perbaikan JSON terpotong menambah `max_tokens` di
  `AiGateway::callOpenAiCompatible()` lewat `env('AI_MAX_TOKENS', 4096)`.
- Namun variabel `AI_MAX_TOKENS` **tidak ada** di `backend/.env.example`.

### Akibat

- Developer/deployer baru tidak tahu variabel ini ada; kalau PRD panjang
  terpotong lagi, orang tidak tahu bisa diatur. (Nilai default 4096 tetap
  dipakai, jadi tidak fatal.)

### Cara Membuktikan Manual

```powershell
Select-String -Path backend/.env.example -Pattern "AI_MAX_TOKENS"
```
**Hasil (bug):** tidak ada keluaran (variabel tidak terdaftar).

### Perbaikan yang Diharapkan

- Tambah di `backend/.env.example` (dan dokumentasi AI Provider di README):
  ```env
  # Batas token keluaran AI (naikkan bila PRD panjang terpotong)
  AI_MAX_TOKENS=4096
  ```

---

## 🧪 Ringkasan Langkah Reproduksi (untuk verifikasi besok)

| Masalah | Langkah singkat | Bukti |
|---|---|---|
| 13.1 | Buka dokumen PRD bersih → lihat tombol kanan atas | Tidak ada tombol Finalisasi; status di DB tetap `draft` |
| 13.2 | Buka statistik dokumen → bandingkan jumlah User Story | Statistik selalu 8 |
| 13.3 | Export PRD berstatus draft | Berhasil terunduh tanpa peringatan |
| 13.4 | Cari `AI_MAX_TOKENS` di `.env.example` | Tidak ditemukan |

---

## ✅ Checklist Perbaikan

- [ ] 13.1 Tambah tombol Finalisasi + handler `POST /finalize` di UI
- [ ] 13.1 Tampilkan badge "Final" & aktifkan stepper Export setelah final
- [ ] 13.2 Ganti statistik hardcoded dengan panjang data asli (`?? 0`)
- [ ] 13.3 Terapkan keputusan Opsi A atau B untuk export draft
- [ ] 13.4 Tambah `AI_MAX_TOKENS` ke `.env.example` + README

---

## 📚 Referensi Berkas

| Berkas | Peran |
|---|---|
| `backend/app/Http/Controllers/ApiController.php` | `finalize()`, `export()`, `projectPayload()` (statistik/validasi) |
| `backend/app/Services/ProjectFlow.php` | `stage()`, `validationSummary()`, `can_finalize` |
| `backend/routes/api.php` | Endpoint `POST /projects/{project}/finalize` |
| `frontend/resources/js/spa/app.js` | `renderDocumentationView()` (tombol, statistik), `triggerExport()` |
| `backend/app/Services/Ai/AiGateway.php` | `AI_MAX_TOKENS` |
| `backend/.env.example` | Dokumentasi env |

---

**Catatan**: Masalah #13.1 adalah yang paling penting karena memutus alur
akhir produk (Finalisasi → Export). Perbaikan #13.2–#13.4 bersifat
melengkapi akurasi & dokumentasi.
