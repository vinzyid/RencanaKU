<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Menyiapkan akun admin utama agar BISA masuk lewat dua jalur:
 *   - Google (OAuth) — tetap berfungsi karena auth_provider/provider_id tidak diubah.
 *   - Email + kata sandi manual.
 *
 * Akun yang lahir dari OAuth dibuat dengan kata sandi acak tak terpakai
 * (Hash::make(Str::random(64))) dan password_set_at NULL, sehingga login manual
 * selalu gagal. Seeder ini mengisi kata sandi yang benar + menandai
 * password_set_at sehingga login manual aktif, tanpa menghapus tautan Google.
 */
class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        $email = 'cuiriostexa@gmail.com';
        $password = 'Curious12345678';

        $user = User::firstOrNew(['email' => $email]);

        $user->name = $user->name ?: 'Admin RencanaKU';
        $user->role = User::ROLE_ADMIN;

        // Kolom 'password' di-cast 'hashed' -> nilai teks biasa otomatis di-hash.
        $user->password = $password;
        $user->password_set_at = now();
        $user->save();

        $this->command?->info("Admin {$email} siap: login manual (kata sandi) + Google keduanya aktif.");
    }
}
