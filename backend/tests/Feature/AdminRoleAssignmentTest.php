<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Password;
use Tests\TestCase;

/**
 * Role admin hanya boleh diberikan setelah kepemilikan email terbukti.
 *
 * Celah sebelumnya: pendaftaran manual langsung memberi role admin bila email
 * ada di ADMIN_EMAILS, tanpa verifikasi. Siapa pun yang tahu email admin yang
 * belum terdaftar bisa mendaftar duluan dan menjadi admin.
 */
class AdminRoleAssignmentTest extends TestCase
{
    use RefreshDatabase;

    private const ADMIN_EMAIL = 'boss@rencanaku.test';

    protected function setUp(): void
    {
        parent::setUp();

        config(['rencanaku.admin_emails' => [self::ADMIN_EMAIL]]);
    }

    private function resetPasswordFor(User $user): void
    {
        $token = Password::broker()->createToken($user);

        $this->postJson('/api/reset-password', [
            'token' => $token,
            'email' => $user->email,
            'password' => 'kata-sandi-baru-123',
            'password_confirmation' => 'kata-sandi-baru-123',
        ])->assertOk();
    }

    public function test_registering_with_an_admin_email_does_not_grant_admin(): void
    {
        $response = $this->postJson('/api/register', [
            'name' => 'Penyerang',
            'email' => self::ADMIN_EMAIL,
            'password' => 'rahasia-penyerang',
        ])->assertCreated();

        $this->assertFalse($response->json('user.is_admin'));

        $user = User::where('email', self::ADMIN_EMAIL)->firstOrFail();
        $this->assertSame(User::ROLE_USER, $user->role);
        $this->assertNull($user->email_verified_at);

        $this->withToken($response->json('token'))
            ->getJson('/api/admin/stats')
            ->assertForbidden();
    }

    public function test_password_reset_proves_email_ownership_and_grants_admin(): void
    {
        $user = User::factory()->create([
            'email' => self::ADMIN_EMAIL,
            'role' => User::ROLE_USER,
            'email_verified_at' => null,
        ]);

        $this->resetPasswordFor($user);

        $user->refresh();
        $this->assertSame(User::ROLE_ADMIN, $user->role);
        $this->assertNotNull($user->email_verified_at);
    }

    public function test_password_reset_keeps_regular_users_as_users(): void
    {
        $user = User::factory()->create(['role' => User::ROLE_USER]);

        $this->resetPasswordFor($user);

        $this->assertSame(User::ROLE_USER, $user->refresh()->role);
    }

    public function test_password_reset_does_not_demote_existing_admins(): void
    {
        $admin = User::factory()->create([
            'email' => 'admin-lama@rencanaku.test',
            'role' => User::ROLE_ADMIN,
        ]);

        $this->resetPasswordFor($admin);

        $this->assertSame(User::ROLE_ADMIN, $admin->refresh()->role);
    }
}
