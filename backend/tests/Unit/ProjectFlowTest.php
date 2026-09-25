<?php

namespace Tests\Unit;

use App\Services\ProjectFlow;
use PHPUnit\Framework\TestCase;

/**
 * Masalah #5: Contradiction Resolution Regex Bug.
 * Memastikan interpretResolution menangkap pilihan pengguna secara akurat
 * dan tidak salah interpretasi kalimat umum atau kata yang mengandung huruf 'a' / 'b'.
 */
class ProjectFlowTest extends TestCase
{
    private ProjectFlow $flow;

    protected function setUp(): void
    {
        parent::setUp();
        $this->flow = new ProjectFlow();
    }

    public function test_interpret_explicit_choice_a(): void
    {
        $this->assertEquals('kept_a', $this->flow->interpretResolution('pilih A'));
        $this->assertEquals('kept_a', $this->flow->interpretResolution('pakai A'));
        $this->assertEquals('kept_a', $this->flow->interpretResolution('pake a'));
        $this->assertEquals('kept_a', $this->flow->interpretResolution('gunakan opsi A'));
        $this->assertEquals('kept_a', $this->flow->interpretResolution('pertahankan A'));
        $this->assertEquals('kept_a', $this->flow->interpretResolution('keep A'));
        $this->assertEquals('kept_a', $this->flow->interpretResolution('A'));
        $this->assertEquals('kept_a', $this->flow->interpretResolution('a'));
        $this->assertEquals('kept_a', $this->flow->interpretResolution('opsi A'));
        $this->assertEquals('kept_a', $this->flow->interpretResolution('pilihan A'));
    }

    public function test_interpret_explicit_choice_b(): void
    {
        $this->assertEquals('kept_b', $this->flow->interpretResolution('pilih B'));
        $this->assertEquals('kept_b', $this->flow->interpretResolution('pakai B'));
        $this->assertEquals('kept_b', $this->flow->interpretResolution('pake b'));
        $this->assertEquals('kept_b', $this->flow->interpretResolution('gunakan opsi B'));
        $this->assertEquals('kept_b', $this->flow->interpretResolution('pertahankan B'));
        $this->assertEquals('kept_b', $this->flow->interpretResolution('keep B'));
        $this->assertEquals('kept_b', $this->flow->interpretResolution('B'));
        $this->assertEquals('kept_b', $this->flow->interpretResolution('b'));
        $this->assertEquals('kept_b', $this->flow->interpretResolution('opsi B'));
        $this->assertEquals('kept_b', $this->flow->interpretResolution('pilihan B'));
    }

    public function test_interpret_revision_intent(): void
    {
        $this->assertEquals('revised', $this->flow->interpretResolution('saya revisi manual'));
        $this->assertEquals('revised', $this->flow->interpretResolution('ubah kedua requirement'));
        $this->assertEquals('revised', $this->flow->interpretResolution('ganti spesifikasi ini'));
        $this->assertEquals('revised', $this->flow->interpretResolution('tolong edit requirement ini'));
        $this->assertEquals('revised', $this->flow->interpretResolution('modify requirement'));
    }

    public function test_interpret_english_sentence_with_letter(): void
    {
        // Kalimat bahasa Inggris biasa yang memuat kata sandang "a" atau kata yang berhuruf a/b
        // TIDAK boleh dianggap memilih opsi A atau B!
        $this->assertEquals('unknown', $this->flow->interpretResolution('I want a faster system'));
        $this->assertEquals('unknown', $this->flow->interpretResolution('This is beautiful'));
        $this->assertEquals('unknown', $this->flow->interpretResolution('Need a new solution for caching'));
    }

    public function test_ambiguous_response_when_both_mentioned(): void
    {
        // Menyebutkan kedua opsi dalam kalimat pemilihan menghasilkan status ambiguous
        $this->assertEquals('ambiguous', $this->flow->interpretResolution('pilih A dan juga B bagus'));
        $this->assertEquals('ambiguous', $this->flow->interpretResolution('pakai A atau B'));
        $this->assertEquals('ambiguous', $this->flow->interpretResolution('pilih B daripada A'));
    }

    public function test_empty_or_whitespace_input(): void
    {
        $this->assertEquals('unknown', $this->flow->interpretResolution(''));
        $this->assertEquals('unknown', $this->flow->interpretResolution('   '));
    }
}
