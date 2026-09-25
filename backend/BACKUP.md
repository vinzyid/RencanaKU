# Panduan Backup & Restore Database

Database: PostgreSQL (Supabase). Backup berisi **seluruh struktur tabel + isi data** semua schema.

## Backup manual

```powershell
php backup-db.php
```

Hasil disimpan di `storage/backups/backup_db_YYYYmmdd_HHMMSS.sql`.
Folder ini tidak di-commit ke git (ada di `.gitignore`).

## Restore (saat data hilang / rusak)

```powershell
php restore-db.php storage/backups/backup_db_20260919_133050.sql
```

Script akan membuat ulang semua tabel dan mengisi datanya kembali.

## Backup otomatis (Windows Task Scheduler)

1. Buka **Task Scheduler** > **Create Basic Task**.
2. Name: `Backup DB Proyek Web`.
3. Trigger: **Daily**, pilih jam (misal 23:00).
4. Action: **Start a program** > pilih `backup-db.bat` yang ada di folder proyek.
5. Finish.

Batch file akan menjalankan backup tiap hari dan menghapus otomatis backup yang lebih tua dari 30 hari.

## Tips tambahan

- Jalankan `php backup-db.php` manual **sebelum** demo/presentasi atau sebelum mengubah database.
- Simpan salinan file backup ke **Google Drive / cloud** secara berkala agar aman jika laptop rusak.
- Struktur tabel juga bisa dibangun ulang dari migrations (tanpa data): `php artisan migrate`.
