<p align="center"><img src="https://raw.githubusercontent.com/laravel/art/master/logo-lockup/5%20SVG/2%20CMYK/1%20Full%20Color/laravel-logolockup-cmyk-red.svg" width="400" alt="Laravel Logo"></p>

## Tentang RencanaKU

RencanaKU adalah platform yang mengubah ide/prompt kasar user menjadi PRD (Product Requirement Document) terstruktur, lengkap dengan deteksi ambiguitas dan kontradiksi requirement.

### Tech Stack

- Laravel 12
- MySQL
- Eloquent ORM

### Struktur Database

- `users` — Data pengguna
- `projects` — Proyek PRD
- `prd_versions` — Riwayat versi PRD
- `ambiguity_flags` — Deteksi ambiguitas requirement
- `contradiction_flags` — Deteksi kontradiksi requirement

### Setup

```bash
# Clone & install
composer install

# Copy env & generate key
cp .env.example .env
php artisan key:generate

# Setup database (MySQL) lalu jalankan
php artisan migrate

# Jalankan server
php artisan serve
```

### Anggota Kelompok

| Nama | Peran |
|------|-------|
| Abyan Bergas Irmawan | Frontend |
| Maulana Yudo Yudistira | Frontend |
| Rafi Pandya Prabowo | Backend |
| Fahryan Amadis | Frontend |
| Agusta Rossi Lasangra | Backend |