<?php

namespace App\Http\Controllers\Controller\Auth;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\Auth\OAuthCodeStore;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Laravel\Socialite\Contracts\User as SocialiteUser;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Sanctum\PersonalAccessToken;

class SocialAuthController extends Controller
{
    public function __construct(
        private readonly OAuthCodeStore $codes,
    ) {}

    /**
     * Redirect back to the SPA with a short-lived, single-use authorization
     * code (Masalah #11) — NOT the raw Sanctum token.
     *
     * Token mentah dulu ditaruh di fragment URL sehingga bisa bocor lewat
     * history browser, log server, Referer, atau analytics. Kini yang
     * dikirim hanyalah kode acak berumur pendek; token asli baru dibuat saat
     * kode ditukar lewat request POST ke /api/oauth/token/complete.
     */
    private function codeRedirect(User $user): \Illuminate\Http\RedirectResponse
    {
        $code = $this->codes->issue($user);

        return redirect('/#oauth_code=' . urlencode($code));
    }

    /**
     * Tukar kode OAuth sekali-pakai dengan token Sanctum asli.
     *
     * Dipanggil oleh SPA lewat POST (bukan lewat URL), sehingga token tidak
     * pernah menyentuh address bar. Kode hangus setelah satu kali pakai.
     */
    public function completeLogin(Request $request)
    {
        $data = $request->validate([
            'code' => 'required|string|max:128',
        ]);

        $user = $this->codes->consume($data['code']);

        if (! $user) {
            return response()->json([
                'message' => 'Kode otentikasi tidak valid atau sudah kadaluarsa. Silakan coba masuk lagi.',
            ], 403);
        }

        // Token sengaja dibuat pada request POST ini, bukan saat redirect,
        // agar tidak pernah transit di URL.
        $token = $user->createToken('spa')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => UserResource::make($user),
        ]);
    }

    /**
     * Resolve (or create) the local user for a social login.
     *
     * Keamanan Akun (Masalah #6 - Anti Account Takeover):
     * 1. Match pada (auth_provider, provider_id) — identitas social yang sudah terverifikasi sebelumnya.
     * 2. Jika akun belum terhubung dengan provider_id ini, periksa apakah email sudah terdaftar:
     *    - Jika email sudah terdaftar secara manual (auth_provider null), tolak auto-link untuk mencegah
     *      account takeover oleh penyerang yang membuat akun pihak ketiga dengan email target.
     *    - Jika email sudah terdaftar dengan OAuth provider lain, tolak auto-link antar-provider.
     *    - Jika email sudah terdaftar dengan provider yang sama tapi provider_id berbeda, tolak.
     * 3. Jika email belum pernah terdaftar, buat akun baru yang aman.
     */
    private function resolveUser(string $provider, SocialiteUser $socialUser, string $email, ?string $name): User
    {
        // 1) Cek pencocokan identitas exact provider & provider_id
        $user = User::where('auth_provider', $provider)
            ->where('provider_id', $socialUser->getId())
            ->first();

        if ($user) {
            $user->forceFill([
                'role' => User::roleForEmail($user->email),
            ])->save();

            return $user;
        }

        // 2) Periksa apakah email sudah terdaftar di sistem
        $existing = User::where('email', $email)->first();

        if ($existing) {
            Log::warning('[SocialAuth] Percobaan login sosial ditolak untuk mencegah account takeover', [
                'attempted_provider' => $provider,
                'attempted_provider_id' => $socialUser->getId(),
                'email' => $email,
                'existing_user_id' => $existing->id,
                'existing_auth_provider' => $existing->auth_provider,
                'ip' => request()->ip(),
            ]);

            if (empty($existing->auth_provider)) {
                throw new \DomainException('Email ini sudah terdaftar dengan password. Silakan masuk menggunakan email dan password Anda.');
            }

            if ($existing->auth_provider !== $provider) {
                $providerName = ucfirst($existing->auth_provider);
                throw new \DomainException("Email ini sudah terdaftar menggunakan akun {$providerName}. Silakan masuk menggunakan metode tersebut.");
            }

            throw new \DomainException("Email ini sudah terhubung dengan akun {$provider} yang berbeda.");
        }

        // 3) Akun baru yang belum pernah terdaftar
        return User::create([
            'name' => $name ?: Str::before($email, '@'),
            'email' => $email,
            // Akun sosial tidak memiliki password usable
            'password' => Hash::make(Str::random(64)),
            'auth_provider' => $provider,
            'provider_id' => $socialUser->getId(),
            'role' => User::roleForEmail($email),
            'email_verified_at' => now(),
        ]);
    }

    /**
     * Redirect user to Google OAuth
     */
    public function redirectToGoogle()
    {
        return Socialite::driver('google')->redirect();
    }

    /**
     * Handle Google callback
     */
    public function handleGoogleCallback()
    {
        try {
            $googleUser = Socialite::driver('google')->user();
            $email = $googleUser->getEmail();

            if (! $email) {
                return redirect('/?oauth_error=' . urlencode('Akun Google tidak menyediakan email. Tidak bisa melanjutkan.'));
            }

            $user = $this->resolveUser('google', $googleUser, $email, $googleUser->getName());

            return $this->codeRedirect($user);
        } catch (\DomainException $e) {
            return redirect('/?oauth_error=' . urlencode($e->getMessage()));
        } catch (\Throwable $e) {
            Log::error('Google OAuth failed: ' . $e->getMessage(), ['exception' => $e]);

            return redirect('/?oauth_error=' . urlencode('Google authentication failed. Please try again.'));
        }
    }

    /**
     * Redirect user to GitHub OAuth
     */
    public function redirectToGithub()
    {
        return Socialite::driver('github')->redirect();
    }

    /**
     * Handle GitHub callback
     */
    public function handleGithubCallback()
    {
        try {
            $githubUser = Socialite::driver('github')->user();
            $email = $githubUser->getEmail();

            // GitHub user doesn't always have a public email, so we need to get it
            if (! $email) {
                return redirect('/?oauth_error=' . urlencode('Akun GitHub tidak memiliki email yang bisa diakses. Pastikan ada email terverifikasi lalu coba lagi.'));
            }

            $user = $this->resolveUser('github', $githubUser, $email, $githubUser->getName());

            return $this->codeRedirect($user);
        } catch (\DomainException $e) {
            return redirect('/?oauth_error=' . urlencode($e->getMessage()));
        } catch (\Throwable $e) {
            Log::error('GitHub OAuth failed: ' . $e->getMessage(), ['exception' => $e]);

            return redirect('/?oauth_error=' . urlencode('GitHub authentication failed. Please try again.'));
        }
    }
}
