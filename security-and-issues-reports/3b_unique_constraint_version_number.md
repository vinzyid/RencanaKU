# Perbaikan Masalah #3 (Lanjutan): Unique Constraint `(project_id, version_number)`

> **Status**: 🟠 Medium-High Priority
> **Kategori**: Arsitektur & Data Consistency
> **Ditulis**: 2025-09-25
> **Terkait**: commit `b770d62` (perbaikan #1-#4)

---

## 📋 Ringkasan

Commit `b770d62` sudah menambahkan **DB transaction + `lockForUpdate()` + retry** pada
`newVersion()`. Itu bagian utama dari Solusi A di
[`3_race_condition_version_number.md`](3_race_condition_version_number.md) dan sudah berjalan.

Namun satu item dari checklist laporan **belum dikerjakan**:

> ### Add Unique Index Constraint
> ```php
> $table->unique(['project_id', 'version_number'], 'project_version_number_unique');
> ```

Saat ini kolom `version_number` di tabel `prd_versions` **tidak punya unique constraint**
(`backend/database/migrations/2026_09_04_101326_02_create_prd_versions_table.php`).

### Kenapa ini penting?

`lockForUpdate()` hanya efektif bila:

1. **Semua** jalur penulisan nomor versi melewati lock yang sama, dan
2. Semua request dijalankan pada koneksi/transaksi yang benar.

Tanpa unique constraint di level database:

- Jika ada satu saja jalur insert (mis. seeder, command artisan, admin tool, atau bug di masa depan)
  yang **tidak** ikut mengambil lock, dua baris dengan nomor versi sama bisa tersimpan.
- Database **tidak akan menolak** duplikat → data rusak secara diam-diam (silent corruption).
- Bug seperti itu sulit dilacak karena tidak ada error, hanya tampilan versi yang aneh.

Unique constraint berfungsi sebagai **jaring pengaman terakhir**: kalau logika aplikasi lolos,
database tetap menolak duplikat dan transaksinya ter-rollback.

---

## ✅ Cara Verifikasi Kondisi Saat Ini (Opsional)

Tambahkan test sementara berikut untuk membuktikan constraint belum ada:

```php
// tests/Feature/VerifyIssue3ConstraintTest.php
<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class VerifyIssue3ConstraintTest extends TestCase
{
    use RefreshDatabase;

    public function test_version_number_has_unique_index(): void
    {
        $indexes = collect(Schema::getIndexes('prd_versions'));

        $hasUnique = $indexes->contains(function ($idx) {
            return ($idx['unique'] ?? false)
                && in_array('project_id', $idx['columns'], true)
                && in_array('version_number', $idx['columns'], true);
        });

        $this->assertTrue($hasUnique, 'Composite unique index belum ada.');
    }
}
```

Jalankan `php artisan test --filter=VerifyIssue3ConstraintTest`.
Sebelum perbaikan: **FAIL**. Setelah perbaikan: **PASS**.

---

## 🛠️ Cara Memperbaiki

### Langkah 1: Buat file migrasi baru

**Jangan** mengubah migrasi lama (`2026_09_04_101326_02_...`), karena di database yang sudah
berjalan migrasi itu sudah dieksekusi. Buat migrasi **baru** agar perubahan diterapkan sebagai
ALTER TABLE.

Buat file `backend/database/migrations/2026_09_25_000001_add_unique_version_number_to_prd_versions_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Jaring pengaman level database untuk race condition penomoran versi PRD
     * (Masalah #3): dua baris tidak boleh punya (project_id, version_number) sama.
     */
    public function up(): void
    {
        Schema::table('prd_versions', function (Blueprint $table) {
            $table->unique(
                ['project_id', 'version_number'],
                'project_version_number_unique'
            );
        });
    }

    public function down(): void
    {
        Schema::table('prd_versions', function (Blueprint $table) {
            $table->dropUnique('project_version_number_unique');
        });
    }
};
```

Catatan: nama index (`project_version_number_unique`) harus **persis sama** di `up()` dan `down()`
supaya rollback bekerja.

### Langkah 2: Cek data lama untuk duplikat (WAJIB sebelum migrate)

Kalau sudah ada data produksi, migrasi akan **gagal** bila ada duplikat lama. Cek dulu dengan SQL
berikut (contoh PostgreSQL):

```sql
SELECT project_id, version_number, COUNT(*)
FROM prd_versions
GROUP BY project_id, version_number
HAVING COUNT(*) > 1;
```

- **Tidak ada baris** → aman, lanjut ke Langkah 3.
- **Ada baris** → perbaiki dulu duplikatnya (nomor ulang atau hapus yang tidak terpakai) sebelum
  menjalankan migrasi.

Untuk SQLite (development), query yang sama juga berlaku.

### Langkah 3: Jalankan migrasi

```bash
cd backend
php artisan migrate
```

Output yang diharapkan:

```
INFO  Running migrations.
2026_09_25_000001_add_unique_version_number_to_prd_versions_table ........ DONE
```

### Langkah 4: Verifikasi

Jalankan test verifikasi di atas (harus PASS), atau cek index langsung:

```bash
php artisan tinker
>>> collect(Illuminate\Support\Facades\Schema::getIndexes('prd_versions'))
...     ->filter(fn($i) => $i['unique'] ?? false)
...     ->pluck('columns');
```

---

## 🧪 Uji Perilaku Setelah Perbaikan

Setelah constraint terpasang, coba insert duplikat secara paksa dan pastikan ditolak:

```bash
cd backend
php artisan tinker
```

```php
$user = App\Models\User::first();
$p = App\Models\Project::create(['user_id' => $user->id, 'title' => 'Test Dup']);

$p->prdVersions()->create([
    'version_number' => 1,
    'content' => ['title' => 'v1'],
    'status' => 'draft',
    'ai_provider' => 'local',
]);

// Ini HARUS melempar UniqueConstraintViolationException:
$p->prdVersions()->create([
    'version_number' => 1, // duplikat
    'content' => ['title' => 'v1 dup'],
    'status' => 'draft',
    'ai_provider' => 'local',
]);
```

Jika muncul error unique constraint → perbaikan berhasil.

---

## ⚠️ Dampak ke Kode Aplikasi

Alur normal **tidak perlu diubah**: `newVersion()` sudah memakai
`DB::transaction` + `lockForUpdate()` sehingga nomor selalu unik dan constraint tidak akan
pernah terlanggar. Constraint hanya menangkap kondisi yang tidak diharapkan.

Jika karena suatu hal constraint sampai terlanggar, Laravel akan melempar
`Illuminate\Database\UniqueConstraintViolationException` dan transaksi ter-rollback — ini
perilaku yang diinginkan (lebih baik gagal daripada menyimpan data rusak).

---

## 📌 Ringkas Checklist

- [ ] Buat migrasi baru `add_unique_version_number_to_prd_versions_table`
- [ ] Cek duplikat data lama (query di Langkah 2)
- [ ] Jalankan `php artisan migrate`
- [ ] Verifikasi index ada (test / tinker)
- [ ] Uji insert duplikat ditolak
- [ ] (Opsional) commit + push migrasi

---

## 🔗 Referensi

- Laporan asli: [`3_race_condition_version_number.md`](3_race_condition_version_number.md) — bagian "Add Unique Index Constraint"
- [Laravel Migrations — Unique Index](https://laravel.com/docs/12.x/migrations#creating-indexes)
- [Laravel Validation — Unique Constraint Violation](https://laravel.com/docs/12.x/database#database-transactions)
