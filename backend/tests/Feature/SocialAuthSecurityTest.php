<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Socialite\Contracts\User as SocialiteUser;
use Laravel\Socialite\Facades\Socialite;
use Mockery;
use Tests\TestCase;

/**
 * Masalah #6: Social Auth Account Takeover Risk.
 * Memastikan alur OAuth terlindungi dari pengambilalihan akun:
 * - Akun manual yang sudah terdaftar tidak boleh di-takeover oleh social auth.
 * - Akun dari provider yang berbeda tidak boleh di-takeover oleh provider lain.
 * - Login pengguna baru dan returning pengguna yang sah tetap berjalan normal.
 */
class SocialAuthSecurityTest extends TestCase
{
    use RefreshDatabase;

    private function mockSocialiteUser(string $provider, string $id, ?string $email, ?string $name = 'Social User'): void
    {
        $socialUser = Mockery::mock(SocialiteUser::class);
        $socialUser->shouldReceive('getId')->andReturn($id);
        $socialUser->shouldReceive('getEmail')->andReturn($email);
        $socialUser->shouldReceive('getName')->andReturn($name);

        $driver = Mockery::mock();
        $driver->shouldReceive('user')->andReturn($socialUser);

        Socialite::shouldReceive('driver')->with($provider)->andReturn($driver);
    }

    public function test_new_social_user_account_creation_succeeds(): void
    {
        $this->mockSocialiteUser('google', 'google_123456', 'newuser@example.com', 'New User');

        $response = $this->get('/oauth/google/callback');

        $response->assertRedirect();
        $this->assertStringContainsString('#oauth_token=', $response->headers->get('Location'));

        $this->assertDatabaseHas('users', [
            'email' => 'newuser@example.com',
            'auth_provider' => 'google',
            'provider_id' => 'google_123456',
        ]);
    }

    public function test_returning_social_user_can_login_without_duplication(): void
    {
        $user = User::factory()->create([
            'email' => 'existing@example.com',
            'auth_provider' => 'google',
            'provider_id' => 'google_999999',
        ]);

        $this->mockSocialiteUser('google', 'google_999999', 'existing@example.com', 'Existing User');

        $response = $this->get('/oauth/google/callback');

        $response->assertRedirect();
        $this->assertStringContainsString('#oauth_token=', $response->headers->get('Location'));

        $this->assertSame(1, User::where('email', 'existing@example.com')->count());
    }

    public function test_attempted_account_takeover_on_password_account_is_blocked(): void
    {
        // 1. Korban mendaftar secara manual dengan email dan password
        $victim = User::create([
            'name' => 'Victim User',
            'email' => 'victim@example.com',
            'password' => Hash::make('secret_password_123'),
            'auth_provider' => null,
            'provider_id' => null,
            'role' => 'user',
        ]);

        // 2. Penyerang mencoba login menggunakan akun Google dengan email korban yang sama
        $this->mockSocialiteUser('google', 'attacker_google_id_666', 'victim@example.com', 'Attacker');

        $response = $this->get('/oauth/google/callback');

        // Harus dialihkan ke error dan TIDAK menghasilkan token login
        $response->assertRedirect();
        $this->assertStringContainsString('oauth_error=', $response->headers->get('Location'));
        $this->assertStringNotContainsString('oauth_token=', $response->headers->get('Location'));

        // Akun korban tetap utuh: auth_provider tetap null, password tidak berubah
        $victim->refresh();
        $this->assertNull($victim->auth_provider);
        $this->assertNull($victim->provider_id);
        $this->assertTrue(Hash::check('secret_password_123', $victim->password));
    }

    public function test_cross_provider_account_takeover_is_blocked(): void
    {
        // Pengguna sah terdaftar lewat Google
        $user = User::create([
            'name' => 'Legit User',
            'email' => 'legit@example.com',
            'password' => Hash::make('unusable_random'),
            'auth_provider' => 'google',
            'provider_id' => 'google_legit_id',
            'role' => 'user',
        ]);

        // Penyerang mencoba login lewat GitHub dengan email yang sama
        $this->mockSocialiteUser('github', 'github_attacker_id', 'legit@example.com', 'Attacker GH');

        $response = $this->get('/oauth/github/callback');

        $response->assertRedirect();
        $this->assertStringContainsString('oauth_error=', $response->headers->get('Location'));
        $this->assertStringNotContainsString('oauth_token=', $response->headers->get('Location'));

        // Provider tetap Google, tidak di-overwrite menjadi github
        $user->refresh();
        $this->assertSame('google', $user->auth_provider);
        $this->assertSame('google_legit_id', $user->provider_id);
    }

    public function test_oauth_without_email_is_blocked(): void
    {
        $this->mockSocialiteUser('google', 'no_email_id', null, 'No Email User');

        $response = $this->get('/oauth/google/callback');

        $response->assertRedirect();
        $this->assertStringContainsString('oauth_error=', $response->headers->get('Location'));
        $this->assertDatabaseMissing('users', [
            'provider_id' => 'no_email_id',
        ]);
    }
}
