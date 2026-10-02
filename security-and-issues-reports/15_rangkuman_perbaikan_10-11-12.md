# Rangkuman Perbaikan Masalah #10, #11, #12

> **Status**: ✅ Selesai (Done)
> **Kategori**: Security (Frontend & Backend)
> **Ditulis**: 2026-06-16
> **Commit**: `8b6b7f6` — `fix(security): atasi masalah #10-#12 (XSS escape, OAuth token URL, role exposure)`
> **Verifikasi**: `php artisan test` → **31 passed (122 assertions)**, tidak ada regresi

---

## 📋 Ringkasan

Ketiga masalah keamanan ini sebelumnya dianggap "sulit dikerjakan" karena
report aslinya menyarankan solusi berskala besar (migrasi ke framework,
pindah penuh ke HTTP-Only cookie). Dengan pendekatan yang lebih terukur,
ketiganya **berhasil diperbaiki tanpa mengubah arsitektur aplikasi**.

| # | Masalah | Tingkat | Status |
|---|---------|---------|--------|
| 10 | Frontend XSS Mitigation Incomplete | 🟢 Low | ✅ Selesai |
| 11 | OAuth Token URL Leak | 🟡 Medium | ✅ Selesai |
| 12 | Admin Role Exposure Through API | 🟢 Low | ✅ Selesai |

---

## #10 — Frontend XSS Mitigation Incomplete

### Masalah
Fungsi `esc()` hanya meng-escape 4 karakter (`&`, `<`, `>`, `"`). Apostrophe
(`'`), garis miring (`/`), dan backtick (`` ` ``) lolos begitu saja — cukup
untuk merusak atribut ber-quote tunggal dan membuka vektor XSS.

### Perbaikan
**File:** `frontend/resources/js/spa/app.js`

- `esc()` diperluas menjadi meng-escape: `& < > " ' / \`` (via `ESCAPE_MAP`).
- Karakter tak terlihat (zero-width space/joiner) dibuang agar tidak bisa
  dipakai mem-bypass validasi tampilan.
- Urutan escape tetap benar (`&` diproses lebih dulu) untuk mencegah
  double-encoding.

### Kode setelah perbaikan
```js
const ESCAPE_MAP = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
    "'": '&#x27;', '/': '&#x2F;', '`': '&#96;',
};

const esc = (value) => {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/[&<>"'/`]/g, (char) => ESCAPE_MAP[char])
        .replace(/[\u200B-\u200D\uFEFF]/g, '');
};
```

---

## #11 — OAuth Token URL Leak

### Masalah
Token Sanctum mentah dikirim lewat fragment URL (`/#oauth_token=...`) saat
callback social login. Fragment berisiko bocor ke history browser, log server,
header Referer, dan analytics pihak ketiga.

### Perbaikan
**Pendekatan:** kode otorisasi sekali-pakai jangka pendek (token tetap
`Bearer`, tidak migrasi ke cookie — menghindari perubahan besar pada
CORS/CSRF/Sanctum stateful).

**Backend:**
- **File baru** `backend/app/Services/Auth/OAuthCodeStore.php`
  - Menerbitkan kode acak 64 karakter, berlaku 60 detik (`Cache::put`).
  - `consume()` memakai `Cache::pull` → kode otomatis hangus setelah satu kali
    dipakai (aman dari pemakaian ganda/paralel).
- `SocialAuthController`
  - `tokenRedirect()` → diganti `codeRedirect()`: redirect membawa
    `/#oauth_code=<kode>`, **bukan** token.
  - **Method baru** `completeLogin()`: menukar kode valid menjadi token
    Sanctum, dipanggil via POST.
- `routes/api.php`
  - **Route baru** `POST /api/oauth/token/complete` (throttle:login).

**Frontend:**
- `mountApp()` menjadi `async`, dan `captureOAuthResult()`:
  - Membaca `oauth_code` dari fragment, langsung membersihkan URL.
  - Menukar kode via `fetch POST /api/oauth/token/complete`.
  - Menyimpan token hasil tukar ke `state` + `localStorage`.

### Alur baru
```
Browser → Provider OAuth → Callback (kode di #oauth_code)
   → SPA bersihkan URL → POST /api/oauth/token/complete {code}
   → Backend terbitkan token → SPA simpan token
```

### Test
- `test_oauth_code_can_be_exchanged_for_token`
- `test_oauth_code_is_single_use` (pemakaian kedua → 403)
- `test_oauth_code_exchange_rejects_invalid_code` (kode palsu → 403)

---

## #12 — Admin Role Exposure Through API

### Masalah
Field `role` ("admin"/"user") diekspos di semua response user. Informasi ini
memudahkan attacker melakukan reconnaissance dan merencanakan privilege
escalation.

### Perbaikan
**Pendekatan:** sembunyikan `role` mentah, ganti dengan flag boolean
`is_admin` (dipakai frontend untuk menampilkan menu admin).

**Backend:**
- **File baru** `backend/app/Http/Resources/UserResource.php`
  - Mengembalikan `id`, `name`, `email`, `auth_provider`, `is_admin`,
    `created_at` — **tanpa** `role`, `password`, `remember_token`.
- `ApiController`
  - `me()` dan `tokenResponse()` memakai `UserResource`.
- `AdminController`
  - Query `by_user` & `recent` dibatasi ke kolom aman (`id, name, email`)
    dengan komentar eksplisit agar `role` tidak ikut terekspos.

**Frontend:** `frontend/resources/js/spa/app.js`
- Deteksi menu admin diubah dari `state.user?.role === 'admin'`
  → `state.user?.is_admin` (3 lokasi).

### Test
- `test_user_resource_hides_raw_role_and_exposes_is_admin_flag`
- `test_regular_user_resource_reports_not_admin`
- `test_me_endpoint_does_not_leak_role`
- `test_login_response_does_not_leak_role`

---

## 📁 Daftar File yang Diubah

| Status | File |
|--------|------|
| Diubah | `backend/app/Http/Controllers/ApiController.php` |
| Diubah | `backend/app/Http/Controllers/AdminController.php` |
| Diubah | `backend/app/Http/Controllers/Controller/Auth/SocialAuthController.php` |
| Diubah | `backend/routes/api.php` |
| Diubah | `frontend/resources/js/spa/app.js` |
| Diubah | `backend/tests/Feature/SocialAuthSecurityTest.php` |
| **Baru** | `backend/app/Http/Resources/UserResource.php` |
| **Baru** | `backend/app/Services/Auth/OAuthCodeStore.php` |
| **Baru** | `backend/tests/Feature/UserRoleExposureTest.php` |

---

## ✅ Hasil Verifikasi

- `php -l` pada semua file PHP yang diubah → **No syntax errors**.
- `node --check frontend/resources/js/spa/app.js` → **JS OK**.
- `php artisan test` → **31 passed (122 assertions)**, 0 gagal.
- `git push origin main` → `92d9074..8b6b7f6  main -> main` (sukses).

---

## 📝 Catatan

- Dua assertion lama di `SocialAuthSecurityTest` diperbarui dari
  `#oauth_token=` menjadi `#oauth_code=` karena memang bagian dari perbaikan #11.
- Report asli #10 & #12 menyarankan solusi besar (migrasi framework /
  pemisahan API layer internal). Solusi yang diterapkan di sini lebih ringan
  namun tetap menutup celah keamanan yang dilaporkan.
- Untuk #11, migrasi penuh ke HTTP-Only cookie tetap opsi ideal jangka panjang
  bila arsitektur auth ingin dirombak.
