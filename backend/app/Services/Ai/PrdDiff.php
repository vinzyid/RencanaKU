<?php

namespace App\Services\Ai;

/**
 * PrdDiff: menghitung perbedaan antar dua versi PRD untuk ditampilkan
 * sebagai highlight warna (hijau = ditambah, merah = dihapus,
 * kuning = diubah) di panel PRD, bukan teks diff mentah.
 */
class PrdDiff
{
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

        return $sections;
    }

    private function label(string $field): string
    {
        return ucwords(str_replace('_', ' ', $field));
    }
}
