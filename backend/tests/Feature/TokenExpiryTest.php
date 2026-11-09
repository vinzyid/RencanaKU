<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Auth\OAuthCodeStore;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\PersonalAccessToken;
use Tests\TestCase;

/**
 * Masa berlaku sesi login + "Ingat saya".
 *
 * - Menutup browser tidak logout (token tetap di localStorage, diuji di frontend).
 * - "Ingat saya" dicentang  -> token berlaku rencanaku.auth.remember_minutes.
 * - "Ingat saya" tidak dicentang -> token berlaku rencanaku.auth.session_minutes.
 * - Token lama tanpa expires_at dibatasi sanctum.expiration (tidak abadi).
 */
class TokenExpiryTest extends TestCase
{
    use RefreshDatabase;

    private function latestTokenFor(User $user): PersonalAccessToken
    {
        return $user->tokens()->latest('id')->firstOrFail();
    }

    private function assertExpiresInMinutes(PersonalAccessToken $token, int $minutes): void
    {
        $this->assertNotNull($token->expires_at);
        $this->assertEqualsWithDelta(
            now()->addMinutes($minutes)->getTimestamp(),
            $token->expires_at->getTimestamp(),
            60,
        );
    }

    public function test_login_without_remember_issues_short_lived_token(): void
    {
        $user = User::factory()->create();

        $this->postJson('/api/login', ['email' => $user->email, 'password' => 'password'])
            ->assertOk()
            ->assertJsonStructure(['token', 'user']);

        $this->assertExpiresInMinutes($this->latestTokenFor($user), config('rencanaku.auth.session_minutes'));
    }

    public function test_login_with_remember_issues_long_lived_token(): void
    {
        $user = User::factory()->create();

        $this->postJson('/api/login', ['email' => $user->email, 'password' => 'password', 'remember' => true])
            ->assertOk();

        $this->assertExpiresInMinutes($this->latestTokenFor($user), config('rencanaku.auth.remember_minutes'));
    }

    public function test_register_respects_remember_choice(): void
    {
        $this->postJson('/api/register', [
            'name' => 'Pengguna Baru',
            'email' => 'baru@rencanaku.test',
            'password' => 'rahasia-aman-123',
            'remember' => true,
        ])->assertCreated();

        $user = User::where('email', 'baru@rencanaku.test')->firstOrFail();

        $this->assertExpiresInMinutes($this->latestTokenFor($user), config('rencanaku.auth.remember_minutes'));
        $this->assertArrayNotHasKey('remember', $user->getAttributes());
    }

    public function test_oauth_completion_respects_remember_choice(): void
    {
        $user = User::factory()->create(['auth_provider' => 'google', 'provider_id' => 'g-123']);
        $code = app(OAuthCodeStore::class)->issue($user);

        $this->postJson('/api/oauth/token/complete', ['code' => $code, 'remember' => true])
            ->assertOk()
            ->assertJsonStructure(['token', 'user']);

        $this->assertExpiresInMinutes($this->latestTokenFor($user), config('rencanaku.auth.remember_minutes'));
    }

    public function test_valid_token_still_works(): void
    {
        $user = User::factory()->create();
        $token = $user->issueSpaToken(false);

        $this->withToken($token)->getJson('/api/me')->assertOk();
    }

    public function test_expired_token_is_rejected(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('spa', ['*'], now()->subMinute())->plainTextToken;

        $this->withToken($token)->getJson('/api/me')->assertUnauthorized();
    }

    public function test_legacy_token_without_expiry_is_capped_by_global_expiration(): void
    {
        $user = User::factory()->create();

        $old = $user->createToken('spa');
        $old->accessToken->forceFill([
            'created_at' => now()->subMinutes(config('sanctum.expiration') + 60),
        ])->save();

        $this->withToken($old->plainTextToken)->getJson('/api/me')->assertUnauthorized();
    }

    public function test_recent_legacy_token_without_expiry_still_works(): void
    {
        $user = User::factory()->create();

        $recent = $user->createToken('spa');
        $recent->accessToken->forceFill(['created_at' => now()->subDays(3)])->save();

        $this->withToken($recent->plainTextToken)->getJson('/api/me')->assertOk();
    }

    public function test_issuing_a_token_prunes_only_this_users_expired_tokens(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();

        $user->createToken('spa', ['*'], now()->subDay());
        $other->createToken('spa', ['*'], now()->subDay());

        $user->issueSpaToken(true);

        $this->assertSame(1, $user->tokens()->count());
        $this->assertSame(1, $other->tokens()->count());
    }
}
