<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Menandai kapan sebuah akun pertama kali memiliki kata sandi yang benar-benar
     * dipakai user.
     *
     * Akun OAuth (Google/GitHub) dibuat dengan password acak 64 karakter yang
     * tidak diketahui siapa pun, sehingga kolom ini NULL sampai user mengeset
     * sendiri kata sandinya (lewat "Lupa Kata Sandi" atau halaman Pengaturan).
     * Akun manual (register) langsung memiliki kata sandi yang terpakai.
     */
    public function up(): void
    {
        if (! Schema::hasColumn('users', 'password_set_at')) {
            Schema::table('users', function (Blueprint $table) {
                $table->timestamp('password_set_at')->nullable();
            });
        }

        // Backfill: akun yang mendaftar manual (auth_provider NULL) sudah
        // memakai kata sandi -> anggap sudah diset sejak akun dibuat.
        DB::table('users')
            ->whereNull('auth_provider')
            ->whereNull('password_set_at')
            ->update(['password_set_at' => DB::raw('created_at')]);
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('password_set_at');
        });
    }
};
