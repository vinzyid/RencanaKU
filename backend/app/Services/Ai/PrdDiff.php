<?php

namespace App\Services\Ai;

use App\Models\VersionDiff;
use Illuminate\Support\Facades\Log;

/**
 * PrdDiff: menghitung perbedaan antar dua versi PRD untuk ditampilkan
 * sebagai highlight warna (hijau = ditambah, merah = dihapus,
 * kuning = diubah) di panel PRD, bukan teks diff mentah.
 */
class PrdDiff
{
    /** Versi algoritma; naikkan bila rumus compare() berubah agar cache lama diabaikan. */
    private const ALGORITHM_VERSION = 'v1';

    /** Ambang (detik) pencatatan log bila komputasi diff terasa lambat. */
    private const SLOW_THRESHOLD_SECONDS = 0.1;

    private const LIST_FIELDS = [
        'objectives',
        'target_users',
        'functional_requirements',
        'non_functional_requirements',
        'constraints',
        'open_questions',
    ];

    private const TEXT_FIELDS = ['title', 'background'];

    /**
     * @return array<int, array{field:string, label:string, type:string, before:mixed, after:mixed, added:array, removed:array, changed:bool}>
     */
    public function compare(array $before, array $after): array
    {
        $start = microtime(true);

        $sections = [];

        foreach (self::TEXT_FIELDS as $field) {
            $old = (string) ($before[$field] ?? '');
            $new = (string) ($after[$field] ?? '');
            if ($old !== $new) {
                $sections[] = [
                    'field' => $field,
                    'label' => $this->label($field),
                    'type' => $old === '' ? 'added' : ($new === '' ? 'removed' : 'changed'),
                    'before' => $old,
                    'after' => $new,
                    'added' => [],
                    'removed' => [],
                    'changed' => true,
                ];
            }
        }

        foreach (self::LIST_FIELDS as $field) {
            $old = array_values((array) ($before[$field] ?? []));
            $new = array_values((array) ($after[$field] ?? []));

            $added = array_values(array_diff($new, $old));
            $removed = array_values(array_diff($old, $new));

            if ($added || $removed) {
                $sections[] = [
                    'field' => $field,
                    'label' => $this->label($field),
                    'type' => $added && ! $removed ? 'added' : (! $added && $removed ? 'removed' : 'changed'),
                    'before' => $old,
                    'after' => $new,
                    'added' => $added,
                    'removed' => $removed,
                    'changed' => true,
                ];
            }
        }

        $duration = microtime(true) - $start;
        if ($duration > self::SLOW_THRESHOLD_SECONDS) {
            Log::warning('[PrdDiff.Slow]', [
                'duration_ms' => round($duration * 1000, 2),
                'before_size' => strlen(json_encode($before)),
                'after_size' => strlen(json_encode($after)),
            ]);
        }

        return $sections;
    }

    /**
     * Sama seperti compare(), tetapi hasilnya disimpan ke tabel version_diffs
     * sehingga diff antar sepasang versi hanya dihitung sekali (Masalah #8).
     * Bila algoritma berubah, algorithm_version berbeda membuat cache lama
     * otomatis tidak dipakai.
     *
     * @return array<int, array<string, mixed>>
     */
    public function compareWithCache(array $before, array $after, int $fromVersionId, int $toVersionId): array
    {
        $cached = VersionDiff::query()
            ->where('from_version_id', $fromVersionId)
            ->where('to_version_id', $toVersionId)
            ->where('algorithm_version', self::ALGORITHM_VERSION)
            ->first();

        if ($cached) {
            return (array) $cached->diff_data;
        }

        $diff = $this->compare($before, $after);

        try {
            VersionDiff::updateOrCreate(
                [
                    'from_version_id' => $fromVersionId,
                    'to_version_id' => $toVersionId,
                    'algorithm_version' => self::ALGORITHM_VERSION,
                ],
                ['diff_data' => $diff],
            );
        } catch (\Throwable $e) {
            // Kegagalan menyimpan cache tidak boleh menggagalkan respons;
            // diff yang sudah dihitung tetap dikembalikan.
            Log::warning('[PrdDiff] gagal menyimpan cache diff: '.$e->getMessage());
        }

        return $diff;
    }

    /**
     * Buang cache diff yang menyangkut sebuah versi. Dipakai saat versi
     * dihapus/diubah kontennya; pada alur normal setiap versi baru selalu
     * menambah pasangan baru sehingga cache lama tetap valid.
     */
    public static function invalidateForVersion(int $versionId): void
    {
        VersionDiff::query()
            ->where('from_version_id', $versionId)
            ->orWhere('to_version_id', $versionId)
            ->delete();
    }

    private function label(string $field): string
    {
        return ucwords(str_replace('_', ' ', $field));
    }
}
