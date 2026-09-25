<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\User;
use App\Models\VersionDiff;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Masalah #8: diff antar versi di-cache di tabel version_diffs sehingga
 * dihitung sekali saja, bukan berulang di tiap request.
 */
class VersionDiffCacheTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config()->set('rencanaku.providers', [
            ['name' => 'local', 'driver' => 'local', 'endpoint' => null, 'key' => null, 'model' => 'deterministic'],
        ]);
    }

    private function seedProjectWithVersions(User $user): Project
    {
        $project = Project::create(['user_id' => $user->id, 'title' => 'Proyek Baru']);

        $this->actingAs($user, 'sanctum')->postJson("/api/projects/{$project->id}/messages", [
            'content' => 'Aplikasi kasir warung.',
        ])->assertStatus(202);

        $this->actingAs($user, 'sanctum')->postJson("/api/projects/{$project->id}/messages", [
            'content' => 'Cukup cepat, untuk saya sendiri, sangat simpel.',
        ])->assertStatus(202);

        return $project->refresh();
    }

    public function test_versions_endpoint_persists_diff_cache(): void
    {
        $user = User::factory()->create();
        $project = $this->seedProjectWithVersions($user);

        $this->assertSame(2, $project->prdVersions()->count());
        $this->assertSame(0, VersionDiff::count());

        $response = $this->actingAs($user, 'sanctum')->getJson("/api/projects/{$project->id}/versions");
        $response->assertOk()->assertJsonStructure(['versions']);

        // Satu pasangan versi -> satu baris cache diff.
        $this->assertSame(1, VersionDiff::count());
    }

    public function test_second_request_reuses_cache_without_duplicating(): void
    {
        $user = User::factory()->create();
        $project = $this->seedProjectWithVersions($user);

        $this->actingAs($user, 'sanctum')->getJson("/api/projects/{$project->id}/versions")->assertOk();
        $this->actingAs($user, 'sanctum')->getJson("/api/projects/{$project->id}/versions")->assertOk();

        // Tetap satu baris walau endpoint dipanggil dua kali.
        $this->assertSame(1, VersionDiff::count());
    }
}
