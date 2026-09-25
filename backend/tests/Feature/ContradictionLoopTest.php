<?php

namespace Tests\Feature;

use App\Models\ContradictionFlag;
use App\Models\Project;
use App\Models\User;
use App\Services\Ai\PrdGenerator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Verifikasi perbaikan bug loop kontradiksi:
 * - false positive ("tidak ada kontradiksi, hanya tantangan") disaring
 * - kode stabil membuat revisi kecil tidak dianggap kontradiksi baru
 * - batas putaran menghentikan interogasi kontradiksi
 */
class ContradictionLoopTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config()->set('rencanaku.providers', [
            ['name' => 'local', 'driver' => 'local', 'endpoint' => null, 'key' => null, 'model' => 'deterministic'],
        ]);
    }

    public function test_false_positive_contradiction_is_filtered(): void
    {
        $gen = app(PrdGenerator::class);
        $ref = new \ReflectionMethod($gen, 'normalizeContradictions');
        $ref->setAccessible(true);

        $result = $ref->invoke($gen, [
            [
                'requirement_a' => 'Data bisa otomatis dari database',
                'requirement_b' => 'Data manual via editor konten',
                'explanation' => 'Tidak ada kontradiksi, hanya tantangan implementasi.',
            ],
        ]);

        $this->assertSame([], $result, 'Penjelasan yang menyangkal kontradiksi harus dibuang');
    }

    public function test_stable_code_ignores_small_text_changes(): void
    {
        $gen = app(PrdGenerator::class);
        $ref = new \ReflectionMethod($gen, 'normalizeContradictions');
        $ref->setAccessible(true);

        $a = $ref->invoke($gen, [[
            'requirement_a' => 'Konten harus dua bahasa',
            'requirement_b' => 'Pengembangan 4 minggu',
            'explanation' => 'Dua hal ini sulit dipenuhi bersamaan.',
        ]]);
        $b = $ref->invoke($gen, [[
            'requirement_a' => 'Konten harus dua bahasa (opsi B)',
            'requirement_b' => 'Pengembangan harus selesai dalam 4 minggu',
            'explanation' => 'Dua hal ini sulit dipenuhi bersamaan.',
        ]]);

        $this->assertNotEmpty($a);
        $this->assertNotEmpty($b);
        $this->assertSame($a[0]['code'], $b[0]['code'], 'Revisi kecil tidak boleh mengubah kode kontradiksi');
    }

    public function test_contradiction_flow_stops_at_max_rounds(): void
    {
        $user = User::factory()->create();
        $project = Project::create(['user_id' => $user->id, 'title' => 'Proyek Baru']);
        $this->actingAs($user, 'sanctum');

        // Ide yang memicu beberapa kontradiksi (gratis vs berlangganan, offline vs realtime).
        $this->postJson("/api/projects/{$project->id}/messages", [
            'content' => 'Aplikasi gratis tanpa login, berlangganan premium, offline, dan real-time dari server.',
        ])->assertStatus(202);

        // Jawab berulang "Pakai A"; alur harus berhenti sendiri, bukan loop tanpa henti.
        $guard = 0;
        do {
            $latest = $project->prdVersions()->latest('version_number')->first();
            $pending = $latest?->contradictionFlags()->whereNull('resolution')->count() ?? 0;
            if ($pending === 0) {
                break;
            }

            $this->postJson("/api/projects/{$project->id}/messages", ['content' => 'Pakai A'])->assertStatus(202);
            $guard++;
        } while ($guard < 10);

        $this->assertLessThan(10, $guard, 'Alur kontradiksi harus berhenti sendiri, bukan loop tanpa henti');

        // Versi terbaru harus bersih dari kontradiksi menggantung agar bisa difinalisasi.
        $latest = $project->prdVersions()->latest('version_number')->first();
        $pendingOnLatest = $latest->contradictionFlags()->whereNull('resolution')->count();
        $this->assertSame(0, $pendingOnLatest, 'Versi terbaru tidak boleh punya kontradiksi menggantung');
    }
}
