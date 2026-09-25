<?php

namespace Tests\Unit;

use App\Services\Ai\LocalPrdEngine;
use PHPUnit\Framework\TestCase;

/**
 * Regresi: ketika provider AI gagal dan revisi jatuh ke engine lokal,
 * PRD yang sudah ada TIDAK boleh hancur / diganti template generic.
 */
class LocalReviseTest extends TestCase
{
    private LocalPrdEngine $engine;

    protected function setUp(): void
    {
        parent::setUp();
        $this->engine = new LocalPrdEngine();
    }

    public function test_revise_preserves_existing_prd(): void
    {
        $prd = [
            'title' => 'Web Portofolio Pribadi',
            'background' => 'Portofolio untuk mencari kerja.',
            'objectives' => ['Menampilkan pengalaman'],
            'target_users' => ['Pencari kerja'],
            'functional_requirements' => ['Unduh CV PDF'],
            'non_functional_requirements' => ['Muat < 3 detik'],
            'constraints' => ['Hanya pemilik yang bisa mengubah'],
            'open_questions' => [],
            'source_prompt' => 'web portofolio',
        ];

        $prompt = "[MODE:revise]\n[PROMPT:Pakai A]\n[PRD:".json_encode($prd)."]";

        $result = $this->engine->respond($prompt);

        // Judul & isi asli harus dipertahankan, bukan diganti template generic.
        $this->assertSame('Web Portofolio Pribadi', $result['title']);
        $this->assertSame('Portofolio untuk mencari kerja.', $result['background']);
        $this->assertContains('Unduh CV PDF', $result['functional_requirements']);
        $this->assertContains('Hanya pemilik yang bisa mengubah', $result['constraints']);
    }

    public function test_revise_records_instruction_without_destroying_doc(): void
    {
        $prd = [
            'title' => 'Aplikasi Kasir',
            'background' => 'Kasir warung.',
            'objectives' => [],
            'target_users' => [],
            'functional_requirements' => [],
            'non_functional_requirements' => [],
            'constraints' => [],
            'open_questions' => [],
        ];

        $prompt = "[MODE:revise]\n[PROMPT:Tambahkan fitur laporan bulanan]\n[PRD:".json_encode($prd)."]";
        $result = $this->engine->respond($prompt);

        $this->assertSame('Aplikasi Kasir', $result['title']);
        $joined = implode(' ', $result['open_questions']);
        $this->assertStringContainsString('laporan bulanan', $joined);
    }
}
