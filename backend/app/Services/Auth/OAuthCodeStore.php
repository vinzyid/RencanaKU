<?php

namespace App\Services\Auth;

use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

/**
 * Penyimpan kode otorisasi sekali-pakai untuk callback OAuth (Masalah #11).
 *
 * Sebelumnya token Sanctum mentah dikirim ke browser lewat fragment URL
 * (`/#oauth_token=...`), yang berisiko bocor ke history browser, log server,
 * header Referer, dan analytics pihak ketiga.
 *
 * Mekanisme baru: callback hanya membawa "kode" acak berumur sangat pendek.
 * Kode ini kemudian ditukar dengan token asli lewat endpoint API biasa
 * (request POST), sehingga token tidak pernah muncul di URL maupun history.
 *
 * Kode bersifat sekali-pakai (diambil lalu dihapus atomik) dan terikat pada
 * user yang bersangkutan.
 */
class OAuthCodeStore
{
    /** Masa berlaku kode (detik) — sengaja sangat singkat. */
    private const TTL_SECONDS = 60;

    private const PREFIX = 'oauth_code:';

    /**
     * Terbitkan kode sekali-pakai untuk user, kembalikan string kodenya.
     */
    public function issue(User $user): string
    {
        // Kode acak kriptografis 64 karakter.
        $code = Str::random(64);

        Cache::put(self::PREFIX.$code, $user->id, self::TTL_SECONDS);

        return $code;
    }

    /**
     * Ambil lalu hapus (sekali-pakai) kode, kembalikan user terkait atau null.
     *
     * Menggunakan Cache::pull agar kode otomatis hilang setelah dibaca,
     * sehingga tidak bisa dipakai dua kali meski request datang bersamaan.
     */
    public function consume(string $code): ?User
    {
        if ($code === '') {
            return null;
        }

        $userId = Cache::pull(self::PREFIX.$code);

        if (! $userId) {
            return null;
        }

        return User::find($userId);
    }
}
