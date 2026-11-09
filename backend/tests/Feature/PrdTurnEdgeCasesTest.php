<?php

namespace Tests\Feature;

use App\Models\AmbiguityFlag;
use App\Models\ContradictionFlag;
use App\Models\PrdVersion;
use App\Models\Project;
use App\Models\User;
use App\Services\Ai\PrdGenerator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Tests\TestCase;

/**
 * Kasus tepi alur chat PRD setelah pemisahan AI dari transaksi DB dan
 * klarifikasi satu pertanyaan per giliran.
 */
class PrdTurnEdgeCasesTest extends TestCase
{
    use RefreshDatabase;

    private function prd(string $title = 'Aplikasi Kasir'): array
    {
        return ['title' => $title, 'background' => 'Kasir warung.', 'functional_requirements' => ['Input transaksi']];
    }

    private function mockGenerator(array $ambiguityCalls, array $contradictionCalls, ?callable $onRevise = null): Mockery\MockInterface
    {
        $generator = Mockery::mock(PrdGenerator::class);
        $generator->shouldReceive('setContext')->andReturnSelf();
        $generator->shouldReceive('provider')->andReturn('mock');
        $generator->shouldReceive('generate')->andReturn($this->prd());
        $generator->shouldReceive('revise')->andReturnUsing(function () use ($onRevise) {
            if ($onRevise) {
                $onRevise();
            }

            return $this->prd();
        });
        $generator->shouldReceive('detectAmbiguities')->andReturn(...($ambiguityCalls ?: [[]]));
        $generator->shouldReceive('detectContradictions')->andReturn(...($contradictionCalls ?: [[]]));
        $this->app->instance(PrdGenerator::class, $generator);

        return $generator;
    }

    private function send(User $user, Project $project, string $content): void
    {
        $this->actingAs($user, 'sanctum')
            ->postJson("/api/projects/{$project->id}/messages", ['content' => $content])
            ->assertStatus(202);
    }

    private function lastAiMessage(Project $project): string
    {
        return $project->messages()->where('sender', 'ai')->latest('id')->value('content');
    }

    public function test_question_limit_assumes_the_rest_openly(): void
    {
        $questions = collect(range(1, 7))
            ->map(fn ($i) => ['key' => "q{$i}", 'question' => "Pertanyaan nomor {$i}?", 'options' => []])
            ->all();
        $this->mockGenerator([$questions, [], [], [], [], [], [], []], [[]]);

        $user = User::factory()->create();
        $project = Project::create(['user_id' => $user->id, 'title' => 'Proyek Baru']);

        $this->send($user, $project, 'Ide aplikasi.');
        foreach (range(1, 5) as $i) {
            $this->send($user, $project, "Jawaban {$i}");
        }

        $message = $this->lastAiMessage($project);
        $this->assertStringContainsString('asumsi wajar', $message);
        $this->assertStringContainsString('Pertanyaan nomor 6?', $message);
        $this->assertStringContainsString('Pertanyaan nomor 7?', $message);
        $this->assertSame(0, AmbiguityFlag::where('is_resolved', false)->count());
        $this->assertSame(5, AmbiguityFlag::where('resolution_answer', 'like', 'Jawaban %')->count());
    }

    public function test_second_contradiction_is_carried_over_not_lost(): void
    {
        $contradictions = [
            ['code' => 'c_price', 'requirement_a' => 'Gratis', 'requirement_b' => 'Berbayar', 'explanation' => 'Model harga bertentangan.'],
            ['code' => 'c_sync', 'requirement_a' => 'Offline', 'requirement_b' => 'Real-time', 'explanation' => 'Mode data bertentangan.'],
        ];
        $this->mockGenerator([[]], [$contradictions, [], [], []]);

        $user = User::factory()->create();
        $project = Project::create(['user_id' => $user->id, 'title' => 'Proyek Baru']);

        $this->send($user, $project, 'Aplikasi gratis tapi berbayar, offline tapi real-time.');

        // Ide tanpa pertanyaan tetapi ada kontradiksi: kontradiksi langsung ditampilkan.
        $first = $project->messages()->where('sender', 'ai')->latest('id')->first();
        $this->assertStringContainsString('A) Gratis', $first->content);
        $this->assertSame(['Pakai A', 'Pakai B', 'Saya revisi manual'], $first->quick_replies);

        $this->send($user, $project, 'Pakai A');

        $latest = $project->prdVersions()->latest('version_number')->first();
        $this->assertSame(['c_sync'], $latest->contradictionFlags()->whereNull('resolution')->pluck('code')->all());
        $this->assertStringContainsString('A) Offline', $this->lastAiMessage($project));
        $this->assertSame('kept_a', ContradictionFlag::where('code', 'c_price')->value('resolution'));
    }

    public function test_turn_is_replanned_when_project_changes_during_ai_call(): void
    {
        $user = User::factory()->create();
        $project = Project::create(['user_id' => $user->id, 'title' => 'Proyek Baru']);

        $calls = 0;
        $generator = $this->mockGenerator([[], [], []], [[], [], []], function () use (&$calls, $project) {
            // Panggilan revise pertama: seolah pesan lain selesai lebih dulu.
            if (++$calls === 1) {
                PrdVersion::create([
                    'project_id' => $project->id,
                    'version_number' => 2,
                    'content' => ['title' => 'Dari pesan lain'],
                    'status' => 'draft',
                    'ai_provider' => 'mock',
                ]);
            }
        });

        $this->send($user, $project, 'Ide awal.');        // v1
        $this->send($user, $project, 'Tolong revisi.');   // revise dipanggil 2x, hasil jadi v3

        $this->assertSame(2, $calls, 'Giliran harus diproses ulang dari state terbaru.');
        $this->assertSame([1, 2, 3], $project->prdVersions()->orderBy('version_number')->pluck('version_number')->all());
        $this->assertSame(2, $project->messages()->where('sender', 'user')->count(), 'Pesan user tidak boleh tersimpan ganda.');
    }
}
