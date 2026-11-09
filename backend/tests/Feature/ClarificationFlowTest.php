<?php

namespace Tests\Feature;

use App\Models\AmbiguityFlag;
use App\Models\Project;
use App\Models\User;
use App\Services\Ai\PrdGenerator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Tests\TestCase;

/**
 * Alur klarifikasi (Masalah #4, Solution A: satu pertanyaan per giliran).
 *
 * Bila AI menemukan beberapa ambiguitas sekaligus, tidak boleh ada pertanyaan
 * yang hilang diam-diam: setiap pertanyaan harus ditanyakan dan dijawab
 * (atau diasumsikan secara eksplisit saat batas putaran tercapai).
 */
class ClarificationFlowTest extends TestCase
{
    use RefreshDatabase;

    private function prd(): array
    {
        return [
            'title' => 'Aplikasi Kasir',
            'background' => 'Kasir warung.',
            'objectives' => ['Mencatat transaksi'],
            'functional_requirements' => ['Input transaksi'],
        ];
    }

    private function questions(): array
    {
        return [
            ['key' => 'q_speed', 'question' => 'Seberapa cepat respons aplikasi?', 'options' => ['< 1 detik', '< 3 detik']],
            ['key' => 'q_users', 'question' => 'Siapa target pengguna?', 'options' => ['Pemilik warung', 'Kasir']],
            ['key' => 'q_payment', 'question' => 'Metode pembayaran apa saja?', 'options' => ['Tunai', 'QRIS']],
        ];
    }

    /** Generator tiruan: ide awal memunculkan 3 pertanyaan, revisi berikutnya tidak memunculkan yang baru. */
    private function fakeGenerator(): void
    {
        $generator = Mockery::mock(PrdGenerator::class);
        $generator->shouldReceive('setContext')->andReturnSelf();
        $generator->shouldReceive('provider')->andReturn('mock');
        $generator->shouldReceive('generate')->andReturn($this->prd());
        $generator->shouldReceive('revise')->andReturn($this->prd());
        $generator->shouldReceive('detectAmbiguities')->andReturn($this->questions(), [], [], [], [], []);
        $generator->shouldReceive('detectContradictions')->andReturn([]);
        $this->app->instance(PrdGenerator::class, $generator);
    }

    private function send(User $user, Project $project, string $content): void
    {
        $this->actingAs($user, 'sanctum')
            ->postJson("/api/projects/{$project->id}/messages", ['content' => $content])
            ->assertStatus(202);
    }

    private function pendingOnLatest(Project $project): array
    {
        return $project->prdVersions()->latest('version_number')->first()
            ->ambiguityFlags()->where('is_resolved', false)->pluck('code')->all();
    }

    public function test_remaining_questions_are_not_silently_dropped_after_first_answer(): void
    {
        $this->fakeGenerator();
        $user = User::factory()->create();
        $project = Project::create(['user_id' => $user->id, 'title' => 'Proyek Baru']);

        $this->send($user, $project, 'Aplikasi kasir untuk warung saya.');
        $this->send($user, $project, '< 1 detik');

        // Dua pertanyaan lain masih harus menunggu jawaban di versi terbaru.
        $this->assertEqualsCanonicalizing(['q_users', 'q_payment'], $this->pendingOnLatest($project));
        $this->assertSame('clarification', $this->getJson("/api/projects/{$project->id}")->json('stage'));
    }

    public function test_ai_asks_one_question_per_turn(): void
    {
        $this->fakeGenerator();
        $user = User::factory()->create();
        $project = Project::create(['user_id' => $user->id, 'title' => 'Proyek Baru']);

        $this->send($user, $project, 'Aplikasi kasir untuk warung saya.');

        $ai = $project->messages()->where('sender', 'ai')->latest('id')->first();
        $this->assertStringContainsString('Seberapa cepat respons aplikasi?', $ai->content);
        $this->assertStringNotContainsString('Siapa target pengguna?', $ai->content);
        $this->assertSame(['< 1 detik', '< 3 detik'], $ai->quick_replies);
    }

    public function test_every_question_gets_its_own_answer(): void
    {
        $this->fakeGenerator();
        $user = User::factory()->create();
        $project = Project::create(['user_id' => $user->id, 'title' => 'Proyek Baru']);

        $this->send($user, $project, 'Aplikasi kasir untuk warung saya.');
        $this->send($user, $project, '< 1 detik');
        $this->send($user, $project, 'Pemilik warung');
        $this->send($user, $project, 'Tunai dan QRIS');

        $answers = AmbiguityFlag::query()
            ->whereNotNull('resolution_answer')
            ->where('resolution_answer', '!=', 'Diasumsikan wajar oleh sistem.')
            ->pluck('resolution_answer', 'code')
            ->all();

        $this->assertSame('< 1 detik', $answers['q_speed'] ?? null);
        $this->assertSame('Pemilik warung', $answers['q_users'] ?? null);
        $this->assertSame('Tunai dan QRIS', $answers['q_payment'] ?? null);
        $this->assertSame([], $this->pendingOnLatest($project));
        $this->assertSame(0, AmbiguityFlag::where('is_resolved', false)->count(), 'Tidak boleh ada pertanyaan yatim di versi lama.');
    }
}
