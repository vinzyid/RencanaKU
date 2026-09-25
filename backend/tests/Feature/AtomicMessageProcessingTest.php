<?php

namespace Tests\Feature;

use App\Models\PrdVersion;
use App\Models\Project;
use App\Models\User;
use App\Services\Ai\PrdGenerator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Tests\TestCase;

/**
 * Masalah #7: processUserMessage harus atomik. Bila langkah AI gagal,
 * pesan user yang sudah dibuat tidak boleh tertinggal di database.
 */
class AtomicMessageProcessingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // Pakai local engine deterministik agar test tidak memanggil API luar.
        config()->set('rencanaku.providers', [
            ['name' => 'local', 'driver' => 'local', 'endpoint' => null, 'key' => null, 'model' => 'deterministic'],
        ]);
    }

    public function test_initial_message_persists_message_and_version_together(): void
    {
        $user = User::factory()->create();
        $project = Project::create(['user_id' => $user->id, 'title' => 'Proyek Baru']);

        $response = $this->actingAs($user, 'sanctum')->postJson("/api/projects/{$project->id}/messages", [
            'content' => 'Saya mau aplikasi kasir warung yang cepat dan mudah.',
        ]);

        $response->assertStatus(202);

        // Pesan user + balasan AI tersimpan, satu versi PRD terbentuk.
        $this->assertSame(2, $project->messages()->count());
        $this->assertSame(1, $project->prdVersions()->count());
        $this->assertSame('user', $project->messages()->orderBy('id')->first()->sender);
    }

    public function test_failed_ai_step_rolls_back_user_message(): void
    {
        $user = User::factory()->create();
        $project = Project::create(['user_id' => $user->id, 'title' => 'Proyek Baru']);

        $generator = Mockery::mock(PrdGenerator::class);
        $generator->shouldReceive('setContext')->andReturnSelf();
        $generator->shouldReceive('generate')->andThrow(new \RuntimeException('AI service unavailable'));
        $this->app->instance(PrdGenerator::class, $generator);

        $response = $this->actingAs($user, 'sanctum')->postJson("/api/projects/{$project->id}/messages", [
            'content' => 'Ide yang akan memicu kegagalan AI.',
        ]);

        $response->assertStatus(500);

        // Tidak ada state setengah jadi: pesan user ikut ter-rollback.
        $this->assertSame(0, $project->messages()->count());
        $this->assertSame(0, $project->prdVersions()->count());
    }

    public function test_second_message_creates_new_version_within_transaction(): void
    {
        $user = User::factory()->create();
        $project = Project::create(['user_id' => $user->id, 'title' => 'Proyek Baru']);

        $this->actingAs($user, 'sanctum')->postJson("/api/projects/{$project->id}/messages", [
            'content' => 'Aplikasi kasir warung.',
        ])->assertStatus(202);

        // Jawab pertanyaan klarifikasi (bila ada) agar sampai ke revisi bebas.
        $this->actingAs($user, 'sanctum')->postJson("/api/projects/{$project->id}/messages", [
            'content' => 'Cukup cepat, untuk saya sendiri, sangat simpel.',
        ])->assertStatus(202);

        $this->assertSame(2, $project->prdVersions()->count());
        $this->assertSame(2, (int) PrdVersion::max('version_number'));
    }
}
