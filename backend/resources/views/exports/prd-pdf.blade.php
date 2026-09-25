<!doctype html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>{{ $content['title'] ?? 'RencanaKU PRD' }}</title>
    <style>
        * { font-family: DejaVu Sans, Arial, sans-serif; }
        body { color: #1c241e; font-size: 12px; line-height: 1.6; margin: 32px; }
        h1 { font-size: 22px; margin: 0 0 4px; }
        .meta { color: #667a6b; font-size: 11px; margin-bottom: 22px; }
        h2 { font-size: 14px; text-transform: uppercase; letter-spacing: .08em; color: #6d8a63; border-bottom: 1px solid #dfe7dd; padding-bottom: 6px; margin: 22px 0 10px; }
        ul { padding-left: 18px; margin: 0; }
        li { margin-bottom: 4px; }
        p { margin: 0; }
        .footer { margin-top: 36px; color: #9aa79b; font-size: 10px; border-top: 1px solid #e5ebe3; padding-top: 10px; }
    </style>
</head>
<body>
    <h1>{{ $content['title'] ?? $project->title }}</h1>
    <div class="meta">RencanaKU · Product Requirement Document · Digenerate dari ide pengguna</div>

    @php
        $labels = [
            'background' => 'Latar Belakang',
            'objectives' => 'Tujuan',
            'target_users' => 'Target User',
            'user_stories' => 'User Story',
            'functional_requirements' => 'Requirement Fungsional',
            'acceptance_criteria' => 'Kriteria Selesai (Acceptance Criteria)',
            'non_functional_requirements' => 'Requirement Non-Fungsional',
            'business_rules' => 'Aturan & Logika Bisnis',
            'mvp_scope' => 'Lingkup MVP',
            'later_scope' => 'Ditunda (Versi Berikutnya)',
            'data_entities' => 'Data yang Disimpan',
            'constraints' => 'Batasan',
            'edge_cases' => 'Kondisi Khusus (Edge Case)',
            'open_questions' => 'Pertanyaan Terbuka',
        ];
    @endphp

    @foreach ($labels as $key => $label)
        @php $value = $content[$key] ?? null; @endphp
        @if (! empty($value))
            <h2>{{ $label }}</h2>
            @if (is_array($value))
                <ul>
                    @foreach ($value as $item)
                        <li>{{ $item }}</li>
                    @endforeach
                </ul>
            @else
                <p>{{ $value }}</p>
            @endif
        @endif
    @endforeach

    <div class="footer">Dokumen ini dihasilkan otomatis oleh RencanaKU — platform prompt-to-PRD dengan deteksi ambiguitas &amp; kontradiksi.</div>
</body>
</html>
