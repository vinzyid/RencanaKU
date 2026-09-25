<?php

namespace App\Services;

use App\Models\PrdVersion;

/**
 * ProjectFlow: state machine & derivasi tahap (stepper) untuk sebuah proyek.
 *
 * Tahapan mengikuti PRD 5.5.1:
 *   input_idea -> clarification -> validation -> documentation -> export
 */
class ProjectFlow
{
    public const STAGES = ['input_idea', 'clarification', 'validation', 'documentation', 'export'];

    public function stage(?PrdVersion $version): string
    {
        if (! $version) {
            return 'input_idea';
        }

        if ($version->status === 'finalized') {
            return 'export';
        }

        if ($version->ambiguityFlags()->where('is_resolved', false)->exists()) {
            return 'clarification';
        }

        if ($version->contradictionFlags()->whereNull('resolution')->exists()) {
            return 'validation';
        }

        return 'documentation';
    }

    public function validationSummary(?PrdVersion $version): array
    {
        if (! $version) {
            return ['ambiguities' => 0, 'contradictions' => 0, 'can_finalize' => false];
        }

        $ambiguities = $version->ambiguityFlags()->where('is_resolved', false)->count();
        $contradictions = $version->contradictionFlags()->whereNull('resolution')->count();

        return [
            'ambiguities' => $ambiguities,
            'contradictions' => $contradictions,
            'can_finalize' => $version->status !== 'finalized' && $ambiguities === 0 && $contradictions === 0,
        ];
    }

    public function blockingIssues(PrdVersion $version): array
    {
        return [
            'ambiguities' => $version->ambiguityFlags()->where('is_resolved', false)->count(),
            'contradictions' => $version->contradictionFlags()->whereNull('resolution')->count(),
        ];
    }

    /**
     * Terjemahkan jawaban bebas user (chip "Pakai A"/"Pakai B"/teks bebas)
     * menjadi kode resolusi yang konsisten dengan skema DB.
     */
    public function interpretResolution(string $content): string
    {
        $normalized = mb_strtolower(trim($content));

        if ($normalized === '') {
            return 'unknown';
        }

        // 1. Pilihan langsung berdiri sendiri (misal "A", "B", "opsi a", "pilihan b")
        if (preg_match('/^(?:opsi|option|pilihan)?\s*a$/iu', $normalized)) {
            return 'kept_a';
        }

        if (preg_match('/^(?:opsi|option|pilihan)?\s*b$/iu', $normalized)) {
            return 'kept_b';
        }

        // 2. Deteksi kata kerja pemilihan eksplisit untuk opsi A atau B
        $selectsA = (bool) preg_match('/\b(?:pilih|pake|pakai|gunakan|pertahankan|keep|ambil)\s+(?:opsi\s+|option\s+|pilihan\s+)?a\b/iu', $normalized);
        $selectsB = (bool) preg_match('/\b(?:pilih|pake|pakai|gunakan|pertahankan|keep|ambil)\s+(?:opsi\s+|option\s+|pilihan\s+)?b\b/iu', $normalized);

        // Jika ambigu (menyebutkan kedua opsi dalam konteks pemilihan atau membandingkan keduanya)
        if (($selectsA && $selectsB) || ($selectsA && preg_match('/\bb\b/iu', $normalized)) || ($selectsB && preg_match('/\ba\b/iu', $normalized))) {
            return 'ambiguous';
        }

        if ($selectsA) {
            return 'kept_a';
        }

        if ($selectsB) {
            return 'kept_b';
        }

        // 3. Deteksi niat revisi eksplisit
        if (preg_match('/\b(?:revisi|ubah|ganti|edit|modify)\b/iu', $normalized)) {
            return 'revised';
        }

        // 4. Fallback default jika tidak ada indikasi pemilihan maupun revisi
        return 'unknown';
    }
}
