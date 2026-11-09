<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\TokenUsage;
use App\Models\User;
use App\Services\Ai\PrdGenerator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Mockery;
use Tests\TestCase;

/**
 * Panggilan AI (bisa 15-90 detik per pesan) tidak boleh terjadi di dalam
 * transaksi database: transaksi akan menahan kunci baris & koneksi DB selama
 * AI bekerja, dan bila gagal, catatan pemakaian token ikut ter-rollback
 * padahal token di provider sudah terpakai.
 */
class AiProcessingTransactionTest extends TestCase
{
    use RefreshDatabase;

    private function prd(): array
    {
        return ['title' => 'Aplikasi Kasir', 'background' => 'Kasir warung.', 'functional_requirements' => ['Input transaksi']];
    }

    public function test_ai_calls_run_outside_database_transaction(): void
    {
        $levels = [];
        $record = function () use (&$levels) {
            $levels[] = DB::transactionLevel();
        };

        $generator = Mockery::mock(PrdGenerator::class);
        $generator->shouldReceive('setContext')->andReturnSelf();
        $generator->shouldReceive('provider')->andReturn('mock');
        $generator->shouldReceive('generate')->andReturnUsing(function () use ($record) { $record(); return $this->prd(); });
        $generator->shouldReceive('detectAmbiguities')->andReturnUsing(function () use ($record) { $record(); return []; });
        $generator->shouldReceive('detectContradictions')->andReturnUsing(function () use ($record) { $record(); return []; });
        $this->app->instance(PrdGenerator::class, $generator);

        $user = User::factory()->create();
        $project = Project::create(['user_id' => $user->id, 'title' => 'Proyek Baru']);

        $this->actingAs($user, 'sanctum')
            ->postJson("/api/projects/{$project->id}/messages", ['content' => 'Aplikasi kasir warung.'])
            ->assertStatus(202);

        // RefreshDatabase membungkus tiap test dalam 1 transaksi (level 1).
        $baseline = 1;
        $this->assertNotEmpty($levels);
        foreach ($levels as $level) {
            $this->assertSame($baseline, $level, 'Panggilan AI terjadi di dalam transaksi database.');
        }

        $this->assertSame(1, $project->prdVersions()->count());
        $this->assertSame(2, $project->messages()->count());
    }

    public function test_token_usage_is_kept_when_a_later_step_fails(): void
    {
        $user = User::factory()->create();
        $project = Project::create(['user_id' => $user->id, 'title' => 'Proyek Baru']);

        $generator = Mockery::mock(PrdGenerator::class);
        $generator->shouldReceive('setContext')->andReturnSelf();
        $generator->shouldReceive('provider')->andReturn('mock');
        $generator->shouldReceive('generate')->andReturnUsing(function () use ($user, $project) {
            // Meniru AiGateway::recordUsage: token di provider sudah terpakai.
            TokenUsage::create([
                'user_id' => $user->id, 'project_id' => $project->id, 'provider' => 'mock',
                'model' => 'm', 'mode' => 'generate', 'prompt_tokens' => 100,
                'completion_tokens' => 200, 'total_tokens' => 300,
            ]);

            return $this->prd();
        });
        $generator->shouldReceive('detectAmbiguities')->andThrow(new \RuntimeException('provider down'));
        $this->app->instance(PrdGenerator::class, $generator);

        $this->actingAs($user, 'sanctum')
            ->postJson("/api/projects/{$project->id}/messages", ['content' => 'Aplikasi kasir warung.']);

        $this->assertSame(1, TokenUsage::count(), 'Pemakaian token hilang dari catatan admin.');
        $this->assertSame(0, $project->prdVersions()->count(), 'Tidak boleh ada versi setengah jadi.');
    }
}
