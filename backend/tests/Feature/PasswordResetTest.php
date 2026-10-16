<?php

namespace Tests\Feature;

use App\Models\User;
use App\Notifications\ResetPasswordNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Tests\TestCase;

/**
 * Fitur "Lupa Kata Sandi": kirim tautan reset, setel ulang dengan token, dan
 * ganti kata sandi dari halaman Pengaturan.
 */
class PasswordResetTest extends TestCase
{
    use RefreshDatabase;

    public function test_forgot_password_sends_reset_link_for_registered_email(): void
    {
        Notification::fake();

        $user = User::factory()->create(['email' => 'user@example.com']);

        $response = $this->postJson('/api/forgot-password', ['email' => 'user@example.com']);

        $response->assertOk();
        Notification::assertSentTo($user, ResetPasswordNotification::class);
    }

    public function test_forgot_password_does_not_reveal_unregistered_email(): void
    {
        Notification::fake();

        $response = $this->postJson('/api/forgot-password', ['email' => 'nobody@example.com']);

        // Respons tetap sukses & generik agar email tidak bisa di-enumerate.
        $response->assertOk();
        Notification::assertNothingSent();
    }

    public function test_reset_password_with_valid_token_updates_password_and_revokes_tokens(): void
    {
        $user = User::factory()->create(['email' => 'user@example.com']);
        $user->createToken('spa');

        $token = Password::broker()->createToken($user);

        $response = $this->postJson('/api/reset-password', [
            'token' => $token,
            'email' => 'user@example.com',
            'password' => 'newpassword123',
            'password_confirmation' => 'newpassword123',
        ]);

        $response->assertOk();

        $fresh = $user->fresh();
        $this->assertTrue(Hash::check('newpassword123', $fresh->password));
        $this->assertNotNull($fresh->password_set_at);
        $this->assertSame(0, $fresh->tokens()->count());
    }

    public function test_reset_password_rejects_invalid_token(): void
    {
        $user = User::factory()->create(['email' => 'user@example.com']);

        $response = $this->postJson('/api/reset-password', [
            'token' => 'token-palsu',
            'email' => 'user@example.com',
            'password' => 'newpassword123',
            'password_confirmation' => 'newpassword123',
        ]);

        $response->assertStatus(422);
        $this->assertFalse(Hash::check('newpassword123', $user->fresh()->password));
    }

    public function test_reset_password_requires_matching_confirmation(): void
    {
        $user = User::factory()->create(['email' => 'user@example.com']);
        $token = Password::broker()->createToken($user);

        $response = $this->postJson('/api/reset-password', [
            'token' => $token,
            'email' => 'user@example.com',
            'password' => 'newpassword123',
            'password_confirmation' => 'beda-password',
        ]);

        $response->assertStatus(422);
    }

    public function test_change_password_requires_current_password_for_local_account(): void
    {
        $user = User::factory()->create(['password' => 'oldpassword']);

        $this->actingAs($user, 'sanctum');

        $this->postJson('/api/password', [
            'password' => 'newpassword123',
            'password_confirmation' => 'newpassword123',
        ])->assertStatus(422);

        $this->postJson('/api/password', [
            'current_password' => 'salah',
            'password' => 'newpassword123',
            'password_confirmation' => 'newpassword123',
        ])->assertStatus(422);

        $this->postJson('/api/password', [
            'current_password' => 'oldpassword',
            'password' => 'newpassword123',
            'password_confirmation' => 'newpassword123',
        ])->assertOk();

        $this->assertTrue(Hash::check('newpassword123', $user->fresh()->password));
    }

    public function test_oauth_account_can_set_password_without_current_password(): void
    {
        // Akun OAuth: password acak tak terpakai -> password_set_at NULL.
        $user = User::factory()->create([
            'auth_provider' => 'google',
            'provider_id' => 'google-123',
        ]);

        $this->assertFalse($user->hasPassword());

        $this->actingAs($user, 'sanctum');

        $this->postJson('/api/password', [
            'password' => 'passwordbaru123',
            'password_confirmation' => 'passwordbaru123',
        ])->assertOk();

        $fresh = $user->fresh();
        $this->assertTrue($fresh->hasPassword());
        $this->assertTrue(Hash::check('passwordbaru123', $fresh->password));
    }
}
