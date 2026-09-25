<?php

namespace App\Jobs;

use App\Http\Controllers\ApiController;
use App\Models\Project;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;

/**
 * Memproses satu pesan user di belakang layar (Opsi 3 - queue).
 *
 * Sebelumnya pemrosesan (panggilan AI yang bisa 15-90 detik) dilakukan
 * langsung di dalam request HTTP, sehingga berisiko "Maximum execution
 * time exceeded". Dengan job ini, request HTTP hanya menyimpan pesan lalu
 * mengembalikan respons cepat; AI dikerjakan oleh worker tanpa batas waktu
 * request. Frontend memantau lewat kolom projects.prd_status.
 */
class ProcessProjectMessage implements ShouldQueue
{
    use Queueable;

    /** Jangan menyerah terlalu cepat saat provider AI lambat/bermasalah. */
    public int $tries = 1;

    /** Batas waktu job (detik) — cukup longgar untuk 3 panggilan AI. */
    public int $timeout = 300;

    public function __construct(
        public int $projectId,
        public string $content,
    ) {}

    public function handle(ApiController $controller): void
    {
        $project = Project::find($this->projectId);

        if (! $project) {
            return;
        }

        try {
            $controller->processUserMessage($project, $this->content);

            $project->forceFill([
                'prd_status' => 'idle',
                'prd_error' => null,
            ])->save();
        } catch (\Throwable $e) {
            Log::error('[ProcessProjectMessage] gagal memproses pesan', [
                'project_id' => $this->projectId,
                'error' => $e->getMessage(),
            ]);

            // Simpan pesan error agar UI bisa menampilkan kegagalan, bukan
            // menggantung selamanya di status "processing".
            $project->forceFill([
                'prd_status' => 'idle',
                'prd_error' => 'Gagal menyusun draft PRD. Silakan coba kirim ulang.',
            ])->save();

            throw $e;
        }
    }

    public function failed(\Throwable $e): void
    {
        // Jaring terakhir bila job mati di luar handle() (mis. timeout).
        Project::whereKey($this->projectId)->update([
            'prd_status' => 'idle',
            'prd_error' => 'Pemrosesan PRD terhenti. Silakan coba kirim ulang.',
        ]);
    }
}
