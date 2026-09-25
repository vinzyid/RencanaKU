<?php

namespace Database\Seeders;

use App\Models\Project;
use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::updateOrCreate(
            ['email' => 'admin@rencanaku.test'],
            ['name' => 'Admin RencanaKU', 'password' => 'admin12345']
        );

        $projects = [
            [
                'title' => 'Kasir Warung Digital',
                'prompt' => 'Aplikasi kasir untuk warung yang mencatat transaksi dan stok dengan cepat dan mudah.',
                'stage_note' => 'Butuh target waktu respons konkret untuk transaksi.',
            ],
            [
                'title' => 'Portal Kegiatan Mahasiswa',
                'prompt' => 'Platform untuk mengelola jadwal, pendaftaran, dan dokumentasi kegiatan mahasiswa.',
                'stage_note' => 'Perlu diperjelas siapa saja peran pengguna (admin, panitia, mahasiswa).',
            ],
            [
                'title' => 'Dashboard Keuangan Pribadi',
                'prompt' => 'Aplikasi untuk mencatat pemasukan, pengeluaran, target tabungan, dan laporan bulanan.',
                'stage_note' => 'Metrik laporan bulanan masih perlu dirinci.',
            ],
        ];

        foreach ($projects as $index => $data) {
            $project = Project::firstOrCreate(
                ['user_id' => $admin->id, 'title' => $data['title']]
            );

            if ($project->messages()->exists()) {
                continue;
            }

            $project->messages()->create(['sender' => 'user', 'content' => $data['prompt']]);

            $content = [
                'title' => $data['title'],
                'background' => 'Dokumen demo untuk pengujian alur RencanaKU.',
                'objectives' => ['Menguji alur stepper + chat.', 'Menampilkan dokumen PRD yang mudah dibaca.'],
                'target_users' => ['Pengguna aplikasi.'],
                'functional_requirements' => ['Pengguna dapat mengelola data utama.', 'Sistem menampilkan ringkasan aktivitas.'],
                'non_functional_requirements' => ['Antarmuka responsif.', 'Data terlindungi berdasarkan kepemilikan akun.'],
                'constraints' => ['Data ini digunakan untuk testing dashboard.'],
                'open_questions' => [],
                'source_prompt' => $data['prompt'],
            ];

            $version = $project->prdVersions()->create([
                'version_number' => 1,
                'status' => 'draft',
                'ai_provider' => 'demo-seed',
                'content' => $content,
            ]);

            $version->ambiguityFlags()->create([
                'code' => 'demo_'.$index,
                'question' => $data['stage_note'],
                'is_resolved' => false,
            ]);

            $project->messages()->create([
                'sender' => 'ai',
                'content' => "Draft PRD v1 sudah saya susun. Sebelum lanjut, ada satu hal yang perlu diperjelas:\n\n".$data['stage_note'],
                'related_prd_version_id' => $version->id,
            ]);
        }
    }
}
