# Audit Implementasi AI — Prioritas untuk Project Akhir

> **Status**: Dokumen audit (bukan daftar bug final)
> **Ditulis**: 2025-09-25
> **Konteks**: Web ini adalah tugas/project akhir untuk dipresentasikan.
> Tujuan audit ini adalah memisahkan hal yang **benar-benar memengaruhi
> kualitas PRD yang dihasilkan** (layak dikerjakan) dari hal yang **overkill**
> untuk kebutuhan tugas (cukup dicatat sebagai batasan).

---

## 🎯 Pertanyaan yang Dijawab Dokumen Ini

> "Apa yang harus diperbaiki agar **PRD yang dihasilkan konsisten dan sesuai
> keinginan user / sesuai isi chat**?"

Jawaban singkat: **fokus pada kelompok A di bawah.** Kelompok B boleh
diabaikan untuk tugas — hanya relevan untuk produksi skala besar.

---

## 🟢 KELOMPOK A — BERDAMPAK LANGSUNG (JANGAN OVERLOOK)

Semua ini memengaruhi **isi & pengalaman dokumen yang dilihat dosen/pengguna**.
Ini yang layak dikerjakan.

### A1. Tombol Finalisasi tidak ada di UI ⚠️ (paling penting)
- **Fakta**: endpoint `POST /finalize` ada, tapi tak pernah dipanggil frontend.
  Status PRD tak pernah jadi `finalized`; stepper tak pernah sampai tahap Export.
- **Dampak ke PRD**: user tak bisa "menutup" PRD sebagai final. Alur yang
  dipresentasikan terlihat terputus.
- **Bukti**: `13_finalize_flow_and_stats.md` bagian 13.1.
- **Sifat**: WAJIB. Ini alur yang pasti diperagakan saat demo.

### A2. Statistik dokumen hardcoded
- **Fakta**: "User Stories = 8" selalu tetap; fallback 12/5 palsu.
  (`app.js` sekitar baris 1398-1400).
- **Dampak ke PRD**: angka di panel statistik **berbohong** — dosen bisa
  membandingkan dengan isi dokumen dan melihat ketidakcocokan.
- **Sifat**: WAJIB (mudah, 3 baris). Langsung terlihat.

### A3. Konsistensi isi antar-respons AI (kualitas nyata)
- **Fakta**: kualitas PRD bergantung sepenuhnya pada model. Tidak ada pengukuran
  atau penjaga kualitas selain prompt + `normalize()`.
- **Dampak ke PRD**: kadang PRD sangat baik, kadang datar/generic — terutama
  bila jatuh ke `LocalPrdEngine`.
- **Sifat**: PENTING untuk demo. Mitigasi praktis:
  1. pastikan API GripHub aktif & `AI_MAX_TOKENS` cukup (jangan sampai fallback
     lokal muncul saat demo),
  2. uji dulu beberapa ide nyata sebelum presentasi.
- **Bukan** perbaikan kode besar — lebih ke "jaga kondisi demo".

### A4. Halusinasi / klaim tanpa dasar — ✅ SUDAH DIBUKTIKAN & DIPERBAIKI

**Bukti sebelum perbaikan** (uji 4 ide minimal lewat AI GripHub; user tidak
menyebut fitur teknis sama sekali):

| Ide user (minimal) | Fitur/klaim tambahan yang muncul tanpa diminta |
|---|---|
| "cuma pengingat minum air" | notifikasi, multi-bahasa, cloud |
| "web jadwal piket kelas" | login, autentikasi, notifikasi |
| "aplikasi hutang teman" | enkripsi, login, notifikasi, laporan, cloud |
| "gallery foto liburan keluarga" | 99%, enkripsi, login, notifikasi, cloud |

→ **Terbukti**: PRD sering menambah klaim/fitur yang tidak diminta user
(user awam bisa salah paham menganggapnya wajib). Klaim "sesuai keinginan user"
**belum bisa dibuat** sebelum ini diperbaiki.

**Perbaikan yang dilakukan** (prompt `PrdGenerator::generate()`):
ditambahkan instruksi eksplisit "tetap setia pada permintaan pengguna":
jangan menambah fitur tanpa diminta, jangan mencantumkan angka/klaim teknis
yang tidak diminta (uptime/enkripsi/SLA), dan lebih baik sedikit tapi benar.

**Bukti sesudah perbaikan** (ide sama):

| Ide | Sebelum | Sesudah |
|---|---|---|
| pengingat minum air | notifikasi, multi-bahasa, cloud | notifikasi |
| jadwal piket kelas | login, autentikasi, notifikasi | login, autentikasi |
| hutang teman | enkripsi, login, notifikasi, laporan, cloud | autentikasi |
| gallery foto | 99%, enkripsi, login, notifikasi, cloud | (tidak ada) |

Klaim teknis berat (`99%`, `enkripsi`, `cloud`, `multi-bahasa`) hilang; jumlah
functional requirement turun ke angka wajar (5–7, dari 8–10). Sisa "login"
dinilai wajar karena aplikasi memang butuh akun.

- **Sifat**: ✅ Diperbaiki (prompt). Tidak bisa 100% dihilangkan (sifat LLM),
  tapi jauh berkurang.

### A5. Export PRD draft tanpa peringatan
- **Fakta**: `export()` tak memblokir status `draft`.
- **Dampak ke PRD**: minor; file bisa "menipu" seolah final.
- **Sifat**: RENDAH-MENENGAH. Perbaikan 1 baris (`abort_unless finalized`).

---

## 🔴 KELOMPOK B — OVERKILL UNTUK TUGAS (cukup dicatat)

Semua ini **tidak terlihat saat presentasi** dan **tidak memengaruhi isi PRD**
pada skala demo. Mengerjakannya = usaha besar tanpa manfaat yang tampak.

### B1. Retry per-provider AI
- Manfaat: ketahanan saat provider sesaat gagal. Untuk demo, cukup andalkan
  fallback chain yang sudah ada.

### B2. Circuit breaker
- Saran dari laporan #7. Berguna untuk trafik tinggi; tidak relevan untuk tugas.

### B3. Idempotency key (klik "Kirim" dobel)
- Risiko: pesan dobel bila user klik cepat. Untuk demo 1 orang, kecil.

### B4. Race condition queue: `retry_after` (90s) < job `timeout` (300s) ⚠️
- **Fakta nyata**: `config/queue.php` `DB_QUEUE_RETRY_AFTER=90`, sedangkan
  `ProcessProjectMessage::$timeout=300`. Job >90 detik bisa dianggap gagal &
  diproses ulang → potensi **PRD dobel/duplikat**.
- **Dampak**: hanya muncul bila AI butuh >90 detik. Saat ini 1 panggilan
  GripHub ~18-35 detik, jadi **belum terpicu**.
- **Sifat**: CATAT SAJA. Kalau saat demo AI lambat (>90s) dan muncul keanehan,
  baru perhatikan. Perbaikan: set `DB_QUEUE_RETRY_AFTER` > 300.

### B5. Indeks database untuk dedup flag
- Performa query; tidak terasa pada skala demo.

### B6. `recordUsage` gagal senyap (token tak tercatat)
- Hanya memengaruhi akurasi statistik biaya admin; bukan isi PRD.

### B7. Gemini (`callGemini`) belum pakai `max_tokens`
- Perbaikan JSON terpotong hanya diterapkan ke provider OpenAI-compatible.
  Relevan **hanya** bila fallback Gemini dipakai (butuh `GEMINI_API_KEY`,
  yang saat ini kosong) → **praktis tidak aktif**.

### B8. SSE/streaming progres AI
- UX bagus, tapi perubahan besar; queue + polling sudah cukup untuk tugas.

---

## 📊 Ringkasan Keputusan

| Kode | Hal | Pengaruh ke PRD | Kerjakan? |
|---|---|---|---|
| A1 | Tombol Finalisasi | Alur terputus saat demo | ✅ WAJIB |
| A2 | Statistik hardcoded | Angka berbohong | ✅ WAJIB |
| A3 | Konsistensi kualitas AI | Isi PRD | ⚠️ Jaga kondisi demo |
| A4 | Halusinasi | Isi PRD tak sesuai | ✅ Diperbaiki (prompt) |
| A5 | Export draft | Minor | 🟢 Kalau sempat |
| B1–B8 | Ketahanan/performa produksi | Tidak terlihat saat demo | ❌ OVERKILL |

---

## ✅ Rekomendasi Akhir (untuk tugas)

1. **Kerjakan A1 & A2** — kecil, langsung terlihat, menutup alur presentasi.
2. **Jaga A3** — pastikan API AI aktif & `AI_MAX_TOKENS` cukup sebelum demo.
3. **A4** — ✅ sudah diperbaiki (instruksi prompt anti-halusinasi).
4. **A5** — opsional (1 baris).
5. **B1–B8** — cukup dicatat di section "Batasan/Known Limitations" laporan
   akhir. **Tidak perlu dikerjakan** untuk presentasi.

---

## 🧪 Cara Membuktikan (jika ingin memastikan status)

| Hal | Cara cek |
|---|---|
| A1 | Buka dokumen PRD → tak ada tombol Finalisasi; status DB tetap `draft` |
| A2 | Bandingkan "User Stories" di statistik vs jumlah user story di dokumen |
| A3 | Uji 3-4 ide nyata; catat mana yang PRD-nya datar |
| A4 | Cari klaim teknis di PRD yang tak diminta user (mis. "AES-256") |
| A5 | Export PRD draft → berhasil tanpa peringatan |
| B4 | `grep retry_after config/queue.php` vs `$timeout` di `ProcessProjectMessage` |

---

## 📚 Referensi Berkas

| Berkas | Bagian yang diaudit |
|---|---|
| `backend/app/Services/Ai/AiGateway.php` | fallback, timeout, max_tokens, decode JSON, recordUsage |
| `backend/app/Services/Ai/PrdGenerator.php` | seluruh prompt, normalize, dedup, sanitasi |
| `backend/app/Services/Ai/LocalPrdEngine.php` | seluruh mode fallback |
| `backend/app/Services/ProjectFlow.php` | state machine |
| `backend/app/Http/Controllers/ApiController.php` | orkestrasi & finalize/export |
| `backend/config/queue.php` | retry_after & timeout |
| `frontend/resources/js/spa/app.js` | statistik & tombol dokumen |

---

**Kesimpulan**: untuk tujuan "PRD konsisten & sesuai keinginan user",
**hanya Kelompok A yang relevan**, dan di dalamnya pun cukup **A1 + A2**
(yang ditangani lewat `13_finalize_flow_and_stats.md`) plus **menjaga A3 saat
demo**. Kelompok B adalah **overkill** untuk tugas dan tidak memengaruhi hasil PRD.
