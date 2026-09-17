# Perbaikan Timeout AI — "Susun Draft PRD"

> Dokumen untuk pembahasan tim. Membahas error
> `Maximum execution time of 30 seconds exceeded` yang muncul saat user
> menekan tombol **Susun draft PRD** di fase Input Ide.
>
> Status: **usulan / belum diputuskan**. Tujuan dokumen ini adalah menyamakan
> pemahaman sebelum tim memilih arah implementasi.

## Akar masalah (ringkas)

Saat user klik "Susun draft PRD", server melakukan **3 panggilan AI berurutan**:

1. `generate()`              → minta AI buat PRD          (bisa 5–30 detik)
2. `detectAmbiguities()`     → minta AI cari ambiguitas   (bisa 5–30 detik)
3. `detectContradictions()`  → minta AI cari kontradiksi  (bisa 5–30 detik)

Total bisa **15–90 detik**. Sementara server membatasi 30 detik → mati di tengah
jalan. Makanya "memproses tapi gagal".

Semua opsi di bawah mencoba menyelesaikan ini, tapi dengan kompromi berbeda.

## Ringkasan alur saat ini

```
handleInitialIdea()
  ├─ 1. generator->generate($content)          → panggilan AI #1
  └─ refreshFlags($version)
       ├─ 2. detectAmbiguities($content)       → panggilan AI #2
       └─ 3. detectContradictions($content)    → panggilan AI #3
```

Catatan teknis:

- Timeout tiap panggilan AI = `AI_REQUEST_TIMEOUT` (saat ini **60 detik**).
- Server dev (`php artisan serve` / PHP built-in server) membatasi request
  ~30 detik → error muncul di sini.
- Model yang dipakai: `deepseek-v4.1-flash` lewat GripHub Router.

---

## Opsi 1 — Naikkan batas waktu

**Yang dilakukan:**

- `ini_set('max_execution_time', 120)` di `public/index.php`
- Turunkan `AI_REQUEST_TIMEOUT` dari 60 → ~30

**Cara kerja:** server diizinkan bekerja sampai 120 detik. Jadi 3 panggilan AI
punya ruang.

**Kelebihan:**

- Paling cepat dikerjakan (2 baris)
- Fitur langsung jalan
- Tidak mengubah logika

**Kekurangan:**

- User menunggu lama tanpa progress — klik, lalu diam 20–60 detik, baru muncul
  hasil. Tidak ada indikator.
- Rawan timeout jaringan — kalau browser/HP user lemah, koneksi bisa putus
  sebelum selesai.
- Boros server — 1 user bisa "memakai" 1 proses PHP selama 60 detik. Kalau 5
  orang bersamaan → server lambat semua.
- Bukan solusi akar — kalau model makin lambat, masalah kembali.
- Di hosting tertentu (mis. shared hosting / beberapa PaaS), `max_execution_time`
  tidak bisa dinaikkan seenaknya.

**Kapan cocok:** untuk demo/testing cepat, atau prototipe. Jangan untuk produksi
jangka panjang.

---

## Opsi 2 — Gabung 3 panggilan AI jadi 1

**Yang dilakukan:** ubah prompt agar **satu panggilan AI** mengembalikan PRD +
ambiguitas + kontradiksi sekaligus. Output JSON jadi:

```json
{
  "title": "...",
  "background": "...",
  "objectives": [],
  "ambiguities": [],
  "contradictions": []
}
```

Lalu `handleInitialIdea` cukup 1x panggil AI, dan `refreshFlags` tidak lagi
memanggil AI (pakai hasil dari output yang sama).

**Cara kerja:** dari 3 request ke GripHub → jadi 1. Waktu tempuh turun ~3x
(mis. dari 45 detik → 15 detik).

**Kelebihan:**

- Menyelesaikan akar masalah — bukan sekadar menaikkan batas
- Hemat token biaya — 1 panggilan jauh lebih murah dari 3 → relevan dengan
  fitur admin pemakaian token
- Konsistensi lebih baik — ambiguitas & kontradiksi dihitung dari PRD yang sama,
  bukan hasil generate ulang
- User menunggu lebih singkat

**Kekurangan:**

- Perubahan kode sedang (`PrdGenerator` + `ApiController`)
- Kualitas bisa sedikit turun: 1 prompt dengan 3 tugas sekaligus kadang membuat
  model kurang fokus. Untuk ambiguitas & kontradiksi, model "berpikir" tentang
  dua hal sekaligus.
- Output JSON lebih besar → risiko model "terpotong" kalau `max_tokens` kecil
- Perubahan format prompt berarti hasil lama & baru bisa beda gaya

**Kapan cocok:** jangka menengah, saat fitur sudah stabil dan tim mau efisiensi.
Rekomendasi sebagai arah utama.

---

## Opsi 3 — Pindahkan ke queue (background job)

**Yang dilakukan:**

- `createProject` langsung membalas "proyek dibuat, sedang menyusun PRD"
- Pekerjaan AI dipindah ke queue (`QUEUE_CONNECTION=database`)
- Worker (`php artisan queue:work`) mengerjakan di latar belakang
- UI polling (`/projects/{id}/messages` berkala) sampai hasil muncul
- Status diperbarui: "draft sedang disusun..." → hasil

**Cara kerja:** request HTTP selesai cepat (<1 detik). AI jalan di proses
terpisah tanpa batas 30 detik.

**Kelebihan:**

- Paling benar secara arsitektur — standar aplikasi produksi modern
- Tidak ada batas waktu request — job bisa jalan berapa pun lamanya
- User experience bagus — bisa tampilkan loading/progress, tidak "diam menggantung"
- Skalabel — banyak user, banyak worker, tidak saling blok
- Tidak membebani request server

**Kekurangan:**

- Perubahan paling besar: controller + endpoint status + UI polling + worker
  deployment
- Butuh worker yang selalu jalan — di produksi perlu supervisor/systemd. Kalau
  worker mati, job menumpuk
- Butuh infrastruktur: queue database/Redis
- Debug lebih kompleks — masalah terjadi di proses terpisah, butuh lihat log worker
- Perubahan UI — SPA harus berubah dari "tunggu respons" jadi "poll status"

**Kapan cocok:** kalau aplikasi sudah dipakai banyak orang, atau fitur AI makin
lama & kompleks. Overkill untuk sekarang, tapi arah jangka panjang yang benar.

---

## Opsi 4 — Timeout pendek + fallback lokal

**Yang dilakukan:**

- Set `AI_REQUEST_TIMEOUT=15`
- Kalau AI tidak selesai dalam 15 detik, langsung jatuh ke `LocalPrdEngine`
  (deterministik, instan)

**Cara kerja:** pakai hasil AI kalau cepat; kalau lama, pakai engine lokal.
Selalu selesai di bawah 30 detik.

**Kelebihan:**

- Tidak pernah timeout — selalu balas cepat
- Perubahan minimal (cukup ubah `.env`)
- Aplikasi tetap terasa responsif

**Kekurangan:**

- Kualitas tidak konsisten — kadang hasil AI bagus, kadang hasil engine lokal
  datar. User bisa bingung "kok hasilnya beda-beda".
- Engine lokal tidak "mengerti" ide spesifik seperti AI
- Bukan solusi akar — cuma "lari" dari masalah
- Kalau AI selalu >15 detik, semua user dapat hasil lokal → AI tak terpakai

**Kapan cocok:** kalau ketersediaan/respons lebih penting daripada kualitas,
atau sebagai jaring pengaman sementara.

---

## Perbandingan singkat

| | Waktu | Kualitas | UX user | Hemat token | Perubahan | Skalabel |
|---|---|---|---|---|---|---|
| **1. Naikkan batas** | lama (20–60s) | tetap | buruk (diam) | tidak | sangat kecil | tidak |
| **2. Gabung 1 call** | ~3x cepat | sedikit turun | lebih baik | **ya** | sedang | cukup |
| **3. Queue** | instan + async | tetap | **terbaik** | tidak | **besar** | **ya** |
| **4. Timeout pendek** | instan | tidak konsisten | baik | tidak (buang percobaan) | sangat kecil | tidak |

---

## Rekomendasi bertahap

1. **Sekarang: Opsi 1 (cepat)** — supaya fitur jalan dulu. Turunkan juga
   `AI_REQUEST_TIMEOUT` ke 30 agar tidak absurd.
2. **Lanjut: Opsi 2** — gabung jadi 1 panggilan. Perbaikan nyata & hemat token
   (cocok dengan rencana fitur admin token).
3. **Nanti kalau sudah ramai: Opsi 3** — queue untuk pengalaman & skalabilitas
   terbaik.

**Opsi 4 jangan dijadikan solusi utama.** Kalau mau, bisa dipakai sebagai
*jaring pengaman* (timeout 25 detik, fallback lokal) bersamaan dengan Opsi 1.

---

## Pertanyaan untuk tim

1. **Model AI-nya memang lambat, atau kadang cepat?**
   - Kalau biasanya 5–10 detik dan cuma kadang 40 detik → Opsi 1 cukup.
   - Kalau selalu ~20 detik per call → Opsi 2 wajib.
2. **Aplikasi ini untuk demo/tugas, atau akan dipakai publik?**
   - Demo → Opsi 1.
   - Publik → Opsi 2/3.
3. **Perlu hemat biaya token?** (karena ada fitur admin token)
   - → mendukung Opsi 2.

---

## Referensi berkas

| Berkas | Peran |
|---|---|
| `app/Http/Controllers/ApiController.php` | `handleInitialIdea()`, `refreshFlags()` — titik 3 panggilan AI |
| `app/Services/Ai/PrdGenerator.php` | `generate()`, `detectAmbiguities()`, `detectContradictions()`, `revise()` |
| `app/Services/Ai/AiGateway.php` | Fallback chain + timeout pemanggilan HTTP |
| `app/Services/Ai/LocalPrdEngine.php` | Engine deterministik (dasar Opsi 4) |
| `config/rencanaku.php` | Daftar provider + `timeout` |
| `.env` | `AI_REQUEST_TIMEOUT`, `GRIPHUB_*` |
| `public/index.php` | Titik `ini_set('max_execution_time', ...)` (Opsi 1) |
