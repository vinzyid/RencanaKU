<?php

namespace Tests\Feature;

use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Masalah #12: Admin Role Exposure Through API.
 * Memastikan field "role" mentah tidak pernah bocor ke response API,
 * sementara frontend tetap mendapat sinyal admin lewat flag "is_admin".
 */
class UserRoleExposureTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_resource_hides_raw_role_and_exposes_is_admin_flag(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);

        $payload = UserResource::make($admin)->resolve();

        $this->assertArrayNotHasKey('role', $payload);
        $this->assertArrayNotHasKey('password', $payload);
        $this->assertArrayNotHasKey('remember_token', $payload);
        $this->assertTrue($payload['is_admin']);
    }

    public function test_regular_user_resource_reports_not_admin(): void
    {
        $user = User::factory()->create(['role' => User::ROLE_USER]);

        $payload = UserResource::make($user)->resolve();

        $this->assertArrayNotHasKey('role', $payload);
        $this->assertFalse($payload['is_admin']);
    }

    public function test_me_endpoint_does_not_leak_role(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/me');

        $response->assertOk()
            ->assertJsonPath('user.is_admin', true)
            ->assertJsonMissingPath('user.role');

        $this->assertArrayNotHasKey('role', $response->json('user'));
    }

    public function test_login_response_does_not_leak_role(): void
    {
        $admin = User::factory()->create([
            'email' => 'admin@example.com',
            'role' => User::ROLE_ADMIN,
        ]);

        $response = $this->postJson('/api/login', [
            'email' => 'admin@example.com',
            'password' => 'password',
        ]);

        $response->assertOk()
            ->assertJsonPath('user.is_admin', true)
            ->assertJsonMissingPath('user.role');
    }
}
