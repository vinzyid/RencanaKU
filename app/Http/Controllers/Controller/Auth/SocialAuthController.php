<?php

namespace App\Http\Controllers\Controller\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Laravel\Socialite\Contracts\User as SocialiteUser;
use Laravel\Socialite\Facades\Socialite;

class SocialAuthController extends Controller
{
    /**
     * Redirect back to the SPA auth page with a Sanctum token so the
     * token-based client can persist it and enter the workspace.
     */
    private function tokenRedirect(User $user): \Illuminate\Http\RedirectResponse
    {
        $token = $user->createToken('spa')->plainTextToken;

        return redirect('/#oauth_token=' . urlencode($token));
    }

    /**
     * Resolve (or create) the local user for a social login. This is the
     * "auto-register" policy: an unknown social account is registered on the
     * fly, so the same button works for both first-timers and returning users.
     *
     * Lookup order:
     *   1. Match on (auth_provider, provider_id) — the same social account.
     *   2. Fall back to email — links a social login to an existing manual account.
     */
    private function resolveUser(string $provider, SocialiteUser $socialUser, string $email, ?string $name): User
    {
        // 1) Exact social identity for this provider.
        $user = User::where('auth_provider', $provider)
            ->where('provider_id', $socialUser->getId())
            ->first();

        // 2) Otherwise link to an existing account with the same email so we
        //    don't end up with duplicate accounts.
        if (! $user) {
            $user = User::where('email', $email)->first();
        }

        if ($user) {
            // Keep the account linked to its social identity.
            $user->forceFill([
                'auth_provider' => $provider,
                'provider_id' => $socialUser->getId(),
            ])->save();

            return $user;
        }

        return User::create([
            'name' => $name ?: Str::before($email, '@'),
            'email' => $email,
            // Social accounts have no usable password. Use an unguessable
            // random value so password login stays impossible until the user
            // explicitly sets one.
            'password' => Hash::make(Str::random(64)),
            'auth_provider' => $provider,
            'provider_id' => $socialUser->getId(),
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

            return $this->tokenRedirect($user);
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

            return $this->tokenRedirect($user);
        } catch (\Throwable $e) {
            Log::error('GitHub OAuth failed: ' . $e->getMessage(), ['exception' => $e]);

            return redirect('/?oauth_error=' . urlencode('GitHub authentication failed. Please try again.'));
        }
    }
}
