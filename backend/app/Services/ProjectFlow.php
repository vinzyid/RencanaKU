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

        if (preg_match('/\b(pakai|pilih|pake|gunakan|pertahankan)?\s*\ba\b/u', $normalized) && ! str_contains($normalized, 'revisi')) {
            return 'kept_a';
        }

        if (preg_match('/\b(pakai|pilih|pake|gunakan|pertahankan)?\s*\bb\b/u', $normalized) && ! str_contains($normalized, 'revisi')) {
            return 'kept_b';
        }

        return 'revised';
    }
}
