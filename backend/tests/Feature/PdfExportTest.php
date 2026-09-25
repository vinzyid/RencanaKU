<?php

namespace Tests\Feature;

use App\Models\PrdVersion;
use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Masalah #9: export PDF harus menghasilkan berkas PDF valid (magic number
 * %PDF-), bukan HTML yang disamarkan sebagai application/pdf.
 */
class PdfExportTest extends TestCase
{
    use RefreshDatabase;

    private function projectWithVersion(User $user): Project
    {
        $project = Project::create(['user_id' => $user->id, 'title' => 'Kasir Warung']);

        PrdVersion::create([
            'project_id' => $project->id,
            'version_number' => 1,
            'status' => 'draft',
            'ai_provider' => 'local',
            'content' => [
                'title' => 'Aplikasi Kasir Warung',
                'background' => 'Warung butuh pencatatan transaksi.',
                'objectives' => ['Mempercepat transaksi'],
                'target_users' => ['Pemilik warung'],
                'functional_requirements' => ['Catat transaksi'],
                'non_functional_requirements' => ['Respons < 3 detik'],
                'constraints' => ['Berhenti di PRD'],
                'open_questions' => ['Pembayaran?'],
                'source_prompt' => 'aplikasi kasir warung',
            ],
        ]);

        return $project;
    }

    public function test_pdf_export_returns_valid_pdf(): void
    {
        $user = User::factory()->create();
        $project = $this->projectWithVersion($user);

        $response = $this->actingAs($user, 'sanctum')
            ->get("/api/projects/{$project->id}/export/pdf");

        $response->assertOk();
        $this->assertStringContainsString('application/pdf', $response->headers->get('Content-Type'));

        // PDF asli selalu dimulai dengan magic number %PDF-.
        $this->assertStringStartsWith('%PDF-', $response->getContent());
    }
}
